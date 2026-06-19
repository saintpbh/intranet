import paramiko

def check_db():
    host = '222.231.1.47'
    username = 'root'
    password = 'Serv57^23'
    
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, username=username, password=password)
        
        print("=== CHECKING SQLite SCHEMA & DATA VIA PYTHON3 ===")
        python_snippet = """
import sqlite3
import sys

# Force UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('/root/prok_api/requests.db')
c = conn.cursor()
try:
    c.execute("SELECT COUNT(*), SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END), SUM(CASE WHEN latitude = 0.0 THEN 1 ELSE 0 END), SUM(CASE WHEN latitude IS NULL THEN 1 ELSE 0 END) FROM local_churches")
    row = c.fetchone()
    print("Counts (total, not_null, zero, null):", row)
    
    # Get 10 successfully geocoded churches
    c.execute("SELECT CHRNAME, ADDRESS, latitude, longitude FROM local_churches WHERE latitude IS NOT NULL AND latitude != 0.0 LIMIT 10")
    print("Geocoded sample:")
    for r in c.fetchall():
        print(f"- {r[0]}: {r[1]} ({r[2]}, {r[3]})")
except Exception as e:
    print("Error:", e)
conn.close()
"""
        # escape double quotes for the bash command
        escaped_snippet = python_snippet.replace('"', '\\"')
        cmd = f"python3 -c \"{escaped_snippet}\""
        stdin, stdout, stderr = client.exec_command(cmd)
        # Get stdout bytes and write to local file with utf-8
        stdout_bytes = stdout.read()
        local_output_path = 'scratch/geocoded_remote.txt'
        with open(local_output_path, 'wb') as f:
            f.write(stdout_bytes)
        
        print(f"Results written to {local_output_path}")
        with open(local_output_path, 'r', encoding='utf-8') as f:
            print(f.read())
            
        client.close()
    except Exception as e:
        print("Failed to check remote DB:", e)

if __name__ == '__main__':
    check_db()
