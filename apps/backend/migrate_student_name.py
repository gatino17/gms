import asyncio
import asyncpg

async def main():
    try:
        conn = await asyncpg.connect("postgresql://gatino:753524@204.48.22.217:5432/studiobd")
        print("Connected to database")
        
        # Add student_name to payments
        await conn.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_name VARCHAR(160)")
        print("Column student_name checked/added to payments")
        
        # Backfill student_name for existing payments
        await conn.execute("""
            UPDATE payments 
            SET student_name = s.first_name || ' ' || s.last_name
            FROM students s
            WHERE payments.student_id = s.id AND payments.student_name IS NULL
        """)
        print("Backfilled student_name for existing records")
        
        await conn.close()
        print("Database schema updated successfully")
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    asyncio.run(main())
