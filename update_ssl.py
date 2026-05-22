import paramiko
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('222.231.1.47', username='root', password='Serv57^23')

service_content = """[Unit]
Description=PROK API FastAPI Service
After=network.target

[Service]
User=root
WorkingDirectory=/root/prok_api
Environment="PATH=/root/prok_api/.venv/bin"
ExecStart=/root/prok_api/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 5005 --ssl-keyfile /etc/letsencrypt/server.prok.or.kr/privkey.pem --ssl-certfile /etc/letsencrypt/server.prok.or.kr/fullchain.pem
Restart=always

[Install]
WantedBy=multi-user.target
"""

sftp = client.open_sftp()
with sftp.file('/etc/systemd/system/prok_api.service', 'w') as f:
    f.write(service_content)
sftp.close()

commands = [
    'systemctl daemon-reload',
    'systemctl restart prok_api',
    'systemctl status prok_api'
]

for cmd in commands:
    print(f'Executing: {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd)
    time.sleep(1)
    print("STDOUT:", stdout.read().decode('utf-8'))
    print("STDERR:", stderr.read().decode('utf-8'))

client.close()
