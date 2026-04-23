import firebase_admin
from firebase_admin import credentials, messaging
import sqlite3
import os

def send_manual_push():
    # 1. Initialize Firebase
    if not firebase_admin._apps:
        cred = credentials.Certificate('server/firebase-service-account.json')
        firebase_admin.initialize_app(cred)

    # 2. Get User Token
    conn = sqlite3.connect('server/requests.db')
    c = conn.cursor()
    c.execute("SELECT push_token FROM push_subscriptions WHERE minister_name LIKE '%박봉환%'")
    row = c.fetchone()
    conn.close()
    
    if not row:
        print("토큰이 없습니다.")
        return
        
    token = row[0]
    print(f"토큰 확인: {token[:20]}...")

    # 3. Send Message
    message = messaging.Message(
        data={
            'title': '🔔 백그라운드 푸시 테스트',
            'body': '앱이 닫혀있거나 홈 화면일 때 이렇게 알림이 옵니다!',
            'notice_id': '0',
            'click_action': '/'
        },
        token=token,
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title='🔔 백그라운드 푸시 테스트',
                body='앱이 닫혀있거나 홈 화면일 때 이렇게 알림이 옵니다!',
                icon='/assets/pwa-192x192.png',
                badge='/assets/pwa-192x192.png',
                require_interaction=True,
            )
        )
    )
    
    try:
        response = messaging.send(message)
        print("푸시 전송 성공:", response)
    except Exception as e:
        print("푸시 전송 실패:", e)

if __name__ == '__main__':
    send_manual_push()
