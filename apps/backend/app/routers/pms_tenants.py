from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, Response, Header, UploadFile, File
import logging
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from pathlib import Path
import secrets

from app.pms.models import Tenant, TenantPlan, AppSetting, WhatsAppMessageLog
from app.pms.deps import (
    get_tenant_id,
    get_db_session,
    get_current_active_superuser,
    get_current_user,
)
from app.pms.schemas import (
    TenantOut,
    TenantCreate,
    TenantUpdate,
    TenantSelfUpdate,
    TenantPlanOut,
    TenantPlanCreate,
    TenantPlanUpdate,
)
from app.core import security
from app.pms import models
from pydantic import BaseModel

class VerifyUnlockPayload(BaseModel):
    code: str


router = APIRouter(prefix="/api/pms/tenants", tags=["pms-tenants"])
logger = logging.getLogger(__name__)
MAX_SESSIONS_PER_TENANT = 3
SESSION_PRESENCE_MINUTES = 1

DEFAULT_TENANT_PLANS = [
    {"name": "Inicio 15", "max_active_students": 15, "monthly_price": 12000, "annual_price": 115200, "is_custom": False},
    {"name": "Estandar 60", "max_active_students": 60, "monthly_price": 40000, "annual_price": 300000, "is_custom": False},
    {"name": "Pro 120", "max_active_students": 120, "monthly_price": 65000, "annual_price": 400000, "is_custom": False},
    {"name": "Super Pro 300", "max_active_students": 300, "monthly_price": 85000, "annual_price": 500000, "is_custom": False},
]


def _resolve_tenant_plan_snapshot(tenant: Tenant) -> None:
    if tenant.plan is not None:
        setattr(tenant, "plan_name", tenant.plan.name)
        setattr(tenant, "max_active_students", tenant.plan.max_active_students)
    else:
        setattr(tenant, "plan_name", None)
        setattr(tenant, "max_active_students", None)


def _next_renewal_for_cycle(cycle: str, base_date: date | None = None) -> date:
    today = base_date or date.today()
    return today + timedelta(days=365 if cycle == "annual" else 30)


