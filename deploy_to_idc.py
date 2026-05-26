import paramiko
import os
import zipfile
import stat

def zip_server_folder(source_dir, output_filename):
    print(f"Zipping {source_dir} to {output_filename}...")
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            if '.venv' in dirs: dirs.remove('.venv')
            if '__pycache__' in dirs: dirs.remove('__pycache__')
            if '.git' in dirs: dirs.remove('.git')
            if 'uploads' in dirs: dirs.remove('uploads')
            if 'node_modules' in dirs: dirs.remove('node_modules')
            
            for file in files:
                if file.endswith('.pyc'): continue
                if file in ('requests.db', 'requests.db-journal'): continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
    print("Zip complete.")

def deploy():
    host = '222.231.1.47'
    username = 'root'
    password = 'Serv57^23'
    local_zip = 'server_deploy.zip'
    remote_zip = '/root/server_deploy.zip'
    remote_dir = '/root/prok_api'

    zip_server_folder('server', local_zip)

    try:
        print("Connecting to SSH...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, username=username, password=password)
        
        print("Uploading zip file...")
        sftp = client.open_sftp()
        sftp.put(local_zip, remote_zip)
        sftp.close()
        
        print("Executing setup commands on server...")
        commands = [
            f"systemctl stop prok_api.service || true",
            f"systemctl disable prok_api.service || true",
            f"rm -f /etc/systemd/system/prok_api.service || true",
            f"systemctl stop prok-api.service || true",
            f"mkdir -p {remote_dir}",
            f"unzip -o {remote_zip} -d {remote_dir}",
        ]
        
        for cmd in commands:
            print(f"Running: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            out_str = stdout.read().decode(errors='replace')
            err_str = stderr.read().decode(errors='replace')
            print(out_str.encode('cp949', errors='replace').decode('cp949'))
            if err_str: print(f"Error: {err_str.encode('cp949', errors='replace').decode('cp949')}")

            if exit_status != 0:
                print(f"Command failed with exit code {exit_status}")
                break

        # Create systemd service (aligned with original prok-api.service)
        service_content = f"""[Unit]
Description=PROK API Server (FastAPI/Uvicorn)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={remote_dir}
ExecStart={remote_dir}/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 5005
Restart=always
RestartSec=5
StandardOutput=append:/var/log/prok-api.log
StandardError=append:/var/log/prok-api.log
Environment=PATH={remote_dir}/.venv/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
"""
        print("Creating systemd service...")
        stdin, stdout, stderr = client.exec_command("cat > /etc/systemd/system/prok-api.service")
        stdin.write(service_content)
        stdin.flush()
        stdin.close()
        
        client.exec_command("systemctl daemon-reload")
        client.exec_command("systemctl enable prok-api.service")
        client.exec_command("systemctl restart prok-api.service")
        print("Service prok-api started. Run 'systemctl status prok-api' to check.")
        
        client.close()
        print("Deployment complete.")
    except Exception as e:
        print(f"Deployment failed: {e}")

if __name__ == "__main__":
    deploy()
