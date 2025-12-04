from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from apps.backend.app.pms.models import Teacher
from apps.backend.app.pms.deps import get_tenant_id, get_db_session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class TeacherBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    join_date: Optional[date] = None
    birthdate: Optional[date] = None
    styles: Optional[str] = None


class TeacherCreate(TeacherBase):
    pass


class TeacherUpdate(TeacherBase):
    pass


class TeacherOut(TeacherBase):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True


class TeacherListResponse(BaseModel):
    items: list[TeacherOut]
    total: int


router = APIRouter(prefix="/api/pms/teachers", tags=["pms-teachers"])


@router.get("/", response_model=TeacherListResponse)
async def list_teachers(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None, description="Filtro por nombre, email o teléfono"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    conditions = [Teacher.tenant_id == tenant_id]
    if q:
        like = f"%{q}%"
        conditions.append(
            (Teacher.name.ilike(like)) | (Teacher.email.ilike(like)) | (Teacher.phone.ilike(like))
        )

    stmt = (
        select(Teacher)
        .where(*conditions)
        .order_by(Teacher.name.asc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()

    total_stmt = select(func.count()).select_from(Teacher).where(*conditions)
    total = await db.scalar(total_stmt)

    return {"items": items, "total": total or 0}


@router.get("/{teacher_id}", response_model=TeacherOut)
async def get_teacher(
    teacher_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    return obj


@router.post("/", response_model=TeacherOut, status_code=201)
async def create_teacher(
    payload: TeacherCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = Teacher(tenant_id=tenant_id, **payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.put("/{teacher_id}", response_model=TeacherOut)
async def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.delete("/{teacher_id}", status_code=204)
async def delete_teacher(
    teacher_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    await db.delete(obj)
    await db.commit()
    return None
