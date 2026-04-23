import urllib.request, json

def send_push():
    url = 'http://127.0.0.1:8000/api/push/campaigns'
    payload = {
        "title": "테스트 푸시 알림",
        "body": "박봉환 목사님, 푸시 알림 테스트입니다. 이 메시지가 보이면 기기 연동이 완벽하게 처리된 것입니다!",
        "scope": "assembly",
        "target_type": "individual",
        "target_data": {"minister_codes": ["000000"]},
        "sender_name": "시스템 관리자"
    }

    import sqlite3
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute("SELECT minister_code FROM push_subscriptions WHERE minister_name LIKE '%박봉환%'")
    row = c.fetchone()
    if not row:
        print("토큰이 아직 DB에 없습니다!")
        return
    
    code = row[0]
    payload["target_data"]["minister_codes"] = [code]

    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res = urllib.request.urlopen(req)
    print(res.read().decode('utf-8'))

send_push()
