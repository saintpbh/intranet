import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def run_cmd(ssh, cmd):
    print(f"\n[Running] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
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
    
    # Run the replication and upload to Firebase Storage
    cmd = "cd /root/prok_api && /root/prok_api/.venv/bin/python3 -c \"import sys; sys.path.append('/root/prok_api'); from main import replicate_mssql_to_local, upload_directory_json_to_firebase; print('Replicating...'); res=replicate_mssql_to_local(); print(res); print('Uploading to Firebase...'); res2=upload_directory_json_to_firebase(); print('Upload result:', res2)\""
    run_cmd(ssh, cmd)
    
    ssh.close()

if __name__ == "__main__":
    main()
