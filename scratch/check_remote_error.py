import paramiko

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    
    print("=== [1] /root/prok_api 디렉토리 파일 목록 ===")
    stdin, stdout, stderr = ssh.exec_command("ls -la /root/prok_api")
    print(stdout.read().decode('utf-8'))
    
    print("=== [2] systemd 서비스 명칭 확인 ===")
    stdin, stdout, stderr = ssh.exec_command("systemctl list-units --type=service | grep -i prok")
    print(stdout.read().decode('utf-8'))
    
    print("=== [3] 서비스 상태 및 최근 저널 로그 ===")
    stdin, stdout, stderr = ssh.exec_command("systemctl status prok_api.service || systemctl status prok-api.service")
    print(stdout.read().decode('utf-8'))
    
    print("=== [4] journalctl -u prok_api.service -n 50 ===")
    stdin, stdout, stderr = ssh.exec_command("journalctl -u prok_api.service -n 50 || journalctl -u prok-api.service -n 50")
    print(stdout.read().decode('utf-8'))
    
    ssh.close()

if __name__ == "__main__":
    main()
