from pydantic import BaseModel
from dotenv import load_dotenv
import os


load_dotenv()


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        # Default to the URL you provided
        "postgresql+asyncpg://gatino:753524@204.48.22.217:5432/studiobd",
    )
    api_title: str = os.getenv("API_TITLE", "PMS API")
    tz: str = os.getenv("TZ", "America/Santiago")
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    secret_key: str = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


settings = Settings()

