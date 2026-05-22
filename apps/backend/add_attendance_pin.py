import asyncio
import asyncpg

async def main():
    try:
        conn = await asyncpg.connect("postgresql://gatino:753524@204.48.22.217:5432/studiobd")
        print("Connected to database")
        
        await conn.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS attendance_pin VARCHAR(4)")
        print("Column attendance_pin checked/added to tenants")
        
        await conn.close()
        print("Database schema updated successfully")
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    asyncio.run(main())
