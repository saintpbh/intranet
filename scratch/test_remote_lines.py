import paramiko

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("Connected!")
    
    cmd = 'python3 -c "import sqlite3; conn=sqlite3.connect(\'/root/prok_api/requests.db\'); conn.row_factory=sqlite3.Row; c=conn.cursor(); c.execute(\'SELECT ChrCode, CHRNAME, NOHNAME FROM local_churches WHERE ChrCode = \\\'100092\\\'\'); row=c.fetchone(); print(dict(row) if row else None); conn.close()"'
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("[STDOUT]")
    print(stdout.read().decode('utf-8', errors='replace').strip())
    
    ssh.close()

if __name__ == "__main__":
    main()
