from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from apps.backend.app.pms.models import Course, Teacher, Room
from apps.backend.app.pms.schemas import CourseOut, CourseCreate, CourseUpdate, CourseListItem, CourseListResponse
from apps.backend.app.pms.deps import get_tenant_id, get_db_session

router = APIRouter(prefix="/api/pms/courses", tags=["pms-courses"])


@router.get("/", response_model=CourseListResponse)
async def list_courses(
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
    q: str | None = Query(default=None, description="Filtro por nombre"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    c = Course
    t = Teacher
    r = Room
    conditions = [c.tenant_id == tenant_id]
    if q:
        like = f"%{q}%"
        conditions.append(c.name.ilike(like))

    stmt = (
        select(
            c.id,
            c.name,
            c.level,
            c.image_url,
            c.course_type,
            c.classes_per_week,
            c.day_of_week,
            c.start_time,
            c.end_time,
            c.day_of_week_2,
            c.start_time_2,
            c.end_time_2,
            c.day_of_week_3,
            c.start_time_3,
            c.end_time_3,
            c.day_of_week_4,
            c.start_time_4,
            c.end_time_4,
            c.day_of_week_5,
            c.start_time_5,
            c.end_time_5,
            c.start_date,
            c.price,
            c.class_price,
            c.is_active,
            t.name.label("teacher_name"),
            r.name.label("room_name"),
        )
        .join(t, (t.id == c.teacher_id) & (t.tenant_id == c.tenant_id), isouter=True)
        .join(r, (r.id == c.room_id) & (r.tenant_id == c.tenant_id), isouter=True)
        .where(*conditions)
        .order_by(c.day_of_week.asc().nulls_last(), c.start_time.asc().nulls_last(), c.name.asc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    rows = res.all()
    out: list[CourseListItem] = []
    for (
        id,
        name,
        level,
        image_url,
        course_type,
        classes_per_week,
        day_of_week,
        start_time,
        end_time,
        day_of_week_2,
        start_time_2,
        end_time_2,
        day_of_week_3,
        start_time_3,
        end_time_3,
        day_of_week_4,
        start_time_4,
        end_time_4,
        day_of_week_5,
        start_time_5,
        end_time_5,
        start_date,
        price,
        class_price,
        is_active,
        teacher_name,
        room_name,
    ) in rows:
        out.append(
            CourseListItem(
                id=id,
                name=name,
                level=level,
                image_url=image_url,
                course_type=course_type,
                classes_per_week=classes_per_week,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time,
                day_of_week_2=day_of_week_2,
                start_time_2=start_time_2,
                end_time_2=end_time_2,
                day_of_week_3=day_of_week_3,
                start_time_3=start_time_3,
                end_time_3=end_time_3,
                day_of_week_4=day_of_week_4,
                start_time_4=start_time_4,
                end_time_4=end_time_4,
                day_of_week_5=day_of_week_5,
                start_time_5=start_time_5,
                end_time_5=end_time_5,
                start_date=start_date,
                price=price,
                class_price=class_price,
                is_active=is_active,
                teacher_name=teacher_name,
                room_name=room_name,
            )
        )

    total_stmt = select(func.count()).select_from(c).where(*conditions)
    total = await db.scalar(total_stmt)

    return {"items": out, "total": total or 0}


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

    content_type = (file.content_type or "").lower()
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail="Tipo no permitido. Use JPG, PNG o WEBP")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(content_type, ".img")

    # Save under app/static/uploads/courses/{tenant}/{course}/
    from apps.backend.app.main import static_dir  # type: ignore
    target = Path(static_dir) / "uploads" / "courses" / str(tenant_id) / str(course_id)
    target.mkdir(parents=True, exist_ok=True)
    filename = secrets.token_hex(16) + ext
    dest = target / filename

    data = await file.read()
    max_bytes = 2 * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail="Imagen supera 2 MB")
    with open(dest, "wb") as fh:
        fh.write(data)

    # Public URL
    public_url = f"/static/uploads/courses/{tenant_id}/{course_id}/{filename}"
    course.image_url = public_url
    await db.flush()
    await db.refresh(course)
    await db.commit()
    return {"image_url": public_url, "id": course.id}


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
    await db.flush()
    await db.refresh(obj)
    await db.commit()
    return obj


@router.delete("/{course_id}", status_code=204)
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
    return None


