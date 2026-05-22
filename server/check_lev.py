import pymssql, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()
conn = pymssql.connect(server=os.getenv('DB_SERVER'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), database=os.getenv('DB_NAME'))
c = conn.cursor(as_dict=True)

# Try to select from TB_PEN_ESTIMATE
try:
    c.execute("SELECT TOP 1 * FROM TB_PEN_ESTIMATE")
    print(f"Table exists: {c.fetchone()}")
except Exception as e:
    print(f"Table error: {e}")

# Check INFORMATION_SCHEMA instead of sys.tables
try:
    c.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='TB_PEN_ESTIMATE'")
    r = c.fetchone()
    print(f"INFORMATION_SCHEMA check: {r}")
except Exception as e:
    print(f"Info schema error: {e}")

# Try creating the table with INFORMATION_SCHEMA
try:
    c.execute("""
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='TB_PEN_ESTIMATE')
        CREATE TABLE TB_PEN_ESTIMATE (
            ID INT IDENTITY(1,1) PRIMARY KEY,
            MinisterCode NVARCHAR(20),
            PenNo NVARCHAR(20),
            RetireAge INT,
            EstimatedMonthly INT,
            ContributionRate FLOAT,
            RetirementRate FLOAT,
            BaseSalary INT,
            CalcDate DATETIME DEFAULT GETDATE()
        )
    """)
    conn.commit()
    print("Table created successfully!")
except Exception as e:
    print(f"Create error: {e}")

conn.close()
