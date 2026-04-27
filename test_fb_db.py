import firebase_admin
from firebase_admin import credentials, db
import sys
import datetime

try:
    cred = credentials.Certificate('server/firebase-service-account.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://prok-ga-default-rtdb.firebaseio.com/'
    })

    ref = db.reference('sync_logs')
    new_log = ref.push({
        'timestamp': datetime.datetime.now().isoformat(),
        'status': 'SUCCESS',
        'message': 'Test initialization log'
    })
    print("SUCCESS: Log created with key", new_log.key)
except Exception as e:
    print("ERROR:", e)
