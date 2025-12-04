from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.app.pms.models import Enrollment, Student, Course
from apps.backend.app.pms.deps import get_tenant_id, get_db_session
from pydantic import BaseModel


class EnrollmentCreate(BaseModel):
    student_id: int
    course_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class EnrollmentOut(BaseModel):
    id: int
    student_id: int
    course_id: int
    start_date: date
    end_date: Optional[date] = None
    is_active: bool

    class Config:
        from_attributes = True


router = APIRouter(prefix="/api/pms/enrollments", tags=["pms-enrollments"])


@router.get("/", response_model=list[EnrollmentOut])
async def list_enrollments(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    course_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    active_only: bool = Query(default=True),
):
    stmt = select(Enrollment).where(Enrollment.tenant_id == tenant_id)
    if course_id:
        stmt = stmt.where(Enrollment.course_id == course_id)
    if student_id:
        stmt = stmt.where(Enrollment.student_id == student_id)
    if active_only:
        stmt = stmt.where(Enrollment.is_active.is_(True))
    res = await db.execute(stmt.order_by(Enrollment.start_date.desc()))
    return res.scalars().all()


@router.post("/", response_model=EnrollmentOut, status_code=201)
async def create_enrollment(
    payload: EnrollmentCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    # Validate references
    s = (await db.execute(select(Student).where(Student.id == payload.student_id, Student.tenant_id == tenant_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    c = (await db.execute(select(Course).where(Course.id == payload.course_id, Course.tenant_id == tenant_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    obj = Enrollment(
        tenant_id=tenant_id,
        student_id=payload.student_id,
        course_id=payload.course_id,
        start_date=payload.start_date or date.today(),
        end_date=payload.end_date,
        is_active=True,
    )
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


class EnrollmentUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


@router.put("/{enrollment_id}", response_model=EnrollmentOut)
async def update_enrollment(
    enrollment_id: int,
    payload: EnrollmentUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = (
        await db.execute(
            select(Enrollment).where(Enrollment.id == enrollment_id, Enrollment.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj

@router.delete("/{enrollment_id}", status_code=204)
async def delete_enrollment(
    enrollment_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = (await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id, Enrollment.tenant_id == tenant_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    await db.delete(obj)
    await db.commit()
    return None
