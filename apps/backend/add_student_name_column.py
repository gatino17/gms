import sqlite3
import os

db_path = r'c:\Users\Alejandro\Desktop\studios\pms\apps\backend\pms.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE payments ADD COLUMN student_name VARCHAR(160)")
        print("Column student_name added to payments table.")
    except sqlite3.OperationalError as e:
        print(f"Error or column already exists: {e}")
    
    # Optional: Fill existing names
    cursor.execute("""
        UPDATE payments 
        SET student_name = (
            SELECT first_name || ' ' || last_name 
            FROM students 
            WHERE students.id = payments.student_id
        )
        WHERE student_name IS NULL AND student_id IS NOT None
    """)
    print(f"Updated {cursor.rowcount} existing payment records with student names.")
    
    conn.commit()
    conn.close()
else:
    print(f"DB not found at {db_path}")
