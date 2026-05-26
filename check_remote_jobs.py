import paramiko

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    
    print("=== [1] 원격지 활성 프로세스 (python, pip, apt) ===")
    stdin, stdout, stderr = ssh.exec_command("ps aux | grep -E 'python|pip|apt|dpkg' | grep -v grep")
    print(stdout.read().decode('utf-8'))
    
    print("=== [2] uvicorn 및 prok-api 서비스 상태 ===")
    stdin, stdout, stderr = ssh.exec_command("systemctl status prok-api.service || ps aux | grep uvicorn")
    print(stdout.read().decode('utf-8'))
    
    print("=== [3] dpkg / apt 락 상태 점검 ===")
    stdin, stdout, stderr = ssh.exec_command("ls -la /var/lib/dpkg/lock* /var/lib/apt/lists/lock* 2>/dev/null")
    print(stdout.read().decode('utf-8'))
    
    ssh.close()

if __name__ == "__main__":
    main()
