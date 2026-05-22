#!/usr/bin/env python3
"""IDC 서버 HTTPS 설정 - 최종 버전"""
import paramiko
import time
import sys
import io

# cp949 인코딩 문제 해결
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def run_cmd(ssh, cmd, timeout=30):
    print(f"  > {cmd[:120]}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(f"    {out[:500]}")
    if err and 'warning' not in err.lower():
        print(f"    [ERR] {err[:500]}")
    return out, err

def run_bg(ssh, cmd):
    """백그라운드 명령"""
    print(f"  > (bg) {cmd[:120]}")
    transport = ssh.get_transport()
    channel = transport.open_session()
    channel.exec_command(cmd)
    time.sleep(1)
    channel.close()

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"SSH 접속 중... {HOST}")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("SSH 접속 성공!\n")
    
    # Nginx 설정은 이미 통과했으므로, 남은 작업만 수행
    
    # ===== Step 1: 기존 uvicorn 정리 =====
    print("=" * 60)
    print("[Step 1] 기존 uvicorn 종료 및 systemd 서비스 등록")
    print("=" * 60)
    
    run_cmd(ssh, "pkill -f uvicorn 2>/dev/null; sleep 2; true")
    
    # systemd 서비스 파일
    service_content = """[Unit]
Description=PROK API Server (FastAPI/Uvicorn)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/prok_api
ExecStart=/root/prok_api/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 5005
Restart=always
RestartSec=5
StandardOutput=append:/var/log/prok-api.log
StandardError=append:/var/log/prok-api.log
Environment=PATH=/root/prok_api/.venv/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
"""
    run_cmd(ssh, f"cat > /etc/systemd/system/prok-api.service << 'SVCEOF'\n{service_content}\nSVCEOF")
    run_cmd(ssh, "systemctl daemon-reload")
    run_cmd(ssh, "systemctl enable prok-api")
    run_cmd(ssh, "systemctl start prok-api")
    time.sleep(3)
    
    out, _ = run_cmd(ssh, "systemctl is-active prok-api")
    if 'active' in out:
        print("  [OK] prok-api 서비스 활성화 완료!")
    else:
        print("  [WARN] systemd 시작 확인 중...")
        run_cmd(ssh, "systemctl status prok-api 2>&1 | tail -20")
        # fallback
        run_bg(ssh, "cd /root/prok_api && nohup /root/prok_api/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 5005 > /var/log/prok-api.log 2>&1 &")
        time.sleep(3)
    
    # ===== Step 2: Nginx 시작 =====
    print("\n" + "=" * 60)
    print("[Step 2] Nginx 시작")
    print("=" * 60)
    
    run_cmd(ssh, "systemctl enable nginx")
    run_cmd(ssh, "systemctl restart nginx")
    time.sleep(2)
    
    out, _ = run_cmd(ssh, "systemctl is-active nginx")
    if 'active' in out:
        print("  [OK] Nginx 활성화 완료!")
    else:
        print("  [WARN] Nginx 시작 실패")
        run_cmd(ssh, "systemctl status nginx 2>&1 | tail -20")
    
    # ===== Step 3: 최종 테스트 =====
    print("\n" + "=" * 60)
    print("[Step 3] 최종 테스트")
    print("=" * 60)
    
    out, _ = run_cmd(ssh, "curl -s http://127.0.0.1:5005/api/system/heartbeat 2>/dev/null")
    print(f"  [HTTP localhost:5005] {out[:200]}")
    
    out, _ = run_cmd(ssh, "curl -sk https://127.0.0.1/api/system/heartbeat 2>/dev/null")
    print(f"  [HTTPS localhost:443] {out[:200]}")
    
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ 2>/dev/null")
    print(f"  [HTTP->HTTPS redirect] HTTP code: {out}")
    
    out, _ = run_cmd(ssh, "ss -tlnp | grep -E ':80|:443|:5005'")
    print(f"\n  Open Ports:\n  {out}")
    
    ssh.close()
    
    print("\n" + "=" * 60)
    print("[DONE] HTTPS 설정 완료!")
    print("=" * 60)
    print("""
  Architecture:
    [Client] --HTTPS:443--> [Nginx] --HTTP--> [uvicorn:5005]
    
  Next Steps:
    1. External test: curl -k https://222.231.1.47/api/system/heartbeat
    2. After DNS change: https://server.prok.or.kr/api/system/heartbeat
    3. Update client .env.production
""")

if __name__ == "__main__":
    main()
