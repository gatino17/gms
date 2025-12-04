from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from apps.backend.app.pms.models import Payment, Course, Teacher
from apps.backend.app.pms.schemas import PaymentOut, PaymentCreate, PaymentUpdate, PaymentListResponse, PaymentByTeacherListResponse
from apps.backend.app.pms.deps import get_tenant_id, get_db_session

router = APIRouter(prefix="/api/pms/payments", tags=["pms-payments"])



@router.get('/by_teacher', response_model=PaymentByTeacherListResponse)
async def payments_by_teacher(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    teacher_id: int | None = Query(default=None),
    course_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None, description="YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD"),
    method: str | None = Query(default=None),
    type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    def parse_date(val: str | None):
        if not val:
            return None
        try:
            return date.fromisoformat(val)
        except Exception:
            return None
    d_from = parse_date(date_from)
    d_to = parse_date(date_to)

    base = (
        select(
            Course.teacher_id.label('teacher_id'),
            func.coalesce(Teacher.name, 'Sin profesor').label('teacher_name'),
            func.sum(Payment.amount).label('total'),
            func.sum(case((Payment.method == 'cash', Payment.amount), else_=0)).label('cash'),
            func.sum(case((Payment.method == 'card', Payment.amount), else_=0)).label('card'),
            func.sum(case((Payment.method == 'transfer', Payment.amount), else_=0)).label('transfer'),
            func.sum(case((Payment.method == 'agreement', Payment.amount), else_=0)).label('agreement'),
        )
        .select_from(Payment)
        .join(Course, Payment.course_id == Course.id, isouter=True)
        .join(Teacher, Course.teacher_id == Teacher.id, isouter=True)
        .where(Payment.tenant_id == tenant_id)
    )
    if teacher_id:
        base = base.where(Course.teacher_id == teacher_id)
    if course_id:
        base = base.where(Payment.course_id == course_id)
    if student_id:
        base = base.where(Payment.student_id == student_id)
    if d_from:
        base = base.where(Payment.payment_date >= d_from)
    if d_to:
        base = base.where(Payment.payment_date <= d_to)
    if method:
        base = base.where(Payment.method == method)
    if type:
        base = base.where(Payment.type == type)

    grouped = base.group_by(Course.teacher_id, Teacher.name)
    ordered = grouped.order_by(func.sum(Payment.amount).desc(), func.coalesce(Teacher.name, ''))
    res = await db.execute(ordered.offset(offset).limit(limit))
    rows = res.all()

    count_q = select(func.count()).select_from(grouped.subquery())
    total = await db.scalar(count_q)

    items = []
    for r in rows:
        m = r._mapping
        items.append({
            'teacher_id': m['teacher_id'],
            'teacher_name': m['teacher_name'],
            'total': m['total'] or 0,
            'cash': m['cash'] or 0,
            'card': m['card'] or 0,
            'transfer': m['transfer'] or 0,
            'agreement': m['agreement'] or 0,
        })
    return {'items': items, 'total': int(total or 0)}


@router.get("/", response_model=PaymentListResponse)
async def list_payments(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    student_id: int | None = Query(default=None),
    course_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None, description="YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD"),
    method: str | None = Query(default=None),
    type: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Buscar en referencia/notas/metodo/tipo"),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    stmt = select(Payment).where(Payment.tenant_id == tenant_id)
    if student_id:
        stmt = stmt.where(Payment.student_id == student_id)
    if course_id:
        stmt = stmt.where(Payment.course_id == course_id)
    def parse_date(val: str | None) -> date | None:
        if not val:
            return None
        try:
            return date.fromisoformat(val)
        except Exception:
            return None
    d_from = parse_date(date_from)
    d_to = parse_date(date_to)
    if d_from:
        stmt = stmt.where(Payment.payment_date >= d_from)
    if d_to:
        stmt = stmt.where(Payment.payment_date <= d_to)
    if method:
        stmt = stmt.where(Payment.method == method)
    if type:
        stmt = stmt.where(Payment.type == type)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Payment.reference.ilike(like))
            | (Payment.notes.ilike(like))
            | (Payment.method.ilike(like))
            | (Payment.type.ilike(like))
        )
    res = await db.execute(
        stmt.order_by(Payment.payment_date.desc(), Payment.created_at.desc()).offset(offset).limit(limit)
    )
    items = res.scalars().all()
    total = await db.scalar(select(func.count()).select_from(Payment).where(*stmt._where_criteria))
    return {"items": items, "total": total or 0}


@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Payment).where(Payment.id == payment_id, Payment.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return obj


@router.post("/", response_model=PaymentOut, status_code=201)
async def create_payment(
    payload: PaymentCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = Payment(tenant_id=tenant_id, **payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.put("/{payment_id}", response_model=PaymentOut)
async def update_payment(
    payment_id: int,
    payload: PaymentUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Payment).where(Payment.id == payment_id, Payment.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Payment).where(Payment.id == payment_id, Payment.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    await db.delete(obj)
    await db.commit()
    return None



