import firebase_admin
from firebase_admin import credentials, storage
import json
import sys

try:
    cred = credentials.Certificate('server/firebase-service-account.json')
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'prok-ga.firebasestorage.app'
    })

    bucket = storage.bucket()
    blob = bucket.blob('test.json')
    blob.upload_from_string(json.dumps({"hello": "world"}), content_type='application/json')
    blob.make_public()
    print("SUCCESS", blob.public_url)
except Exception as e:
    print("ERROR", e)
