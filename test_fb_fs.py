import firebase_admin
from firebase_admin import credentials, firestore
import sys
import datetime

try:
    cred = credentials.Certificate('server/firebase-service-account.json')
    firebase_admin.initialize_app(cred)

    db = firestore.client()
    doc_ref = db.collection('sync_logs').document()
    doc_ref.set({
        'timestamp': datetime.datetime.now().isoformat(),
        'status': 'SUCCESS',
        'message': 'Test initialization log for Firestore'
    })
    print("SUCCESS: Log created with id", doc_ref.id)
except Exception as e:
    print("ERROR:", e)
