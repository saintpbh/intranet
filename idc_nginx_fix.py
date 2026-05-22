#!/usr/bin/env python3
"""Nginx CORS 중복 헤더 제거 + DNS 확인"""
import paramiko
import time
import sys
import io

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
    if err:
        print(f"    [info] {err[:500]}")
    return out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"SSH 접속 중... {HOST}")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("SSH 접속 성공!\n")
    
    # ===== Nginx 설정 업데이트 (CORS 헤더 제거 - FastAPI에서 처리) =====
    print("=" * 60)
    print("[Step 1] Nginx 설정 업데이트 (CORS 중복 제거)")
    print("=" * 60)
    
    # CORS 헤더를 Nginx에서 제거 - FastAPI가 자체적으로 CORS 처리
    site_conf = """server {
    listen 80;
    server_name server.prok.or.kr _;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name server.prok.or.kr _;

    ssl_certificate     /etc/letsencrypt/server.prok.or.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/server.prok.or.kr/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    location / {
        proxy_pass http://127.0.0.1:5005;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
"""
    run_cmd(ssh, f"cat > /etc/nginx/conf.d/prok-api.conf << 'SITEEOF'\n{site_conf}\nSITEEOF")
    
    # 설정 검증
    out, err = run_cmd(ssh, "nginx -t 2>&1")
    if 'successful' in (out + err).lower():
        print("  [OK] Nginx 설정 검증 통과!")
        run_cmd(ssh, "systemctl reload nginx")
        print("  [OK] Nginx 리로드 완료!")
    else:
        print(f"  [ERROR] {out} {err}")
    
    # ===== 최종 상태 확인 =====
    print("\n" + "=" * 60)
    print("[Step 2] 서비스 상태 확인")
    print("=" * 60)
    
    out, _ = run_cmd(ssh, "systemctl is-active prok-api nginx")
    out, _ = run_cmd(ssh, "ss -tlnp | grep -E ':80|:443|:5005'")
    
    # 내부 테스트
    out, _ = run_cmd(ssh, "curl -sk https://localhost/api/system/heartbeat")
    print(f"\n  HTTPS 내부 테스트: {out}")
    
    # 응답 헤더 확인 (CORS 중복 없는지)
    out, _ = run_cmd(ssh, "curl -sk -D- https://localhost/api/system/heartbeat -o /dev/null 2>/dev/null | head -20")
    print(f"\n  응답 헤더:\n{out}")
    
    ssh.close()
    print("\n[완료]")

if __name__ == "__main__":
    main()
