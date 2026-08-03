from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from sqlalchemy import select, func, case, or_, and_, cast, Date
from sqlalchemy.orm import selectinload
import secrets
from datetime import datetime
import unicodedata

from app.core import security
from app.core.config import settings

from app.pms.models import Student, Tenant, TenantPlan
from app.pms.models import Course, Enrollment, Attendance, Payment, Teacher
from app.pms.schemas import StudentOut, StudentCreate, StudentUpdate, StudentListResponse, StudentStats
from app.pms.deps import get_tenant_id, get_db_session, get_current_student
from app.pms.phone_utils import COUNTRY_PHONE_PRESETS, resolve_tenant_phone_prefix, normalize_phone_value

router = APIRouter(prefix="/api/pms/students", tags=["pms-students"])

# Almacen simple en memoria para codigos de portal (en un entorno real usar DB + email)
_portal_codes: dict[tuple[str, int | None], dict[str, object]] = {}


def _student_portal_path(tenant: Tenant | None, tenant_id: int) -> str:
    slug = getattr(tenant, "slug", None) or f"tenant-{tenant_id}"
    return f"/mobile/{slug}"


def _create_student_portal_code(student: Student, tenant_id: int, minutes: int = 60) -> dict[str, object]:
    email = (student.email or "").strip().lower()
    code = f"{secrets.randbelow(1000000):06d}"
    _portal_codes[(email, tenant_id)] = {
        "code": code,
        "expires": datetime.utcnow() + timedelta(minutes=minutes),
        "student_id": student.id,
        "tenant_id": tenant_id,
    }
    return {"code": code, "expires_in_minutes": minutes}


def _course_weekdays(course: Course) -> list[int]:
    days: set[int] = set()
    for attr in ("day_of_week", "day_of_week_2", "day_of_week_3", "day_of_week_4", "day_of_week_5"):
        value = getattr(course, attr, None)
        if value is not None:
            days.add(int(value))
    return sorted(days)


def _expected_classes_between(start: date | None, end: date | None, course: Course) -> int:
    if not start:
        return 0
    if end and start == end:
        return 1
    period_end = end or date.today()
    if period_end < start:
        return 0
    total = 0
    for target_dow in _course_weekdays(course):
        cur = start + timedelta(days=(target_dow - start.weekday() + 7) % 7)
        while cur <= period_end:
            total += 1
            cur += timedelta(days=7)
    return total


def _subtract_months(value: date, months: int) -> date:
    month = value.month - months
    year = value.year
    while month <= 0:
        month += 12
        year -= 1
    last_day = [
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ][month - 1]
    return date(year, month, min(value.day, last_day))


def _add_months(value: date, months: int) -> date:
    month = value.month + months
    year = value.year
    while month > 12:
        month -= 12
        year += 1
    last_day = [
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ][month - 1]
    return date(year, month, min(value.day, last_day))


def _full_months_between(start: date | None, end: date) -> int:
    if not start or start > end:
        return 0
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(0, months)


