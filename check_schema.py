import sys
sys.path.append('./server')
from main import get_connection

conn = get_connection()
cursor = conn.cursor()

for table in ['TB_PEN100', 'TB_PEN110', 'TB_PEN120']:
    cursor.execute(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}'")
    cols = [r[0] for r in cursor.fetchall()]
    print(f"{table}: {cols}")

conn.close()
