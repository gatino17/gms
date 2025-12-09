from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime

from apps.backend.app.pms.deps import get_tenant_id

router = APIRouter(prefix="/api/pms/announcements", tags=["pms-announcements"])

# Almacen temporal en memoria. En produccion, usar tabla en BD.
_announcements: list[dict] = []


class AnnouncementIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    body: Optional[str] = Field(None, max_length=2000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None


class AnnouncementOut(AnnouncementIn):
    id: int
    tenant_id: int
    created_at: datetime


def _is_active(item: dict) -> bool:
    today = date.today()
    sd = item.get("start_date")
    ed = item.get("end_date")
    if sd and today < sd:
        return False
    if ed and today > ed:
        return False
    return True


@router.get("/", response_model=List[AnnouncementOut])
async def list_announcements(tenant_id: int = Depends(get_tenant_id)):
    active = [a for a in _announcements if a["tenant_id"] == tenant_id and _is_active(a)]
    # ordenar por created_at desc y limitar a 4
    active.sort(key=lambda x: x["created_at"], reverse=True)
    return active[:4]


@router.post("/", response_model=AnnouncementOut)
async def create_announcement(payload: AnnouncementIn, tenant_id: int = Depends(get_tenant_id)):
    new_id = (max((a["id"] for a in _announcements), default=0) + 1)
    item = {
        "id": new_id,
        "tenant_id": tenant_id,
        "title": payload.title,
        "subtitle": payload.subtitle,
        "body": payload.body,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "image_url": payload.image_url,
        "link_url": payload.link_url,
        "created_at": datetime.utcnow(),
    }
    _announcements.append(item)
    # mantener tamaño razonable
    if len(_announcements) > 1000:
        _announcements[:] = sorted(_announcements, key=lambda x: x["created_at"], reverse=True)[:1000]
    return item


@router.delete("/{announcement_id}")
async def delete_announcement(announcement_id: int, tenant_id: int = Depends(get_tenant_id)):
    idx = next((i for i, a in enumerate(_announcements) if a["id"] == announcement_id and a["tenant_id"] == tenant_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")
    _announcements.pop(idx)
    return {"ok": True}