async def _student_highlight_progress(
    db: AsyncSession,
    tenant_id: int,
    student: Student,
    enroll_rows: list[tuple[Enrollment, Course]],
    today: date,
) -> dict[str, object]:
    tiers = [
        {"months": 4, "threshold": 90.0, "label": "Constancia 4M"},
        {"months": 6, "threshold": 95.0, "label": "Disciplina 6M"},
        {"months": 12, "threshold": 95.0, "label": "Excelencia 12M"},
    ]
    active_rows = [(enr, course) for enr, course in enroll_rows if enr.is_active and getattr(course, "is_active", True)]
    if len(active_rows) >= 2:
        tiers[0] = {**tiers[0], "threshold": 80.0}
    if not active_rows:
        return {
            "status": "no_courses",
            "message": "Inscríbete en un curso para comenzar tu camino destacado.",
            "payments_current": False,
            "months_completed": 0,
            "progress_percent": 0,
            "stage_months": 1,
            "stage_progress_percent": 0,
            "next_tier_months": 4,
            "next_tier_label": "Constancia 4M",
            "required_attendance": 90.0,
            "attendance_rate": 0,
            "attended": 0,
            "expected": 0,
        }

    base_start = getattr(student, "joined_at", None) or min(enr.start_date for enr, _course in active_rows if enr.start_date)
    months_completed = _full_months_between(base_start, today)
    payments_current = all(enr.end_date is not None and enr.end_date >= today for enr, _course in active_rows)

    min_cutoff = _subtract_months(today, 12)
    course_ids = [course.id for _enr, course in active_rows]
    attendance_set: set[tuple[int, date]] = set()
    if course_ids:
        rows = (
            await db.execute(
                select(Attendance.course_id, Attendance.attended_at)
                .where(
                    Attendance.tenant_id == tenant_id,
                    Attendance.student_id == student.id,
                    Attendance.course_id.in_(course_ids),
                    Attendance.attended_at >= datetime.combine(min_cutoff, datetime.min.time()),
                    Attendance.attended_at < datetime.combine(today + timedelta(days=1), datetime.min.time()),
                    or_(Attendance.notes == None, Attendance.notes != "clase_suelta"),
                )
            )
        ).all()
        attendance_set = {(int(course_id), attended_at.date()) for course_id, attended_at in rows}

    def evaluate(months: int) -> dict[str, object]:
        cutoff = _subtract_months(today, months)
        enough_time = bool(base_start and base_start <= cutoff and any(enr.start_date <= cutoff for enr, _course in active_rows))
        expected = 0
        attended = 0
        for enr, course in active_rows:
            window_start = max(enr.start_date, cutoff if enough_time else (base_start or enr.start_date))
            window_end = min(enr.end_date or today, today)
            if window_start > window_end:
                continue
            expected += _expected_classes_between(window_start, window_end, course)
            attended += sum(
                1
                for course_id, att_date in attendance_set
                if course_id == course.id and window_start <= att_date <= window_end
            )
        rate = min(100.0, round((attended / expected) * 100, 1)) if expected > 0 else 0.0
        return {
            "months": months,
            "enough_time": enough_time,
            "expected": expected,
            "attended": attended,
            "attendance_rate": rate,
        }

    evaluations = {int(tier["months"]): evaluate(int(tier["months"])) for tier in tiers}
    achieved: dict[str, object] | None = None
    for tier in reversed(tiers):
        data = evaluations[int(tier["months"])]
        if (
            payments_current
            and data["enough_time"]
            and data["expected"]
            and float(data["attendance_rate"]) >= float(tier["threshold"])
        ):
            achieved = {**tier, **data}
            break

    next_tier = None
    if achieved:
        for tier in tiers:
            if int(tier["months"]) > int(achieved["months"]):
                next_tier = tier
                break
    else:
        next_tier = tiers[0]

    active_tier = next_tier or achieved or tiers[-1]
    active_eval = evaluations[int(active_tier["months"])]
    month_progress = min(100.0, round((months_completed / int(active_tier["months"])) * 100, 1)) if active_tier else 0.0
    attendance_progress = min(100.0, round((float(active_eval["attendance_rate"]) / float(active_tier["threshold"])) * 100, 1)) if active_tier else 0.0
    progress_percent = int(round(min(month_progress, attendance_progress)))
    current_expected = 0
    current_attended = 0
    period_completed_recently = False
    for enr, course in active_rows:
        expected_for_period = _expected_classes_between(enr.start_date, enr.end_date, course)
        if not (enr.end_date and enr.start_date == enr.end_date):
            configured_total = int(getattr(course, "total_classes", None) or 0)
            if configured_total > 0:
                expected_for_period = configured_total
        if expected_for_period <= 0:
            continue
        period_end = enr.end_date or today
        current_expected += expected_for_period
        current_attended += sum(
            1
            for course_id, att_date in attendance_set
            if course_id == course.id and enr.start_date <= att_date <= period_end
        )
    period_completion = min(100.0, round((current_attended / current_expected) * 100, 1)) if current_expected > 0 else 0.0
    period_completion_threshold = float(tiers[0]["threshold"])
    if current_expected > 0 and period_completion >= period_completion_threshold:
        period_completed_recently = any(
            bool(enr.end_date and today - timedelta(days=7) <= enr.end_date <= today)
            for enr, _course in active_rows
        )
    if months_completed < 4:
        stage_months = min(4, max(1, months_completed + 1))
    elif achieved and next_tier:
        stage_months = int(next_tier["months"])
    else:
        stage_months = int(active_tier["months"])
    if base_start and stage_months > 0:
        stage_target = _add_months(base_start, stage_months)
        stage_total_days = max(1, (stage_target - base_start).days)
        stage_elapsed_days = max(0, min(stage_total_days, (today - base_start).days))
        time_progress = (stage_elapsed_days / stage_total_days) * 100
        stage_progress_percent = int(round(max(time_progress, period_completion)))
    else:
        stage_progress_percent = int(round(period_completion))

    status = "completed" if achieved and not next_tier else "achieved" if achieved else "in_progress"
    if not payments_current:
        status = "payment_pending"
    elif not active_eval["expected"]:
        status = "not_enough_data"

    if status == "payment_pending" and period_completed_recently:
        message = "Primer mes listo. Renueva para seguir avanzando."
    elif status == "payment_pending":
        message = "Regulariza tu curso para seguir acumulando hacia alumno destacado."
    elif status == "completed":
        message = "Ya alcanzaste la meta de excelencia 12M."
    elif achieved:
        message = f"Ya lograste {achieved['label']}. Siguiente meta: {active_tier['label']}."
    elif months_completed < 4:
        stage_messages = {
            0: "Primer objetivo: completar 1 mes.",
            1: "Primer mes listo. Vamos por el segundo.",
            2: "Dos meses listos. Vamos por el tercero.",
            3: "Tres meses listos. Vamos por Constancia 4M.",
        }
        message = stage_messages.get(months_completed, f"Siguiente objetivo: {stage_months}M.")
    else:
        message = f"Avanza hacia {active_tier['label']} con asistencia constante y pagos al dia."
    celebration_months = None
    if payments_current and months_completed in {1, 2, 3, 4, 6, 12}:
        celebration_months = months_completed
    elif period_completed_recently:
        celebration_months = max(1, months_completed)
    celebration_title = None
    celebration_message = None
    if celebration_months:
        if celebration_months == 1:
            celebration_title = "Primer mes listo"
            celebration_message = "Vas construyendo constancia. Sigue asi."
        elif celebration_months == 2:
            celebration_title = "Dos meses firmes"
            celebration_message = "Tu ritmo ya se nota. Sigue sumando pasos."
        elif celebration_months == 3:
            celebration_title = "Tres meses constantes"
            celebration_message = "Estas muy cerca de la meta 4M."
        elif celebration_months == 4:
            celebration_title = "Constancia 4M lograda"
            celebration_message = "Este avance merece reconocimiento."
        elif celebration_months == 6:
            celebration_title = "Disciplina 6M lograda"
            celebration_message = "Tu compromiso marca diferencia."
        elif celebration_months == 12:
            celebration_title = "Excelencia 12M lograda"
            celebration_message = "Un ano completo de constancia."

    return {
        "status": status,
        "message": message,
        "payments_current": payments_current,
        "months_completed": months_completed,
        "progress_percent": progress_percent,
        "stage_months": stage_months,
        "stage_progress_percent": stage_progress_percent,
        "period_completion_percent": period_completion,
        "celebration_key": f"highlight-{celebration_months}m" if celebration_months else None,
        "celebration_months": celebration_months,
        "celebration_title": celebration_title,
        "celebration_message": celebration_message,
        "current_tier_months": int(achieved["months"]) if achieved else None,
        "current_tier_label": achieved["label"] if achieved else None,
        "next_tier_months": int(next_tier["months"]) if next_tier else None,
        "next_tier_label": next_tier["label"] if next_tier else None,
        "target_tier_months": int(active_tier["months"]) if active_tier else None,
        "target_tier_label": active_tier["label"] if active_tier else None,
        "required_attendance": float(active_tier["threshold"]) if active_tier else None,
        "attendance_rate": active_eval["attendance_rate"],
        "attended": active_eval["attended"],
        "expected": active_eval["expected"],
    }


