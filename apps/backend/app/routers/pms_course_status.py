from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from datetime import date, timedelta
from datetime import date

from apps.backend.app.pms.models import Course, Enrollment, Student, Teacher, Attendance, Payment
from apps.backend.app.pms.deps import get_tenant_id, get_db_session


router = APIRouter(prefix="/api/pms/course_status", tags=["pms-course-status"])


@router.get("/")
@router.get("")
async def course_status(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    course_q: str | None = Query(default=None, description="Filtro por nombre de curso"),
    course_id: int | None = Query(default=None, description="ID de curso"),
    student_q: str | None = Query(default=None, description="Filtro por nombre o email de alumno"),
    teacher_q: str | None = Query(default=None, description="Filtro por nombre de profesor"),
    only_active: bool = Query(default=True),
    day_of_week: int | None = Query(default=None, ge=0, le=6, description="Día de la semana (0=Lun .. 6=Dom)"),
    attendance_days: int = Query(default=30, ge=1, le=365, description="Ventana de días para contar asistencia"),
):
    c = Course
    e = Enrollment
    s = Student
    a = None  # forward reference for type hints

    # Subconsulta de asistencia por alumno/curso en la ventana indicada
    date_from = date.today() - timedelta(days=attendance_days)
    from apps.backend.app.pms.models import Attendance as AModel
    a = AModel
    # Conteo base de asistencias en ventana (luego se filtran por rango de inscripci�n)
    att_sq = (
        select(a.student_id.label("stu_id"), a.course_id.label("cou_id"), func.count().label("att_count"))
        .where(a.tenant_id == tenant_id, a.attended_at >= date_from)
        .group_by(a.student_id, a.course_id)
        .subquery()
    )

    stmt = (
        select(
            c.id,
            c.name,
            c.level,
            c.price,
            c.class_price,
            c.image_url,
            c.day_of_week,
            c.start_time,
            c.end_time,
            c.day_of_week_2,
            c.start_time_2,
            c.end_time_2,
            c.day_of_week_3,
            c.start_time_3,
            c.end_time_3,
            c.day_of_week_4,
            c.start_time_4,
            c.end_time_4,
            c.day_of_week_5,
            c.start_time_5,
            c.end_time_5,
            c.course_type,
            c.total_classes,
            c.classes_per_week,
            c.start_date,
            Teacher.id,
            Teacher.name,
            s.id,
            s.first_name,
            s.last_name,
            s.photo_url,
            s.email,
            s.gender,
            s.phone,
            s.notes,
            s.birthdate,
            e.start_date,
            e.end_date,
            e.is_active,
            func.coalesce(att_sq.c.att_count, 0).label("att_count"),
        )
        .join(e, and_(e.course_id == c.id, e.tenant_id == c.tenant_id), isouter=True)
        .join(s, and_(s.id == e.student_id, s.tenant_id == e.tenant_id), isouter=True)
        .join(Teacher, and_(Teacher.id == c.teacher_id, Teacher.tenant_id == c.tenant_id), isouter=True)
        .join(att_sq, and_(att_sq.c.stu_id == s.id, att_sq.c.cou_id == c.id), isouter=True)
        .where(c.tenant_id == tenant_id)
    )

    if only_active:
        stmt = stmt.where(
            and_(
                c.is_active.is_(True),
                or_(e.is_active.is_(True), e.id.is_(None)),
                or_(s.is_active.is_(True), s.id.is_(None)),
            )
        )

    if course_q:
        like = f"%{course_q}%"
        stmt = stmt.where(c.name.ilike(like))
    if course_id:
        stmt = stmt.where(c.id == course_id)

    if student_q:
        like = f"%{student_q}%"
        stmt = stmt.where(
            or_(s.first_name.ilike(like), s.last_name.ilike(like), s.email.ilike(like))
        )

    if day_of_week is not None:
        stmt = stmt.where(c.day_of_week == day_of_week)

    if teacher_q:
        like = f"%{teacher_q}%"
        stmt = stmt.where(Teacher.name.ilike(like))

    rows = (await db.execute(stmt.order_by(c.name.asc(), s.last_name.asc(), s.first_name.asc()))).all()

    grouped: dict[int, dict] = {}
    seen_by_course: dict[int, set[int]] = {}
    course_ids: set[int] = set()
    student_ids: set[int] = set()
    today = date.today()
    for (
        course_id,
        course_name,
        level,
        course_price,
        course_class_price,
        course_image,
        course_day,
        course_start_time,
        course_end_time,
        course_day2,
        course_start_time2,
        course_end_time2,
        course_day3,
        course_start_time3,
        course_end_time3,
        course_day4,
        course_start_time4,
        course_end_time4,
        course_day5,
        course_start_time5,
        course_end_time5,
        course_type,
        total_classes,
        classes_per_week,
        course_start,
        teacher_id,
        teacher_name,
        student_id,
        first_name,
        last_name,
        photo_url,
        email,
        gender,
        phone,
        notes,
        birthdate,
        start_date,
        end_date,
        e_active,
        att_count,
    ) in rows:
        if course_id not in grouped:
            grouped[course_id] = {
                "course": {
                    "id": course_id,
                    "name": course_name,
                    "level": level,
                    "price": float(course_price) if course_price is not None else None,
                    "class_price": float(course_class_price) if course_class_price is not None else None,
                    "image_url": course_image,
                    "day_of_week": course_day,
                    "start_time": course_start_time.isoformat() if course_start_time else None,
                    "end_time": course_end_time.isoformat() if course_end_time else None,
                    "day_of_week_2": course_day2,
                    "start_time_2": course_start_time2.isoformat() if course_start_time2 else None,
                    "end_time_2": course_end_time2.isoformat() if course_end_time2 else None,
                    "day_of_week_3": course_day3,
                    "start_time_3": course_start_time3.isoformat() if course_start_time3 else None,
                    "end_time_3": course_end_time3.isoformat() if course_end_time3 else None,
                    "day_of_week_4": course_day4,
                    "start_time_4": course_start_time4.isoformat() if course_start_time4 else None,
                    "end_time_4": course_end_time4.isoformat() if course_end_time4 else None,
                    "day_of_week_5": course_day5,
                    "start_time_5": course_start_time5.isoformat() if course_start_time5 else None,
                    "end_time_5": course_end_time5.isoformat() if course_end_time5 else None,
                    "course_type": course_type,
                    "total_classes": int(total_classes) if total_classes is not None else None,
                    "classes_per_week": int(classes_per_week) if classes_per_week is not None else None,
                    "start_date": course_start.isoformat() if course_start else None,
                },
                "teacher": {
                    "id": teacher_id,
                    "name": teacher_name,
                } if teacher_id is not None else None,
                "students": [],
                "counts": {"total": 0, "female": 0, "male": 0},
            }
            seen_by_course[course_id] = set()
            course_ids.add(course_id)
        # append student only if exists (course may have none)
        if student_id is not None:
            # avoid duplicates of the same student within the same course
            if student_id in seen_by_course.get(course_id, set()):
                continue
            is_paid = bool(end_date and end_date >= today)
            is_birthday_today = bool(birthdate and birthdate.month == today.month and birthdate.day == today.day)
            student_entry = {
                "id": student_id,
                "first_name": first_name,
                "last_name": last_name,
                "photo_url": photo_url,
                "email": email,
                "gender": gender,
                "phone": phone,
                "notes": notes,
                "enrolled_since": start_date.isoformat() if start_date else None,
                "renewal_date": end_date.isoformat() if end_date else None,
                "email_ok": bool((email or "").strip()),
                "payment_status": "activo" if is_paid else "pendiente",
                # Ajustado luego con att_dates filtradas
                "attendance_count": int(att_count or 0),
                "birthday_today": is_birthday_today,
            }
            grouped[course_id]["students"].append(student_entry)
            seen_by_course[course_id].add(student_id)
            student_ids.add(student_id)
            # update counts
            counts = grouped[course_id]["counts"]
            counts["total"] += 1
            g = (gender or "").strip().lower()
            if g in ("f", "female", "femenino", "mujer") or g.startswith("fem") or g.startswith("muj"):
                counts["female"] += 1
            elif g in ("m", "male", "masculino", "hombre") or g.startswith("masc") or g.startswith("hom"):
                counts["male"] += 1

    # Build per-student attendance date list within the window, filtered por rango de inscripci�n
    if course_ids and student_ids:
        ares = await db.execute(
            select(Attendance.student_id, Attendance.course_id, Attendance.attended_at)
            .where(
                Attendance.tenant_id == tenant_id,
                Attendance.course_id.in_(course_ids),
                Attendance.student_id.in_(student_ids),
                Attendance.attended_at >= date_from,
            )
        )
        att_map: dict[tuple[int, int], list[str]] = {}
        for sid, cid, at in ares.all():
            key = (cid, sid)
            att_map.setdefault(key, []).append(at.date().isoformat())
        for cid, bundle in grouped.items():
            for st in bundle.get("students", []):
                key = (cid, st["id"])  # type: ignore
                raw_dates = att_map.get(key, [])
                # Filtrar por rango de inscripci�n (si no hay fechas, se usa ventana base)
                def parse_date(val: str | None):
                    try:
                        return date.fromisoformat(val) if val else None
                    except Exception:
                        return None
                start_d = parse_date(st.get("enrolled_since"))
                end_d = parse_date(st.get("renewal_date")) or date.today()
                filtered = []
                for d in raw_dates:
                    try:
                        dd = date.fromisoformat(d)
                    except Exception:
                        continue
                    if start_d and dd < start_d:
                        continue
                    if end_d and dd > end_d:
                        continue
                    filtered.append(d)
                st["att_dates"] = filtered
                st["attendance_count"] = len(filtered)

    return list(grouped.values())
