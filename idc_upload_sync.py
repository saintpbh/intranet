#!/usr/bin/env python3
"""IDC 서버 uploads 디렉토리 확인 및 로컬 파일 전송"""
import paramiko
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def run_cmd(ssh, cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"SSH 접속 중... {HOST}")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("SSH 접속 성공!\n")
    
    # 1. IDC 서버의 uploads 디렉토리 확인
    print("[1] IDC 서버 uploads 디렉토리 확인...")
    out, _ = run_cmd(ssh, "ls -la /root/prok_api/uploads/ 2>/dev/null")
    print(f"  {out if out else '(디렉토리 없음)'}")
    
    out, _ = run_cmd(ssh, "find /root/prok_api/uploads/ -type f 2>/dev/null | head -20")
    print(f"  파일 목록: {out if out else '(파일 없음)'}")
    
    # 2. 로컬 uploads 디렉토리 확인
    local_uploads = r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\server\uploads"
    print(f"\n[2] 로컬 uploads 디렉토리 확인: {local_uploads}")
    
    if os.path.exists(local_uploads):
        for root, dirs, files in os.walk(local_uploads):
            for f in files:
                fp = os.path.join(root, f)
                rel = os.path.relpath(fp, local_uploads)
                size = os.path.getsize(fp)
                print(f"  {rel} ({size:,} bytes)")
    else:
        print("  (로컬 uploads 디렉토리 없음)")
    
    # 3. IDC 서버 main.py에서 uploads 경로 확인
    print("\n[3] IDC 서버 main.py의 uploads 설정 확인...")
    out, _ = run_cmd(ssh, "grep -n 'uploads\\|UPLOAD\\|static' /root/prok_api/main.py | head -20")
    print(f"  {out if out else '(관련 설정 없음)'}")
    
    # 4. IDC 서버에 uploads 디렉토리 생성
    print("\n[4] IDC 서버에 uploads 디렉토리 구조 생성...")
    run_cmd(ssh, "mkdir -p /root/prok_api/uploads/profiles")
    out, _ = run_cmd(ssh, "ls -la /root/prok_api/uploads/")
    print(f"  {out}")
    
    # 5. 로컬 파일을 IDC로 전송
    if os.path.exists(local_uploads):
        print("\n[5] 로컬 파일 -> IDC 서버 전송...")
        sftp = ssh.open_sftp()
        
        for root, dirs, files in os.walk(local_uploads):
            for f in files:
                local_path = os.path.join(root, f)
                rel = os.path.relpath(local_path, local_uploads).replace("\\", "/")
                remote_path = f"/root/prok_api/uploads/{rel}"
                
                # 원격 디렉토리 생성
                remote_dir = os.path.dirname(remote_path)
                try:
                    sftp.stat(remote_dir)
                except:
                    run_cmd(ssh, f"mkdir -p {remote_dir}")
                
                try:
                    sftp.put(local_path, remote_path)
                    print(f"  [OK] {rel}")
                except Exception as e:
                    print(f"  [ERR] {rel}: {e}")
        
        sftp.close()
        
        # 전송 결과 확인
        print("\n[6] 전송 결과 확인...")
        out, _ = run_cmd(ssh, "find /root/prok_api/uploads/ -type f | wc -l")
        print(f"  총 파일 수: {out}")
        out, _ = run_cmd(ssh, "find /root/prok_api/uploads/ -type f")
        print(f"  {out}")
    else:
        print("\n[5] 로컬 uploads 없음 - 전송 건너뜀")
    
    ssh.close()
    print("\n[완료]")

if __name__ == "__main__":
    main()
