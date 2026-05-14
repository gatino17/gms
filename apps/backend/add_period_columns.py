import asyncio
from sqlalchemy import text
from app.db.session import get_db

async def add_period_columns():
    async for db in get_db():
        try:
            print("Adding period_start...")
            await db.execute(text("ALTER TABLE payments ADD COLUMN period_start DATE;"))
        except Exception as e:
            print(f"Error adding period_start (maybe already exists): {e}")
            
        try:
            print("Adding period_end...")
            await db.execute(text("ALTER TABLE payments ADD COLUMN period_end DATE;"))
        except Exception as e:
            print(f"Error adding period_end (maybe already exists): {e}")
            
        await db.commit()
        print("Done.")
        break

if __name__ == "__main__":
    asyncio.run(add_period_columns())
