import os
import firebase_admin
from firebase_admin import credentials, messaging
import json

# Setup
cred_path = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

def send_topic_push():
    topic = 'all_users'
    title = '푸시알림테스트 성공!'
    body = '기장주소록의 푸시 알림 설정이 완료되었습니다.'
    
    base_url = 'https://prok-ga.web.app'
    
    message = messaging.Message(
        data={
            'title': title,
            'body': body,
            'icon': '/assets/pwa-192x192.png',
        },
        topic=topic,
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon='/assets/pwa-192x192.png',
                badge='/assets/pwa-192x192.png',
                require_interaction=True,
                vibrate=[200, 100, 200]
            ),
            fcm_options=messaging.WebpushFCMOptions(
                link=base_url
            )
        )
    )
    
    try:
        response = messaging.send(message)
        print(f'Successfully sent message to topic {topic}: {response}')
    except Exception as e:
        print(f'Error sending message: {e}')

if __name__ == '__main__':
    send_topic_push()
