import asyncio
from sqlalchemy import select
from app.pms.models import Student, Course
from app.db.session import SessionLocal

async def check_urls():
    async with SessionLocal() as db:
        res = await db.execute(select(Student.first_name, Student.photo_url).where(Student.photo_url.is_not(None)).limit(5))
        print("--- Students ---")
        for name, url in res.all():
            print(f"{name}: {url}")
            
        res = await db.execute(select(Course.name, Course.image_url).where(Course.image_url.is_not(None)).limit(5))
        print("\n--- Courses ---")
        for name, url in res.all():
            print(f"{name}: {url}")

if __name__ == "__main__":
    asyncio.run(check_urls())
