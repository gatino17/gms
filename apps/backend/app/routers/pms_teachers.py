from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from jose import JWTError, jwt
from zoneinfo import ZoneInfo

from app.core import security
from app.pms.models import Teacher, Course, Payment, Tenant, User, Attendance
from app.core.config import settings
from app.pms.models import Student, Enrollment, Room
from app.pms.deps import get_tenant_id, get_db_session, reusable_oauth2
from app.schemas import token as token_schema
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime, timedelta
from sqlalchemy import select, func, case
import secrets
import string


class TeacherBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    join_date: Optional[date] = None
    birthdate: Optional[date] = None
    styles: Optional[str] = None
    photo_url: Optional[str] = None


class TeacherCreate(TeacherBase):
    pass


class TeacherUpdate(TeacherBase):
    pass


class TeacherOut(TeacherBase):
    id: int
    tenant_id: int
    user_id: Optional[int] = None
    portal_enabled: bool = False

    class Config:
        from_attributes = True


class TeacherPortalAccessPayload(BaseModel):
    password: Optional[str] = None
    enabled: bool = True


class TeacherPortalAccessOut(BaseModel):
    teacher_id: int
    user_id: Optional[int] = None
    email: str
    portal_enabled: bool
    password: Optional[str] = None
    message: str


class TeacherPortalLoginPayload(BaseModel):
    email: EmailStr
    password: str
    tenant_id: Optional[int] = None


class TeacherPortalAttendancePayload(BaseModel):
    student_id: int
    course_id: int
    date: Optional[date] = None


class TeacherStats(BaseModel):
    total: int = 0
    new_this_month: int = 0


class TeacherListResponse(BaseModel):
    items: list[TeacherOut]
    total: int
    stats: TeacherStats


router = APIRouter(prefix="/api/pms/teachers", tags=["pms-teachers"])


def _generate_teacher_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _ensure_teacher_portal_enabled(db: AsyncSession, tenant_id: int) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    if not tenant.mobile_enabled or not tenant.teacher_portal_enabled:
        raise HTTPException(status_code=403, detail="Portal de profesores no habilitado para este estudio")
    return tenant


async def _get_current_portal_teacher(
    db: AsyncSession = Depends(get_db_session),
    token: str = Depends(reusable_oauth2),
) -> Teacher:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        token_data = token_schema.TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    if payload.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Token no es de profesor")
    tenant_id = payload.get("tenant_id")
    teacher_id = payload.get("teacher_id")
    if tenant_id is None or teacher_id is None:
        raise HTTPException(status_code=403, detail="Token profesor incompleto")
    await _ensure_teacher_portal_enabled(db, int(tenant_id))
    res = await db.execute(
        select(Teacher).where(
            Teacher.id == int(teacher_id),
            Teacher.tenant_id == int(tenant_id),
            Teacher.user_id == token_data.sub,
            Teacher.portal_enabled == True,
        )
    )
    teacher = res.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    return teacher


