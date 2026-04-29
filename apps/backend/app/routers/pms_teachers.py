from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.pms.models import Teacher
from app.pms.deps import get_tenant_id, get_db_session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, timedelta
from sqlalchemy import select, func, case


class TeacherBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    join_date: Optional[date] = None
    birthdate: Optional[date] = None
    styles: Optional[str] = None
    photo_url: Optional[str] = None


class TeacherCreate(TeacherBase):
    pass


class TeacherUpdate(TeacherBase):
    pass


class TeacherOut(TeacherBase):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True


class TeacherStats(BaseModel):
    total: int = 0
    new_this_month: int = 0


class TeacherListResponse(BaseModel):
    items: list[TeacherOut]
    total: int
    stats: TeacherStats


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

    # Stats calculation
    month_ago = date.today() - timedelta(days=30)
    stats_stmt = select(
        func.count().label('total'),
        func.sum(case(((Teacher.join_date != None) & (Teacher.join_date >= month_ago), 1), else_=0)).label('new_month'),
    ).where(Teacher.tenant_id == tenant_id)
    
    sres = await db.execute(stats_stmt)
    row = sres.one()
    
    stats = TeacherStats(
        total=int(row.total or 0),
        new_this_month=int(row.new_month or 0),
    )

    return {"items": items, "total": stats.total, "stats": stats}


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


@router.post("/{teacher_id}/photo")
async def upload_teacher_photo(
    teacher_id: int,
    file: UploadFile = File(...),
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")

    # Compute static_dir locally to avoid circular import
    static_dir = Path(__file__).resolve().parent.parent / "static"
    target = static_dir / "uploads" / "teachers" / str(tenant_id) / str(teacher_id)
    target.mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "photo").name
    # Validar tipo y tamaño
    ct = (file.content_type or "").lower()
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if ct not in allowed:
        raise HTTPException(status_code=400, detail="Tipo no permitido. Use JPG, PNG o WEBP")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen supera 2 MB")
    (target / filename).write_bytes(content)
    public_url = f"/static/uploads/teachers/{tenant_id}/{teacher_id}/{filename}"
    obj.photo_url = public_url
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return {"url": public_url}
