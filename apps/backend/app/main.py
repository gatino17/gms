from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging


from app.core.config import settings
from app.routers import pms_students, pms_courses, pms_payments
from app.routers import pms_course_status
from app.routers import pms_teachers
from app.routers import pms_rooms
from app.routers import pms_enrollments
from app.routers import pms_attendance
from app.routers import pms_tenants
from app.routers import pms_announcements
from app.routers import auth
from app.routers import pms_dashboard
from app.routers import pms_reports
from app.routers import pms_whatsapp

app = FastAPI(title=settings.api_title)

# CORS configuration
cors_origins_raw = settings.cors_origins.split(',')
origins = [o.strip() for o in cors_origins_raw if o.strip()]
local_dev_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# If origins is '*' or empty, provide safe local defaults.
if not origins or "*" in origins:
    origins = local_dev_origins.copy()

# Always allow common local dev origins in development.
if settings.environment.lower() == "development":
    for dev_origin in local_dev_origins:
        if dev_origin not in origins:
            origins.append(dev_origin)

# Support local dev ports beyond the explicit list only in development.
allow_origin_regex = (
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    if settings.environment.lower() == "development"
    else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler to ensure CORS headers are sent on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Global error handler caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", origins[0]),
            "Access-Control-Allow-Credentials": "true",
        }
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
app.include_router(pms_announcements.router)
app.include_router(auth.router, tags=["login"])
app.include_router(pms_dashboard.router)
app.include_router(pms_reports.router)
app.include_router(pms_whatsapp.router)

# Static files (for uploaded images)
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}