async def _teacher_portal_summary(teacher: Teacher, db: AsyncSession) -> dict:
    tenant = await db.get(Tenant, teacher.tenant_id)
    local_tz = ZoneInfo(settings.tz)
    today = datetime.now(local_tz).date()
    start_day = datetime(today.year, today.month, today.day)
    end_day = start_day + timedelta(days=1)
    courses_res = await db.execute(
        select(Course, Room.name.label("room_name"))
        .join(Room, (Room.id == Course.room_id) & (Room.tenant_id == Course.tenant_id), isouter=True)
        .where(
            Course.tenant_id == teacher.tenant_id,
            Course.teacher_id == teacher.id,
            Course.is_active == True,
        )
        .order_by(Course.day_of_week.asc().nulls_last(), Course.start_time.asc().nulls_last(), Course.name.asc())
    )
    course_rows = courses_res.all()
    course_ids = [course.id for course, _ in course_rows]

    students_by_course: dict[int, list[dict]] = {course_id: [] for course_id in course_ids}
    attended_by_course: dict[int, set[int]] = {course_id: set() for course_id in course_ids}
    if course_ids:
        attendance_res = await db.execute(
            select(Attendance.course_id, Attendance.student_id)
            .where(
                Attendance.tenant_id == teacher.tenant_id,
                Attendance.course_id.in_(course_ids),
                Attendance.attended_at >= start_day,
                Attendance.attended_at < end_day,
            )
        )
        for course_id, student_id in attendance_res.all():
            attended_by_course.setdefault(course_id, set()).add(student_id)

        students_res = await db.execute(
            select(Enrollment, Student)
            .join(Student, Student.id == Enrollment.student_id)
            .where(
                Enrollment.tenant_id == teacher.tenant_id,
                Enrollment.course_id.in_(course_ids),
                Enrollment.is_active == True,
                Student.is_active == True,
            )
            .order_by(Student.first_name.asc(), Student.last_name.asc())
        )
        for enrollment, student in students_res.all():
            students_by_course.setdefault(enrollment.course_id, []).append({
                "id": student.id,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "email": student.email,
                "phone": student.phone,
                "gender": student.gender,
                "birthdate": student.birthdate.isoformat() if student.birthdate else None,
                "photo_url": student.photo_url,
                "enrollment_id": enrollment.id,
                "enrolled_since": enrollment.start_date.isoformat() if enrollment.start_date else None,
                "renewal_date": enrollment.end_date.isoformat() if enrollment.end_date else None,
                "enrollment_mode": "single_class" if enrollment.end_date and enrollment.start_date == enrollment.end_date else "regular",
            })

    courses = []
    for course, room_name in course_rows:
        students = students_by_course.get(course.id, [])
        courses.append({
            "id": course.id,
            "name": course.name,
            "level": course.level,
            "image_url": course.image_url,
            "course_type": course.course_type,
            "classes_per_week": course.classes_per_week,
            "day_of_week": course.day_of_week,
            "start_time": course.start_time.isoformat() if course.start_time else None,
            "end_time": course.end_time.isoformat() if course.end_time else None,
            "day_of_week_2": course.day_of_week_2,
            "start_time_2": course.start_time_2.isoformat() if course.start_time_2 else None,
            "end_time_2": course.end_time_2.isoformat() if course.end_time_2 else None,
            "day_of_week_3": course.day_of_week_3,
            "start_time_3": course.start_time_3.isoformat() if course.start_time_3 else None,
            "end_time_3": course.end_time_3.isoformat() if course.end_time_3 else None,
            "day_of_week_4": course.day_of_week_4,
            "start_time_4": course.start_time_4.isoformat() if course.start_time_4 else None,
            "end_time_4": course.end_time_4.isoformat() if course.end_time_4 else None,
            "day_of_week_5": course.day_of_week_5,
            "start_time_5": course.start_time_5.isoformat() if course.start_time_5 else None,
            "end_time_5": course.end_time_5.isoformat() if course.end_time_5 else None,
            "room_name": room_name,
            "student_count": len(students),
            "attended_today_student_ids": sorted(attended_by_course.get(course.id, set())),
            "students": students,
        })

    return {
        "tenant": {
            "id": tenant.id if tenant else teacher.tenant_id,
            "name": getattr(tenant, "name", None),
            "slug": getattr(tenant, "slug", None),
            "logo_url": getattr(tenant, "logo_url", None),
            "city": getattr(tenant, "city", None),
            "country": getattr(tenant, "country", None),
            "mobile_theme": getattr(tenant, "mobile_theme", None) or "gms_default",
        },
        "teacher": {
            "id": teacher.id,
            "name": teacher.name,
            "email": teacher.email,
            "phone": teacher.phone,
            "photo_url": teacher.photo_url,
        },
        "courses": courses,
        "course_count": len(courses),
        "student_count": sum(len(course["students"]) for course in courses),
    }


@router.post("/portal/login")
async def teacher_portal_login(
    payload: TeacherPortalLoginPayload,
    db: AsyncSession = Depends(get_db_session),
):
    email = str(payload.email).strip().lower()
    user_res = await db.execute(select(User).where(func.lower(User.email) == email))
    user = user_res.scalar_one_or_none()
    if not user or getattr(user, "role", None) != "teacher":
        raise HTTPException(status_code=400, detail="Correo o clave incorrectos")
    if payload.tenant_id is not None and user.tenant_id != payload.tenant_id:
        raise HTTPException(status_code=403, detail="Profesor no pertenece a este estudio")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Acceso profesor inactivo")
    if not security.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Correo o clave incorrectos")
    if user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Profesor sin tenant asignado")

    tenant = await _ensure_teacher_portal_enabled(db, user.tenant_id)
    teacher_res = await db.execute(
        select(Teacher).where(
            Teacher.user_id == user.id,
            Teacher.tenant_id == user.tenant_id,
            Teacher.portal_enabled == True,
        )
    )
    teacher = teacher_res.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=403, detail="Acceso mobile no habilitado para este profesor")

    token = security.create_access_token(
        user.id,
        extra={"role": "teacher", "tenant_id": user.tenant_id, "teacher_id": teacher.id},
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "logo_url": tenant.logo_url,
            "mobile_theme": tenant.mobile_theme or "gms_default",
        },
        "teacher": {
            "id": teacher.id,
            "email": user.email,
            "full_name": teacher.name,
            "tenant_id": user.tenant_id,
        },
    }


