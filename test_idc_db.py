import pymssql
import sys

server = "mssql.nskorea.com"
user = "prok.or.kr"
password = "qp1f]4jIM"
database = "KJ_CHURCH" 

def test_connection():
    try:
        print(f"[*] Attempting to connect to IDC Server: {server}...")
        conn = pymssql.connect(server, user, password, database, charset='cp949')
        cursor = conn.cursor(as_dict=True)
        
        print("[*] Connection successful! DB is online.")
        
        # Test TB_PEN100
        print("\n[*] Verifying integration with TB_PEN100...")
        cursor.execute("SELECT TOP 3 PenNo, MemberCode FROM TB_PEN100")
        rows = cursor.fetchall()
        print(f"Successfully fetched {len(rows)} records from TB_PEN100")

        # Test TB_PEN110
        print("\n[*] Verifying integration with TB_PEN110...")
        cursor.execute("SELECT TOP 3 PenNo, YYMM, Contribute, PenLevel FROM TB_PEN110 ORDER BY YYMM DESC")
        rows2 = cursor.fetchall()
        print(f"Successfully fetched {len(rows2)} records from TB_PEN110")

        cursor.close()
        conn.close()
        print("\n[*] All integration checks passed.")
        return True
    except Exception as e:
        print(f"\n[!] Error connecting to IDC Database: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
