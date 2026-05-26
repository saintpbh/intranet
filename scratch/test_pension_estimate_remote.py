import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("Connected!")
    
    python_code = """
import urllib.request
import json
import time

url = "http://127.0.0.1:5005/api/pension/200331/estimate"
payload = {
    "retire_age": 65,
    "lev1_y": 15, "lev1_m": 6,
    "lev2_y": 10, "lev2_m": 0,
    "lev3_y": 5, "lev3_m": 0,
    "lev4_y": 4, "lev4_m": 0,
    "birth_year": 1968, "birth_month": 5,
    "amt": 3500000
}

headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

print("--- Testing Live Pension Estimate API Latency ---")
latencies = []
for i in range(3):
    start = time.time()
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        with urllib.request.urlopen(req) as res:
            code = res.getcode()
            content = res.read().decode('utf-8')
            elapsed = (time.time() - start) * 1000
            latencies.append(elapsed)
            data = json.loads(content)
            print(f" - [Run {i+1}] HTTP {code} | Latency: {elapsed:.2f} ms | Monthly Pay: {data.get('estimated_monthly'):,} 원")
    except Exception as e:
        print(f" - [Run {i+1}] Failed: {e}")

if latencies:
    print(f"\\n[SUMMARY] Min: {min(latencies):.1f}ms | Max: {max(latencies):.1f}ms | Avg: {sum(latencies)/len(latencies):.1f}ms")
"""
    
    stdin, stdout, stderr = ssh.exec_command("/root/prok_api/.venv/bin/python3", timeout=30)
    stdin.write(python_code)
    stdin.flush()
    stdin.close()
    
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    
    print("[STDOUT]")
    print(out)
    if err:
        print("[STDERR]")
        print(err)
        
    ssh.close()

if __name__ == "__main__":
    main()