@router.get("/portal/me")
async def teacher_portal_me(
    teacher: Teacher = Depends(_get_current_portal_teacher),
    db: AsyncSession = Depends(get_db_session),
):
    return await _teacher_portal_summary(teacher, db)


@router.post("/portal/attendance")
async def teacher_portal_mark_attendance(
    payload: TeacherPortalAttendancePayload,
    teacher: Teacher = Depends(_get_current_portal_teacher),
    db: AsyncSession = Depends(get_db_session),
):
    course_res = await db.execute(
        select(Course).where(
            Course.id == payload.course_id,
            Course.tenant_id == teacher.tenant_id,
            Course.teacher_id == teacher.id,
            Course.is_active == True,
        )
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado para este profesor")

    student_res = await db.execute(
        select(Student).where(
            Student.id == payload.student_id,
            Student.tenant_id == teacher.tenant_id,
            Student.is_active == True,
        )
    )
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    local_tz = ZoneInfo(settings.tz)
    mark_date = payload.date or datetime.now(local_tz).date()
    enrollment_res = await db.execute(
        select(Enrollment.id).where(
            Enrollment.tenant_id == teacher.tenant_id,
            Enrollment.student_id == student.id,
            Enrollment.course_id == course.id,
            Enrollment.is_active == True,
            Enrollment.start_date <= mark_date,
            or_(Enrollment.end_date == None, Enrollment.end_date >= mark_date),
        )
    )
    if not enrollment_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Alumno sin inscripcion activa para este curso")

    attended_at = datetime.now(local_tz).replace(tzinfo=None)
    if payload.date:
        attended_at = datetime(mark_date.year, mark_date.month, mark_date.day)
    start_day = datetime(mark_date.year, mark_date.month, mark_date.day)
    end_day = start_day + timedelta(days=1)
    existing_res = await db.execute(
        select(Attendance).where(
            Attendance.tenant_id == teacher.tenant_id,
            Attendance.course_id == course.id,
            Attendance.student_id == student.id,
            Attendance.attended_at >= start_day,
            Attendance.attended_at < end_day,
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        return {
            "status": "already_marked",
            "student_id": student.id,
            "course_id": course.id,
            "attended_at": existing.attended_at.isoformat(),
        }

    attendance = Attendance(
        tenant_id=teacher.tenant_id,
        student_id=student.id,
        course_id=course.id,
        attended_at=attended_at,
        marked_by=f"teacher:{teacher.id}",
        notes="portal_profesor",
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)
    return {
        "status": "ok",
        "id": attendance.id,
        "student_id": student.id,
        "course_id": course.id,
        "attended_at": attendance.attended_at.isoformat(),
    }


@router.get("/", response_model=TeacherListResponse)
@router.get("", response_model=TeacherListResponse)
async def list_teachers(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None, description="Filtro por nombre, email o teléfono"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    conditions = [Teacher.tenant_id == tenant_id]
    if q:
        like = f"%{q}%"
        conditions.append(
            (Teacher.name.ilike(like)) | (Teacher.email.ilike(like)) | (Teacher.phone.ilike(like))
        )

    stmt = (
        select(Teacher)
        .where(*conditions)
        .order_by(Teacher.name.asc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()

    # Stats calculation
    month_ago = date.today() - timedelta(days=30)
    stats_stmt = select(
        func.count().label('total'),
        func.sum(case(((Teacher.join_date != None) & (Teacher.join_date >= month_ago), 1), else_=0)).label('new_month'),
    ).where(Teacher.tenant_id == tenant_id)
    
    sres = await db.execute(stats_stmt)
    row = sres.one()
    
    stats = TeacherStats(
        total=int(row.total or 0),
        new_this_month=int(row.new_month or 0),
    )

    return {"items": items, "total": stats.total, "stats": stats}


@router.post("/{teacher_id}/portal/access", response_model=TeacherPortalAccessOut)
async def create_or_reset_teacher_portal_access(
    teacher_id: int,
    payload: TeacherPortalAccessPayload,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    await _ensure_teacher_portal_enabled(db, tenant_id)
    teacher_res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    teacher = teacher_res.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    if not teacher.email:
        raise HTTPException(status_code=400, detail="El profesor necesita correo para crear acceso mobile")

    email = teacher.email.strip().lower()
    password = (payload.password or "").strip() or _generate_teacher_password()
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="La clave debe tener al menos 6 caracteres")

    existing = await db.scalar(select(User).where(func.lower(User.email) == email))
    if existing and existing.tenant_id != tenant_id:
        raise HTTPException(status_code=400, detail="El correo ya esta usado en otro tenant")
    if existing and getattr(existing, "role", None) not in ("teacher",):
        raise HTTPException(status_code=400, detail="El correo ya esta usado por un usuario administrativo")

    user = existing
    if not user:
        user = User(
            email=email,
            hashed_password=security.get_password_hash(password),
            full_name=teacher.name,
            is_active=True,
            is_superuser=False,
            role="teacher",
            tenant_id=tenant_id,
        )
        db.add(user)
        await db.flush()
    else:
        user.hashed_password = security.get_password_hash(password)
        user.full_name = teacher.name
        user.is_active = bool(payload.enabled)
        user.is_superuser = False
        user.role = "teacher"
        user.tenant_id = tenant_id

    teacher.user_id = user.id
    teacher.portal_enabled = bool(payload.enabled)
    await db.commit()
    await db.refresh(teacher)
    return TeacherPortalAccessOut(
        teacher_id=teacher.id,
        user_id=user.id,
        email=email,
        portal_enabled=teacher.portal_enabled,
        password=password,
        message="Acceso mobile del profesor actualizado",
    )


@router.delete("/{teacher_id}/portal/access", response_model=TeacherPortalAccessOut)
async def disable_teacher_portal_access(
    teacher_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    teacher_res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    teacher = teacher_res.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    email = (teacher.email or "").strip().lower()
    teacher.portal_enabled = False
    if teacher.user_id:
        user = await db.get(User, teacher.user_id)
        if user and getattr(user, "role", None) == "teacher":
            user.is_active = False
    await db.commit()
    return TeacherPortalAccessOut(
        teacher_id=teacher.id,
        user_id=teacher.user_id,
        email=email or "-",
        portal_enabled=False,
        password=None,
        message="Acceso mobile del profesor desactivado",
    )


@router.get("/{teacher_id}", response_model=TeacherOut)
async def get_teacher(
    teacher_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    return obj


@router.post("/", response_model=TeacherOut, status_code=201)
@router.post("", response_model=TeacherOut, status_code=201)
async def create_teacher(
    payload: TeacherCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = Teacher(tenant_id=tenant_id, **payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.put("/{teacher_id}", response_model=TeacherOut)
async def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.delete("/{teacher_id}", status_code=204)
async def delete_teacher(
    teacher_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    teacher_name = (obj.name or "").strip()
    if teacher_name:
        await db.execute(
            Payment.__table__.update()
            .where(
                Payment.tenant_id == tenant_id,
                Payment.course_id.in_(
                    select(Course.id).where(Course.tenant_id == tenant_id, Course.teacher_id == teacher_id)
                ),
                (Payment.teacher_name_snapshot.is_(None)) | (func.trim(Payment.teacher_name_snapshot) == ""),
            )
            .values(teacher_name_snapshot=teacher_name)
        )
    await db.delete(obj)
    await db.commit()
    return None


@router.post("/{teacher_id}/photo")
async def upload_teacher_photo(
    teacher_id: int,
    file: UploadFile = File(...),
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")

    # Compute static_dir locally to avoid circular import
    static_dir = Path(__file__).resolve().parent.parent / "static"
    target = static_dir / "uploads" / "teachers" / str(tenant_id) / str(teacher_id)
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
    public_url = f"/static/uploads/teachers/{tenant_id}/{teacher_id}/{filename}"
    obj.photo_url = public_url
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return {"url": public_url}
