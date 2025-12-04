from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from apps.backend.app.core.config import settings


engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,   # valida la conexión antes de usarla para evitar sockets cerrados
    pool_recycle=1800,    # recicla conexiones cada 30 min; ajusta según el timeout de tu DB
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with SessionLocal() as session:
        yield session
