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
from datetime import datetime, timezone

from app.core.config import settings
from app.pms.deps import get_db_session, get_tenant_id, get_current_active_superuser, get_current_user
from app.pms.models import Tenant, Student, Course, WhatsAppMessageLog, AppSetting
from app.pms.phone_utils import COUNTRY_PHONE_PRESETS, normalize_phone_value, resolve_tenant_phone_prefix


router = APIRouter(prefix="/api/pms/whatsapp", tags=["pms-whatsapp"])
DAY_NAMES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
DEFAULT_WHATSAPP_TEMPLATE_SID = "HXc48c3cc85e952f4801808ddaff9a809e"


class WhatsAppTestIn(BaseModel):
    student_id: int
    course_id: int


class TwilioAdminConfigIn(BaseModel):
    account_sid: str
    auth_token: str | None = None
    api_key_sid: str | None = None
    api_key_secret: str | None = None
    whatsapp_from: str
    template_sid: str | None = None
    enabled: bool = True


class TwilioAdminConfigOut(BaseModel):
    account_sid: str
    auth_token_configured: bool
    auth_token_masked: str | None = None
    api_key_sid: str | None = None
    api_key_configured: bool = False
    api_key_masked: str | None = None
    auth_mode: str = "unknown"
    whatsapp_from: str
    template_sid: str | None = None
    enabled: bool
    source: str


class TwilioActiveTemplateOut(BaseModel):
    template_sid: str


class TwilioAdminTestIn(BaseModel):
    to_phone: str
    body: str | None = None


class TwilioBalanceOut(BaseModel):
    balance_usd: float
    currency: str
    budget_usd: float
    threshold_usd: float
    remaining_usd: float
    remaining_percent: float
    level: str
    checked_at: str


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


async def _resolve_twilio_config(db: AsyncSession) -> tuple[str, str, str, str, str, bool, str]:
    sid_db = await _get_app_setting(db, "twilio_account_sid")
    token_db = await _get_app_setting(db, "twilio_auth_token")
    api_key_sid_db = await _get_app_setting(db, "twilio_api_key_sid")
    api_key_secret_db = await _get_app_setting(db, "twilio_api_key_secret")
    from_db = await _get_app_setting(db, "twilio_whatsapp_from")
    enabled_raw = await _get_app_setting(db, "twilio_enabled")
    enabled_db = enabled_raw.lower() in ("1", "true", "yes", "on")

    if sid_db and from_db and ((api_key_sid_db and api_key_secret_db) or token_db):
        return (
            sid_db,
            token_db,
            api_key_sid_db,
            api_key_secret_db,
            from_db,
            enabled_db if enabled_raw else True,
            "database",
        )

    return (
        settings.twilio_account_sid.strip(),
        settings.twilio_auth_token.strip(),
        settings.twilio_api_key_sid.strip(),
        settings.twilio_api_key_secret.strip(),
        settings.twilio_whatsapp_from.strip(),
        True,
        "env",
    )


async def _resolve_twilio_template_sid(db: AsyncSession) -> str:
    template_db = await _get_app_setting(db, "twilio_whatsapp_template_sid")
    if template_db:
        return template_db
    if settings.twilio_whatsapp_template_sid.strip():
        return settings.twilio_whatsapp_template_sid.strip()
    return DEFAULT_WHATSAPP_TEMPLATE_SID


def _twilio_auth_b64(account_sid: str, auth_token: str, api_key_sid: str, api_key_secret: str) -> str:
    # Prefer API Key auth when available, fallback to auth token.
    if api_key_sid and api_key_secret:
        auth_raw = f"{api_key_sid}:{api_key_secret}".encode("utf-8")
    elif account_sid and auth_token:
        auth_raw = f"{account_sid}:{auth_token}".encode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Twilio no configurado en el servidor.")
    return base64.b64encode(auth_raw).decode("ascii")


def _normalize_phone(phone: str | None, tenant: Tenant | None = None) -> str:
    normalized = normalize_phone_value(
        phone,
        default_prefix=resolve_tenant_phone_prefix(
            getattr(tenant, "phone_prefix", None),
            getattr(tenant, "country", None),
            getattr(tenant, "currency", None),
        ),
        known_prefixes=[preset["prefix"] for preset in COUNTRY_PHONE_PRESETS.values()],
    )
    return f"whatsapp:{normalized}" if normalized else ""


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


def _is_twilio_sandbox_sender(whatsapp_from: str) -> bool:
    normalized = (whatsapp_from or "").strip().lower()
    return normalized == "whatsapp:+14155238886"


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


