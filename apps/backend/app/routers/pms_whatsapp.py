from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import base64
import json
import asyncio

from app.core.config import settings
from app.pms.deps import get_db_session, get_tenant_id, get_current_active_superuser
from app.pms.models import Tenant, Student, Course, WhatsAppMessageLog, AppSetting


router = APIRouter(prefix="/api/pms/whatsapp", tags=["pms-whatsapp"])
DAY_NAMES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


class WhatsAppTestIn(BaseModel):
    student_id: int
    course_id: int


class TwilioAdminConfigIn(BaseModel):
    account_sid: str
    auth_token: str
    whatsapp_from: str
    enabled: bool = True


class TwilioAdminConfigOut(BaseModel):
    account_sid: str
    auth_token_configured: bool
    auth_token_masked: str | None = None
    whatsapp_from: str
    enabled: bool
    source: str


class TwilioAdminTestIn(BaseModel):
    to_phone: str
    body: str | None = None


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


async def _get_app_setting(db: AsyncSession, key: str) -> str:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalars().first()
    return (row.value or "").strip() if row else ""


async def _set_app_setting(db: AsyncSession, key: str, value: str) -> None:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalars().first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


async def _resolve_twilio_config(db: AsyncSession) -> tuple[str, str, str, bool, str]:
    sid_db = await _get_app_setting(db, "twilio_account_sid")
    token_db = await _get_app_setting(db, "twilio_auth_token")
    from_db = await _get_app_setting(db, "twilio_whatsapp_from")
    enabled_raw = await _get_app_setting(db, "twilio_enabled")
    enabled_db = enabled_raw.lower() in ("1", "true", "yes", "on")

    if sid_db and token_db and from_db:
        return sid_db, token_db, from_db, enabled_db if enabled_raw else True, "database"

    return (
        settings.twilio_account_sid.strip(),
        settings.twilio_auth_token.strip(),
        settings.twilio_whatsapp_from.strip(),
        True,
        "env",
    )


def _normalize_phone(phone: str | None) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith("56"):
        return f"whatsapp:+{digits}"
    if digits.startswith("0"):
        digits = digits[1:]
    return f"whatsapp:+56{digits}"


def _course_schedule_text(course: Course) -> str:
    day_idx = getattr(course, "day_of_week", None)
    start_time = getattr(course, "start_time", None)
    day_name = DAY_NAMES[day_idx] if isinstance(day_idx, int) and 0 <= day_idx <= 6 else ""
    hhmm = start_time.strftime("%H:%M") if start_time else ""
    if day_name and hhmm:
        return f"{day_name} {hhmm} hrs"
    if hhmm:
        return f"{hhmm} hrs"
    if day_name:
        return day_name
    return "horario por confirmar"


def _build_message(student_name: str, course: Course, tenant_name: str, custom_part: str | None) -> str:
    custom = (custom_part or f"Te saludamos de {tenant_name}.").strip()
    course_name = (course.name or "curso").strip()
    schedule = _course_schedule_text(course)
    return (
        f"Hola {student_name}, {custom} "
        f"Esperamos que estes disfrutando mucho tus clases. "
        f"Te recordamos que tienes un pago pendiente del curso *{course_name}* 💳 "
        f"de los dias *{schedule}* 📌🕒. "
        f"Nos vemos pronto ✨."
    )

