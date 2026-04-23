import urllib.request, json
import sqlite3

def send_push():
    url = 'http://127.0.0.1:5005/api/push/campaigns'
    payload = {
        "title": "테스트 푸시 알림",
        "body": "박봉환 목사님, 앱을 잠시 닫고 (바탕화면으로 나가서) 확인해보세요!",
        "scope": "assembly",
        "target_type": "individual",
        "target_data": {"minister_codes": ["000000"]},
        "sender_name": "시스템 관리자"
    }

    conn = sqlite3.connect('server/requests.db')
    c = conn.cursor()
    c.execute("SELECT minister_code FROM push_subscriptions WHERE minister_name LIKE '%박봉환%'")
    row = c.fetchone()
    if not row:
        print("토큰이 아직 DB에 없습니다!")
        conn.close()
        return
    
    code = row[0]
    payload["target_data"]["minister_codes"] = [code]
    conn.close()

    # 1. Create
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res = urllib.request.urlopen(req)
    res_data = json.loads(res.read().decode('utf-8'))
    
    if "id" not in res_data:
        print("생성 실패", res_data)
        return
    
    camp_id = res_data["id"]
    
    # 2. Send
    send_url = f'http://127.0.0.1:5005/api/push/campaigns/{camp_id}/send'
    send_payload = {"send_type": "now"}
    req2 = urllib.request.Request(send_url, data=json.dumps(send_payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res2 = urllib.request.urlopen(req2)
    print("발송 결과:", res2.read().decode('utf-8'))

send_push()