def _student_mobile_access_payload(
    student: Student,
    tenant: Tenant | None,
    tenant_id: int,
    code_data: dict[str, object] | None = None,
) -> dict[str, object]:
    tenant_mobile_enabled = bool(getattr(tenant, "mobile_enabled", False))
    tenant_student_portal_enabled = bool(getattr(tenant, "student_portal_enabled", False))
    payload: dict[str, object] = {
        "enabled": bool(getattr(student, "portal_enabled", False)),
        "email": student.email,
        "student_id": student.id,
        "tenant_id": tenant_id,
        "tenant_mobile_enabled": tenant_mobile_enabled,
        "tenant_student_portal_enabled": tenant_student_portal_enabled,
        "can_generate": bool(student.email) and tenant_mobile_enabled and tenant_student_portal_enabled,
        "portal_path": _student_portal_path(tenant, tenant_id),
    }
    if code_data:
        payload.update(code_data)
    return payload


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


def _normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_accents.split())


@router.get("/", response_model=StudentListResponse)
@router.get("", response_model=StudentListResponse)
async def list_students(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    joined_sort: str = Query(default="desc", pattern="^(asc|desc)$"),
    name_sort: str | None = Query(default=None, pattern="^(asc|desc)$"),
):
    conditions = [Student.tenant_id == tenant_id]
    if q:
        normalized_q = _normalize_search_text(q)
        search_blob = func.translate(
            func.lower(func.concat_ws(
                " ",
                func.coalesce(Student.first_name, ""),
                func.coalesce(Student.last_name, ""),
                func.coalesce(Student.email, ""),
                func.coalesce(Student.phone, ""),
            )),
            "áéíóúüñ",
            "aeiouun",
        )
        terms = [term for term in normalized_q.split(" ") if term]
        if terms:
            conditions.append(and_(*(search_blob.ilike(f"%{term}%") for term in terms)))

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

    if name_sort:
        first_name_order = func.translate(func.lower(func.coalesce(Student.first_name, "")), "áéíóúüñ", "aeiouun")
        last_name_order = func.translate(func.lower(func.coalesce(Student.last_name, "")), "áéíóúüñ", "aeiouun")
        order_by = (
            (first_name_order.asc(), last_name_order.asc(), Student.id.asc())
            if name_sort == "asc"
            else (first_name_order.desc(), last_name_order.desc(), Student.id.desc())
        )
    else:
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
    data = payload.model_dump(exclude_unset=True)
    email = (data.get("email") or "").strip().lower()
    if email:
        existing = await db.scalar(
            select(Student.id).where(
                Student.tenant_id == tenant_id,
                func.lower(Student.email) == email,
            )
        )
        if existing:
            raise HTTPException(status_code=409, detail="Este alumno ya está registrado con ese correo.")
        data["email"] = email

    if payload.is_active is not False:
        await _ensure_student_plan_capacity(db, tenant_id)
    tenant = await db.get(Tenant, tenant_id)
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
    if "email" in incoming:
        email = (incoming.get("email") or "").strip().lower()
        if email:
            existing = await db.scalar(
                select(Student.id).where(
                    Student.tenant_id == tenant_id,
                    Student.id != student_id,
                    func.lower(Student.email) == email,
                )
            )
            if existing:
                raise HTTPException(status_code=409, detail="Este alumno ya está registrado con ese correo.")
        incoming["email"] = email or None
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


