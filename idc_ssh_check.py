#!/usr/bin/env python3
"""IDC 서버 SSH 접속 및 인증서 확인 스크립트"""
import paramiko
import sys

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def run_cmd(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"[1] SSH 접속 중... {HOST}")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("[1] SSH 접속 성공!")
    
    # 1. /etc/letsencrypt/ 디렉토리 확인
    print("\n[2] /etc/letsencrypt/ 디렉토리 확인...")
    out, err = run_cmd(ssh, "ls -laR /etc/letsencrypt/")
    print(out[:5000] if out else "(empty)")
    if err:
        print(f"  ERR: {err[:500]}")
    
    # 2. 인증서 파일 찾기
    print("\n[3] 인증서 파일(pem) 찾기...")
    out, err = run_cmd(ssh, "find /etc/letsencrypt/ -name '*.pem' -type f 2>/dev/null")
    print(out if out else "(pem 파일 없음)")
    
    # 3. live 디렉토리 확인
    print("\n[4] live 디렉토리 확인...")
    out, err = run_cmd(ssh, "ls -la /etc/letsencrypt/live/ 2>/dev/null")
    print(out if out else "(live 디렉토리 없음)")
    
    # 4. 현재 서비스 상태 확인
    print("\n[5] FastAPI 서비스 상태 확인...")
    out, err = run_cmd(ssh, "systemctl status prok-api 2>/dev/null || ps aux | grep -i uvicorn | grep -v grep")
    print(out if out else "(서비스 미발견)")
    
    # 5. Nginx 상태 확인
    print("\n[6] Nginx 설치/상태 확인...")
    out, err = run_cmd(ssh, "nginx -v 2>&1; systemctl status nginx 2>/dev/null | head -10")
    print(out if out else "(nginx 미설치)")
    if err:
        print(f"  {err[:500]}")
    
    # 6. 포트 상태 확인
    print("\n[7] 열린 포트 확인...")
    out, err = run_cmd(ssh, "ss -tlnp | grep -E '(:80|:443|:5005|:8000)'")
    print(out if out else "(해당 포트 없음)")
    
    # 7. 방화벽 상태 확인
    print("\n[8] 방화벽 상태...")
    out, err = run_cmd(ssh, "firewall-cmd --list-all 2>/dev/null || iptables -L -n 2>/dev/null | head -30")
    print(out if out else "(방화벽 정보 없음)")
    if err:
        print(f"  {err[:500]}")
    
    ssh.close()
    print("\n[완료] SSH 연결 종료")

if __name__ == "__main__":
    main()
