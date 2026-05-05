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

app = FastAPI(title=settings.api_title)

# CORS configuration
cors_origins_raw = settings.cors_origins.split(',')
origins = [o.strip() for o in cors_origins_raw if o.strip()]

# If origins is '*' or empty, provide defaults including the production IP
if not origins or "*" in origins:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://206.189.191.143",
        "http://206.189.191.143:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

# Static files (for uploaded images)
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}
