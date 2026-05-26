import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def run_cmd(ssh, cmd):
    print(f"\n[Running] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=20)
    try:
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        print("[STDOUT]")
        print(out)
        if err:
            print("[STDERR]")
            print(err)
    except Exception as e:
        print(f"[Error] {e}")

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("Connected!")
    
    # Check systemctl status of prok-api
    run_cmd(ssh, "systemctl status prok-api")
    
    # Read last 50 lines of /var/log/prok-api.log
    run_cmd(ssh, "tail -n 50 /var/log/prok-api.log")
    
    # Check if requests.db has table church_virtual_accounts
    run_cmd(ssh, "/root/prok_api/.venv/bin/python3 -c \"import sqlite3; conn=sqlite3.connect('/root/prok_api/requests.db'); c=conn.cursor(); c.execute('SELECT count(*) FROM church_virtual_accounts'); print('cva count:', c.fetchone()[0]); conn.close()\"")
    
    ssh.close()

if __name__ == "__main__":
    main()
