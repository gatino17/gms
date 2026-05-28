from pydantic import BaseModel
from dotenv import load_dotenv
import os
from pathlib import Path


# Cargar siempre el .env del backend, independiente desde dónde se ejecute uvicorn.
_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_BACKEND_ENV)


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        # Default to the URL you provided
        "postgresql+asyncpg://gatino:753524@204.48.22.217:5432/studiobd",
    )
    api_title: str = os.getenv("API_TITLE", "PMS API")
    tz: str = os.getenv("TZ", "America/Santiago")
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "http://206.189.191.143,http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
    )
    secret_key: str = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_whatsapp_from: str = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")


settings = Settings()

