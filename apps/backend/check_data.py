import asyncio
import asyncpg

async def main():
    try:
        conn = await asyncpg.connect("postgresql://gatino:753524@204.48.22.217:5432/studiobd")
        
        tenant_id = 10
        
        t_count = await conn.fetchval("SELECT COUNT(*) FROM teachers WHERE tenant_id = $1", tenant_id)
        p_count = await conn.fetchval("SELECT COUNT(*) FROM payments WHERE tenant_id = $1", tenant_id)
        s_count = await conn.fetchval("SELECT COUNT(*) FROM students WHERE tenant_id = $1", tenant_id)
        
        print(f"Tenant {tenant_id} - Teachers: {t_count}, Payments: {p_count}, Students: {s_count}")
        
        if p_count > 0:
            last_p = await conn.fetchrow("SELECT payment_date, amount FROM payments WHERE tenant_id = $1 ORDER BY payment_date DESC LIMIT 1", tenant_id)
            print(f"Last payment: {last_p['payment_date']} - {last_p['amount']}")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
