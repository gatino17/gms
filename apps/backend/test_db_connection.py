import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def test_connection():
    print(f"Testing connection to: {DATABASE_URL}")
    try:
        engine = create_async_engine(DATABASE_URL)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"Connection successful! Result: {result.fetchone()}")
            
            # Check if user table exists
            result = await conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')"))
            exists = result.scalar()
            print(f"Table 'users' exists: {exists}")
            
            if exists:
                # Check columns
                columns_to_check = ['id', 'email', 'hashed_password', 'full_name', 'is_active', 'is_superuser', 'tenant_id']
                for col in columns_to_check:
                    try:
                        await conn.execute(text(f"SELECT {col} FROM users LIMIT 1"))
                        print(f"  Column '{col}' exists: Yes")
                    except Exception as e:
                        print(f"  Column '{col}' exists: NO (Error: {e})")
                
                # Check user count
                result = await conn.execute(text("SELECT COUNT(*) FROM users"))
                count = result.scalar()
                print(f"Total users in DB: {count}")
                
                if count == 0:
                    print("WARNING: No users found in 'users' table. You need to create a superuser.")
            else:
                print("WARNING: Table 'users' does not exist. Did you run migrations?")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_connection())
