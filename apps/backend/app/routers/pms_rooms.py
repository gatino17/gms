from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.backend.app.pms.models import Room
from apps.backend.app.pms.deps import get_tenant_id, get_db_session
from pydantic import BaseModel
from typing import Optional


class RoomBase(BaseModel):
    name: str
    location: Optional[str] = None
    capacity: Optional[int] = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(RoomBase):
    pass


class RoomOut(RoomBase):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True


router = APIRouter(prefix="/api/pms/rooms", tags=["pms-rooms"])


@router.get("/", response_model=list[RoomOut])
async def list_rooms(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None, description="Filtro por nombre o ubicación"),
):
    stmt = select(Room).where(Room.tenant_id == tenant_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Room.name.ilike(like)) | (Room.location.ilike(like)))
    res = await db.execute(stmt.order_by(Room.name.asc()))
    return res.scalars().all()


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(
    room_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Room).where(Room.id == room_id, Room.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    return obj


@router.post("/", response_model=RoomOut, status_code=201)
async def create_room(
    payload: RoomCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = Room(tenant_id=tenant_id, **payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.put("/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: int,
    payload: RoomUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Room).where(Room.id == room_id, Room.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.delete("/{room_id}", status_code=204)
async def delete_room(
    room_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Room).where(Room.id == room_id, Room.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    await db.delete(obj)
    await db.commit()
    return None

