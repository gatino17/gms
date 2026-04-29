import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select
from app.pms.models import Tenant

DATABASE_URL = "postgresql+asyncpg://gatino:753524@204.48.22.217:5432/studiobd"

async def check():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(select(Tenant).where(Tenant.name == 'Estudio de Prueba Antigravity'))
        tenants = res.fetchall()
        print(f"Tenants found: {len(tenants)}")
        for t in tenants:
            print(f"ID: {t[0]}, Slug: {t[2]}")

if __name__ == "__main__":
    asyncio.run(check())
