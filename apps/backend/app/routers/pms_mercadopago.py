from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.pms.deps import get_current_student, get_db_session
from app.pms.models import Course, Enrollment, Payment, Student, Teacher, Tenant

router = APIRouter(prefix="/api/pms/mercadopago", tags=["pms-mercadopago"])


class MercadoPagoCheckoutRequest(BaseModel):
    enrollment_id: int


def _mp_headers() -> dict[str, str]:
    token = settings.mercadopago_access_token.strip()
    if not token:
        raise HTTPException(status_code=503, detail="Mercado Pago no esta configurado")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _course_weekdays(course: Course) -> list[int]:
    days: set[int] = set()
    for attr in ("day_of_week", "day_of_week_2", "day_of_week_3", "day_of_week_4", "day_of_week_5"):
        value = getattr(course, attr, None)
        if value is not None:
            days.add(int(value))
    return sorted(days)


def _period_end_for_course(start: date, course: Course) -> date:
    total_classes = int(getattr(course, "total_classes", None) or 4)
    if total_classes <= 1:
        return start
    days = _course_weekdays(course)
    if not days:
        return start + timedelta(days=21)

    attended_dates: list[date] = []
    current = start
    guard = 0
    while len(attended_dates) < total_classes and guard < 370:
        if current.weekday() in days:
            attended_dates.append(current)
        current += timedelta(days=1)
        guard += 1
    return attended_dates[-1] if attended_dates else start + timedelta(days=21)


def _next_course_date(after_date: date, course: Course) -> date:
    days = _course_weekdays(course)
    if not days:
        return after_date + timedelta(days=1)
    current = after_date + timedelta(days=1)
    for _ in range(14):
        if current.weekday() in days:
            return current
        current += timedelta(days=1)
    return after_date + timedelta(days=1)


def _next_period(enrollment: Enrollment, course: Course) -> tuple[date, date]:
    today = date.today()
    if enrollment.end_date:
        start = _next_course_date(enrollment.end_date, course)
    else:
        start = today
    if start < today:
        start = today if today.weekday() in _course_weekdays(course) else _next_course_date(today - timedelta(days=1), course)
    return start, _period_end_for_course(start, course)


def _payment_reference(payment_id: str | int) -> str:
    return f"MP:{payment_id}"


def _parse_iso_date(value: Any) -> date:
    if not value:
        return date.today()
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except Exception:
        return date.today()


async def _fetch_mp_payment(payment_id: str | int) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"https://api.mercadopago.com/v1/payments/{payment_id}",
            headers=_mp_headers(),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo consultar el pago en Mercado Pago")
    return response.json()


async def _register_approved_payment(db: AsyncSession, payment_data: dict[str, Any]) -> bool:
    payment_id = payment_data.get("id")
    if not payment_id:
        return False
    if payment_data.get("status") != "approved":
        return False

    reference = _payment_reference(payment_id)
    existing = await db.scalar(select(Payment.id).where(Payment.reference == reference))
    if existing:
        return False

    metadata = payment_data.get("metadata") or {}
    tenant_id = int(metadata.get("tenant_id") or 0)
    student_id = int(metadata.get("student_id") or 0)
    course_id = int(metadata.get("course_id") or 0)
    enrollment_id = int(metadata.get("enrollment_id") or 0)
    if not tenant_id or not student_id or not course_id or not enrollment_id:
        return False

    tenant = await db.get(Tenant, tenant_id)
    if not tenant or not getattr(tenant, "online_payments_enabled", False):
        return False

    enrollment = await db.get(Enrollment, enrollment_id)
    if not enrollment or enrollment.tenant_id != tenant_id or enrollment.student_id != student_id or enrollment.course_id != course_id:
        return False

    student = await db.get(Student, student_id)
    course_res = await db.execute(
        select(Course)
        .options(selectinload(Course.teacher))
        .where(Course.id == course_id, Course.tenant_id == tenant_id)
    )
    course = course_res.scalar_one_or_none()
    if not student or not course:
        return False

    period_start_raw = metadata.get("period_start")
    period_end_raw = metadata.get("period_end")
    period_start = date.fromisoformat(period_start_raw) if period_start_raw else None
    period_end = date.fromisoformat(period_end_raw) if period_end_raw else None
    if period_start and period_end:
        enrollment.start_date = period_start
        enrollment.end_date = period_end
        enrollment.is_active = True

    amount = Decimal(str(payment_data.get("transaction_amount") or metadata.get("amount") or 0))
    if amount <= 0:
        return False

    db.add(
        Payment(
            tenant_id=tenant_id,
            student_id=student_id,
            student_name=f"{student.first_name} {student.last_name}".strip(),
            course_id=course_id,
            teacher_name_snapshot=getattr(getattr(course, "teacher", None), "name", None),
            amount=amount,
            payment_date=_parse_iso_date(payment_data.get("date_approved") or payment_data.get("date_created")),
            method="mercado_pago",
            type=str(metadata.get("payment_type") or "monthly"),
            reference=reference,
            notes=f"Pago aprobado por Mercado Pago. Preference: {payment_data.get('preference_id') or '-'}",
            period_start=period_start,
            period_end=period_end,
        )
    )
    await db.commit()
    return True


