from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from sqlalchemy import select, func, case, or_
from sqlalchemy.orm import selectinload
import secrets
from datetime import datetime

from app.core import security

from app.pms.models import Student, Tenant, TenantPlan
from app.pms.models import Course, Enrollment, Attendance, Payment, Teacher
from app.pms.schemas import StudentOut, StudentCreate, StudentUpdate, StudentListResponse, StudentStats
from app.pms.deps import get_tenant_id, get_db_session, get_current_student
from app.pms.phone_utils import COUNTRY_PHONE_PRESETS, resolve_tenant_phone_prefix, normalize_phone_value

router = APIRouter(prefix="/api/pms/students", tags=["pms-students"])

# Almacen simple en memoria para codigos de portal (en un entorno real usar DB + email)
_portal_codes: dict[tuple[str, int | None], dict[str, object]] = {}


async def _ensure_student_plan_capacity(db: AsyncSession, tenant_id: int) -> None:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant or not tenant.plan_id:
        return

    plan = await db.get(TenantPlan, tenant.plan_id)
    if not plan or not plan.max_active_students or plan.max_active_students <= 0:
        return

    active_students = await db.scalar(
        select(func.count()).select_from(Student).where(
            Student.tenant_id == tenant_id,
            Student.is_active == True,
        )
    ) or 0

    if active_students < plan.max_active_students:
        return

    next_plan = (
        await db.execute(
            select(TenantPlan)
            .where(
                TenantPlan.is_active == True,
                TenantPlan.max_active_students > plan.max_active_students,
            )
            .order_by(TenantPlan.max_active_students.asc(), TenantPlan.id.asc())
            .limit(1)
        )
    ).scalars().first()

    detail = (
        f"Has alcanzado el limite de {plan.max_active_students} alumnos activos de tu plan {plan.name}."
    )
    if next_plan:
        detail += f" Puedes cambiarte al plan {next_plan.name} ({next_plan.max_active_students} alumnos) desde Studios."
    else:
        detail += " Puedes cambiar de plan desde Studios para seguir inscribiendo alumnos."

    raise HTTPException(status_code=400, detail=detail)


def _known_phone_prefixes() -> list[str]:
    return [preset["prefix"] for preset in COUNTRY_PHONE_PRESETS.values()]


def _normalize_student_phone(phone: str | None, tenant: Tenant | None) -> str | None:
    default_prefix = resolve_tenant_phone_prefix(
        getattr(tenant, "phone_prefix", None),
        getattr(tenant, "country", None),
        getattr(tenant, "currency", None),
    )
    return normalize_phone_value(phone, default_prefix=default_prefix, known_prefixes=_known_phone_prefixes())


