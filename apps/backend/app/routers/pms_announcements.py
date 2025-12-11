from __future__ import annotations

from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.app.pms import models, schemas
from apps.backend.app.pms.deps import get_db_session, get_tenant_id

router = APIRouter(prefix="/api/pms/announcements", tags=["pms-announcements"])


@router.get("/", response_model=List[schemas.AnnouncementOut])
async def list_announcements(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    active_only: bool = Query(default=True),
    date_ref: date | None = Query(default=None),
    limit: int = Query(default=4, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Lista anuncios por tenant.
    - active_only: si es True, filtra por is_active y ventana de fechas.
    - date_ref: fecha de referencia para vigencia (hoy por defecto).
    - limit/offset: paginación (por defecto muestra 4, como en la app móvil).
    """
    ref = date_ref or date.today()
    stmt = select(models.Announcement).where(models.Announcement.tenant_id == tenant_id)
    if active_only:
        stmt = stmt.where(models.Announcement.is_active.is_(True))
        stmt = stmt.where(
            or_(models.Announcement.start_date == None, models.Announcement.start_date <= ref),  # noqa: E711
            or_(models.Announcement.end_date == None, models.Announcement.end_date >= ref),      # noqa: E711
        )
    stmt = stmt.order_by(
        models.Announcement.sort_order.nulls_last(),
        models.Announcement.created_at.desc(),
    ).offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/", response_model=schemas.AnnouncementOut)
async def create_announcement(
    payload: schemas.AnnouncementCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = models.Announcement(
        tenant_id=tenant_id,
        title=payload.title,
        subtitle=payload.subtitle,
        body=payload.body,
        start_date=payload.start_date,
        end_date=payload.end_date,
        image_url=payload.image_url,
        link_url=payload.link_url,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.put("/{announcement_id}", response_model=schemas.AnnouncementOut)
async def update_announcement(
    announcement_id: int,
    payload: schemas.AnnouncementUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(
        select(models.Announcement).where(
            models.Announcement.id == announcement_id,
            models.Announcement.tenant_id == tenant_id,
        )
    )
    obj = res.scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")

    for field, value in payload.dict().items():
        setattr(obj, field, value)
    obj.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{announcement_id}", status_code=204)
async def delete_announcement(
    announcement_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(
        select(models.Announcement).where(
            models.Announcement.id == announcement_id,
            models.Announcement.tenant_id == tenant_id,
        )
    )
    obj = res.scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")
    await db.delete(obj)
    await db.commit()
    return

