from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo

from app.pms.models import Course, Enrollment, Student, Teacher, Attendance, Payment
from app.pms.deps import get_tenant_id, get_db_session


router = APIRouter(prefix="/api/pms/course_status", tags=["pms-course-status"])


@router.get("/")
@router.get("")
async def course_status(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    course_q: str | None = Query(default=None),
    course_id: int | None = Query(default=None),
    student_q: str | None = Query(default=None),
    teacher_q: str | None = Query(default=None),
    only_active: bool = Query(default=True),
    day_of_week: int | None = Query(default=None, ge=0, le=6),
    use_today: bool = Query(default=False),
):
    # Subquery for attendance count per (student, course) within THEIR enrollment dates
    att_subquery = (
        select(
            Attendance.student_id, 
            Attendance.course_id, 
            func.count(Attendance.id).label("count")
        )
        .join(Enrollment, and_(
            Enrollment.student_id == Attendance.student_id,
            Enrollment.course_id == Attendance.course_id,
            Enrollment.tenant_id == Attendance.tenant_id
        ))
        .where(
            Attendance.tenant_id == tenant_id,
            Attendance.attended_at >= Enrollment.start_date,
            or_(Enrollment.end_date == None, Attendance.attended_at <= Enrollment.end_date),
            or_(Attendance.notes == None, Attendance.notes != 'clase_suelta')
        )
        .group_by(Attendance.student_id, Attendance.course_id)
        .subquery()
    )

    # Subquery for extra attendances per (student, course) OUTSIDE THEIR enrollment dates
    extra_subquery = (
        select(
            Attendance.student_id, 
            Attendance.course_id, 
            func.count(Attendance.id).label("count")
        )
        .join(Enrollment, and_(
            Enrollment.student_id == Attendance.student_id,
            Enrollment.course_id == Attendance.course_id,
            Enrollment.tenant_id == Attendance.tenant_id
        ))
        .where(
            Attendance.tenant_id == tenant_id,
            or_(
                and_(Enrollment.end_date != None, Attendance.attended_at > Enrollment.end_date),
                Attendance.notes == 'clase_suelta'
            )
        )
        .group_by(Attendance.student_id, Attendance.course_id)
        .subquery()
    )

    # Latest single-class payment per (student, course).
    # This lets course-status distinguish a paid one-off class from a real pending renewal.
    single_class_payment_subquery = (
        select(
            Payment.student_id,
            Payment.course_id,
            func.max(Payment.payment_date).label("latest_single_class_date"),
        )
        .where(
            Payment.tenant_id == tenant_id,
            Payment.type == "single_class",
        )
        .group_by(Payment.student_id, Payment.course_id)
        .subquery()
    )

    enrollment_join = and_(Enrollment.course_id == Course.id, Enrollment.tenant_id == Course.tenant_id)
    student_join = and_(Student.id == Enrollment.student_id, Student.tenant_id == Course.tenant_id)
    if only_active:
        enrollment_join = and_(enrollment_join, Enrollment.is_active == True)
        student_join = and_(student_join, Student.is_active == True)

    stmt = (
        select(
            Course,
            Teacher.name.label("teacher_name"),
            Student,
            Enrollment.id.label("enr_id"),
            Enrollment.start_date.label("enr_start"),
            Enrollment.end_date.label("enr_end"),
            func.coalesce(att_subquery.c.count, 0).label("att_count"),
            func.coalesce(extra_subquery.c.count, 0).label("extra_count"),
            single_class_payment_subquery.c.latest_single_class_date.label("latest_single_class_date"),
        )
        .join(Enrollment, enrollment_join, isouter=True)
        .join(Student, student_join, isouter=True)
        .join(Teacher, and_(Teacher.id == Course.teacher_id, Teacher.tenant_id == Course.tenant_id), isouter=True)
        .join(att_subquery, and_(att_subquery.c.student_id == Student.id, att_subquery.c.course_id == Course.id), isouter=True)
        .join(extra_subquery, and_(extra_subquery.c.student_id == Student.id, extra_subquery.c.course_id == Course.id), isouter=True)
        .join(single_class_payment_subquery, and_(single_class_payment_subquery.c.student_id == Student.id, single_class_payment_subquery.c.course_id == Course.id), isouter=True)
        .where(Course.tenant_id == tenant_id)
    )

    if only_active:
        stmt = stmt.where(Course.is_active == True)

    if course_q: stmt = stmt.where(Course.name.ilike(f"%{course_q}%"))
    if course_id: stmt = stmt.where(Course.id == course_id)
    if student_q:
        stmt = stmt.where(or_(Student.first_name.ilike(f"%{student_q}%"), Student.last_name.ilike(f"%{student_q}%")))
    effective_day = day_of_week
    if effective_day is None and use_today:
        effective_day = datetime.now(ZoneInfo("America/Santiago")).weekday()

    if effective_day is not None:
        stmt = stmt.where(
            or_(
                Course.day_of_week == effective_day,
                Course.day_of_week_2 == effective_day,
                Course.day_of_week_3 == effective_day,
                Course.day_of_week_4 == effective_day,
                Course.day_of_week_5 == effective_day,
            )
        )
    if teacher_q:
        stmt = stmt.where(Teacher.name.ilike(f"%{teacher_q}%"))

    rows = (await db.execute(stmt.order_by(Course.name, Student.last_name))).all()

    grouped = {}
    today = date.today()

    def count_weekdays(start, end, dows):
        if not start or not end or not dows: return 0
        days = (end - start).days + 1
        if days <= 0: return 0
        weeks = days // 7
        count = weeks * len(dows)
        rem = days % 7
        for i in range(rem):
            if (start + timedelta(days=i)).weekday() in dows:
                count += 1
        return count

    for course_obj, t_name, student_obj, enr_id, enr_start, enr_end, att_count, extra_count, latest_single_class_date in rows:
        cid = course_obj.id
        if cid not in grouped:
            grouped[cid] = {
                "course": {
                    "id": course_obj.id,
                    "name": course_obj.name,
                    "level": course_obj.level,
                    "price": float(course_obj.price) if course_obj.price else None,
                    "image_url": course_obj.image_url,
                    "day_of_week": course_obj.day_of_week,
                    "day_of_week_2": course_obj.day_of_week_2,
                    "day_of_week_3": course_obj.day_of_week_3,
                    "day_of_week_4": course_obj.day_of_week_4,
                    "day_of_week_5": course_obj.day_of_week_5,
                    "start_time": course_obj.start_time.isoformat() if course_obj.start_time else None,
                    "start_date": course_obj.start_date.isoformat() if course_obj.start_date else None,
                },
                "teacher": {"name": t_name} if t_name else None,
                "students": [],
                "counts": {"total": 0, "female": 0, "male": 0}
            }
        
        if student_obj:
            dows = [getattr(course_obj, f"day_of_week{suffix}", None) for suffix in ["", "_2", "_3", "_4", "_5"]]
            dows = [d for d in dows if d is not None]
            expected = count_weekdays(enr_start, enr_end or today, dows)
            current_period_active = bool(enr_end and enr_end >= today)

            # A standalone single-class should read as:
            # - Paid on or before its class date
            # - Inactive after that day
            # and it should not be reported as a pending monthly renewal.
            single_class_date = None
            if latest_single_class_date and not current_period_active:
                if enr_end is None or latest_single_class_date >= enr_end:
                    single_class_date = latest_single_class_date

            is_single_class = single_class_date is not None
            payment_status = "activo" if current_period_active else "pendiente"
            display_attendance_count = int(att_count or 0)
            display_extra_count = int(extra_count or 0)
            enrollment_mode = "regular"

            if is_single_class:
                enrollment_mode = "single_class"
                payment_status = "activo" if single_class_date >= today else "inactivo"
                expected = 1
                # Standalone single-class attendance is tracked via `notes=clase_suelta`,
                # so reuse that signal for display instead of showing it as an "extra".
                display_attendance_count = 1 if int(extra_count or 0) > 0 else 0
                display_extra_count = 0

            student_data = {
                "id": student_obj.id,
                "first_name": student_obj.first_name,
                "last_name": student_obj.last_name,
                "phone": student_obj.phone,
                "enrollment_id": enr_id,
                "photo_url": student_obj.photo_url,
                "gender": student_obj.gender,
                "enrolled_since": enr_start.isoformat() if enr_start else None,
                "renewal_date": enr_end.isoformat() if enr_end else None,
                "payment_status": payment_status,
                "enrollment_mode": enrollment_mode,
                "single_class_date": single_class_date.isoformat() if single_class_date else None,
                "attendance_count": display_attendance_count,
                "expected_count": expected,
                "extra_count": display_extra_count,
                "birthday_today": bool(student_obj.birthdate and student_obj.birthdate.month == today.month and student_obj.birthdate.day == today.day),
            }
            grouped[cid]["students"].append(student_data)
            grouped[cid]["counts"]["total"] += 1
            gen = (student_obj.gender or "").lower()
            if gen.startswith("f"): grouped[cid]["counts"]["female"] += 1
            elif gen.startswith("m"): grouped[cid]["counts"]["male"] += 1

    return list(grouped.values())