@router.get("/", response_model=StudentListResponse)
@router.get("", response_model=StudentListResponse)
async def list_students(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    joined_sort: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    conditions = [Student.tenant_id == tenant_id]
    if q:
        like = f"%{q}%"
        conditions.append((Student.first_name.ilike(like)) | (Student.last_name.ilike(like)) | (Student.email.ilike(like)))

    registration_exists = (
        select(Payment.id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.student_id == Student.id,
            func.lower(Payment.type) == "registration",
        )
        .limit(1)
        .exists()
    )

    order_by = (
        (Student.joined_at.asc(), Student.created_at.asc())
        if joined_sort == "asc"
        else (Student.joined_at.desc(), Student.created_at.desc())
    )

    # Fetch items with enrollment count
    stmt = (
        select(Student, func.count(Enrollment.id), registration_exists.label("has_registration_fee"))
        .outerjoin(Enrollment, Enrollment.student_id == Student.id)
        .where(*conditions)
        .group_by(Student.id)
        .order_by(*order_by)
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    rows = res.all()
    
    items = []
    for s, count, has_registration_fee in rows:
        setattr(s, 'enrollment_count', count)
        setattr(s, 'has_registration_fee', bool(has_registration_fee))
        items.append(s)

    # Combine total count and stats into ONE query
    lower_gender = func.lower(Student.gender)
    female_case = case((lower_gender.like('f%'), 1), (lower_gender.like('muj%'), 1), else_=0)
    male_case = case((lower_gender.like('m%'), 1), (lower_gender.like('hombre%'), 1), (lower_gender.like('masculino%'), 1), else_=0)
    week_cut = date.today() - timedelta(days=7)
    enrollment_exists = (
        select(Enrollment.id)
        .where(
            Enrollment.tenant_id == tenant_id,
            Enrollment.student_id == Student.id,
        )
        .limit(1)
        .exists()
    )
    
    stats_stmt = select(
        func.count().label('total'),
        func.sum(case((Student.is_active == True, 1), else_=0)).label('active'),
        func.sum(case((Student.is_active == False, 1), else_=0)).label('inactive'),
        func.sum(female_case).label('female'),
        func.sum(male_case).label('male'),
        func.sum(case(((Student.joined_at != None) & (Student.joined_at >= week_cut), 1), else_=0)).label('new_week'),
        func.sum(case((~enrollment_exists, 1), else_=0)).label('without_course'),
    ).where(*conditions)
    
    sres = await db.execute(stats_stmt)
    row = sres.one()
    
    stats = StudentStats(
        total_active=int(row.active or 0),
        total_inactive=int(row.inactive or 0),
        female=int(row.female or 0),
        male=int(row.male or 0),
        new_this_week=int(row.new_week or 0),
        without_course=int(row.without_course or 0),
    )

    return {"items": items, "total": int(row.total or 0), "stats": stats}


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
@router.post("", response_model=StudentOut, status_code=201)
async def create_student(
    payload: StudentCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    if payload.is_active is not False:
        await _ensure_student_plan_capacity(db, tenant_id)
    tenant = await db.get(Tenant, tenant_id)
    data = payload.model_dump(exclude_unset=True)
    data["phone"] = _normalize_student_phone(data.get("phone"), tenant)
    obj = Student(tenant_id=tenant_id, **data)
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
    tenant = await db.get(Tenant, tenant_id)
    prev_is_active = bool(obj.is_active)
    incoming = payload.model_dump(exclude_unset=True)
    if "phone" in incoming:
        incoming["phone"] = _normalize_student_phone(incoming.get("phone"), tenant)
    for k, v in incoming.items():
        setattr(obj, k, v)
    if "is_active" in incoming:
        new_is_active = bool(incoming.get("is_active"))
        if prev_is_active and not new_is_active:
            obj.inactive_at = datetime.utcnow()
        if new_is_active:
            if not prev_is_active:
                await _ensure_student_plan_capacity(db, tenant_id)
            obj.inactive_at = None
            obj.inactive_note = None
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

    # Compute static_dir locally to avoid circular import
    static_dir = Path(__file__).resolve().parent.parent / "static"
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

    tres = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tres.scalar_one_or_none()

    eres = await db.execute(
        select(Enrollment, Course)
        .join(Course, Course.id == Enrollment.course_id)
        .options(
            selectinload(Course.teacher),
            selectinload(Course.room),
        )
        .where(Enrollment.tenant_id == tenant_id, Enrollment.student_id == student_id)
        .order_by(Enrollment.start_date.desc())
    )
    enroll_rows = eres.all()
    today_dt = date.today()
    enrollments = []
    for e, c in enroll_rows:
        is_paid = False
        if e.end_date and e.end_date >= today_dt:
            is_paid = True

        enrollments.append({
            "id": e.id,
            "start_date": e.start_date.isoformat() if e.start_date else None,
            "end_date": e.end_date.isoformat() if e.end_date else None,
            "is_active": bool(e.is_active),
            "payment_status": "activo" if is_paid else "pendiente",
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

    pres = await db.execute(
        select(Payment, Course, Teacher)
        .join(Course, Course.id == Payment.course_id, isouter=True)
        .join(Teacher, Teacher.id == Course.teacher_id, isouter=True)
        .where(Payment.tenant_id == tenant_id, Payment.student_id == student_id)
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .limit(10)
    )
    payments_recent = []
    for p, c, t in pres.all():
        payments_recent.append({
            "id": p.id,
            "amount": float(p.amount),
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "method": p.method,
            "type": p.type,
            "reference": p.reference,
            "course_id": p.course_id,
            "course_name": getattr(c, "name", None),
            "teacher_name": getattr(t, "name", None),
            "period_start": p.period_start.isoformat() if p.period_start else None,
            "period_end": p.period_end.isoformat() if p.period_end else None,
        })

    cutoff = date.today() - timedelta(days=90)
    pres2 = await db.execute(
        select(func.sum(Payment.amount))
        .where(Payment.tenant_id == tenant_id, Payment.student_id == student_id, Payment.payment_date >= cutoff)
    )
    total_paid_recent = float(pres2.scalar() or 0)

    return {
        "tenant": {
            "id": tenant.id if tenant else tenant_id,
            "name": getattr(tenant, "name", None),
            "slug": getattr(tenant, "slug", None),
            "contact_email": getattr(tenant, "contact_email", None),
            "address": getattr(tenant, "address", None),
            "country": getattr(tenant, "country", None),
            "city": getattr(tenant, "city", None),
            "phone": getattr(tenant, "phone", None),
            "logo_url": getattr(tenant, "logo_url", None),
            "mobile_theme": getattr(tenant, "mobile_theme", None) or "gms_default",
        },
        "student": {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "phone": getattr(student, "phone", None),
            "gender": getattr(student, "gender", None),
            "birthdate": student.birthdate.isoformat() if getattr(student, "birthdate", None) else None,
            "joined_at": student.joined_at.isoformat() if getattr(student, "joined_at", None) else None,
            "notes": getattr(student, "notes", None),
            "photo_url": student.photo_url,
            "is_active": bool(getattr(student, "is_active", False)),
            "inactive_note": getattr(student, "inactive_note", None),
            "inactive_at": student.inactive_at.isoformat() if getattr(student, "inactive_at", None) else None,
            "tenant_id": student.tenant_id,
            "emergency_contact": getattr(student, "emergency_contact", None),
            "emergency_phone": getattr(student, "emergency_phone", None),
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
    tenant = await db.get(Tenant, student.tenant_id)
    if not tenant or not tenant.mobile_enabled or not tenant.student_portal_enabled:
        raise HTTPException(status_code=403, detail="Portal de alumnos no habilitado para este estudio")
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
    tenant = await db.get(Tenant, tid)
    if not tenant or not tenant.mobile_enabled or not tenant.student_portal_enabled:
        raise HTTPException(status_code=403, detail="Portal de alumnos no habilitado para este estudio")
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
    tenant = await db.get(Tenant, current_student.tenant_id)
    if not tenant or not tenant.mobile_enabled or not tenant.student_portal_enabled:
        raise HTTPException(status_code=403, detail="Portal de alumnos no habilitado para este estudio")
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
        select(Attendance.course_id, Attendance.attended_at, Attendance.is_recovery, Attendance.notes)
        .where(
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.attended_at >= first_day,
            Attendance.attended_at < (last_day + timedelta(days=1)),
        )
    )
    attended_map: dict[date, list[dict]] = {}
    for cid, at, rec, notes in ares.all():
        dt = at.date()
        if dt not in attended_map: attended_map[dt] = []
        attended_map[dt].append({"course_id": cid, "is_recovery": bool(rec), "is_extra": notes == 'clase_suelta'})

    days = []
    cur = first_day
    while cur <= last_day:
        exp_ids = [cid for (d, cid) in expected if d == cur]
        att_info = attended_map.get(cur, [])
        att_ids = [i["course_id"] for i in att_info]
        has_recovery = any(i["is_recovery"] for i in att_info)
        has_extra = any(i.get("is_extra") for i in att_info)
        
        days.append({
            "date": cur.isoformat(),
            "expected": len(exp_ids) > 0,
            "attended": len(att_ids) > 0,
            "is_recovery": has_recovery,
            "is_extra": has_extra,
            "expected_course_ids": exp_ids,
            "attended_course_ids": att_ids,
        })
        cur += timedelta(days=1)

    return {"year": year, "month": month, "days": days}



@router.get("/{student_id}/full_stats")
async def get_student_full_stats(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    from datetime import date, timedelta
    
    # Obtener todas las matrículas del alumno con sus cursos
    eres = await db.execute(
        select(Enrollment, Course)
        .join(Course, Course.id == Enrollment.course_id)
        .where(Enrollment.tenant_id == tenant_id, Enrollment.student_id == student_id)
    )
    enrolls = eres.all()
    
    if not enrolls:
        return {}

    # Fecha límite para cálculo (hoy + 6 meses para horizonte futuro)
    today = date.today()
    future_horizon = today + timedelta(days=180)
    
    results = {}
    
    for e, c in enrolls:
        start = e.start_date
        end = e.end_date
        if not start:
            continue
            
        course_id = c.id
        
        # Días de la semana del curso
        dows = []
        for attr in ("day_of_week", "day_of_week_2", "day_of_week_3", "day_of_week_4", "day_of_week_5"):
            v = getattr(c, attr, None)
            if v is not None:
                dows.append(int(v))
        
        if not dows:
            continue

        # 1. Calcular Esperados (dentro del periodo de matrícula)
        expected_count = 0
        if end:
            for target_dow in dows:
                cur = start
                # Alinear al primer día de clase
                diff = (target_dow - cur.weekday() + 7) % 7
                cur += timedelta(days=diff)
                while cur <= end:
                    expected_count += 1
                    cur += timedelta(days=7)

        # 2. Calcular Asistidos (desde inicio hasta horizonte futuro)
        ares = await db.execute(
            select(func.count(Attendance.id))
            .where(
                Attendance.tenant_id == tenant_id,
                Attendance.student_id == student_id,
                Attendance.course_id == course_id,
                Attendance.attended_at >= start,
                Attendance.attended_at <= future_horizon,
                or_(Attendance.notes == None, Attendance.notes != 'clase_suelta')
            )
        )
        attended_count = ares.scalar() or 0
        
        # 3. Calcular Extra Outside (asistencias después del fin de matrícula)
        extra_outside = 0
        if end:
            a_extra_res = await db.execute(
                select(func.count(Attendance.id))
                .where(
                    Attendance.tenant_id == tenant_id,
                    Attendance.student_id == student_id,
                    Attendance.course_id == course_id,
                    or_(
                        Attendance.attended_at > end,
                        Attendance.notes == 'clase_suelta'
                    ),
                    Attendance.attended_at <= future_horizon
                )
            )
            extra_outside = a_extra_res.scalar() or 0

        results[e.id] = {
            "expected": expected_count,
            "attended": attended_count,
            "extraOutside": extra_outside
        }

    return results
