import urllib.request
import json
import sqlite3

def send_push_to_all():
    # 1. Create Campaign
    url_create = 'http://127.0.0.1:5005/api/push/campaigns'
    payload_create = {
        "title": "전체 알림 테스트",
        "body": "앱을 사용 중인 모든 분들께 보내는 테스트 푸시 알림입니다.",
        "scope": "assembly",
        "target_type": "all",
        "target_data": {},
        "sender_name": "시스템 관리자"
    }

    req_create = urllib.request.Request(url_create, data=json.dumps(payload_create).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res_create = urllib.request.urlopen(req_create)
    response_data = json.loads(res_create.read().decode('utf-8'))
    
    if "id" not in response_data:
        print("캠페인 생성 실패:", response_data)
        return
        
    campaign_id = response_data["id"]
    print(f"캠페인 생성 성공: ID = {campaign_id}")
    
    # 2. Send Campaign
    url_send = f'http://127.0.0.1:5005/api/push/campaigns/{campaign_id}/send'
    payload_send = {
        "send_type": "now"
    }
    
    req_send = urllib.request.Request(url_send, data=json.dumps(payload_send).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res_send = urllib.request.urlopen(req_send)
    send_response = json.loads(res_send.read().decode('utf-8'))
    
    print("발송 결과:", send_response)

if __name__ == "__main__":
    send_push_to_all()
