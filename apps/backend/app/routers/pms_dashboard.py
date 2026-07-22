from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case
from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo
from typing import Any

from app.pms.models import Course, Enrollment, Student, Payment, Attendance, Teacher
from app.pms.deps import get_tenant_id, get_db_session

router = APIRouter(prefix="/api/pms/dashboard", tags=["pms-dashboard"])


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


def _course_days(course: Course) -> list[int]:
    return [
        day for day in [
            course.day_of_week,
            course.day_of_week_2,
            course.day_of_week_3,
            course.day_of_week_4,
            course.day_of_week_5,
        ] if day is not None
    ]


def _count_weekdays(start: date, end: date, dows: list[int]) -> int:
    if start > end or not dows:
        return 0
    total = 0
    for dow in set(dows):
        current = start
        diff = (dow - current.weekday()) % 7
        current += timedelta(days=diff)
        while current <= end:
            total += 1
            current += timedelta(days=7)
    return total


async def _highlighted_students(db: AsyncSession, tenant_id: int, today: date) -> dict[str, Any]:
    tiers = [
        {"months": 12, "threshold": 95.0, "label": "Excelencia 12M"},
        {"months": 6, "threshold": 95.0, "label": "Disciplina 6M"},
        {"months": 4, "threshold": 90.0, "label": "Constancia 4M"},
    ]
    min_cutoff = _subtract_months(today, 12)

    rows = (
        await db.execute(
            select(Student, Enrollment, Course)
            .join(Enrollment, and_(Enrollment.student_id == Student.id, Enrollment.tenant_id == tenant_id))
            .join(Course, and_(Course.id == Enrollment.course_id, Course.tenant_id == tenant_id))
            .where(
                Student.tenant_id == tenant_id,
                Student.is_active.is_(True),
                Enrollment.is_active.is_(True),
                Course.is_active.is_(True),
            )
        )
    ).all()

    by_student: dict[int, dict[str, Any]] = {}
    course_ids: set[int] = set()
    for student, enrollment, course in rows:
        course_ids.add(course.id)
        entry = by_student.setdefault(
            student.id,
            {
                "student": student,
                "enrollments": [],
            },
        )
        entry["enrollments"].append((enrollment, course))

    if not by_student:
        return {"total": 0, "by_tier": {"4": 0, "6": 0, "12": 0}, "items": []}

    attendance_set: set[tuple[int, int, date]] = set()
    min_cutoff_dt = datetime.combine(min_cutoff, datetime.min.time())
    tomorrow_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    att_rows = (
        await db.execute(
            select(Attendance.student_id, Attendance.course_id, Attendance.attended_at)
            .where(
                Attendance.tenant_id == tenant_id,
                Attendance.student_id.in_(list(by_student.keys())),
                Attendance.course_id.in_(list(course_ids)),
                Attendance.attended_at >= min_cutoff_dt,
                Attendance.attended_at < tomorrow_dt,
                or_(Attendance.notes == None, Attendance.notes != "clase_suelta"),
            )
        )
    ).all()
    for student_id, course_id, attended_at in att_rows:
        attendance_set.add((int(student_id), int(course_id), attended_at.date()))

    highlighted: list[dict[str, Any]] = []
    by_tier = {"4": 0, "6": 0, "12": 0}

    for student_id, entry in by_student.items():
        student: Student = entry["student"]
        enrollments: list[tuple[Enrollment, Course]] = entry["enrollments"]
        payments_current = all(enr.end_date is not None and enr.end_date >= today for enr, _course in enrollments)
        if not payments_current:
            continue

        best: dict[str, Any] | None = None
        for tier in tiers:
            cutoff = _subtract_months(today, int(tier["months"]))
            if student.joined_at and student.joined_at > cutoff:
                continue
            if not any(enr.start_date <= cutoff for enr, _course in enrollments):
                continue

            expected = 0
            attended = 0
            for enr, course in enrollments:
                window_start = max(enr.start_date, cutoff)
                window_end = min(enr.end_date or today, today)
                if window_start > window_end:
                    continue
                expected += _count_weekdays(window_start, window_end, _course_days(course))
                attended += sum(
                    1
                    for sid, cid, att_date in attendance_set
                    if sid == student_id and cid == course.id and window_start <= att_date <= window_end
                )

            if expected <= 0:
                continue
            rate = min(100.0, round((attended / expected) * 100, 1))
            if rate >= float(tier["threshold"]):
                best = {
                    "id": student.id,
                    "name": f"{student.first_name} {student.last_name}",
                    "photo_url": student.photo_url,
                    "tier_months": tier["months"],
                    "tier_label": tier["label"],
                    "attendance_rate": rate,
                    "attended": attended,
                    "expected": expected,
                    "payment_status": "Al dia",
                }
                break

        if best:
            by_tier[str(best["tier_months"])] += 1
            highlighted.append(best)

    highlighted.sort(key=lambda item: (int(item["tier_months"]), float(item["attendance_rate"]), int(item["attended"])), reverse=True)
    return {"total": len(highlighted), "by_tier": by_tier, "items": highlighted[:5]}

