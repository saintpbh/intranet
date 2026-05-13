from db_helper import get_connection

try:
    conn = get_connection()
    conn.autocommit(True)
    cursor = conn.cursor()
    
    cursor.execute("""
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TB_Min_Modify_Req' AND xtype='U')
    CREATE TABLE TB_Min_Modify_Req (
        ReqID INT IDENTITY(1,1) PRIMARY KEY,
        MinisterCode CHAR(6),
        MinisterName NVARCHAR(50),
        ReqField VARCHAR(50),
        OldValue NVARCHAR(200),
        NewValue NVARCHAR(200),
        ReqStatus VARCHAR(20) DEFAULT 'PENDING',
        ReqDate DATETIME DEFAULT GETDATE(),
        ResolvedDate DATETIME NULL,
        Memo NVARCHAR(500) NULL
    )
    """)
    print("TB_Min_Modify_Req table checked/created successfully.")
except Exception as e:
    print("Error creating table:", e)
finally:
    if 'conn' in locals():
        conn.close()