def _twilio_send_whatsapp(to_phone: str, message: str, account_sid: str, auth_token: str, whatsapp_from: str) -> dict:
    if not account_sid or not auth_token or not whatsapp_from:
        raise HTTPException(status_code=400, detail="Twilio no configurado en el servidor.")

    form = urlencode(
        {
            "From": whatsapp_from,
            "To": to_phone,
            "Body": message,
        }
    ).encode("utf-8")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    auth_raw = f"{account_sid}:{auth_token}".encode("utf-8")
    auth_b64 = base64.b64encode(auth_raw).decode("ascii")
    req = Request(url, data=form, method="POST")
    req.add_header("Authorization", f"Basic {auth_b64}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urlopen(req, timeout=20) as res:
            payload = json.loads(res.read().decode("utf-8"))
            return payload
    except HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8"))
            detail = err.get("message") or err
        except Exception:
            detail = str(e)
        raise HTTPException(status_code=400, detail=f"Twilio error: {detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando WhatsApp: {e}")


def _twilio_get_message_status(sid: str, account_sid: str, auth_token: str) -> dict:
    if not account_sid or not auth_token:
        raise HTTPException(status_code=400, detail="Twilio no configurado en el servidor.")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{sid}.json"
    auth_raw = f"{account_sid}:{auth_token}".encode("utf-8")
    auth_b64 = base64.b64encode(auth_raw).decode("ascii")
    req = Request(url, method="GET")
    req.add_header("Authorization", f"Basic {auth_b64}")
    try:
        with urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode("utf-8"))
    except HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8"))
            detail = err.get("message") or err
        except Exception:
            detail = str(e)
        raise HTTPException(status_code=400, detail=f"Twilio error: {detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando estado Twilio: {e}")


