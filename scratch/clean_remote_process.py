import paramiko

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    
    print("=== [1] stuck pip install 프로세스 강제 종료 ===")
    # stuck pip process 131470 kill
    stdin, stdout, stderr = ssh.exec_command("kill -9 131470 || pkill -9 -f 'pip install'")
    print(stdout.read().decode('utf-8'))
    
    print("=== [2] uvicorn 찌꺼기 포트 락 해제 및 재정리 ===")
    stdin, stdout, stderr = ssh.exec_command("fuser -k 5005/tcp || true")
    print(stdout.read().decode('utf-8'))
    
    print("=== [3] prok-api.service 서비스 재가동 ===")
    stdin, stdout, stderr = ssh.exec_command("systemctl daemon-reload && systemctl enable prok-api.service && systemctl restart prok-api.service")
    print(stdout.read().decode('utf-8'))
    
    print("=== [4] 서비스 정상 가동 상태 조회 ===")
    stdin, stdout, stderr = ssh.exec_command("systemctl status prok-api.service")
    print(stdout.read().decode('utf-8'))
    
    ssh.close()

if __name__ == "__main__":
    main()
