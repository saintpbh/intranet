from db_helper import get_connection

try:
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    
    # Check current value
    cursor.execute("SELECT MinisterCode, MinisterName FROM VI_MIN_INFO WHERE MinisterCode = '7600'")
    print("Before:", cursor.fetchall())
    
    # Try updating the view or the underlying table
    try:
        cursor.execute("UPDATE VI_MIN_INFO SET MinisterName = %s WHERE MinisterCode = %s", ('총회직원'.encode('cp949'), '7600'))
        conn.commit()
        print("Updated via view successfully.")
    except Exception as e:
        print("Failed to update view directly:", e)
        # Check tables
        cursor.execute("SELECT name FROM sys.tables WHERE name LIKE '%Min%'")
        print("Tables:", [t['name'] for t in cursor.fetchall()])
        
    cursor.execute("SELECT MinisterCode, MinisterName FROM VI_MIN_INFO WHERE MinisterCode = '7600'")
    print("After:", cursor.fetchall())
    
    conn.close()
except Exception as e:
    print("Error:", e)
