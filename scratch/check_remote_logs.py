import paramiko
import sys

def check_logs():
    host = '222.231.1.47'
    username = 'root'
    password = 'Serv57^23'
    
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, username=username, password=password)
        
        # Check service status
        print("=== SERVICE STATUS ===")
        stdin, stdout, stderr = client.exec_command("systemctl status prok-api")
        print(stdout.read().decode(errors='replace'))
        
        # Check last 30 lines of log
        print("=== LAST 30 LOG LINES FROM server.log ===")
        stdin, stdout, stderr = client.exec_command("tail -n 30 /root/prok_api/server.log")
        print(stdout.read().decode(errors='replace'))
        
        client.close()
    except Exception as e:
        print("Failed to check remote logs:", e)

if __name__ == '__main__':
    check_logs()
