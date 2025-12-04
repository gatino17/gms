import asyncio
import sys
from pathlib import Path

# Add the project root to the python path
sys.path.append(str(Path(__file__).resolve().parents[2]))

from apps.backend.app.db.session import SessionLocal
from apps.backend.app.pms.models import User
from apps.backend.app.core.security import get_password_hash

async def create_superuser():
    async with SessionLocal() as session:
        email = "admin@example.com"
        password = "admin"
        
        print(f"Checking if user {email} exists...")
        # Check if user exists (using simple loop since I don't want to import select if not needed, but I should)
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if user:
            print(f"User {email} already exists.")
            return

        print(f"Creating user {email}...")
        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name="Admin User",
            is_superuser=True,
            is_active=True
        )
        session.add(user)
        await session.commit()
        print(f"User {email} created successfully.")

if __name__ == "__main__":
    asyncio.run(create_superuser())
