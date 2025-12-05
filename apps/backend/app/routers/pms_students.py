from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from sqlalchemy import select, func, case
import secrets
from datetime import datetime

from apps.backend.app.core import security

from apps.backend.app.pms.models import Student
from apps.backend.app.pms.models import Course, Enrollment, Attendance, Payment
from apps.backend.app.pms.schemas import StudentOut, StudentCreate, StudentUpdate, StudentListResponse, StudentStats
from apps.backend.app.pms.deps import get_tenant_id, get_db_session, get_current_student

router = APIRouter(prefix="/api/pms/students", tags=["pms-students"])

# Almacen simple en memoria para codigos de portal (en un entorno real usar DB + email)
_portal_codes: dict[tuple[str, int | None], dict[str, object]] = {}


@router.get("/", response_model=StudentListResponse)
async def list_students(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None, description="Filtro por nombre o email"),
    limit: int = Query(default=20, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    conditions = [Student.tenant_id == tenant_id]
    if q:
        like = f"%{q}%"
        conditions.append((Student.first_name.ilike(like)) | (Student.last_name.ilike(like)) | (Student.email.ilike(like)))

    stmt = select(Student).where(*conditions)
    res = await db.execute(
        stmt.order_by(Student.created_at.desc()).offset(offset).limit(limit)
    )
    items = res.scalars().all()

    total = await db.scalar(select(func.count()).select_from(Student).where(*conditions)) or 0

    lower_gender = func.lower(Student.gender)
    female_case = case((lower_gender.like('f%'), 1), (lower_gender.like('muj%'), 1), else_=0)
    male_case = case((lower_gender.like('m%'), 1), (lower_gender.like('hombre%'), 1), (lower_gender.like('masculino%'), 1), else_=0)
    week_cut = date.today() - timedelta(days=7)
    stats_stmt = select(
        func.sum(case((Student.is_active == True, 1), else_=0)).label('total_active'),
        func.sum(case((Student.is_active == False, 1), else_=0)).label('total_inactive'),
        func.sum(female_case).label('female'),
        func.sum(male_case).label('male'),
        func.sum(case(((Student.joined_at != None) & (Student.joined_at >= week_cut), 1), else_=0)).label('new_this_week'),
    ).where(*conditions)
    sres = await db.execute(stats_stmt)
    srow = sres.one()
    stats = StudentStats(
        total_active=int(srow.total_active or 0),
        total_inactive=int(srow.total_inactive or 0),
        female=int(srow.female or 0),
        male=int(srow.male or 0),
        new_this_week=int(srow.new_this_week or 0),
    )

    return {"items": items, "total": int(total), "stats": stats}


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(
        select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id)
    )
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return obj


