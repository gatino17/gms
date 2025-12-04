from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path


from apps.backend.app.core.config import settings
from apps.backend.app.routers import pms_students, pms_courses, pms_payments
from apps.backend.app.routers import pms_course_status
from apps.backend.app.routers import pms_teachers
from apps.backend.app.routers import pms_rooms
from apps.backend.app.routers import pms_enrollments
from apps.backend.app.routers import pms_attendance
from apps.backend.app.routers import pms_tenants
from apps.backend.app.routers import auth

app = FastAPI(title=settings.api_title)

origins = [o.strip() for o in settings.cors_origins.split(',') if o.strip()]
if not origins or origins == ['*']:
    origins = ['http://localhost:5173', 'http://127.0.0.1:5173']
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PMS routers
app.include_router(pms_students.router)
app.include_router(pms_courses.router)
app.include_router(pms_payments.router)
app.include_router(pms_course_status.router)
app.include_router(pms_teachers.router)
app.include_router(pms_rooms.router)
app.include_router(pms_enrollments.router)
app.include_router(pms_attendance.router)
app.include_router(pms_tenants.router)
app.include_router(auth.router, tags=["login"])

# Static files (for uploaded images)
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}
