from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.pms.models import Course, Teacher, Room, Enrollment
from app.pms.schemas import CourseOut, CourseCreate, CourseUpdate, CourseListItem, CourseListResponse
from app.pms.deps import get_tenant_id, get_db_session

router = APIRouter(prefix="/api/pms/courses", tags=["pms-courses"])


@router.get("/", response_model=CourseListResponse)
@router.get("")
async def list_courses(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    enrollment_sq = (
        select(Enrollment.course_id, func.count(Enrollment.id).label("student_count"))
        .where(Enrollment.tenant_id == tenant_id, Enrollment.is_active == True)
        .group_by(Enrollment.course_id)
        .subquery()
    )

    stmt = (
        select(
            Course,
            Teacher.name.label("teacher_name"),
            Room.name.label("room_name"),
            func.coalesce(enrollment_sq.c.student_count, 0).label("student_count")
        )
        .join(Teacher, (Teacher.id == Course.teacher_id) & (Teacher.tenant_id == Course.tenant_id), isouter=True)
        .join(Room, (Room.id == Course.room_id) & (Room.tenant_id == Course.tenant_id), isouter=True)
        .join(enrollment_sq, enrollment_sq.c.course_id == Course.id, isouter=True)
        .where(Course.tenant_id == tenant_id)
    )
    
    if q:
        stmt = stmt.where(Course.name.ilike(f"%{q}%"))

    stmt = stmt.order_by(Course.day_of_week.asc().nulls_last(), Course.start_time.asc().nulls_last(), Course.name.asc()).offset(offset).limit(limit)
    
    res = await db.execute(stmt)
    rows = res.all()
    
    items = []
    for c_obj, t_name, r_name, s_count in rows:
        d = {k: v for k, v in c_obj.__dict__.items() if not k.startswith('_')}
        items.append(CourseListItem(**d, teacher_name=t_name, room_name=r_name, student_count=int(s_count)))

    total = await db.scalar(select(func.count()).select_from(Course).where(Course.tenant_id == tenant_id)) or 0
    return {"items": items, "total": int(total)}


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(
    course_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    return obj


@router.post("/", response_model=CourseOut, status_code=201)
async def create_course(
    payload: CourseCreate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    obj = Course(tenant_id=tenant_id, **payload.model_dump(exclude_unset=True))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.put("/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: int,
    payload: CourseUpdate,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{course_id}")
async def delete_course(
    course_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    res = await db.execute(select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    await db.delete(obj)
    await db.commit()
    return {"detail": "Curso eliminado"}


@router.post("/{course_id}/image")
async def upload_course_image(
    course_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    file: UploadFile = File(...),
):
    res = await db.execute(select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    # Guardar archivo
    ext = Path(file.filename).suffix
    new_name = f"course_{course_id}_{secrets.token_hex(4)}{ext}"
    
    # Usar ruta absoluta para evitar problemas de importación circular
    static_dir = Path(__file__).parent.parent / "static"
    upload_dir = static_dir / "uploads" / "courses"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / new_name
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    course.image_url = f"/static/uploads/courses/{new_name}"
    await db.commit()
    await db.refresh(course)
    return course