@router.get("/summary")
async def get_summary(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session)
) -> Any:
    cl_now = datetime.now(ZoneInfo("America/Santiago"))
    today = cl_now.date()
    month_start = today.replace(day=1)
    soon_end_date = today + timedelta(days=7)
    dow = today.weekday()
    
    # Subquery for student counts per course
    counts_sub = (
        select(
            Enrollment.course_id,
            func.count(Student.id).label("total"),
            func.sum(case((Student.gender == 'Femenino', 1), else_=0)).label("female"),
            func.sum(case((Student.gender == 'Masculino', 1), else_=0)).label("male")
        )
        .join(Student, and_(Enrollment.student_id == Student.id, Student.tenant_id == tenant_id))
        .where(Enrollment.tenant_id == tenant_id, Enrollment.is_active == True)
        .group_by(Enrollment.course_id)
        .alias("course_counts")
    )
    
    # Subquery for Birthdays (Students + Teachers)
    birthday_sub = select((Student.first_name + ' ' + Student.last_name).label("name")).where(
        Student.tenant_id == tenant_id, Student.is_active == True,
        func.extract('month', Student.birthdate) == today.month,
        func.extract('day', Student.birthdate) == today.day
    ).union_all(
        select((Teacher.name + ' (Profesor)').label("name")).where(
            Teacher.tenant_id == tenant_id,
            func.extract('month', Teacher.birthdate) == today.month,
            func.extract('day', Teacher.birthdate) == today.day
        )
    ).alias("bday_union")

    main_stmt = select(
        # KPIs
        select(func.count(Student.id)).where(Student.tenant_id == tenant_id, Student.is_active == True).label("students"),
        select(func.count(Course.id)).where(Course.tenant_id == tenant_id, Course.is_active == True).label("courses"),
        select(func.sum(Payment.amount)).where(Payment.tenant_id == tenant_id, Payment.payment_date == today).label("rev_today"),
        select(func.sum(Payment.amount)).where(Payment.tenant_id == tenant_id, Payment.payment_date >= month_start).label("rev_month"),
        select(func.count(Enrollment.id)).where(Enrollment.tenant_id == tenant_id, Enrollment.is_active == True, or_(Enrollment.end_date == None, Enrollment.end_date < today)).label("pendings"),
        select(func.count(Attendance.id)).where(Attendance.tenant_id == tenant_id, Attendance.attended_at >= (today - timedelta(days=30))).label("att_30d"),
        
        # Birthdays (JSON array of names)
        select(func.coalesce(func.json_agg(birthday_sub.c.name), func.json_build_array())).select_from(birthday_sub).label("birthdays"),
        
        # Classes Today (JSON array of objects)
        select(func.coalesce(func.json_agg(func.json_build_object(
            'id', Course.id, 'name', Course.name, 'start_time', Course.start_time, 'end_time', Course.end_time, 
            'level', Course.level, 'image_url', Course.image_url, 'teacher_name', Teacher.name,
            'total_students', func.coalesce(counts_sub.c.total, 0),
            'female_students', func.coalesce(counts_sub.c.female, 0),
            'male_students', func.coalesce(counts_sub.c.male, 0)
        )), func.json_build_array())).select_from(Course).outerjoin(Teacher, Teacher.id == Course.teacher_id).outerjoin(counts_sub, counts_sub.c.course_id == Course.id).where(
            Course.tenant_id == tenant_id, Course.is_active == True,
            or_(Course.day_of_week == dow, Course.day_of_week_2 == dow, Course.day_of_week_3 == dow, Course.day_of_week_4 == dow, Course.day_of_week_5 == dow)
        ).label("classes_today")
    )
    
    # Execute the massive consolidated query
    res = (await db.execute(main_stmt)).first()
    
    # Separate query for group-bys and lists with complex joins (to keep it readable and performant)
    # Revenue by method
    rev_method_stmt = select(Payment.method, func.sum(Payment.amount)).where(
        Payment.tenant_id == tenant_id, Payment.payment_date >= month_start
    ).group_by(Payment.method)
    
    # Recent Payments (fetching only what we need)
    recent_stmt = (
        select(Payment.id, Payment.amount, Payment.payment_date, Payment.method, Payment.type, Payment.reference, Course.name, Student.first_name, Student.last_name)
        .join(Course, and_(Course.id == Payment.course_id, Course.tenant_id == tenant_id), isouter=True)
        .join(Student, and_(Student.id == Payment.student_id, Student.tenant_id == tenant_id), isouter=True)
        .where(Payment.tenant_id == tenant_id)
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
        .limit(6) # Reduced limit slightly for speed
    )

    # Alerts Previews
    pending_prev_stmt = select(Student.first_name, Student.last_name, Course.name, Enrollment.end_date).join(Enrollment, and_(Enrollment.student_id == Student.id, Enrollment.tenant_id == tenant_id)).join(Course, and_(Course.id == Enrollment.course_id, Course.tenant_id == tenant_id)).where(
        Enrollment.tenant_id == tenant_id, Enrollment.is_active == True,
        or_(Enrollment.end_date == None, Enrollment.end_date < today)
    ).limit(3)
    
    soon_stmt = select(Student.first_name, Student.last_name, Course.name, Enrollment.end_date).join(Student).join(Course).where(
        Enrollment.tenant_id == tenant_id, Enrollment.is_active == True,
        Enrollment.end_date >= today, Enrollment.end_date <= soon_end_date
    ).limit(5)

    # We still have a few awaits, but much fewer than 10. 
    # Total round-trips: 1 (main) + 4 (lists) = 5. Better than before.
    # Actually, let's use asyncio.gather for these remaining ones if we can, 
    # but since they use the same session, we'll just execute them.
    
    rev_res = await db.execute(rev_method_stmt)
    recent_res = await db.execute(recent_stmt)
    p_prev_res = await db.execute(pending_prev_stmt)
    soon_res = await db.execute(soon_stmt)
    highlighted = await _highlighted_students(db, tenant_id, today)

    return {
        "kpis": {
            "active_students": res[0] or 0,
            "active_courses": res[1] or 0,
            "revenue_today": float(res[2] or 0),
            "revenue_month": float(res[3] or 0),
            "revenue_by_method": {str(r[0]): float(r[1] or 0) for r in rev_res.all()}
        },
        "classes_today": res[7] or [],
        "recent_payments": [
            {
                "id": r[0], "amount": float(r[1] or 0), "payment_date": r[2].isoformat(),
                "method": r[3], "type": r[4], "reference": r[5], "course_name": r[6],
                "student_name": f"{r[7]} {r[8]}" if r[7] else None
            } for r in recent_res.all()
        ],
        "alerts": {
            "pending_count": res[4] or 0,
            "pending_preview": [{"student": f"{r[0]} {r[1]}", "course": r[2], "end_date": r[3].isoformat() if r[3] else None} for r in p_prev_res.all()],
            "birthdays": res[6] or [],
            "soon_end": [{"student": f"{r[0]} {r[1]}", "course": r[2], "renewal_date": r[3].isoformat()} for r in soon_res.all()]
        },
        "attendance_30d": res[5] or 0,
        "highlighted_students": highlighted,
    }
