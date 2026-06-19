import firebase_admin
from firebase_admin import credentials, firestore
import datetime

try:
    cred = credentials.Certificate('server/firebase-service-account.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Update 55TLTeZPFkykQEhX4qTg
    ad1_ref = db.collection('ads').document('55TLTeZPFkykQEhX4qTg')
    ad1_ref.update({
        'end_date': '2026-12-31',
        'is_active': True,
        'updated_at': datetime.datetime.now(datetime.timezone.utc)
    })
    print("SUCCESS: 55TLTeZPFkykQEhX4qTg updated to end on 2026-12-31")

    # Update gP51Iqge8KRrcc3tIYyY
    ad2_ref = db.collection('ads').document('gP51Iqge8KRrcc3tIYyY')
    ad2_ref.update({
        'end_date': '2026-12-31',
        'is_active': True,
        'updated_at': datetime.datetime.now(datetime.timezone.utc)
    })
    print("SUCCESS: gP51Iqge8KRrcc3tIYyY updated to end on 2026-12-31")

except Exception as e:
    print("ERROR:", e)