@router.post("/test")
async def whatsapp_test_send(
    payload: WhatsAppTestIn,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado.")

    student = (
        await db.execute(
            select(Student).where(Student.id == payload.student_id, Student.tenant_id == tenant_id)
        )
    ).scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")

    course = (
        await db.execute(
            select(Course).where(Course.id == payload.course_id, Course.tenant_id == tenant_id)
        )
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")

    to_phone = _normalize_phone(student.phone)
    if not to_phone:
        raise HTTPException(status_code=400, detail="El alumno no tiene telÃ©fono vÃ¡lido para WhatsApp.")

    account_sid, auth_token, whatsapp_from, enabled, _ = await _resolve_twilio_config(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Twilio esta desactivado en configuracion.")

    msg = _build_message(
        student_name=student.first_name,
        course=course,
        tenant_name=tenant.name or "la academia",
        custom_part=tenant.whatsapp_message,
    )
    twilio_payload = _twilio_send_whatsapp(
        to_phone=to_phone,
        message=msg,
        account_sid=account_sid,
        auth_token=auth_token,
        whatsapp_from=whatsapp_from,
    )
    log = WhatsAppMessageLog(
        tenant_id=tenant_id,
        student_id=student.id,
        course_id=course.id,
        to_phone=to_phone,
        message_body=msg,
        sid=twilio_payload.get("sid"),
        status=twilio_payload.get("status"),
        error_code=twilio_payload.get("error_code"),
        error_message=twilio_payload.get("error_message"),
    )
    db.add(log)
    await db.commit()
    return {
        "ok": True,
        "mode": "sandbox",
        "to": to_phone,
        "sid": twilio_payload.get("sid"),
        "status": twilio_payload.get("status"),
        "log_id": log.id,
    }


@router.get("/status/{sid}")
async def whatsapp_status(
    sid: str,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    log = (
        await db.execute(
            select(WhatsAppMessageLog).where(
                WhatsAppMessageLog.sid == sid,
                WhatsAppMessageLog.tenant_id == tenant_id,
            )
        )
    ).scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado.")

    account_sid, auth_token, _, _, _ = await _resolve_twilio_config(db)
    twilio_payload = _twilio_get_message_status(sid, account_sid=account_sid, auth_token=auth_token)
    log.status = twilio_payload.get("status")
    log.error_code = twilio_payload.get("error_code")
    log.error_message = twilio_payload.get("error_message")
    await db.commit()
    return {
        "ok": True,
        "sid": sid,
        "status": log.status,
        "error_code": log.error_code,
        "error_message": log.error_message,
    }


@router.post("/status-callback")
async def whatsapp_status_callback(
    MessageSid: str = Form(default=""),
    MessageStatus: str = Form(default=""),
    ErrorCode: str = Form(default=""),
    ErrorMessage: str = Form(default=""),
    db: AsyncSession = Depends(get_db_session),
):
    if not MessageSid:
        return {"ok": True}
    log = (
        await db.execute(select(WhatsAppMessageLog).where(WhatsAppMessageLog.sid == MessageSid))
    ).scalars().first()
    if log:
        log.status = MessageStatus or log.status
        log.error_code = ErrorCode or log.error_code
        log.error_message = ErrorMessage or log.error_message
        await db.commit()
    return {"ok": True}


@router.get("/admin-config", response_model=TwilioAdminConfigOut)
async def get_twilio_admin_config(
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    sid, token, from_phone, enabled, source = await _resolve_twilio_config(db)
    return TwilioAdminConfigOut(
        account_sid=sid,
        auth_token_configured=bool(token),
        auth_token_masked=_mask_secret(token) if token else None,
        whatsapp_from=from_phone,
        enabled=enabled,
        source=source,
    )


@router.put("/admin-config", response_model=TwilioAdminConfigOut)
async def set_twilio_admin_config(
    payload: TwilioAdminConfigIn,
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    sid = (payload.account_sid or "").strip()
    token = (payload.auth_token or "").strip()
    from_phone = (payload.whatsapp_from or "").strip()
    if not sid or not token or not from_phone:
        raise HTTPException(status_code=400, detail="SID, token y whatsapp_from son obligatorios.")
    if not from_phone.startswith("whatsapp:+"):
        raise HTTPException(status_code=400, detail="El numero origen debe iniciar con 'whatsapp:+'.")

    await _set_app_setting(db, "twilio_account_sid", sid)
    await _set_app_setting(db, "twilio_auth_token", token)
    await _set_app_setting(db, "twilio_whatsapp_from", from_phone)
    await _set_app_setting(db, "twilio_enabled", "true" if payload.enabled else "false")
    await db.commit()

    return TwilioAdminConfigOut(
        account_sid=sid,
        auth_token_configured=True,
        auth_token_masked=_mask_secret(token),
        whatsapp_from=from_phone,
        enabled=payload.enabled,
        source="database",
    )


@router.post("/admin-test")
async def twilio_admin_test(
    payload: TwilioAdminTestIn,
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    account_sid, auth_token, whatsapp_from, enabled, _ = await _resolve_twilio_config(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Twilio esta desactivado en configuracion.")
    to_phone = _normalize_phone(payload.to_phone)
    if not to_phone:
        raise HTTPException(status_code=400, detail="Numero destino invalido.")
    body = (payload.body or "Prueba de WhatsApp desde la configuracion de Studios.").strip()
    sent = _twilio_send_whatsapp(
        to_phone=to_phone,
        message=body,
        account_sid=account_sid,
        auth_token=auth_token,
        whatsapp_from=whatsapp_from,
    )
    sid = sent.get("sid")
    initial_status = (sent.get("status") or "").lower()
    final_status = initial_status
    error_code = sent.get("error_code")
    error_message = sent.get("error_message")

    if sid:
        # Small polling window to provide clearer sandbox feedback (join / no join)
        for _ in range(3):
            await asyncio.sleep(1.5)
            st = _twilio_get_message_status(sid, account_sid=account_sid, auth_token=auth_token)
            final_status = (st.get("status") or final_status or "").lower()
            error_code = st.get("error_code") or error_code
            error_message = st.get("error_message") or error_message
            if final_status in ("delivered", "read", "failed", "undelivered"):
                break

    if final_status in ("delivered", "read"):
        message = f"Prueba enviada y entregada. SID: {sid}"
    elif final_status in ("failed", "undelivered"):
        message = f"Prueba enviada. SID: {sid}. No entregado (sandbox): el numero probablemente no hizo join."
    else:
        message = f"Prueba enviada. SID: {sid}. Estado actual: {final_status or 'pendiente'} (si no hizo join, no se entregara)."

    return {
        "ok": True,
        "sid": sid,
        "status": final_status or initial_status,
        "error_code": error_code,
        "error_message": error_message,
        "message": message,
    }