@router.post("/checkout")
async def create_checkout_preference(
    payload: MercadoPagoCheckoutRequest,
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
):
    tenant = await db.get(Tenant, current_student.tenant_id)
    if not tenant or not tenant.mobile_enabled or not tenant.student_portal_enabled:
        raise HTTPException(status_code=403, detail="Portal de alumnos no habilitado")
    if not getattr(tenant, "online_payments_enabled", False):
        raise HTTPException(status_code=403, detail="Pagos online no habilitados para este estudio")

    res = await db.execute(
        select(Enrollment, Course)
        .join(Course, Course.id == Enrollment.course_id)
        .where(
            Enrollment.id == payload.enrollment_id,
            Enrollment.tenant_id == current_student.tenant_id,
            Enrollment.student_id == current_student.id,
        )
    )
    row = res.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Curso del alumno no encontrado")
    enrollment, course = row
    if enrollment.is_active is False:
        raise HTTPException(status_code=400, detail="El curso no esta activo para pago online")
    if enrollment.end_date and enrollment.end_date >= date.today():
        raise HTTPException(status_code=400, detail="Este curso ya esta al dia")

    amount = Decimal(str(getattr(course, "price", None) or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="El curso no tiene precio mensual configurado")

    period_start, period_end = _next_period(enrollment, course)
    frontend_url = settings.frontend_public_url.rstrip("/")
    notification_url = settings.mercadopago_webhook_url.strip() or None
    period_label = f"{period_start.strftime('%d-%m-%Y')} al {period_end.strftime('%d-%m-%Y')}"

    preference_payload: dict[str, Any] = {
        "items": [
            {
                "id": str(course.id),
                "title": f"{course.name} | {period_label}",
                "description": f"{tenant.name} - Renovacion mensual",
                "quantity": 1,
                "currency_id": "CLP",
                "unit_price": float(amount),
            }
        ],
        "payer": {
            "name": current_student.first_name,
            "surname": current_student.last_name,
            "email": current_student.email,
        },
        "external_reference": f"pms:{tenant.id}:{current_student.id}:{course.id}:{enrollment.id}:{period_start}:{period_end}",
        "metadata": {
            "tenant_id": tenant.id,
            "student_id": current_student.id,
            "course_id": course.id,
            "enrollment_id": enrollment.id,
            "payment_type": "monthly",
            "amount": float(amount),
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        },
        "back_urls": {
            "success": f"{frontend_url}/mobile/payments?mp_status=success",
            "failure": f"{frontend_url}/mobile/payments?mp_status=failure",
            "pending": f"{frontend_url}/mobile/payments?mp_status=pending",
        },
    }
    if frontend_url.startswith("https://"):
        preference_payload["auto_return"] = "approved"
    if notification_url:
        preference_payload["notification_url"] = notification_url

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.mercadopago.com/checkout/preferences",
            headers=_mp_headers(),
            json=preference_payload,
        )
    if response.status_code >= 400:
        detail = response.text
        raise HTTPException(status_code=502, detail=f"Mercado Pago rechazo la preferencia: {detail}")

    preference = response.json()
    return {
        "preference_id": preference.get("id"),
        "init_point": preference.get("init_point"),
        "sandbox_init_point": preference.get("sandbox_init_point"),
        "amount": float(amount),
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
    }


@router.post("/webhook")
async def mercadopago_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    payload: dict[str, Any] = {}
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    query = request.query_params
    payment_id = (
        payload.get("data", {}).get("id")
        or payload.get("id")
        or query.get("data.id")
        or query.get("id")
    )
    event_type = payload.get("type") or payload.get("topic") or query.get("type") or query.get("topic")
    if not payment_id or (event_type and "payment" not in str(event_type).lower()):
        return {"ok": True, "ignored": True}

    payment_data = await _fetch_mp_payment(payment_id)
    registered = await _register_approved_payment(db, payment_data)
    return {"ok": True, "registered": registered}
