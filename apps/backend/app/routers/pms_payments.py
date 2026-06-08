from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_

from app.pms.models import Payment, Course, Teacher, Student
from app.pms.schemas import PaymentOut, PaymentCreate, PaymentUpdate, PaymentListResponse, PaymentByTeacherListResponse
from app.pms.deps import get_tenant_id, get_db_session

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

    teacher_name_expr = func.coalesce(Teacher.name, Payment.teacher_name_snapshot, 'Sin profesor')

    base = (
        select(
            Course.teacher_id.label('teacher_id'),
            teacher_name_expr.label('teacher_name'),
            func.sum(Payment.amount).label('total'),
            func.sum(case((Payment.method == 'efectivo', Payment.amount), else_=0)).label('cash'),
            func.sum(case((or_(Payment.method == 'debito', Payment.method == 'credito', Payment.method == 'card'), Payment.amount), else_=0)).label('card'),
            func.sum(case((or_(Payment.method == 'transferencia', Payment.method == 'transfer'), Payment.amount), else_=0)).label('transfer'),
            func.sum(case((or_(Payment.method == 'convenio', Payment.method == 'agreement'), Payment.amount), else_=0)).label('agreement'),
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

    grouped = base.group_by(Course.teacher_id, Teacher.name, Payment.teacher_name_snapshot)
    ordered = grouped.order_by(func.sum(Payment.amount).desc(), teacher_name_expr.asc())
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
@router.get("", response_model=PaymentListResponse)
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

    # Base filter for all queries
    filters = [Payment.tenant_id == tenant_id]
    if student_id:
        filters.append(Payment.student_id == student_id)
    if course_id:
        filters.append(Payment.course_id == course_id)
    if d_from:
        filters.append(Payment.payment_date >= d_from)
    if d_to:
        filters.append(Payment.payment_date <= d_to)
    if method:
        if method == 'card':
            filters.append(or_(Payment.method == 'card', Payment.method == 'debito', Payment.method == 'credito'))
        elif method == 'transfer':
            filters.append(or_(Payment.method == 'transfer', Payment.method == 'transferencia'))
        elif method == 'cash':
            filters.append(or_(Payment.method == 'cash', Payment.method == 'efectivo'))
        elif method == 'agreement':
            filters.append(or_(Payment.method == 'agreement', Payment.method == 'convenio'))
        else:
            filters.append(Payment.method == method)

    if type:
        if type == 'agreement':
            filters.append(or_(Payment.type == 'agreement', Payment.type == 'convenio'))
        else:
            filters.append(Payment.type == type)
    if q:
        like = f"%{q}%"
        full_name = func.concat(
            func.coalesce(Student.first_name, ""),
            " ",
            func.coalesce(Student.last_name, "")
        )
        filters.append(
            or_(
                Payment.reference.ilike(like),
                Payment.notes.ilike(like),
                Payment.method.ilike(like),
                Payment.type.ilike(like),
                Payment.student_name.ilike(like),
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
                full_name.ilike(like),
                Course.name.ilike(like),
            )
        )

    def apply_filters(q_stmt):
        if q:
            q_stmt = q_stmt.join(Student, Payment.student_id == Student.id, isouter=True)
            q_stmt = q_stmt.join(Course, Payment.course_id == Course.id, isouter=True)
        return q_stmt.where(*filters)

    stats_stmt = apply_filters(select(
        func.sum(Payment.amount).label('total_amount'),
        func.sum(case((Payment.method == 'efectivo', Payment.amount), else_=0)).label('cash_amount'),
        func.sum(case((or_(Payment.method == 'debito', Payment.method == 'credito', Payment.method == 'card'), Payment.amount), else_=0)).label('card_amount'),
        func.sum(case((or_(Payment.method == 'transferencia', Payment.method == 'transfer'), Payment.amount), else_=0)).label('transfer_amount'),
        func.sum(case((or_(Payment.method == 'convenio', Payment.method == 'agreement'), Payment.amount), else_=0)).label('agreement_amount'),
    ))
    
    stats_res = await db.execute(stats_stmt)
    stats_row = stats_res.mappings().one_or_none()
    
    stats_data = {
        "total_amount": stats_row["total_amount"] or 0,
        "cash_amount": stats_row["cash_amount"] or 0,
        "card_amount": stats_row["card_amount"] or 0,
        "transfer_amount": stats_row["transfer_amount"] or 0,
        "agreement_amount": stats_row["agreement_amount"] or 0,
    }

    # List query
    list_stmt = apply_filters(
        select(Payment, Student.first_name, Student.last_name)
        .join(Student, Payment.student_id == Student.id, isouter=True)
    ).order_by(Payment.payment_date.desc(), Payment.created_at.desc())
    
    res = await db.execute(list_stmt.offset(offset).limit(limit))
    rows = res.all()
    
    items = []
    for r in rows:
        p = r.Payment
        # If the student name isn't stored in the payment record yet (old data),
        # but the student still exists, use the joined data.
        if not p.student_name and r.first_name:
            p.student_name = f"{r.first_name} {r.last_name}".strip()
        items.append(p)
    
    # Total count
    total_stmt = apply_filters(select(func.count()).select_from(Payment))
    total = await db.scalar(total_stmt)
    
    return {"items": items, "total": total or 0, "stats": stats_data}


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
@router.post("", response_model=PaymentOut, status_code=201)
async def create_payment(
    payload: PaymentCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    data = payload.model_dump(exclude_unset=True)
    if data.get('student_id') and not data.get('student_name'):
        res = await db.execute(select(Student).where(Student.id == data['student_id'], Student.tenant_id == tenant_id))
        s = res.scalar_one_or_none()
        if s:
            data['student_name'] = f"{s.first_name} {s.last_name}".strip()
    if data.get('course_id') and not data.get('teacher_name_snapshot'):
        course_res = await db.execute(
            select(Teacher.name)
            .select_from(Course)
            .join(Teacher, Course.teacher_id == Teacher.id, isouter=True)
            .where(Course.id == data['course_id'], Course.tenant_id == tenant_id)
        )
        teacher_name = course_res.scalar_one_or_none()
        if teacher_name:
            data['teacher_name_snapshot'] = teacher_name
            
    obj = Payment(tenant_id=tenant_id, **data)
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