@router.post("/", response_model=StudentOut, status_code=201)
async def create_student(
    payload: StudentCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = Student(tenant_id=tenant_id, **payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.put("/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: int,
    payload: StudentUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(
        select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id)
    )
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(
        select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id)
    )
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    await db.delete(obj)
    await db.commit()
    return None


@router.post("/{student_id}/photo")
async def upload_student_photo(
    student_id: int,
    file: UploadFile = File(...),
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    # Use the same static dir mounted in main
    from apps.backend.app.main import static_dir  # type: ignore
    target = static_dir / "uploads" / "students" / str(tenant_id) / str(student_id)
    target.mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "photo").name
    # Validar tipo y tamaño
    ct = (file.content_type or "").lower()
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if ct not in allowed:
        raise HTTPException(status_code=400, detail="Tipo no permitido. Use JPG, PNG o WEBP")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen supera 2 MB")
    (target / filename).write_bytes(content)
    public_url = f"/static/uploads/students/{tenant_id}/{student_id}/{filename}"
    obj.photo_url = public_url
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return {"url": public_url}


@router.get("/{student_id}/portal")
async def student_portal_summary(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    sres = await db.execute(select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id))
    student = sres.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    eres = await db.execute(
        select(Enrollment, Course)
        .join(Course, Course.id == Enrollment.course_id)
        .where(Enrollment.tenant_id == tenant_id, Enrollment.student_id == student_id)
        .order_by(Enrollment.start_date.desc())
    )
    enroll_rows = eres.all()
    enrollments = []
    for e, c in enroll_rows:
        enrollments.append({
            "id": e.id,
            "start_date": e.start_date.isoformat() if e.start_date else None,
            "end_date": e.end_date.isoformat() if e.end_date else None,
            "is_active": bool(e.is_active),
            "course": {
                "id": c.id,
                "name": c.name,
                "level": c.level,
                "classes_per_week": c.classes_per_week,
                "day_of_week": c.day_of_week,
                "start_time": c.start_time.isoformat() if c.start_time else None,
                "end_time": c.end_time.isoformat() if c.end_time else None,
                "day_of_week_2": c.day_of_week_2,
                "start_time_2": c.start_time_2.isoformat() if c.start_time_2 else None,
                "end_time_2": c.end_time_2.isoformat() if c.end_time_2 else None,
                "day_of_week_3": c.day_of_week_3,
                "start_time_3": c.start_time_3.isoformat() if c.start_time_3 else None,
                "end_time_3": c.end_time_3.isoformat() if c.end_time_3 else None,
                "day_of_week_4": c.day_of_week_4,
                "start_time_4": c.start_time_4.isoformat() if c.start_time_4 else None,
                "end_time_4": c.end_time_4.isoformat() if c.end_time_4 else None,
                "day_of_week_5": c.day_of_week_5,
                "start_time_5": c.start_time_5.isoformat() if c.start_time_5 else None,
                "end_time_5": c.end_time_5.isoformat() if c.end_time_5 else None,
                "teacher_id": c.teacher_id,
                "teacher_name": getattr(c.teacher, "name", None),
                "image_url": c.image_url,
                "room_name": getattr(c.room, "name", None),
            }
        })

    ares = await db.execute(
        select(Attendance, Course.name)
        .join(Course, Course.id == Attendance.course_id)
        .where(Attendance.tenant_id == tenant_id, Attendance.student_id == student_id)
        .order_by(Attendance.attended_at.desc())
        .limit(10)
    )
    att_rows = ares.all()
    attendance_recent = [
        {
            "course": name,
            "attended_at": a.attended_at.isoformat(),
            "status": "presente",
        }
        for a, name in att_rows
    ]

    att_count = len(attendance_recent)
    att_percent = int(round((att_count / 5) * 100)) if att_count < 5 else 100

    from datetime import date, timedelta
    pres = await db.execute(
        select(Payment)
        .where(Payment.tenant_id == tenant_id, Payment.student_id == student_id)
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .limit(10)
    )
    payments_recent = [
        {
            "id": p.id,
            "amount": float(p.amount),
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "method": p.method,
            "type": p.type,
            "reference": p.reference,
        }
        for p in pres.scalars().all()
    ]

    cutoff = date.today() - timedelta(days=90)
    pres2 = await db.execute(
        select(Payment)
        .where(Payment.tenant_id == tenant_id, Payment.student_id == student_id, Payment.payment_date >= cutoff)
    )
    total_paid_recent = sum(float(p.amount) for p in pres2.scalars().all())

    return {
        "student": {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "photo_url": student.photo_url,
        },
        "attendance": { "percent": att_percent, "recent": attendance_recent },
        "enrollments": enrollments,
        "classes_active": sum(1 for e in enrollments if e.get("is_active")),
            "payments": { "recent": payments_recent, "total_last_90": total_paid_recent },
        }

# ====== Portal alumno: login passwordless con código corto ======
class PortalRequestPayload(StudentUpdate):
    email: str
    tenant_id: int | None = None

@router.post("/portal/request_code")
async def request_portal_code(payload: dict, db: AsyncSession = Depends(get_db_session)):
    # payload esperado: {"email": "...", "tenant_id": optional}
    email = (payload.get("email") or "").strip().lower()
    tenant_id = payload.get("tenant_id")
    if not email:
        raise HTTPException(status_code=400, detail="Email requerido")
    query = select(Student).where(func.lower(Student.email) == email)
    if tenant_id is not None:
        query = query.where(Student.tenant_id == tenant_id)
    res = await db.execute(query)
    student = res.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado para ese email")
    key = (email, tenant_id or student.tenant_id)
    code = f"{secrets.randbelow(1000000):06d}"
    _portal_codes[key] = {
        "code": code,
        "expires": datetime.utcnow() + timedelta(minutes=10),
        "student_id": student.id,
        "tenant_id": tenant_id or student.tenant_id,
    }
    # En un entorno real se enviaría por correo. Para pruebas devolvemos el código.
    return {"ok": True, "code": code, "expires_in_minutes": 10}

@router.post("/portal/login")
async def portal_login(payload: dict, db: AsyncSession = Depends(get_db_session)):
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    tenant_id = payload.get("tenant_id")
    if not email or not code:
        raise HTTPException(status_code=400, detail="Email y codigo requeridos")
    # buscar código considerando que tenant_id puede no venir en la app
    entry = None
    # primer intento: clave exacta enviada
    key = (email, tenant_id)
    if key in _portal_codes and _portal_codes[key].get("code") == code:
        entry = _portal_codes[key]
    else:
        # intentar con tenant None
        key2 = (email, None)
        if key2 in _portal_codes and _portal_codes[key2].get("code") == code:
            entry = _portal_codes[key2]
        else:
            # buscar cualquier entry por email con ese código
            for (em, tidv), val in list(_portal_codes.items()):
                if em == email and val.get("code") == code:
                    entry = val
                    tenant_id = tidv
                    break
    if not entry or entry.get("code") != code:
        raise HTTPException(status_code=400, detail="Codigo invalido")
    if entry["expires"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Codigo expirado")
    student_id = entry["student_id"]
    tid = entry["tenant_id"]
    sres = await db.execute(select(Student).where(Student.id == student_id, Student.tenant_id == tid))
    student = sres.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    token = security.create_access_token(
        student.id,
        extra={"role": "student", "tenant_id": tid}
    )
    # invalidar
    _portal_codes.pop((email, tenant_id), None)
    _portal_codes.pop((email, tid), None)
    return {
        "access_token": token,
        "token_type": "bearer",
        "student": {
            "id": student.id,
            "email": student.email,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "tenant_id": tid,
        },
    }

@router.get("/portal/me")
async def portal_me(
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
):
    if current_student.tenant_id is None:
        raise HTTPException(status_code=400, detail="Alumno sin tenant asignado")
    # reutilizar el resumen del portal existente con el tenant real del alumno
    return await student_portal_summary(
        current_student.id,
        tenant_id=current_student.tenant_id,
        db=db,
    )

@router.get("/{student_id}/attendance_calendar")
async def attendance_calendar(
    student_id: int,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    from datetime import date, timedelta

    sres = await db.execute(select(Student.id).where(Student.id == student_id, Student.tenant_id == tenant_id))
    if not sres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    first_day = date(year, month, 1)
    last_day = (date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1) - timedelta(days=1))

    eres = await db.execute(
        select(Enrollment, Course)
        .join(Course, Course.id == Enrollment.course_id)
        .where(Enrollment.tenant_id == tenant_id, Enrollment.student_id == student_id)
    )
    enrolls = eres.all()

    expected: set[tuple[date, int]] = set()
    for e, c in enrolls:
        dows: list[int] = []
        for attr in ("day_of_week", "day_of_week_2", "day_of_week_3", "day_of_week_4", "day_of_week_5"):
            v = getattr(c, attr, None)
            if v is not None:
                dows.append(int(v))
        if not dows:
            continue
        start = first_day if (e.start_date is None or e.start_date < first_day) else e.start_date
        end = last_day if (e.end_date is None or e.end_date > last_day) else e.end_date
        if start is None or end is None or start > end:
            continue
        for target in dows:
            cur = start
            while cur.weekday() != target:
                cur += timedelta(days=1)
                if cur > end:
                    break
            while cur <= end:
                expected.add((cur, c.id))
                cur += timedelta(days=7)

    ares = await db.execute(
        select(Attendance.course_id, Attendance.attended_at)
        .where(
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.attended_at >= first_day,
            Attendance.attended_at < (last_day + timedelta(days=1)),
        )
    )
    attended: set[tuple[date, int]] = set()
    for cid, at in ares.all():
        attended.add((at.date(), cid))

    days = []
    cur = first_day
    while cur <= last_day:
        exp_ids = [cid for (d, cid) in expected if d == cur]
        att_ids = [cid for (d, cid) in attended if d == cur]
        exp = len(exp_ids) > 0
        att = len(att_ids) > 0
        days.append({
            "date": cur.isoformat(),
            "expected": bool(exp),
            "attended": bool(att),
            # Nuevos campos para control fino en frontend
            "expected_course_ids": exp_ids,
            "attended_course_ids": att_ids,
        })
        cur += timedelta(days=1)

    return {"year": year, "month": month, "days": days}