@router.get("", response_model=list[TenantOut])
@router.get("/", response_model=list[TenantOut])
async def list_tenants(
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = res.scalars().all()
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    twilio_budget_raw = await db.scalar(select(AppSetting.value).where(AppSetting.key == "twilio_budget_usd"))
    try:
        twilio_budget = float((twilio_budget_raw or "").strip()) if twilio_budget_raw else 20.0
    except Exception:
        twilio_budget = 20.0

    wa_res = await db.execute(
        select(
            WhatsAppMessageLog.tenant_id,
            func.coalesce(func.sum(func.abs(WhatsAppMessageLog.price_usd)), 0),
        )
        .where(
            WhatsAppMessageLog.created_at >= month_start,
            WhatsAppMessageLog.price_usd.is_not(None),
        )
        .group_by(WhatsAppMessageLog.tenant_id)
    )
    wa_map = {int(tid): float(total or 0) for tid, total in wa_res.all() if tid is not None}

    now_dt = datetime.utcnow()
    presence_cutoff = now_dt - timedelta(minutes=SESSION_PRESENCE_MINUTES)
    sessions_res = await db.execute(
        select(models.UserSession.tenant_id, func.count(models.UserSession.id))
        .where(
            models.UserSession.tenant_id.is_not(None),
            models.UserSession.revoked_at.is_(None),
            models.UserSession.expires_at > now_dt,
            models.UserSession.last_seen_at > presence_cutoff,
        )
        .group_by(models.UserSession.tenant_id)
    )
    sessions_map = {int(tid): int(cnt) for tid, cnt in sessions_res.all() if tid is not None}
    for t in tenants:
        t.plan = await db.get(TenantPlan, t.plan_id) if t.plan_id else None
        _resolve_tenant_plan_snapshot(t)
        admin_flag = await db.scalar(
            select(models.User.is_superuser).where(models.User.tenant_id == t.id).order_by(models.User.id)
        )
        setattr(t, "admin_is_superuser", bool(admin_flag) if admin_flag is not None else None)
        setattr(t, "active_sessions", sessions_map.get(t.id, 0))
        setattr(t, "max_sessions", int(getattr(t, "max_sessions", None) or MAX_SESSIONS_PER_TENANT))
        setattr(t, "whatsapp_consumption_usd", wa_map.get(t.id, 0.0))
        setattr(t, "whatsapp_budget_usd", twilio_budget)
    return tenants


@router.get("/plans", response_model=list[TenantPlanOut])
async def list_tenant_plans(
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(TenantPlan).order_by(TenantPlan.max_active_students.asc(), TenantPlan.name.asc()))
    plans = res.scalars().all()
    if plans:
        return plans
    created = [TenantPlan(**item) for item in DEFAULT_TENANT_PLANS]
    for item in created:
        db.add(item)
    await db.commit()
    res2 = await db.execute(select(TenantPlan).order_by(TenantPlan.max_active_students.asc(), TenantPlan.name.asc()))
    return res2.scalars().all()


@router.post("/plans", response_model=TenantPlanOut, status_code=status.HTTP_201_CREATED)
async def create_tenant_plan(
    payload: TenantPlanCreate,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    obj = TenantPlan(**payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.put("/plans/{plan_id}", response_model=TenantPlanOut)
async def update_tenant_plan(
    plan_id: int,
    payload: TenantPlanUpdate,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    obj = await db.get(TenantPlan, plan_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_plan(
    plan_id: int,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    obj = await db.get(TenantPlan, plan_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    in_use = await db.scalar(select(func.count()).select_from(Tenant).where(Tenant.plan_id == plan_id)) or 0
    if in_use > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: el plan esta asignado a uno o mas estudios")
    await db.delete(obj)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    payload: TenantCreate,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    normalized_email = payload.email.lower()
    existing_user = await db.scalar(
        select(models.User).where(models.User.email == normalized_email)
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="El correo ya esta registrado")

    max_id = await db.scalar(select(func.max(Tenant.id)))
    counter = (max_id or 0) + 1
    base_slug = f"tenant-{counter}"

    slug_exists = await db.scalar(select(Tenant).where(Tenant.slug == base_slug))
    while slug_exists:
        counter += 1
        base_slug = f"tenant-{counter}"
        slug_exists = await db.scalar(select(Tenant).where(Tenant.slug == base_slug))

    selected_plan = await db.get(TenantPlan, payload.plan_id) if payload.plan_id else None
    if payload.plan_id and not selected_plan:
        raise HTTPException(status_code=400, detail="Plan seleccionado no existe")
    billing_cycle = payload.billing_cycle or "monthly"
    if billing_cycle not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="Ciclo de cobro invalido")
    tenant = Tenant(
        name=payload.name.strip(),
        slug=base_slug,
        contact_email=normalized_email,
        address=payload.address,
        country=payload.country,
        city=payload.city,
        postal_code=payload.postal_code,
        phone=payload.phone,
        whatsapp_message=payload.whatsapp_message,
        logo_url=payload.logo_url,
        currency=payload.currency,
        instagram_url=payload.instagram_url,
        tiktok_url=payload.tiktok_url,
        facebook_url=payload.facebook_url,
        website_url=payload.website_url,
        plan_id=selected_plan.id if selected_plan else None,
        billing_cycle=billing_cycle,
        price_locked=payload.price_locked if payload.price_locked is not None else (
            selected_plan.monthly_price if (selected_plan and billing_cycle == "monthly") else (selected_plan.annual_price if selected_plan else None)
        ),
        plan_label_snapshot=selected_plan.name if selected_plan else None,
        plan_start_date=payload.plan_start_date or (date.today() if selected_plan else None),
        plan_renewal_date=payload.plan_renewal_date or ( _next_renewal_for_cycle(billing_cycle) if selected_plan else None ),
        max_sessions=int(payload.max_sessions or MAX_SESSIONS_PER_TENANT),
        enrollment_fee_enabled=bool(payload.enrollment_fee_enabled),
        enrollment_fee_amount=payload.enrollment_fee_amount,
        enrollment_fee_apply_to=payload.enrollment_fee_apply_to or "new_only",
        enrollment_fee_allow_waive=bool(payload.enrollment_fee_allow_waive),
        enrollment_fee_kind=payload.enrollment_fee_kind or "incorporation",
        enrollment_fee_renewal=payload.enrollment_fee_renewal or "never",
    )
    db.add(tenant)
    await db.flush()

    user = models.User(
        email=normalized_email,
        hashed_password=security.get_password_hash(payload.password),
        full_name=payload.name.strip(),
        is_active=True,
        is_superuser=payload.is_superuser,
        tenant_id=tenant.id,
    )
    db.add(user)

    await db.commit()
    await db.refresh(tenant)
    tenant.plan = selected_plan
    _resolve_tenant_plan_snapshot(tenant)
    return tenant


@router.get("/me", response_model=TenantOut)
async def get_current_tenant(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    tenant.plan = await db.get(TenantPlan, tenant.plan_id) if tenant.plan_id else None
    _resolve_tenant_plan_snapshot(tenant)
    return tenant


@router.put("/me", response_model=TenantOut)
async def update_current_tenant(
    payload: TenantSelfUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: models.User = Depends(get_current_user),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-ID"),
):
    # Determinar tenant según permisos:
    # - Super: usa header si viene y es válido, si no usa su tenant_id si existe.
    # - No super: usa su tenant_id; si viene header y difiere, rechaza.
    tenant_id: int | None = None

    def parse_int(value: str | None) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except Exception:
            return None

    header_tid = parse_int(x_tenant_id)

    if current_user.is_superuser:
        tenant_id = header_tid if header_tid is not None else current_user.tenant_id
    else:
        # Usuarios no super: siempre usar su tenant_id, ignorando el header (para evitar 400/403).
        if current_user.tenant_id is None:
            raise HTTPException(status_code=403, detail="Usuario sin tenant asignado")
        tenant_id = current_user.tenant_id
        header_tid = tenant_id

    if not tenant_id:
        logger.warning(
            "update_current_tenant: tenant_id missing",
            extra={
                "user_id": current_user.id,
                "is_superuser": current_user.is_superuser,
                "user_tenant_id": current_user.tenant_id,
                "header_tenant_id": x_tenant_id,
                "parsed_header_tenant_id": header_tid,
            },
        )
        detail = (
            "Tenant no asignado "
            f"(user_id={current_user.id}, user_tenant_id={current_user.tenant_id}, "
            f"is_superuser={current_user.is_superuser}, header={x_tenant_id}, parsed={header_tid})"
        )
        raise HTTPException(status_code=400, detail=detail)

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(tenant, field, value)

    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.post("/verify_unlock")
async def verify_unlock(
    payload: VerifyUnlockPayload,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    current_user: models.User = Depends(get_current_user),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    
    if tenant.attendance_pin and payload.code == tenant.attendance_pin:
        return {"success": True}
        
    if security.verify_password(payload.code, current_user.hashed_password):
        return {"success": True}
        
    raise HTTPException(status_code=400, detail="Código o contraseña incorrectos")


@router.put("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    data = payload.dict(exclude_unset=True)
    if not data:
        return tenant

    admin_user = None

    if "email" in data and data["email"]:
        normalized_email = data["email"].lower()
        existing_user = await db.scalar(
            select(models.User).where(
                and_(
                    models.User.email == normalized_email,
                    models.User.tenant_id != tenant_id,
                )
            )
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="El correo ya esta registrado")
        tenant.contact_email = normalized_email
        admin_user = await db.scalar(
            select(models.User).where(models.User.tenant_id == tenant_id).order_by(models.User.id)
        )
        if admin_user:
            admin_user.email = normalized_email

    if "name" in data and data["name"]:
        tenant.name = data["name"].strip()
        if not admin_user:
            admin_user = await db.scalar(
                select(models.User).where(models.User.tenant_id == tenant_id).order_by(models.User.id)
            )
        if admin_user:
            admin_user.full_name = tenant.name

    if "address" in data:
        tenant.address = data["address"]
    if "country" in data:
        tenant.country = data["country"]
    if "city" in data:
        tenant.city = data["city"]
    if "postal_code" in data:
        tenant.postal_code = data["postal_code"]
    if "phone" in data:
        tenant.phone = data["phone"]
    if "whatsapp_message" in data:
        tenant.whatsapp_message = data["whatsapp_message"]
    if "logo_url" in data:
        tenant.logo_url = data["logo_url"]
    if "currency" in data:
        tenant.currency = data["currency"]
    if "instagram_url" in data:
        tenant.instagram_url = data["instagram_url"]
    if "tiktok_url" in data:
        tenant.tiktok_url = data["tiktok_url"]
    if "facebook_url" in data:
        tenant.facebook_url = data["facebook_url"]
    if "website_url" in data:
        tenant.website_url = data["website_url"]
    if "plan_id" in data:
        if data["plan_id"] is None:
            tenant.plan_id = None
            tenant.plan_label_snapshot = None
            tenant.plan_start_date = None
            tenant.plan_renewal_date = None
        else:
            selected_plan = await db.get(TenantPlan, int(data["plan_id"]))
            if not selected_plan:
                raise HTTPException(status_code=400, detail="Plan seleccionado no existe")
            tenant.plan_id = selected_plan.id
            tenant.plan_label_snapshot = selected_plan.name
            if "price_locked" not in data:
                cycle = data.get("billing_cycle") or tenant.billing_cycle or "monthly"
                tenant.price_locked = selected_plan.monthly_price if cycle == "monthly" else selected_plan.annual_price
            if "plan_start_date" not in data:
                tenant.plan_start_date = date.today()
            if "plan_renewal_date" not in data:
                cycle = data.get("billing_cycle") or tenant.billing_cycle or "monthly"
                tenant.plan_renewal_date = _next_renewal_for_cycle(cycle)
    if "billing_cycle" in data and data["billing_cycle"]:
        cycle = data["billing_cycle"]
        if cycle not in ("monthly", "annual"):
            raise HTTPException(status_code=400, detail="Ciclo de cobro invalido")
        tenant.billing_cycle = cycle
        if "plan_renewal_date" not in data and tenant.plan_id:
            tenant.plan_renewal_date = _next_renewal_for_cycle(cycle)
    if "price_locked" in data:
        tenant.price_locked = data["price_locked"]
    if "plan_label_snapshot" in data:
        tenant.plan_label_snapshot = data["plan_label_snapshot"]
    if "plan_renewal_date" in data:
        tenant.plan_renewal_date = data["plan_renewal_date"]
    if "plan_start_date" in data:
        tenant.plan_start_date = data["plan_start_date"]
    if "max_sessions" in data and data["max_sessions"] is not None:
        tenant.max_sessions = max(1, min(5, int(data["max_sessions"])))
    if "attendance_pin" in data:
        tenant.attendance_pin = data["attendance_pin"]
    if "enrollment_fee_enabled" in data:
        tenant.enrollment_fee_enabled = bool(data["enrollment_fee_enabled"])
    if "enrollment_fee_amount" in data:
        tenant.enrollment_fee_amount = data["enrollment_fee_amount"]
    if "enrollment_fee_apply_to" in data:
        tenant.enrollment_fee_apply_to = data["enrollment_fee_apply_to"]
    if "enrollment_fee_allow_waive" in data:
        tenant.enrollment_fee_allow_waive = bool(data["enrollment_fee_allow_waive"])
    if "enrollment_fee_kind" in data:
        tenant.enrollment_fee_kind = data["enrollment_fee_kind"]
    if "enrollment_fee_renewal" in data:
        tenant.enrollment_fee_renewal = data["enrollment_fee_renewal"]
    if "is_superuser" in data:
        if admin_user is None:
            admin_user = await db.scalar(
                select(models.User).where(models.User.tenant_id == tenant_id).order_by(models.User.id)
            )
        if admin_user:
            admin_user.is_superuser = bool(data["is_superuser"])

    # Cambio de contraseña: solo si viene un valor no vacío
    if "password" in data and data["password"]:
        if admin_user is None:
            admin_user = await db.scalar(
                select(models.User).where(models.User.tenant_id == tenant_id).order_by(models.User.id)
            )
        if admin_user:
            admin_user.hashed_password = security.get_password_hash(data["password"])

    await db.commit()
    await db.refresh(tenant)
    tenant.plan = await db.get(TenantPlan, tenant.plan_id) if tenant.plan_id else None
    _resolve_tenant_plan_snapshot(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: int,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    await db.execute(delete(models.User).where(models.User.tenant_id == tenant_id))
    await db.delete(tenant)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{tenant_id}/sessions/revoke-all", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_all_tenant_sessions(
    tenant_id: int,
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    await db.execute(
        models.UserSession.__table__.update()
        .where(
            models.UserSession.tenant_id == tenant_id,
            models.UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.utcnow())
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/upload-logo")
async def upload_tenant_logo(
    file: UploadFile = File(...),
    tenant_id: int = Depends(get_tenant_id),
):
    ct = (file.content_type or "").lower()
    allowed = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
    if ct not in allowed:
        raise HTTPException(status_code=400, detail="Tipo no permitido. Use JPG, PNG, WEBP o SVG")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo supera 2 MB")

    from app.main import static_dir  # type: ignore

    filename = Path(file.filename or "logo").name
    stem = Path(filename).stem
    ext = Path(filename).suffix or ".png"
    safe_name = f"{stem}_{secrets.token_hex(4)}{ext}"
    target = Path(static_dir) / "uploads" / "tenants" / str(tenant_id)
    target.mkdir(parents=True, exist_ok=True)
    (target / safe_name).write_bytes(content)
    public_url = f"/static/uploads/tenants/{tenant_id}/{safe_name}"
    return {"url": public_url}
