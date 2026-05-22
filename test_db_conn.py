import paramiko
import sys

def check_db_port():
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect('222.231.1.47', username='root', password='Serv57^23')
        
        script = """
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
result = s.connect_ex(('mssql.nskorea.com', 1433))
if result == 0:
    print('DB_PORT_OPEN')
else:
    print('DB_PORT_CLOSED')
s.close()
"""
        stdin, stdout, stderr = client.exec_command(f'python3 -c "{script}"')
        print(stdout.read().decode().strip())
        err = stderr.read().decode().strip()
        if err:
            print(f"Error: {err}")
        client.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    check_db_port()
