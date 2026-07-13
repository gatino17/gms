from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

from app.pms.models import Attendance, Course, Student, Enrollment
from app.pms.deps import get_tenant_id, get_db_session
from app.core.config import settings

router = APIRouter(prefix="/api/pms", tags=["pms-attendance"])


def _course_slots_for_day(course: Course, day_idx: int):
    slots = []
    for suffix in ["", "_2", "_3", "_4", "_5"]:
        dow = getattr(course, f"day_of_week{suffix}", None)
        start = getattr(course, f"start_time{suffix}", None)
        end = getattr(course, f"end_time{suffix}", None)
        if dow == day_idx and start and end:
            slots.append((start, end))
    return slots


def _attendance_window_for_course(course: Course, local_now: datetime):
    slots = _course_slots_for_day(course, local_now.weekday())
    if not slots:
        return False, "Hoy no corresponde este curso para auto-asistencia. Dirígete a recepción para ingreso manual."

    open_ranges = []
    for start_t, end_t in slots:
        start_dt = local_now.replace(hour=start_t.hour, minute=start_t.minute, second=0, microsecond=0)
        end_dt = local_now.replace(hour=end_t.hour, minute=end_t.minute, second=0, microsecond=0)
        open_ranges.append((start_dt - timedelta(minutes=30), end_dt, start_t, end_t))

    for open_dt, close_dt, _start_t, end_t in open_ranges:
        if open_dt <= local_now <= close_dt:
            return True, f"Asistencia habilitada hasta las {end_t.strftime('%H:%M')} hrs."

    next_open = min(open_ranges, key=lambda item: item[0])
    last_close = max(open_ranges, key=lambda item: item[1])
    if local_now < next_open[0]:
        return False, f"La auto-asistencia se habilita desde las {next_open[0].strftime('%H:%M')} hrs. Dirígete a recepción para ingreso manual."
    return False, f"La auto-asistencia para este curso cerró a las {last_close[3].strftime('%H:%M')} hrs. Dirígete a recepción para ingreso manual."

class AttendanceIn(dict):
    student_id: int
    course_id: int
    # attended_at opcional si quieres permitir marcar otras fechas

@router.post("/attendance", status_code=201)
async def mark_attendance(
    payload: dict,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    student_id = payload.get("student_id")
    course_id = payload.get("course_id")
    if not student_id or not course_id:
        raise HTTPException(status_code=400, detail="student_id y course_id son requeridos")

    # Validaciones básicas
    c = await db.execute(select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id))
    course = c.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    s = await db.execute(select(Student.id).where(Student.id == student_id, Student.tenant_id == tenant_id))
    if not s.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    # Fecha/hora a marcar: por defecto ahora; opcionalmente aceptar 'attended_at' o 'date' (YYYY-MM-DD)
    # Registrar en hora local del negocio para que calendario y "hoy" coincidan con Chile.
    local_tz = ZoneInfo(settings.tz)
    attended_at = datetime.now(local_tz).replace(tzinfo=None)
    raw_dt = payload.get("attended_at") or payload.get("date")
    if isinstance(raw_dt, str) and raw_dt:
        try:
            # Acepta YYYY-MM-DD o ISO completo
            if len(raw_dt) == 10:
                y, m, d = map(int, raw_dt.split("-"))
                attended_at = datetime(y, m, d)
            else:
                attended_at = datetime.fromisoformat(raw_dt)
        except Exception:
            pass

    if bool(payload.get("self_service")):
        allowed, message = _attendance_window_for_course(course, datetime.now(local_tz))
        if not allowed:
            raise HTTPException(status_code=403, detail=message)

    # (Opcional) Evitar duplicado mismo día por alumno/curso
    start_day = attended_at.replace(hour=0, minute=0, second=0, microsecond=0)
    end_day = start_day + timedelta(days=1)
    exists_q = select(Attendance.attended_at).where(
        Attendance.tenant_id == tenant_id,
        Attendance.course_id == course_id,
        Attendance.student_id == student_id,
        Attendance.attended_at >= start_day,
        Attendance.attended_at < end_day,
    ).order_by(Attendance.attended_at.desc())
    exists = await db.execute(exists_q)
    existing_attended_at = exists.scalar_one_or_none()
    if existing_attended_at:
        # Idempotente: no falla, retorna 200 con mensaje
        local_tz = ZoneInfo(settings.tz)
        attended_at_local = existing_attended_at.replace(tzinfo=local_tz)
        return {"status": "already_marked", "attended_at": attended_at_local.isoformat()}

    # Verificar vigencia de matrícula para el curso/alumno en la fecha de asistencia
    today_ref = attended_at.date()
    enr_q = select(Enrollment.id, Enrollment.end_date).where(
        Enrollment.tenant_id == tenant_id,
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_id,
        Enrollment.is_active == True,
        Enrollment.start_date <= today_ref,
        or_(Enrollment.end_date == None, Enrollment.end_date >= today_ref),
    )
    enr = await db.execute(enr_q)
    enr_row = enr.first()
    renewal_required = enr_row is None
    last_class_today = False
    if enr_row:
        enrollment_end_date = enr_row[1]
        last_class_today = enrollment_end_date == today_ref

    is_recovery = bool(payload.get("is_recovery", False))
    notes = payload.get("notes")
    att = Attendance(
        tenant_id=tenant_id,
        student_id=student_id,
        course_id=course_id,
        attended_at=attended_at,
        marked_by="kiosk" if bool(payload.get("self_service")) else "web",
        is_recovery=is_recovery,
        notes=notes,
    )
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return {
        "status": "ok",
        "id": att.id,
        "renewal_required": renewal_required,
        "renewal_message": "Está en proceso de renovación, favor pasar por recepción." if renewal_required else None,
        "last_class_today": last_class_today,
        "last_class_message": "Hoy es tu última clase, recuerda pasar a renovar." if last_class_today else None,
    }


@router.delete("/attendance", status_code=200)
async def unmark_attendance(
    student_id: int,
    course_id: int,
    attended_date: date,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    # Borrar registros de asistencia para la fecha indicada (rango del día)
    start_day = datetime(attended_date.year, attended_date.month, attended_date.day)
    end_day = start_day + timedelta(days=1)
    res = await db.execute(
        select(Attendance).where(
            Attendance.tenant_id == tenant_id,
            Attendance.student_id == student_id,
            Attendance.course_id == course_id,
            Attendance.attended_at >= start_day,
            Attendance.attended_at < end_day,
        )
    )
    rows = res.scalars().all()
    if not rows:
        # idempotente
        return {"status": "not_found"}
    for r in rows:
        await db.delete(r)
    await db.commit()
    return {"status": "deleted", "count": len(rows)}

@router.get("/attendance/today")
async def attendance_today(
    course_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    local_tz = ZoneInfo(settings.tz)
    today = datetime.now(local_tz).date()
    start = datetime(today.year, today.month, today.day)
    end = start + timedelta(days=1)
    res = await db.execute(
        select(Attendance.student_id)
        .where(
            Attendance.tenant_id == tenant_id,
            Attendance.course_id == course_id,
            Attendance.attended_at >= start,
            Attendance.attended_at < end,
        )
    )
    ids = [row[0] for row in res.all()]
    return {"student_ids": ids}
