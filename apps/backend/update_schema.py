import asyncio
import asyncpg

async def main():
    try:
        conn = await asyncpg.connect("postgresql://gatino:753524@204.48.22.217:5432/studiobd")
        print("Connected to database")
        
        # Add photo_url to teachers
        await conn.execute("ALTER TABLE teachers ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255)")
        print("Column photo_url checked/added to teachers")
        
        # Add photo_url to students (just in case)
        await conn.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255)")
        print("Column photo_url checked/added to students")
        
        await conn.close()
        print("Database schema updated successfully")
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    asyncio.run(main())
