from __future__ import annotations

from datetime import date

from sqlalchemy import Date, cast, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.pms.models import Attendance


async def regularize_extra_attendance_for_paid_period(
    db: AsyncSession,
    *,
    tenant_id: int,
    student_id: int | None,
    course_id: int | None,
    period_start: date | None,
    period_end: date | None,
) -> int:
    """Convert unpaid extra marks into normal attendance once a period covers them."""
    if not student_id or not course_id or not period_start or not period_end:
        return 0

    result = await db.execute(
        update(Attendance)
        .where(
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.course_id == course_id,
            Attendance.is_recovery == False,  # noqa: E712
            Attendance.notes == "clase_suelta",
            cast(Attendance.attended_at, Date) >= period_start,
            cast(Attendance.attended_at, Date) <= period_end,
        )
        .values(notes=None)
    )
    return int(result.rowcount or 0)
