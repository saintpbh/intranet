import urllib.request, json

def send_push():
    url = 'http://127.0.0.1:8000/api/push/campaigns'
    payload = {
        "title": "기장주소록 알림 연동 테스트",
        "body": "박봉환 목사님, 앱 강제 업데이트 후 권한 수락이 확인되었습니다! 이 알림이 성공적으로 보인다면 모든 설정이 완벽하게 된 것입니다.",
        "scope": "all",
        "target_type": "all",
        "target_data": {},
        "sender_name": "시스템 관리자"
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        res = urllib.request.urlopen(req)
        print(res.read().decode('utf-8'))
    except Exception as e:
        print("ERROR:", e)
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))

send_push()
