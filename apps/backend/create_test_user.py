import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.pms.models import User
from app.core import security
import os

DATABASE_URL = "postgresql+asyncpg://gatino:753524@204.48.22.217:5432/studiobd"

async def create_test_user():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if user exists
        from sqlalchemy import select
        res = await session.execute(select(User).where(User.email == "test@test.com"))
        user = res.scalars().first()
        
        if user:
            print("User test@test.com already exists.")
        else:
            user = User(
                email="test@test.com",
                hashed_password=security.get_password_hash("testpassword123"),
                full_name="Test Superuser",
                is_active=True,
                is_superuser=True
            )
            session.add(user)
            await session.commit()
            print("User test@test.com created successfully.")

if __name__ == "__main__":
    asyncio.run(create_test_user())
