import paramiko

host = '222.231.1.47'
username = 'root'
password = 'Serv57^23'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=username, password=password)

print("Uploading server/main.py...")
sftp = client.open_sftp()
sftp.put('server/main.py', '/root/prok_api/main.py')
sftp.close()

print("Restarting prok_api.service...")
stdin, stdout, stderr = client.exec_command("systemctl restart prok_api.service")
exit_status = stdout.channel.recv_exit_status()
print(stdout.read().decode(errors='replace'))
if stderr.read(): print("Error:", stderr.read().decode(errors='replace'))
print("Restart exited with code", exit_status)

client.close()
print("Done.")
