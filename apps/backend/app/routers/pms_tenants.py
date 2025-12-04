from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, Response, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete

from apps.backend.app.pms.models import Tenant
from apps.backend.app.pms.deps import (
    get_tenant_id,
    get_db_session,
    get_current_active_superuser,
    get_current_user,
)
from apps.backend.app.pms.schemas import TenantOut, TenantCreate, TenantUpdate, TenantSelfUpdate
from apps.backend.app.core import security
from apps.backend.app.pms import models


router = APIRouter(prefix="/api/pms/tenants", tags=["pms-tenants"])


@router.get("/", response_model=list[TenantOut])
async def list_tenants(
    _: models.User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = res.scalars().all()
    for t in tenants:
        admin_flag = await db.scalar(
            select(models.User.is_superuser).where(models.User.tenant_id == t.id).order_by(models.User.id)
        )
        setattr(t, "admin_is_superuser", bool(admin_flag) if admin_flag is not None else None)
    return tenants


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
        rooms_count=payload.rooms_count,
        sidebar_theme=payload.sidebar_theme,
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
    return tenant


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
    if "rooms_count" in data:
        tenant.rooms_count = data["rooms_count"]
    if "sidebar_theme" in data:
        tenant.sidebar_theme = data["sidebar_theme"]
    if "is_superuser" in data:
        if admin_user is None:
            admin_user = await db.scalar(
                select(models.User).where(models.User.tenant_id == tenant_id).order_by(models.User.id)
            )
        if admin_user:
            admin_user.is_superuser = bool(data["is_superuser"])

    await db.commit()
    await db.refresh(tenant)
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


@router.get("/me", response_model=TenantOut)
async def get_current_tenant(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
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
        if current_user.tenant_id is None:
            raise HTTPException(status_code=403, detail="Usuario sin tenant asignado")
        tenant_id = current_user.tenant_id
        if header_tid is not None and header_tid != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="Tenant no permitido")

    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant no asignado")

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(tenant, field, value)

    await db.commit()
    await db.refresh(tenant)
    return tenant