def _build_template_variables(student_name: str, course_name: str, schedule: str, tenant_name: str) -> dict[str, str]:
    return {
        "1": student_name.strip() or "Alumno",
        "2": course_name.strip() or "curso",
        "3": schedule.strip() or "horario por confirmar",
        "4": tenant_name.strip() or "la academia",
    }

def _twilio_send_whatsapp(
    to_phone: str,
    message: str,
    account_sid: str,
    auth_token: str,
    api_key_sid: str,
    api_key_secret: str,
    whatsapp_from: str,
) -> dict:
    if not account_sid or not whatsapp_from:
        raise HTTPException(status_code=400, detail="Twilio no configurado en el servidor.")

    form = urlencode(
        {
            "From": whatsapp_from,
            "To": to_phone,
            "Body": message,
        }
    ).encode("utf-8")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    auth_b64 = _twilio_auth_b64(account_sid, auth_token, api_key_sid, api_key_secret)
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


def _twilio_send_whatsapp_template(
    to_phone: str,
    content_sid: str,
    content_variables: dict[str, str],
    account_sid: str,
    auth_token: str,
    api_key_sid: str,
    api_key_secret: str,
    whatsapp_from: str,
) -> dict:
    if not account_sid or not whatsapp_from or not content_sid:
        raise HTTPException(status_code=400, detail="Twilio template no configurado en el servidor.")

    form = urlencode(
        {
            "From": whatsapp_from,
            "To": to_phone,
            "ContentSid": content_sid,
            "ContentVariables": json.dumps(content_variables, ensure_ascii=False),
        }
    ).encode("utf-8")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    auth_b64 = _twilio_auth_b64(account_sid, auth_token, api_key_sid, api_key_secret)
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
        raise HTTPException(status_code=500, detail=f"Error enviando plantilla WhatsApp: {e}")


def _twilio_get_message_status(
    sid: str, account_sid: str, auth_token: str, api_key_sid: str, api_key_secret: str
) -> dict:
    if not account_sid:
        raise HTTPException(status_code=400, detail="Twilio no configurado en el servidor.")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{sid}.json"
    auth_b64 = _twilio_auth_b64(account_sid, auth_token, api_key_sid, api_key_secret)
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


def _to_float(value: str | None, fallback: float) -> float:
    try:
        return float((value or "").strip())
    except Exception:
        return fallback


def _twilio_price_usd(payload: dict | None) -> float | None:
    if not payload:
        return None
    raw = payload.get("price")
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except Exception:
        return None


