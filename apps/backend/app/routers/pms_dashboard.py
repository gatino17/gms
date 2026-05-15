from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import date, timedelta
from typing import Any

from app.pms.models import Course, Enrollment, Student, Payment, Attendance, Teacher
from app.pms.deps import get_tenant_id, get_db_session

router = APIRouter(prefix="/api/pms/dashboard", tags=["pms-dashboard"])

@router.get("/summary")
async def get_summary(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session)
) -> Any:
    today = date.today()
    month_start = today.replace(day=1)
    soon_end_date = today + timedelta(days=7)
    dow = today.weekday()
    
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
            'level', Course.level, 'image_url', Course.image_url, 'teacher_name', Teacher.name
        )), func.json_build_array())).select_from(Course).outerjoin(Teacher, Teacher.id == Course.teacher_id).where(
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
        "attendance_30d": res[5] or 0
    }