@router.get("/{student_id}/mobile_access")
async def get_student_mobile_access(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id))
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    tenant = await db.get(Tenant, tenant_id)
    return _student_mobile_access_payload(student, tenant, tenant_id)


@router.post("/{student_id}/mobile_access/generate")
async def generate_student_mobile_access(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id))
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    if not student.email:
        raise HTTPException(status_code=400, detail="El alumno necesita email para usar el portal mobile")

    tenant = await db.get(Tenant, tenant_id)
    if not tenant or not tenant.mobile_enabled or not tenant.student_portal_enabled:
        raise HTTPException(status_code=403, detail="Portal de alumnos no habilitado para este estudio")

    student.portal_enabled = True
    code_data = _create_student_portal_code(student, tenant_id, minutes=60)
    await db.flush()
    await db.refresh(student)
    await db.commit()
    return _student_mobile_access_payload(student, tenant, tenant_id, code_data)


@router.delete("/{student_id}/mobile_access")
async def disable_student_mobile_access(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id))
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    student.portal_enabled = False
    email = (student.email or "").strip().lower()
    if email:
        _portal_codes.pop((email, tenant_id), None)
        _portal_codes.pop((email, None), None)
    await db.flush()
    await db.refresh(student)
    await db.commit()
    tenant = await db.get(Tenant, tenant_id)
    return _student_mobile_access_payload(student, tenant, tenant_id)


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

    expected_total = 0
    elapsed_expected_total = 0
    attended_total = 0
    for e, c in enroll_rows:
        if not e.is_active:
            continue
        expected = _expected_classes_between(e.start_date, e.end_date, c)
        if not (e.end_date and e.start_date == e.end_date):
            configured_total = int(getattr(c, "total_classes", None) or 0)
            if configured_total > 0:
                expected = configured_total
        if expected <= 0:
            continue
        is_single_class = bool(e.end_date and e.start_date == e.end_date)
        attendance_filters = [
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.course_id == c.id,
            cast(Attendance.attended_at, Date) >= e.start_date,
        ]
        if e.end_date:
            attendance_filters.append(cast(Attendance.attended_at, Date) <= e.end_date)
        if not is_single_class:
            attendance_filters.append(or_(Attendance.notes == None, Attendance.notes != 'clase_suelta'))
        a_count_res = await db.execute(select(func.count(Attendance.id)).where(*attendance_filters))
        expected_total += expected
        elapsed_end = min(e.end_date or today_dt, today_dt)
        elapsed_expected_total += _expected_classes_between(e.start_date, elapsed_end, c)
        attended_total += int(a_count_res.scalar() or 0)
    att_percent = int(round((min(attended_total, expected_total) / expected_total) * 100)) if expected_total > 0 else 0
    attendance_rate = int(round((min(attended_total, elapsed_expected_total) / elapsed_expected_total) * 100)) if elapsed_expected_total > 0 else 0
    period_progress_percent = int(round((elapsed_expected_total / expected_total) * 100)) if expected_total > 0 else 0
    highlight_progress = await _student_highlight_progress(db, tenant_id, student, enroll_rows, today_dt)

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
            "online_payments_enabled": bool(getattr(tenant, "online_payments_enabled", False)),
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
            "portal_enabled": bool(getattr(student, "portal_enabled", False)),
            "inactive_note": getattr(student, "inactive_note", None),
            "inactive_at": student.inactive_at.isoformat() if getattr(student, "inactive_at", None) else None,
            "tenant_id": student.tenant_id,
            "emergency_contact": getattr(student, "emergency_contact", None),
            "emergency_phone": getattr(student, "emergency_phone", None),
        },
        "attendance": {
            "percent": att_percent,
            "attendance_rate": attendance_rate,
            "period_progress_percent": period_progress_percent,
            "attended": attended_total,
            "expected": expected_total,
            "elapsed_expected": elapsed_expected_total,
            "recent": attendance_recent,
        },
        "highlight_progress": highlight_progress,
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
    if not getattr(student, "portal_enabled", False):
        raise HTTPException(status_code=403, detail="Acceso mobile no habilitado para este alumno")
    code_data = _create_student_portal_code(student, tenant_id or student.tenant_id, minutes=10)
    # En un entorno real se enviaría por correo. Para pruebas devolvemos el código.
    return {"ok": True, "code": code_data["code"], "expires_in_minutes": code_data["expires_in_minutes"]}

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
    if not getattr(student, "portal_enabled", False):
        raise HTTPException(status_code=403, detail="Acceso mobile no habilitado para este alumno")
    token = security.create_access_token(
        student.id,
        expires_delta=timedelta(days=settings.mobile_access_token_expire_days),
        extra={"role": "student", "tenant_id": tid}
    )
    # invalidar
    _portal_codes.pop((email, tenant_id), None)
    _portal_codes.pop((email, tid), None)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_days": settings.mobile_access_token_expire_days,
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
    if not getattr(current_student, "portal_enabled", False):
        raise HTTPException(status_code=403, detail="Acceso mobile no habilitado para este alumno")
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
                cast(Attendance.attended_at, Date) >= start,
                cast(Attendance.attended_at, Date) <= future_horizon,
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
                        cast(Attendance.attended_at, Date) > end,
                        Attendance.notes == 'clase_suelta'
                    ),
                    cast(Attendance.attended_at, Date) <= future_horizon
                )
            )
            extra_outside = a_extra_res.scalar() or 0

        results[e.id] = {
            "expected": expected_count,
            "attended": attended_count,
            "extraOutside": extra_outside
        }

    return results