def _twilio_get_balance(account_sid: str, auth_token: str, api_key_sid: str, api_key_secret: str) -> dict:
    if not account_sid:
        raise HTTPException(status_code=400, detail="Twilio no configurado en el servidor.")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Balance.json"
    auth_b64 = _twilio_auth_b64(account_sid, auth_token, api_key_sid, api_key_secret)
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
        raise HTTPException(status_code=500, detail=f"Error consultando balance Twilio: {e}")


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

    to_phone = _normalize_phone(student.phone, tenant)
    if not to_phone:
        raise HTTPException(status_code=400, detail="El alumno no tiene telÃ©fono vÃ¡lido para WhatsApp.")

    account_sid, auth_token, api_key_sid, api_key_secret, whatsapp_from, enabled, _ = await _resolve_twilio_config(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Twilio esta desactivado en configuracion.")

    template_sid = await _resolve_twilio_template_sid(db)
    schedule = _course_schedule_text(course)
    template_variables = _build_template_variables(
        student_name=student.first_name,
        course_name=course.name or "curso",
        schedule=schedule,
        tenant_name=tenant.name or "la academia",
    )
    msg = _build_message(
        student_name=student.first_name,
        course=course,
        tenant_name=tenant.name or "la academia",
        custom_part=tenant.whatsapp_message,
    )
    twilio_payload = _twilio_send_whatsapp_template(
        to_phone=to_phone,
        content_sid=template_sid,
        content_variables=template_variables,
        account_sid=account_sid,
        auth_token=auth_token,
        api_key_sid=api_key_sid,
        api_key_secret=api_key_secret,
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
        price_usd=_twilio_price_usd(twilio_payload),
        price_unit=twilio_payload.get("price_unit"),
        error_code=twilio_payload.get("error_code"),
        error_message=twilio_payload.get("error_message"),
    )
    db.add(log)
    await db.commit()
    return {
        "ok": True,
        "mode": "sandbox" if _is_twilio_sandbox_sender(whatsapp_from) else "production",
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

    account_sid, auth_token, api_key_sid, api_key_secret, _, _, _ = await _resolve_twilio_config(db)
    twilio_payload = _twilio_get_message_status(
        sid, account_sid=account_sid, auth_token=auth_token, api_key_sid=api_key_sid, api_key_secret=api_key_secret
    )
    log.status = twilio_payload.get("status")
    price = _twilio_price_usd(twilio_payload)
    if price is not None:
        log.price_usd = price
    if twilio_payload.get("price_unit"):
        log.price_unit = twilio_payload.get("price_unit")
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
        # Twilio callback does not always include price, so fetch full message state.
        try:
            account_sid, auth_token, api_key_sid, api_key_secret, _, _, _ = await _resolve_twilio_config(db)
            st = _twilio_get_message_status(
                MessageSid,
                account_sid=account_sid,
                auth_token=auth_token,
                api_key_sid=api_key_sid,
                api_key_secret=api_key_secret,
            )
            price = _twilio_price_usd(st)
            if price is not None:
                log.price_usd = price
            if st.get("price_unit"):
                log.price_unit = st.get("price_unit")
        except Exception:
            pass
        await db.commit()
    return {"ok": True}


@router.get("/admin-config", response_model=TwilioAdminConfigOut)
async def get_twilio_admin_config(
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    sid, token, api_key_sid, api_key_secret, from_phone, enabled, source = await _resolve_twilio_config(db)
    template_sid = await _resolve_twilio_template_sid(db)
    return TwilioAdminConfigOut(
        account_sid=sid,
        auth_token_configured=bool(token),
        auth_token_masked=_mask_secret(token) if token else None,
        api_key_sid=api_key_sid or None,
        api_key_configured=bool(api_key_sid and api_key_secret),
        api_key_masked=_mask_secret(api_key_secret) if api_key_secret else None,
        auth_mode="api_key" if (api_key_sid and api_key_secret) else ("auth_token" if token else "unknown"),
        whatsapp_from=from_phone,
        template_sid=template_sid,
        enabled=enabled,
        source=source,
    )


@router.get("/active-template", response_model=TwilioActiveTemplateOut)
async def get_twilio_active_template(
    _: object = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    template_sid = await _resolve_twilio_template_sid(db)
    return TwilioActiveTemplateOut(template_sid=template_sid)


@router.put("/admin-config", response_model=TwilioAdminConfigOut)
async def set_twilio_admin_config(
    payload: TwilioAdminConfigIn,
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    current_sid, current_token, current_api_key_sid, current_api_key_secret, _, _, _ = await _resolve_twilio_config(db)

    sid = (payload.account_sid or "").strip()
    token = (payload.auth_token or "").strip()
    api_key_sid = (payload.api_key_sid or "").strip()
    api_key_secret = (payload.api_key_secret or "").strip()
    from_phone = (payload.whatsapp_from or "").strip()
    template_sid = (payload.template_sid or "").strip()
    if not sid or not from_phone:
        raise HTTPException(status_code=400, detail="SID y whatsapp_from son obligatorios.")

    # Preserve existing credentials when the user is only updating non-secret fields
    # from the admin UI and leaves secret inputs blank.
    effective_token = token or current_token
    effective_api_key_sid = api_key_sid or current_api_key_sid
    effective_api_key_secret = api_key_secret or (
        current_api_key_secret if effective_api_key_sid == current_api_key_sid else ""
    )

    if not ((effective_api_key_sid and effective_api_key_secret) or effective_token):
        raise HTTPException(status_code=400, detail="Debes configurar Auth Token o API Key SID+Secret.")
    if not from_phone.startswith("whatsapp:+"):
        raise HTTPException(status_code=400, detail="El numero origen debe iniciar con 'whatsapp:+'.")
    if not template_sid:
        template_sid = DEFAULT_WHATSAPP_TEMPLATE_SID

    await _set_app_setting(db, "twilio_account_sid", sid)
    if effective_token:
        await _set_app_setting(db, "twilio_auth_token", effective_token)
    if effective_api_key_sid:
        await _set_app_setting(db, "twilio_api_key_sid", effective_api_key_sid)
    if effective_api_key_secret:
        await _set_app_setting(db, "twilio_api_key_secret", effective_api_key_secret)
    await _set_app_setting(db, "twilio_whatsapp_from", from_phone)
    await _set_app_setting(db, "twilio_whatsapp_template_sid", template_sid)
    await _set_app_setting(db, "twilio_enabled", "true" if payload.enabled else "false")
    await db.commit()

    return TwilioAdminConfigOut(
        account_sid=sid,
        auth_token_configured=bool(effective_token),
        auth_token_masked=_mask_secret(effective_token) if effective_token else None,
        api_key_sid=effective_api_key_sid or None,
        api_key_configured=bool(effective_api_key_sid and effective_api_key_secret),
        api_key_masked=_mask_secret(effective_api_key_secret) if effective_api_key_secret else None,
        auth_mode="api_key" if (effective_api_key_sid and effective_api_key_secret) else ("auth_token" if effective_token else "unknown"),
        whatsapp_from=from_phone,
        template_sid=template_sid,
        enabled=payload.enabled,
        source="database",
    )


@router.post("/admin-test")
async def twilio_admin_test(
    payload: TwilioAdminTestIn,
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    account_sid, auth_token, api_key_sid, api_key_secret, whatsapp_from, enabled, _ = await _resolve_twilio_config(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Twilio esta desactivado en configuracion.")
    to_phone = _normalize_phone(payload.to_phone)
    if not to_phone:
        raise HTTPException(status_code=400, detail="Numero destino invalido.")
    template_sid = await _resolve_twilio_template_sid(db)
    test_label = (payload.body or "Prueba rapida").strip()
    sent = _twilio_send_whatsapp_template(
        to_phone=to_phone,
        content_sid=template_sid,
        content_variables=_build_template_variables(
            student_name="Alejandro",
            course_name=test_label,
            schedule="hoy 19:00 hrs",
            tenant_name="PMS Studio",
        ),
        account_sid=account_sid,
        auth_token=auth_token,
        api_key_sid=api_key_sid,
        api_key_secret=api_key_secret,
        whatsapp_from=whatsapp_from,
    )
    sid = sent.get("sid")
    is_sandbox = _is_twilio_sandbox_sender(whatsapp_from)
    initial_status = (sent.get("status") or "").lower()
    final_status = initial_status
    error_code = sent.get("error_code")
    error_message = sent.get("error_message")

    if sid:
        # Small polling window to provide clearer sandbox feedback (join / no join)
        for _ in range(3):
            await asyncio.sleep(1.5)
            st = _twilio_get_message_status(
                sid, account_sid=account_sid, auth_token=auth_token, api_key_sid=api_key_sid, api_key_secret=api_key_secret
            )
            final_status = (st.get("status") or final_status or "").lower()
            error_code = st.get("error_code") or error_code
            error_message = st.get("error_message") or error_message
            if final_status in ("delivered", "read", "failed", "undelivered"):
                break

    if final_status in ("delivered", "read"):
        message = f"Prueba plantilla enviada y entregada. SID: {sid}"
    elif final_status in ("failed", "undelivered"):
        if is_sandbox:
            message = f"Prueba enviada. SID: {sid}. No entregado (sandbox): el numero probablemente no hizo join."
        else:
            message = f"Prueba plantilla enviada. SID: {sid}. No entregado. Revisa el estado del numero destino o los registros de Twilio."
    else:
        if is_sandbox:
            message = f"Prueba enviada. SID: {sid}. Estado actual: {final_status or 'pendiente'} (si no hizo join, no se entregara)."
        else:
            message = f"Prueba plantilla enviada. SID: {sid}. Estado actual: {final_status or 'pendiente'}."

    return {
        "ok": True,
        "sid": sid,
        "status": final_status or initial_status,
        "error_code": error_code,
        "error_message": error_message,
        "message": message,
    }


@router.get("/admin-balance", response_model=TwilioBalanceOut)
async def get_twilio_admin_balance(
    _: object = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    account_sid, auth_token, api_key_sid, api_key_secret, _, enabled, _ = await _resolve_twilio_config(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Twilio esta desactivado en configuracion.")

    payload = _twilio_get_balance(
        account_sid=account_sid,
        auth_token=auth_token,
        api_key_sid=api_key_sid,
        api_key_secret=api_key_secret,
    )
    balance_usd = _to_float(payload.get("balance"), 0.0)
    currency = (payload.get("currency") or "USD").upper()

    budget_usd = max(_to_float(await _get_app_setting(db, "twilio_budget_usd"), 20.0), 0.01)
    threshold_usd = max(_to_float(await _get_app_setting(db, "twilio_alert_threshold_usd"), 5.0), 0.0)

    remaining_usd = max(balance_usd, 0.0)
    remaining_percent = max(min((remaining_usd / budget_usd) * 100.0, 100.0), 0.0)

    if remaining_usd <= threshold_usd:
        level = "critical"
    elif remaining_usd <= (threshold_usd + 5.0):
        level = "warning"
    else:
        level = "ok"

    return TwilioBalanceOut(
        balance_usd=round(balance_usd, 4),
        currency=currency,
        budget_usd=round(budget_usd, 4),
        threshold_usd=round(threshold_usd, 4),
        remaining_usd=round(remaining_usd, 4),
        remaining_percent=round(remaining_percent, 1),
        level=level,
        checked_at=datetime.now(timezone.utc).isoformat(),
    )




