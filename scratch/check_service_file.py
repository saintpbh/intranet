import paramiko

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    
    print("=== [1] /etc/systemd/system/prok-api.service 내용 ===")
    stdin, stdout, stderr = ssh.exec_command("cat /etc/systemd/system/prok-api.service")
    print(stdout.read().decode('utf-8'))
    
    ssh.close()

if __name__ == "__main__":
    main()
