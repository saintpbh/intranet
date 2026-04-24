from fastapi import FastAPI, Query, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pymssql
import os
import json
import shutil
import sqlite3
from datetime import datetime
import logging

# Firebase Admin SDK for FCM push
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    _sa_path = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
    if os.path.exists(_sa_path):
        # 중복 초기화 방지
        if not firebase_admin._apps:
            cred = credentials.Certificate(_sa_path)
            firebase_admin.initialize_app(cred)
        FCM_AVAILABLE = True
        logging.info('[FCM] Firebase Admin SDK initialized successfully')
    else:
        FCM_AVAILABLE = False
        logging.warning(f'[FCM] Service account key not found: {_sa_path}')
except ImportError:
    FCM_AVAILABLE = False
    logging.warning('[FCM] firebase-admin package not installed')

# --- FCM Helper Functions ---
def _send_fcm_topic_notification(topic: str, title: str, body: str, notice_id: str = ""):
    """Firebase Admin SDK를 통해 토픽에 알림 전송"""
    if not FCM_AVAILABLE:
        raise RuntimeError('FCM not available')
    
    link_url = f'/?notice={notice_id}' if notice_id else '/'
    
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body
        ),
        data={
            'title': title,
            'body': body,
            'notice_id': notice_id,
            'click_action': link_url,
            'url': link_url
        },
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(
                link=link_url
            )
        ),
        topic=topic
    )
    response = messaging.send(message)
    logging.info(f'[FCM] Topic message sent to {topic}: {response}')
    return response

def _send_fcm_to_tokens(tokens: list, title: str, body: str, data: dict = None):
    """Firebase Admin SDK를 통해 개별 토큰 목록에 알림 전송 (최대 500개씩)"""
    if not FCM_AVAILABLE:
        raise RuntimeError('FCM not available')
    if not tokens:
        return {'success': 0, 'failure': 0}
    
    extra_data = data or {}
    extra_data.update({'title': title, 'body': body})
    
    link_url = extra_data.get('url') or extra_data.get('click_action') or '/'
    
    success_count = 0
    failure_count = 0
    # FCM multicast는 최대 500개 토큰
    for i in range(0, len(tokens), 500):
        batch = tokens[i:i+500]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data=extra_data,
            webpush=messaging.WebpushConfig(
                fcm_options=messaging.WebpushFCMOptions(
                    link=link_url
                )
            ),
            tokens=batch
        )
        response = messaging.send_each_for_multicast(message)
        success_count += response.success_count
        failure_count += response.failure_count
        logging.info(f'[FCM] Multicast batch {i//500+1}: {response.success_count} success, {response.failure_count} failed')
    return {'success': success_count, 'failure': failure_count}

app = FastAPI()

# ── In-memory active session tracking ──
import time as _time
_server_start_time = datetime.now().isoformat()
_active_sessions = {}   # key: session_id -> {minister_code, name, page, device, last_seen, ip}
_SESSION_TIMEOUT = 300   # 5 min heartbeat timeout

os.makedirs("uploads/profiles", exist_ok=True)
os.makedirs("uploads/church_photos", exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")

# Enable CORS for all origins (PWA + ngrok 유료 터널)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global Exception Handler: DB 연결 오류를 안전하게 JSON으로 반환 ──
@app.exception_handler(pymssql.OperationalError)
async def mssql_operational_error_handler(request: Request, exc: pymssql.OperationalError):
    logging.error(f'[DB] MSSQL OperationalError: {exc}')
    return JSONResponse(
        status_code=503,
        content={"error": "db_connection_failed", "message": "DB연결 오류! 데이터베이스 서버에 접속할 수 없습니다."}
    )

@app.exception_handler(pymssql.InterfaceError)
async def mssql_interface_error_handler(request: Request, exc: pymssql.InterfaceError):
    logging.error(f'[DB] MSSQL InterfaceError: {exc}')
    return JSONResponse(
        status_code=503,
        content={"error": "db_connection_failed", "message": "DB연결 오류! 데이터베이스 서버에 접속할 수 없습니다."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # pymssql 관련 에러인지 추가 확인
    exc_str = str(exc).lower()
    if 'pymssql' in type(exc).__module__ if hasattr(type(exc), '__module__') else False or \
       'connection' in exc_str or 'login' in exc_str or 'timeout' in exc_str:
        logging.error(f'[DB] Connection-related error: {type(exc).__name__}: {exc}')
        return JSONResponse(
            status_code=503,
            content={"error": "db_connection_failed", "message": "DB연결 오류! 데이터베이스 서버에 접속할 수 없습니다."}
        )
    # 기타 예상치 못한 에러
    logging.error(f'[Server] Unhandled error: {type(exc).__name__}: {exc}')
    return JSONResponse(
        status_code=500,
        content={"error": "server_error", "message": f"서버 오류가 발생했습니다: {type(exc).__name__}"}
    )

# Database credentials
DB_USER = "pbh"
DB_PASSWORD = "prok3000"
DB_SERVER = "192.168.0.145"
DB_DATABASE = "KJ_CHURCH"

def get_connection():
    """MSSQL 연결 (5초 타임아웃)"""
    return pymssql.connect(
        server=DB_SERVER, 
        user=DB_USER, 
        password=DB_PASSWORD, 
        database=DB_DATABASE, 
        charset='cp949',
        login_timeout=5,
        timeout=10
    )

@app.on_event("startup")
async def startup_event():
    logging.info("[Startup] Verifying database connections...")
    
    # 1. SQLite DB (requests.db) check
    try:
        logging.info("[Startup] Checking SQLite connection...")
        sqlite_conn = sqlite3.connect('requests.db')
        sqlite_conn.execute("SELECT 1")
        sqlite_conn.close()
        logging.info("[Startup] SQLite connection successful.")
    except Exception as e:
        logging.critical(f"[Startup] SQLite connection failed! Error: {e}")
        import os
        os._exit(1) # Exit server if critical DB fails

    # 2. MSSQL DB (KJ_CHURCH) check
    try:
        logging.info("[Startup] Checking MSSQL connection...")
        mssql_conn = get_connection()
        mssql_conn.close()
        logging.info("[Startup] MSSQL connection successful.")
    except Exception as e:
        logging.critical(f"[Startup] MSSQL connection failed! Error: {e}")
        import os
        os._exit(1) # Exit server if critical DB fails

@app.get("/api/user-profiles/{minister_code}")
def get_user_profile(minister_code: str):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT profile_image_url, status_message, phone, email, background_image_url FROM user_profiles WHERE minister_code=?", (minister_code,))
    row = c.fetchone()
    conn.close()
    if row:
        return {"profile_image_url": row[0] or "", "status_message": row[1] or "", "phone": row[2] or "", "email": row[3] or "", "background_image_url": row[4] or ""}
    return {"profile_image_url": "", "status_message": "", "phone": "", "email": "", "background_image_url": ""}

@app.post("/api/user-profiles/{minister_code}")
def update_user_profile(minister_code: str, payload: dict):
    print(f"DEBUG: Updating profile for {minister_code}. Payload: {payload}")
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO user_profiles (minister_code, profile_image_url, status_message, background_image_url, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(minister_code) DO UPDATE SET
            profile_image_url=excluded.profile_image_url,
            status_message=excluded.status_message,
            background_image_url=excluded.background_image_url,
            updated_at=CURRENT_TIMESTAMP
    ''', (minister_code, payload.get("profile_image_url", ""), payload.get("status_message", ""), payload.get("background_image_url", "")))
    conn.commit()
    conn.close()
    return {"success": True}

@app.post("/api/upload-profile")
def upload_profile_image(file: UploadFile = File(...)):
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = os.path.join("uploads", "profiles", filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/api/uploads/profiles/{filename}"}

# --- Self-edit phone/email ---
@app.put("/api/user-profiles/{minister_code}/contact")
def update_user_contact(minister_code: str, payload: dict):
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO user_profiles (minister_code, phone, email, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(minister_code) DO UPDATE SET
            phone=excluded.phone,
            email=excluded.email,
            updated_at=CURRENT_TIMESTAMP
    ''', (minister_code, payload.get("phone", ""), payload.get("email", "")))
    conn.commit()
    conn.close()
    return {"success": True}

# --- Info Edit Requests (3-step workflow) ---
@app.post("/api/info-edit-requests")
def create_info_edit_request(payload: dict):
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO info_edit_requests (minister_code, minister_name, noh_code, noh_name, changes_json, reason)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        payload.get("minister_code", ""),
        payload.get("minister_name", ""),
        payload.get("noh_code", ""),
        payload.get("noh_name", ""),
        json.dumps(payload.get("changes", []), ensure_ascii=False),
        payload.get("reason", ""),
    ))
    conn.commit()
    req_id = c.lastrowid
    conn.close()
    return {"success": True, "id": req_id}

@app.get("/api/info-edit-requests")
def list_info_edit_requests(noh_code: str = "", status: str = "", minister_code: str = ""):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    sql = "SELECT * FROM info_edit_requests WHERE 1=1"
    params = []
    if noh_code:
        sql += " AND noh_code=?"
        params.append(noh_code)
    if status:
        sql += " AND status=?"
        params.append(status)
    if minister_code:
        sql += " AND minister_code=?"
        params.append(minister_code)
    sql += " ORDER BY created_at DESC"
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    for r in rows:
        try:
            r["changes"] = json.loads(r["changes_json"]) if r.get("changes_json") else []
        except:
            r["changes"] = []
    conn.close()
    return rows

@app.put("/api/info-edit-requests/{req_id}/noh-confirm")
def noh_confirm_edit_request(req_id: int, payload: dict):
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        UPDATE info_edit_requests SET status='NOH_CONFIRMED', noh_reviewer=?, noh_reviewed_at=CURRENT_TIMESTAMP, noh_memo=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ''', (payload.get("reviewer", ""), payload.get("memo", ""), req_id))
    conn.commit()
    conn.close()
    return {"success": True}

@app.put("/api/info-edit-requests/{req_id}/noh-reject")
def noh_reject_edit_request(req_id: int, payload: dict):
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        UPDATE info_edit_requests SET status='NOH_REJECTED', noh_reviewer=?, noh_reviewed_at=CURRENT_TIMESTAMP, noh_memo=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ''', (payload.get("reviewer", ""), payload.get("memo", ""), req_id))
    conn.commit()
    conn.close()
    return {"success": True}

@app.put("/api/info-edit-requests/{req_id}/assembly-complete")
def assembly_complete_edit_request(req_id: int, payload: dict):
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        UPDATE info_edit_requests SET status='COMPLETED', assembly_reviewer=?, assembly_completed_at=CURRENT_TIMESTAMP, assembly_memo=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ''', (payload.get("reviewer", ""), payload.get("memo", ""), req_id))
    conn.commit()
    conn.close()
    return {"success": True}

from typing import List

@app.get("/api/churches/{chr_code}/photos")
def get_church_photos(chr_code: str):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT photo_url, order_idx FROM church_photos WHERE chr_code=? ORDER BY order_idx", (chr_code,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/churches/{chr_code}/photos")
def update_church_photos(chr_code: str, files: List[UploadFile] = File(...)):
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute("DELETE FROM church_photos WHERE chr_code=?", (chr_code,))
    
    saved_photos = []
    for idx, file in enumerate(files[:3]):
        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{idx}_{file.filename}"
        file_path = os.path.join("uploads", "church_photos", filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        photo_url = f"/api/uploads/church_photos/{filename}"
        c.execute("INSERT INTO church_photos (chr_code, photo_url, order_idx, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", 
                  (chr_code, photo_url, idx))
        saved_photos.append({"photo_url": photo_url, "order_idx": idx})
        
    conn.commit()
    conn.close()
    return {"success": True, "photos": saved_photos}

@app.get("/api/churches")
def get_churches(search: str = ""):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        search_term = f"%{search}%".encode('cp949')
        duty_term = "%담임%".encode('cp949')
        query = """
            SELECT TOP 100 
                c.ChrCode, c.ChrName AS CHRNAME, n.NohName AS NOHNAME, s.SichalName AS SICHALNAME, 
                c.Tel_Church, c.Tel_Mobile, c.Tel_Fax, c.Address AS ADDRESS, c.Juso AS JUSO, c.PostNo, c.Email,
                (SELECT TOP 1 m.MinisterName FROM VI_MIN_INFO m WHERE m.ChrCode = c.ChrCode AND m.DUTYNAME LIKE %s) AS MOCKNAME 
            FROM TB_Chr100 c 
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode 
            LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
            WHERE c.ChrName LIKE %s OR n.NohName LIKE %s
            ORDER BY n.NohName, c.ChrName
        """
        cursor.execute(query, (duty_term, search_term, search_term))
        results = cursor.fetchall()
        return results
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/ministers")
def get_ministers(search: str = ""):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        search_term = f"%{search}%".encode('cp949')
        query = """
            SELECT TOP 100 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.EMAIL 
            FROM VI_MIN_INFO m
            WHERE m.MinisterName LIKE %s OR m.CHRNAME LIKE %s OR m.NOHNAME LIKE %s
            ORDER BY m.NOHNAME, m.CHRNAME, m.MinisterName
        """
        cursor.execute(query, (search_term, search_term, search_term))
        results = cursor.fetchall()
        
        try:
            sql_conn = sqlite3.connect('requests.db')
            sql_c = sql_conn.cursor()
            sql_c.execute('SELECT minister_code, profile_image_url, status_message, background_image_url FROM user_profiles')
            profiles = {row[0]: {"profile_image_url": row[1], "status_message": row[2], "background_image_url": row[3] or ""} for row in sql_c.fetchall()}
            sql_conn.close()
        except:
            profiles = {}
            
        for row in results:
            code = str(row.get("MinisterCode", "")).strip()
            if code in profiles:
                row["custom_image"] = profiles[code]["profile_image_url"]
                row["status_message"] = profiles[code]["status_message"]
                row["background_image"] = profiles[code]["background_image_url"]
                
        return results
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/addressbook")
def get_addressbook(search: str = ""):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        search_term = f"%{search}%".encode('cp949')
        query = """
            SELECT TOP 200 
                MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, 
                TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL
            FROM VI_MIN_JANG_LIST_2
            WHERE MINISTERNAME LIKE %s OR CHRNAME LIKE %s OR NOHNAME LIKE %s
            ORDER BY NOHNAME, CHRNAME, MINISTERNAME
        """
        cursor.execute(query, (search_term, search_term, search_term))
        results = cursor.fetchall()
        return results
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/sync/directory")
def sync_directory():
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        # Fetch all ministers
        cursor.execute("""
            SELECT 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.EMAIL 
            FROM VI_MIN_INFO m
        """)
        ministers = cursor.fetchall()
        
        # Fetch profiles for ministers
        try:
            sql_conn = sqlite3.connect('requests.db')
            sql_c = sql_conn.cursor()
            sql_c.execute('SELECT minister_code, profile_image_url, status_message, background_image_url FROM user_profiles')
            profiles = {row[0]: {"profile_image_url": row[1], "status_message": row[2], "background_image_url": row[3] or ""} for row in sql_c.fetchall()}
            sql_conn.close()
        except:
            profiles = {}
            
        for row in ministers:
            code = str(row.get("MinisterCode", "")).strip()
            if code in profiles:
                row["custom_image"] = profiles[code]["profile_image_url"]
                row["status_message"] = profiles[code]["status_message"]
                row["background_image"] = profiles[code]["background_image_url"]

        # Fetch all churches
        duty_term = "%담임%".encode('cp949')
        cursor.execute("""
            SELECT 
                c.ChrCode, c.ChrName AS CHRNAME, n.NohName AS NOHNAME, s.SichalName AS SICHALNAME, 
                c.Tel_Church, c.Tel_Mobile, c.Tel_Fax, c.Address AS ADDRESS, c.Juso AS JUSO, c.PostNo, c.Email,
                (SELECT TOP 1 m.MinisterName FROM VI_MIN_INFO m WHERE m.ChrCode = c.ChrCode AND m.DUTYNAME LIKE %s) AS MOCKNAME 
            FROM TB_Chr100 c 
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode 
            LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
        """, (duty_term,))
        churches = cursor.fetchall()

        # Fetch all elders
        cursor.execute("""
            SELECT 
                e.PriestCode, e.PriestName, e.ChrCode,
                c.ChrName, n.NohName,
                e.Tel_Mobile, e.Email,
                e.Address, e.Juso, e.PostNo
            FROM TB_Chr300 e
            LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
            WHERE e.DelGu IS NULL OR e.DelGu != '1'
        """)
        elders = cursor.fetchall()

        # Fetch all addressbook combinations
        cursor.execute("""
            SELECT 
                MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, 
                TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL
            FROM VI_MIN_JANG_LIST_2
        """)
        addressbook = cursor.fetchall()

        return {
            "ministers": ministers,
            "churches": churches,
            "elders": elders,
            "addressbook": addressbook
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/elders")
def get_elders(search: str = ""):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        search_term = f"%{search}%".encode('cp949')
        query = """
            SELECT TOP 200 
                e.PriestCode, e.PriestName, e.ChrCode,
                c.ChrName, n.NohName,
                e.Tel_Mobile, e.Email,
                e.Address, e.Juso, e.PostNo
            FROM TB_Chr300 e
            LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
            WHERE (e.DelGu IS NULL OR e.DelGu != '1')
              AND (e.PriestName LIKE %s OR c.ChrName LIKE %s OR n.NohName LIKE %s)
            ORDER BY n.NohName, c.ChrName, e.PriestName
        """
        cursor.execute(query, (search_term, search_term, search_term))
        results = cursor.fetchall()
        return results
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/elders/{priest_code}")
def get_elder_detail(priest_code: str):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        query = """
            SELECT TOP 1 
                e.PriestCode, e.PriestName, e.ChrCode,
                c.ChrName, n.NohName,
                e.Tel_Home, e.Tel_Mobile, e.Email,
                e.Address, e.Juso, e.PostNo,
                e.BirthDay, e.AppDate, e.Occupation
            FROM TB_Chr300 e
            LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
            WHERE e.PriestCode = %s
        """
        cursor.execute(query, (priest_code,))
        result = cursor.fetchone()
        if not result:
            return {"error": "Elder not found."}
        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

import sqlite3
import json
from datetime import datetime

def init_sqlite():
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_profiles (
            minister_code TEXT PRIMARY KEY,
            profile_image_url TEXT,
            status_message TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS church_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chr_code TEXT,
            photo_url TEXT,
            order_idx INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS modify_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            minister_code TEXT,
            minister_name TEXT,
            field TEXT,
            old_value TEXT,
            new_value TEXT,
            status TEXT DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            memo TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cert_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            minister_code TEXT,
            minister_name TEXT,
            cert_type TEXT,
            cert_label TEXT,
            noh_code TEXT,
            noh_name TEXT,
            sichal_code TEXT,
            chr_code TEXT,
            chr_name TEXT,
            status TEXT DEFAULT 'SUBMITTED',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            memo TEXT,
            doc_number TEXT DEFAULT '',
            pdf_filename TEXT DEFAULT ''
        )
    ''')
    for col, coldef in [('doc_number', "TEXT DEFAULT ''"), ('pdf_filename', "TEXT DEFAULT ''")]:
        try:
            c.execute(f"ALTER TABLE cert_requests ADD COLUMN {col} {coldef}")
        except:
            pass
    c.execute('''
        CREATE TABLE IF NOT EXISTS approval_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER,
            request_type TEXT DEFAULT 'cert',
            stage TEXT,
            action TEXT,
            actor_name TEXT,
            actor_role TEXT,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES cert_requests(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS admin_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            minister_code TEXT NOT NULL,
            minister_name TEXT,
            noh_code TEXT,
            noh_name TEXT,
            sichal_code TEXT,
            sichal_name TEXT,
            assigned_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(role, minister_code, noh_code, sichal_code)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            scope_code TEXT DEFAULT '',
            scope_name TEXT DEFAULT '',
            category TEXT DEFAULT '공지',
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            author_name TEXT,
            author_role TEXT,
            is_pinned INTEGER DEFAULT 0,
            target_type TEXT DEFAULT 'all',
            recipients TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # ALTER TABLE fallback for existing DBs
    for col, coldef in [('target_type', "TEXT DEFAULT 'all'"), ('recipients', "TEXT DEFAULT '[]'")]:
        try:
            c.execute(f"ALTER TABLE notices ADD COLUMN {col} {coldef}")
        except:
            pass
            
    c.execute('''
        CREATE TABLE IF NOT EXISTS church_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            church_code TEXT NOT NULL,
            church_name TEXT,
            noh_code TEXT,
            noh_name TEXT,
            report_year INTEGER NOT NULL,
            status TEXT DEFAULT 'SUBMITTED',
            submitted_by TEXT,
            statistics_data TEXT,
            elders_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(church_code, report_year)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS ads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            image_url TEXT NOT NULL,
            link_url TEXT DEFAULT '',
            display_order INTEGER DEFAULT 0,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_by TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Info Edit Requests (3-step workflow: user -> noh_secretary -> assembly)
    c.execute('''
        CREATE TABLE IF NOT EXISTS info_edit_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            minister_code TEXT NOT NULL,
            minister_name TEXT NOT NULL,
            noh_code TEXT DEFAULT '',
            noh_name TEXT DEFAULT '',
            changes_json TEXT NOT NULL,
            reason TEXT DEFAULT '',
            status TEXT DEFAULT 'SUBMITTED',
            noh_reviewer TEXT DEFAULT '',
            noh_reviewed_at DATETIME,
            noh_memo TEXT DEFAULT '',
            assembly_reviewer TEXT DEFAULT '',
            assembly_completed_at DATETIME,
            assembly_memo TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Add phone/email columns to user_profiles if not exist
    for col, coldef in [('phone', "TEXT DEFAULT ''"), ('email', "TEXT DEFAULT ''"), ('background_image_url', "TEXT DEFAULT ''")]:
        try:
            c.execute(f"ALTER TABLE user_profiles ADD COLUMN {col} {coldef}")
        except:
            pass
    # --- Document Builder Tables ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS form_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            version INTEGER DEFAULT 1,
            schema_json TEXT NOT NULL,
            created_by TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS form_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_type TEXT NOT NULL DEFAULT 'pdf',
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            template_id INTEGER,
            pdf_filename TEXT DEFAULT '',
            content TEXT DEFAULT '',
            visibility_roles TEXT DEFAULT '[]',
            report_year INTEGER,
            deadline TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            approval_steps TEXT DEFAULT '[]',
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS form_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            respondent_code TEXT,
            respondent_name TEXT,
            respondent_org TEXT,
            noh_code TEXT,
            response_data TEXT NOT NULL,
            status TEXT DEFAULT 'SUBMITTED',
            current_step INTEGER DEFAULT 0,
            approval_history TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES form_documents(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS visibility_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_tag TEXT NOT NULL UNIQUE,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Seed visibility roles
    seed_roles = [
        ('신학생', 1), ('전도사', 2), ('목사수련생', 3), ('목후생', 4), ('준목', 5),
        ('목사', 6), ('담임목사', 7), ('노회서기', 8), ('노회장', 9), ('총회직원', 10),
        ('장로', 11), ('권사', 12), ('집사', 13), ('교회담당자', 14), ('시찰서기', 15)
    ]
    for tag, order in seed_roles:
        try:
            c.execute("INSERT OR IGNORE INTO visibility_roles (role_tag, display_order) VALUES (?, ?)", (tag, order))
        except:
            pass
    # Migrate: add new columns if missing
    for stmt in [
        "ALTER TABLE form_documents ADD COLUMN approval_steps TEXT DEFAULT '[]'",
        "ALTER TABLE form_responses ADD COLUMN current_step INTEGER DEFAULT 0",
        "ALTER TABLE form_responses ADD COLUMN approval_history TEXT DEFAULT '[]'",
    ]:
        try:
            c.execute(stmt)
        except:
            pass
    c.execute('''
        CREATE TABLE IF NOT EXISTS read_receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            reader_code TEXT NOT NULL,
            reader_name TEXT DEFAULT '',
            reader_org TEXT DEFAULT '',
            read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(item_type, item_id, reader_code)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cert_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            workflow TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Seed default cert types if empty
    c.execute("SELECT COUNT(*) FROM cert_types")
    if c.fetchone()[0] == 0:
        import json
        defaults = [
            ("재직증명서", "현재 교회 재직 확인서", json.dumps([
                {"stage": "CHURCH_CONFIRMED", "label": "교회 당회장", "type": "approve"},
                {"stage": "SICHAL_CONFIRMED", "label": "시찰", "type": "pass"},
                {"stage": "NOH_CONFIRMED", "label": "노회", "type": "pass"},
                {"stage": "APPROVED", "label": "총회", "type": "approve"},
                {"stage": "ISSUED", "label": "발급", "type": "issue"}
            ])),
            ("안수증명서", "목사 안수 확인서", json.dumps([
                {"stage": "NOH_CONFIRMED", "label": "노회", "type": "approve"},
                {"stage": "APPROVED", "label": "총회", "type": "approve"},
                {"stage": "ISSUED", "label": "발급", "type": "issue"}
            ])),
            ("총회 등록 확인서", "총회 소속 확인서", json.dumps([
                {"stage": "APPROVED", "label": "총회", "type": "approve"},
                {"stage": "ISSUED", "label": "발급", "type": "issue"}
            ])),
            ("경력증명서", "사역 이력 확인서", json.dumps([
                {"stage": "CHURCH_CONFIRMED", "label": "교회 당회장", "type": "approve"},
                {"stage": "SICHAL_CONFIRMED", "label": "시찰", "type": "pass"},
                {"stage": "NOH_CONFIRMED", "label": "노회", "type": "approve"},
                {"stage": "APPROVED", "label": "총회", "type": "approve"},
                {"stage": "ISSUED", "label": "발급", "type": "issue"}
            ])),
        ]
        for name, desc, wf in defaults:
            c.execute("INSERT INTO cert_types (name, description, workflow) VALUES (?, ?, ?)", (name, desc, wf))
    # Push notification tables
    c.execute('''
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            minister_code TEXT NOT NULL,
            minister_name TEXT DEFAULT '',
            noh_code TEXT DEFAULT '',
            sichal_code TEXT DEFAULT '',
            push_token TEXT NOT NULL,
            device_info TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(minister_code, push_token)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS push_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            scope TEXT DEFAULT 'assembly',
            member_codes TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS push_campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            link_url TEXT DEFAULT '',
            scope TEXT DEFAULT 'assembly',
            target_type TEXT DEFAULT 'all',
            target_data TEXT DEFAULT '{}',
            status TEXT DEFAULT 'draft',
            scheduled_at DATETIME,
            sent_at DATETIME,
            sender_name TEXT DEFAULT '',
            sender_role TEXT DEFAULT '',
            total_targets INTEGER DEFAULT 0,
            delivered_count INTEGER DEFAULT 0,
            opened_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS push_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            minister_code TEXT NOT NULL,
            minister_name TEXT DEFAULT '',
            noh_code TEXT DEFAULT '',
            sichal_code TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            delivered_at DATETIME,
            opened_at DATETIME,
            FOREIGN KEY (campaign_id) REFERENCES push_campaigns(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS official_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_number TEXT DEFAULT '',
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            sender_org TEXT DEFAULT '',
            sender_name TEXT DEFAULT '',
            sender_role TEXT DEFAULT '',
            sender_scope TEXT DEFAULT 'assembly',
            recipients TEXT DEFAULT '[]',
            cc_list TEXT DEFAULT '[]',
            sent_date TEXT DEFAULT '',
            received_date TEXT DEFAULT '',
            signature_token TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            pdf_filename TEXT DEFAULT '',
            scope TEXT DEFAULT 'assembly',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_sqlite()

# ensure uploads dir
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Notice APIs ---

class NoticeCreate(BaseModel):
    scope: str           # 'assembly', 'presbytery', 'sichal'
    scope_code: str = ""
    scope_name: str = ""
    category: str = "공지"
    title: str
    content: str
    author_name: str = ""
    author_role: str = ""
    is_pinned: bool = False
    target_type: str = "all"  # all, select
    recipients: list = []     # [{type, code, name}]
    send_push: bool = False   # 체크 시 FCM 푸시 알림 발송

@app.get("/api/notices")
def get_notices(scope: str = "", scope_code: str = "", target_noh: str = "", target_sichal: str = "", limit: int = 50):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        if target_noh or target_sichal:
            query = """
                SELECT * FROM notices 
                WHERE scope = 'assembly'
                   OR (scope = 'presbytery' AND (scope_name = ? OR scope_name = '' OR scope_name IS NULL))
                   OR (scope = 'sichal' AND (scope_name = ? OR scope_name = '' OR scope_name IS NULL))
                ORDER BY is_pinned DESC, created_at DESC LIMIT ?
            """
            params = [target_noh, target_sichal, limit]
        else:
            query = "SELECT * FROM notices WHERE 1=1"
            params = []
            if scope:
                query += " AND scope = ?"
                params.append(scope)
            if scope_code:
                query += " AND scope_code = ?"
                params.append(scope_code)
            query += " ORDER BY is_pinned DESC, created_at DESC LIMIT ?"
            params.append(limit)
        c.execute(query, params)
        rows = []
        for row in c.fetchall():
            d = dict(row)
            d['recipients'] = json.loads(d.get('recipients') or '[]')
            # Get read count
            c.execute("SELECT COUNT(*) FROM read_receipts WHERE item_type='notice' AND item_id=?", (d['id'],))
            d['read_count'] = c.fetchone()[0]
            rows.append(d)
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/notices/{notice_id}")
def get_notice(notice_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM notices WHERE id = ?", (notice_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else {"error": "Not found"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/notices")
def create_notice(req: NoticeCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT INTO notices (scope, scope_code, scope_name, category, title, content, author_name, author_role, is_pinned, target_type, recipients)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (req.scope, req.scope_code, req.scope_name, req.category, req.title, req.content, 
              req.author_name, req.author_role, 1 if req.is_pinned else 0,
              req.target_type, json.dumps(req.recipients, ensure_ascii=False)))
        conn.commit()
        notice_id = c.lastrowid
        conn.close()

        # FCM 푸시 알림 발송 (관리자가 체크박스를 켠 경우)
        push_sent = False
        push_error = None
        if FCM_AVAILABLE and req.send_push:
            try:
                scope_label = {'assembly': '총회', 'presbytery': '노회', 'sichal': '시찰'}
                title = f"📢 {scope_label.get(req.scope, '')} {req.category}"
                body = req.title

                if req.target_type == 'all' or not req.recipients:
                    # 전체 발송
                    _send_fcm_topic_notification(
                        topic='all_users',
                        title=title,
                        body=body,
                        notice_id=str(notice_id)
                    )
                    push_sent = True
                    logging.info(f'[FCM] Push sent to all_users for notice #{notice_id}')
                else:
                    # 지정 발송 (토큰 기반)
                    conn_sub = sqlite3.connect('requests.db')
                    c_sub = conn_sub.cursor()
                    
                    target_tokens = set()
                    
                    for r in req.recipients:
                        r_type = r.get('type')
                        r_code = r.get('code')
                        
                        if r_type == 'presbytery':
                            c_sub.execute("SELECT push_token FROM push_subscriptions WHERE noh_code = ?", (r_code,))
                            target_tokens.update(row[0] for row in c_sub.fetchall())
                        elif r_type == 'sichal':
                            c_sub.execute("SELECT push_token FROM push_subscriptions WHERE sichal_code = ?", (r_code,))
                            target_tokens.update(row[0] for row in c_sub.fetchall())
                        elif r_type == 'minister':
                            c_sub.execute("SELECT push_token FROM push_subscriptions WHERE minister_code = ?", (r_code,))
                            target_tokens.update(row[0] for row in c_sub.fetchall())
                        elif r_type == 'group':
                            # 추후 '담임목사', '각종 위원회' 등 그룹 추가를 위한 확장 지점
                            # 예: push_groups 테이블 활용 또는 MSSQL 뷰 등 다른 정보와 연동 가능
                            pass
                            
                    conn_sub.close()
                    
                    if target_tokens:
                        base_url = 'https://prok-ga.web.app'
                        click_url = f'{base_url}/?notice={notice_id}' if notice_id else base_url
                        fcm_data = {
                            'notice_id': str(notice_id),
                            'title': title,
                            'body': body,
                            'url': click_url,
                            'click_action': click_url,
                            'icon': '/assets/pwa-192x192.png'
                        }
                        result = _send_fcm_to_tokens(list(target_tokens), title, body, data=fcm_data)
                        push_sent = True
                        logging.info(f'[FCM] Targeted push sent to {len(target_tokens)} tokens for notice #{notice_id}. Result: {result}')
                    else:
                        logging.info(f'[FCM] No tokens found for targeted notice #{notice_id}')
                        push_sent = False
                        push_error = "해당 대상자의 푸시 토큰이 등록되어 있지 않습니다."
                        
            except Exception as fcm_err:
                push_error = str(fcm_err)
                logging.error(f'[FCM] Push failed: {fcm_err}')

        return {"success": True, "id": notice_id, "message": "공지가 등록되었습니다.",
                "push_sent": push_sent, "push_error": push_error}
    except Exception as e:
        return {"error": str(e)}

class NoticeUpdate(BaseModel):
    category: str = ""
    title: str = ""
    content: str = ""
    is_pinned: bool = False

@app.put("/api/notices/{notice_id}")
def update_notice(notice_id: int, req: NoticeUpdate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        now = datetime.now().isoformat()
        c.execute('''
            UPDATE notices SET category=?, title=?, content=?, is_pinned=?, updated_at=?
            WHERE id=?
        ''', (req.category, req.title, req.content, 1 if req.is_pinned else 0, now, notice_id))
        conn.commit()
        conn.close()
        return {"success": True, "message": "공지가 수정되었습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/notices/{notice_id}")
def delete_notice(notice_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/notices/{notice_id}/resend-push")
def resend_notice_push(notice_id: int):
    try:
        if not FCM_AVAILABLE:
            return {"error": "푸시 알림 기능이 활성화되어 있지 않습니다."}

        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM notices WHERE id = ?", (notice_id,))
        notice = c.fetchone()
        
        if not notice:
            conn.close()
            return {"error": "존재하지 않는 공지입니다."}
        
        scope_label = {'assembly': '총회', 'presbytery': '노회', 'sichal': '시찰'}
        title = f"📢 {scope_label.get(notice['scope'], '')} {notice['category']}"
        body = notice['title']
        
        target_type = notice['target_type']
        recipients_str = notice['recipients']
        recipients = json.loads(recipients_str) if recipients_str else []

        push_sent = False
        push_error = None
        
        if target_type == 'all' or not recipients:
            _send_fcm_topic_notification(
                topic='all_users',
                title=title,
                body=body,
                notice_id=str(notice_id)
            )
            push_sent = True
            logging.info(f'[FCM] Re-sent Push to all_users for notice #{notice_id}')
        else:
            conn_sub = sqlite3.connect('requests.db')
            c_sub = conn_sub.cursor()
            
            target_tokens = set()
            
            for r in recipients:
                r_type = r.get('type')
                r_code = r.get('code')
                
                if r_type == 'presbytery':
                    c_sub.execute("SELECT push_token FROM push_subscriptions WHERE noh_code = ?", (r_code,))
                    target_tokens.update(row[0] for row in c_sub.fetchall())
                elif r_type == 'sichal':
                    c_sub.execute("SELECT push_token FROM push_subscriptions WHERE sichal_code = ?", (r_code,))
                    target_tokens.update(row[0] for row in c_sub.fetchall())
                elif r_type == 'minister':
                    c_sub.execute("SELECT push_token FROM push_subscriptions WHERE minister_code = ?", (r_code,))
                    target_tokens.update(row[0] for row in c_sub.fetchall())
                    
            conn_sub.close()
            
            if target_tokens:
                base_url = 'https://prok-ga.web.app'
                click_url = f'{base_url}/?notice={notice_id}' if notice_id else base_url
                fcm_data = {
                    'notice_id': str(notice_id),
                    'title': title,
                    'body': body,
                    'url': click_url,
                    'click_action': click_url,
                    'icon': '/assets/pwa-192x192.png'
                }
                _send_fcm_to_tokens(list(target_tokens), title, body, data=fcm_data)
                push_sent = True
                logging.info(f'[FCM] Re-sent Targeted push to {len(target_tokens)} tokens for notice #{notice_id}')
            else:
                push_error = "해당 대상자의 푸시 토큰이 등록되어 있지 않습니다."
                
        conn.close()
        return {
            "success": push_sent, 
            "message": "푸시 알림이 재발송되었습니다." if push_sent else "발송 대상이 없습니다.", 
            "error": push_error
        }
    except Exception as e:
        return {"error": str(e)}

# --- Ads APIs ---

class AdCreate(BaseModel):
    title: str
    image_url: str = ""
    link_url: str = ""
    display_order: int = 0
    start_date: str
    end_date: str
    created_by: str = ""

@app.get("/api/ads")
def get_ads(active_only: bool = False):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        if active_only:
            today = datetime.now().strftime('%Y-%m-%d')
            c.execute("SELECT * FROM ads WHERE is_active=1 AND start_date <= ? AND end_date >= ? ORDER BY display_order, id", (today, today))
        else:
            c.execute("SELECT * FROM ads ORDER BY display_order, id")
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/ads")
def create_ad(req: AdCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT INTO ads (title, image_url, link_url, display_order, start_date, end_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (req.title, req.image_url, req.link_url, req.display_order, req.start_date, req.end_date, req.created_by))
        conn.commit()
        ad_id = c.lastrowid
        conn.close()
        return {"success": True, "id": ad_id}
    except Exception as e:
        return {"error": str(e)}

@app.put("/api/ads/{ad_id}")
def update_ad(ad_id: int, req: AdCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            UPDATE ads SET title=?, image_url=?, link_url=?, display_order=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        ''', (req.title, req.image_url, req.link_url, req.display_order, req.start_date, req.end_date, ad_id))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/ads/{ad_id}")
def delete_ad(ad_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM ads WHERE id = ?", (ad_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/upload-ad")
def upload_ad_image(file: UploadFile = File(...)):
    os.makedirs(os.path.join("uploads", "ads"), exist_ok=True)
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = os.path.join("uploads", "ads", filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/api/uploads/ads/{filename}"}

@app.get("/api/uploads/ads/{filename}")
def get_ad_image(filename: str):
    from fastapi.responses import FileResponse
    file_path = os.path.join("uploads", "ads", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return {"error": "File not found"}

# --- Cert Type APIs ---

class CertTypeCreate(BaseModel):
    name: str
    description: str = ""
    workflow: list  # list of {stage, label, type}

class CertTypeUpdate(BaseModel):
    name: str = ""
    description: str = ""
    workflow: list = []
    is_active: bool = True

@app.get("/api/cert-types")
def get_cert_types(active_only: bool = False):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT * FROM cert_types"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY id"
        c.execute(query)
        rows = []
        for row in c.fetchall():
            d = dict(row)
            d['workflow'] = json.loads(d['workflow']) if d['workflow'] else []
            rows.append(d)
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/cert-types")
def create_cert_type(req: CertTypeCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("INSERT INTO cert_types (name, description, workflow) VALUES (?, ?, ?)",
                  (req.name, req.description, json.dumps(req.workflow, ensure_ascii=False)))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"'{req.name}' 증명서 유형이 생성되었습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.put("/api/cert-types/{ct_id}")
def update_cert_type(ct_id: int, req: CertTypeUpdate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("UPDATE cert_types SET name=?, description=?, workflow=?, is_active=? WHERE id=?",
                  (req.name, req.description, json.dumps(req.workflow, ensure_ascii=False), 
                   1 if req.is_active else 0, ct_id))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/cert-types/{ct_id}")
def delete_cert_type(ct_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM cert_types WHERE id = ?", (ct_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}


# --- Role Management APIs ---

class RoleAssignment(BaseModel):
    role: str          # 'noh_secretary', 'sichal_secretary'
    minister_code: str
    minister_name: str
    noh_code: str = ""
    noh_name: str = ""
    sichal_code: str = ""
    sichal_name: str = ""
    assigned_by: str = ""

@app.get("/api/admin/roles")
def get_admin_roles(role: str = "", noh_code: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT * FROM admin_roles WHERE 1=1"
        params = []
        if role:
            query += " AND role = ?"
            params.append(role)
        if noh_code:
            query += " AND noh_code = ?"
            params.append(noh_code)
        query += " ORDER BY created_at DESC"
        c.execute(query, params)
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/admin/roles")
def assign_role(req: RoleAssignment):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT OR REPLACE INTO admin_roles 
            (role, minister_code, minister_name, noh_code, noh_name, sichal_code, sichal_name, assigned_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (req.role, req.minister_code, req.minister_name, 
              req.noh_code, req.noh_name, req.sichal_code, req.sichal_name, req.assigned_by))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"{req.minister_name}님이 지정되었습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/admin/roles/{role_id}")
def remove_role(role_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM admin_roles WHERE id = ?", (role_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# Search ministers for role assignment (returns noh info)
@app.get("/api/admin/search-ministers")
def search_ministers_for_admin(search: str = ""):
    if not search or len(search) < 2:
        return []
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        query = """
            SELECT TOP 20
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME,
                m.TEL_MOBILE
            FROM VI_MIN_INFO m
            WHERE m.MinisterName LIKE %s
            ORDER BY m.MinisterName
        """
        cursor.execute(query, (f'%{search}%',))
        return cursor.fetchall()
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

# Get presbyteries list from DB
@app.get("/api/presbyteries")
def get_presbyteries():
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        cursor.execute("SELECT NohCode, NohName FROM TB_Chr910 ORDER BY NohCode")
        return cursor.fetchall()
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


# --- Status constants ---
# SUBMITTED → CHURCH_CONFIRMED → SICHAL_CONFIRMED → NOH_CONFIRMED → APPROVED → ISSUED
# Any stage can → REJECTED

NEXT_STATUS = {
    'SUBMITTED': 'CHURCH_CONFIRMED',
    'CHURCH_CONFIRMED': 'SICHAL_CONFIRMED',
    'SICHAL_CONFIRMED': 'NOH_CONFIRMED',
    'NOH_CONFIRMED': 'APPROVED',
    'APPROVED': 'ISSUED',
    'MODIFY_REQUESTED': 'ISSUED',
}

STATUS_LABELS = {
    'SUBMITTED': '신청됨',
    'CHURCH_CONFIRMED': '교회 확인',
    'SICHAL_CONFIRMED': '시찰 확인',
    'NOH_CONFIRMED': '노회 확인',
    'APPROVED': '총회 승인',
    'ISSUED': '발급 완료',
    'REJECTED': '반려',
    'MODIFY_REQUESTED': '수정 요청됨',
}

STAGE_ROLE = {
    'SUBMITTED': 'church',
    'CHURCH_CONFIRMED': 'sichal',
    'SICHAL_CONFIRMED': 'presbytery',
    'NOH_CONFIRMED': 'assembly',
    'APPROVED': 'assembly',
    'ISSUED': 'assembly',
    'MODIFY_REQUESTED': 'assembly',
}

# --- My Info APIs ---

@app.get("/api/myinfo/{code}/history")
def get_minister_history(code: str):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        query = """
            SELECT 
                r.MinisterCode, m.MinisterName, 
                c.ChrName, n.NohName,
                d.CodeName as DUTYNAME,
                r.AppDate, r.TradeDate
            FROM TB_Chr201 r
            JOIN TB_Chr200 m ON r.MinisterCode = m.MinisterCode
            LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
            LEFT JOIN TB_Chr900 d ON d.CodeGubun = '05' AND r.DutyCode = d.Code
            WHERE r.MinisterCode = %s
            ORDER BY r.AppDate DESC
        """
        cursor.execute(query, (code,))
        results = cursor.fetchall()
        for r in results:
            trade = r.get('TradeDate', '')
            r['is_current'] = not trade or trade.strip() == ''
            app_date = r.get('AppDate', '')
            r['start_year'] = app_date[:4] if app_date and len(app_date) >= 4 else ''
            r['end_year'] = trade[:4] if trade and len(trade) >= 4 else ''
        return results
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

class CertRequestModel(BaseModel):
    minister_code: str
    minister_name: str
    cert_type: str
    cert_label: str
    memo: str = ""

@app.post("/api/cert-request")
def submit_cert_request(req: CertRequestModel):
    try:
        # Look up minister's church/noh info
        ms_conn = get_connection()
        cursor = ms_conn.cursor(as_dict=True)
        cursor.execute("""
            SELECT TOP 1 m.MinisterCode, m.CHRNAME, m.NOHNAME,
                   r.ChrCode, r.NohCode, s.SichalCode
            FROM VI_MIN_INFO m
            LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                AND (r.TradeDate IS NULL OR r.TradeDate = '')
            LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
            WHERE m.MinisterCode = %s
        """, (req.minister_code,))
        info = cursor.fetchone() or {}
        ms_conn.close()

        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT INTO cert_requests 
            (minister_code, minister_name, cert_type, cert_label, memo,
             noh_code, noh_name, sichal_code, chr_code, chr_name, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')
        ''', (req.minister_code, req.minister_name, req.cert_type, req.cert_label, req.memo,
              info.get('NohCode', ''), info.get('NOHNAME', ''), 
              info.get('SichalCode', ''), info.get('ChrCode', ''), info.get('CHRNAME', '')))
        req_id = c.lastrowid
        # Add initial history
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'cert', 'SUBMITTED', 'submit', ?, 'personal', ?)
        ''', (req_id, req.minister_name, f'{req.cert_label} 신청'))
        conn.commit()
        conn.close()
        return {"success": True, "message": "증명서 요청이 접수되었습니다.", "id": req_id}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/cert-requests/me")
def get_my_cert_requests(minister_code: str):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM cert_requests WHERE minister_code = ? ORDER BY created_at DESC", (minister_code,))
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

class ModifyRequestModel(BaseModel):
    minister_code: str
    comment: str

@app.post("/api/cert-requests/{req_id}/request-modify")
def request_cert_modification(req_id: int, req: ModifyRequestModel):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM cert_requests WHERE id = ? AND minister_code = ?", (req_id, req.minister_code))
        cert = c.fetchone()
        if not cert:
            return {"error": "요청을 찾을 수 없거나 권한이 없습니다."}
        
        if cert['status'] != 'ISSUED':
            return {"error": "발급 완료된 증명서만 수정 요청이 가능합니다."}
            
        now = datetime.now().isoformat()
        new_status = 'MODIFY_REQUESTED'
        
        c.execute('''
            UPDATE cert_requests 
            SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (new_status, now, req_id))
        
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'cert', ?, ?, ?, ?, ?)
        ''', (req_id, new_status, 'request_modify', cert['minister_name'], 'personal', req.comment))
        
        conn.commit()
        conn.close()
        return {"success": True, "new_status": new_status, "status_label": STATUS_LABELS.get(new_status, new_status)}
    except Exception as e:
        return {"error": str(e)}

# --- Admin Cert Request APIs ---

@app.get("/api/admin/cert-requests")
def get_cert_requests(status: str = "", noh_code: str = "", chr_code: str = "", minister_code: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT * FROM cert_requests WHERE 1=1"
        params = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if noh_code:
            query += " AND noh_code = ?"
            params.append(noh_code)
        if chr_code:
            query += " AND chr_code = ?"
            params.append(chr_code)
        if minister_code:
            query += " AND minister_code = ?"
            params.append(minister_code)
        query += " ORDER BY created_at DESC"
        c.execute(query, params)
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/admin/cert-requests/{req_id}")
def get_cert_request_detail(req_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM cert_requests WHERE id = ?", (req_id,))
        req = c.fetchone()
        if not req:
            return {"error": "요청을 찾을 수 없습니다."}
        c.execute("SELECT * FROM approval_history WHERE request_id = ? AND request_type = 'cert' ORDER BY created_at ASC", (req_id,))
        history = [dict(row) for row in c.fetchall()]
        conn.close()
        result = dict(req)
        result['history'] = history
        result['status_label'] = STATUS_LABELS.get(result['status'], result['status'])
        return result
    except Exception as e:
        return {"error": str(e)}

class ApprovalAction(BaseModel):
    action: str  # 'approve' or 'reject'
    actor_name: str
    actor_role: str  # 'church', 'sichal', 'presbytery', 'assembly'
    comment: str = ""
    doc_number: str = ""
    pdf_filename: str = ""

@app.post("/api/admin/cert-requests/{req_id}/approve")
def approve_cert_request(req_id: int, req: ApprovalAction):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM cert_requests WHERE id = ?", (req_id,))
        cert = c.fetchone()
        if not cert:
            return {"error": "요청을 찾을 수 없습니다."}
        
        current_status = cert['status']
        expected_role = STAGE_ROLE.get(current_status)
        
        if req.actor_role != expected_role:
            return {"error": f"이 단계({STATUS_LABELS.get(current_status, current_status)})의 결재 권한이 없습니다."}
        
        if req.action == 'reject':
            new_status = 'REJECTED'
        else:
            new_status = NEXT_STATUS.get(current_status)
            if not new_status:
                if current_status == 'ISSUED':
                    # 재발급 허용
                    new_status = 'ISSUED'
                else:
                    return {"error": f"현재 상태({current_status})에서 승인할 수 없습니다."}
        
        now = datetime.now().isoformat()
        c.execute('''
            UPDATE cert_requests 
            SET status = ?, updated_at = ?,
                doc_number = CASE WHEN ? != '' THEN ? ELSE doc_number END,
                pdf_filename = CASE WHEN ? != '' THEN ? ELSE pdf_filename END
            WHERE id = ?
        ''', (new_status, now, req.doc_number, req.doc_number, req.pdf_filename, req.pdf_filename, req_id))
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'cert', ?, ?, ?, ?, ?)
        ''', (req_id, new_status, req.action, req.actor_name, req.actor_role, req.comment))
        conn.commit()
        conn.close()
        return {"success": True, "new_status": new_status, "status_label": STATUS_LABELS.get(new_status, new_status)}
    except Exception as e:
        return {"error": str(e)}

# --- Church Report APIs ---

class ChurchReportModel(BaseModel):
    church_code: str
    church_name: str
    noh_code: str
    noh_name: str
    report_year: int
    submitted_by: str
    statistics_data: str  # JSON string
    elders_data: str      # JSON string

@app.post("/api/church-reports")
def submit_church_report(req: ChurchReportModel):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        
        now = datetime.now().isoformat()
        
        c.execute("SELECT id, status FROM church_reports WHERE church_code = ? AND report_year = ?", (req.church_code, req.report_year))
        row = c.fetchone()
        
        if row:
            if row[1] in ['NOH_APPROVED', 'ASSEMBLY_APPROVED']:
                conn.close()
                return {"error": "이미 승인된 보고서는 수정할 수 없습니다."}
            
            c.execute('''
                UPDATE church_reports 
                SET church_name=?, noh_code=?, noh_name=?, submitted_by=?, statistics_data=?, elders_data=?, status='SUBMITTED', updated_at=?
                WHERE id=?
            ''', (req.church_name, req.noh_code, req.noh_name, req.submitted_by, req.statistics_data, req.elders_data, now, row[0]))
            req_id = row[0]
            action = "update"
        else:
            c.execute('''
                INSERT INTO church_reports 
                (church_code, church_name, noh_code, noh_name, report_year, submitted_by, statistics_data, elders_data, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')
            ''', (req.church_code, req.church_name, req.noh_code, req.noh_name, req.report_year, req.submitted_by, req.statistics_data, req.elders_data))
            req_id = c.lastrowid
            action = "submit"
            
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'report', 'SUBMITTED', ?, ?, 'church', '상황보고서 제출')
        ''', (req_id, action, req.submitted_by))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "보고서가 성공적으로 제출되었습니다.", "id": req_id}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/church-reports")
def get_church_reports(church_code: str = "", noh_code: str = "", report_year: str = "", status: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT id, church_code, church_name, noh_code, noh_name, report_year, status, submitted_by, created_at, updated_at FROM church_reports WHERE 1=1"
        params = []
        if church_code:
            query += " AND church_code = ?"
            params.append(church_code)
        if noh_code:
            query += " AND noh_code = ?"
            params.append(noh_code)
        if report_year:
            query += " AND report_year = ?"
            params.append(report_year)
        if status:
            query += " AND status = ?"
            params.append(status)
            
        query += " ORDER BY report_year DESC, updated_at DESC"
        c.execute(query, params)
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/church-reports/{req_id}")
def get_church_report_detail(req_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM church_reports WHERE id = ?", (req_id,))
        req_row = c.fetchone()
        if not req_row:
            return {"error": "보고서를 찾을 수 없습니다."}
            
        c.execute("SELECT * FROM approval_history WHERE request_id = ? AND request_type = 'report' ORDER BY created_at ASC", (req_id,))
        history = [dict(row) for row in c.fetchall()]
        conn.close()
        
        result = dict(req_row)
        result['history'] = history
        return result
    except Exception as e:
        return {"error": str(e)}

class ReportApprovalAction(BaseModel):
    action: str  # 'approve' or 'reject'
    actor_name: str
    actor_role: str
    comment: str = ""

@app.post("/api/admin/church-reports/{req_id}/approve")
def approve_church_report(req_id: int, req: ReportApprovalAction):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM church_reports WHERE id = ?", (req_id,))
        report = c.fetchone()
        if not report:
            return {"error": "보고서를 찾을 수 없습니다."}
        
        current_status = report['status']
        new_status = current_status
        
        if req.action == 'reject':
            new_status = 'REJECTED'
        elif req.action == 'approve':
            if current_status == 'SUBMITTED':
                new_status = 'NOH_APPROVED'
            elif current_status in ['NOH_APPROVED', 'REJECTED']:  # Can re-approve if rejected maybe, but normally just move forward
                new_status = 'ASSEMBLY_APPROVED'
            else:
                return {"error": f"현재 상태({current_status})에서 승인할 수 없습니다."}
                
        now = datetime.now().isoformat()
        c.execute("UPDATE church_reports SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, req_id))
        
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'report', ?, ?, ?, ?, ?)
        ''', (req_id, new_status, req.action, req.actor_name, req.actor_role, req.comment))
        
        conn.commit()
        conn.close()
        return {"success": True, "new_status": new_status}
    except Exception as e:
        return {"error": str(e)}

# =============================================
#  Document Builder & Management APIs
# =============================================

# --- Visibility Roles ---
@app.get("/api/visibility-roles")
def get_visibility_roles():
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM visibility_roles ORDER BY display_order").fetchall()
    conn.close()
    return [dict(r) for r in rows]

class VisibilityRoleModel(BaseModel):
    role_tag: str
    display_order: int = 0

@app.post("/api/visibility-roles")
def add_visibility_role(req: VisibilityRoleModel):
    try:
        conn = sqlite3.connect('requests.db')
        conn.execute("INSERT INTO visibility_roles (role_tag, display_order) VALUES (?, ?)", (req.role_tag, req.display_order))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/visibility-roles/{role_id}")
def delete_visibility_role(role_id: int):
    conn = sqlite3.connect('requests.db')
    conn.execute("DELETE FROM visibility_roles WHERE id = ?", (role_id,))
    conn.commit()
    conn.close()
    return {"success": True}

# --- Form Templates ---
class FormTemplateModel(BaseModel):
    name: str
    description: str = ""
    schema_json: str
    created_by: str = ""

@app.get("/api/form-templates")
def get_form_templates(active_only: bool = False):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    q = "SELECT * FROM form_templates"
    if active_only:
        q += " WHERE is_active = 1"
    q += " ORDER BY updated_at DESC"
    rows = conn.execute(q).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/form-templates")
def create_form_template(req: FormTemplateModel):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("INSERT INTO form_templates (name, description, schema_json, created_by) VALUES (?, ?, ?, ?)",
                  (req.name, req.description, req.schema_json, req.created_by))
        conn.commit()
        tid = c.lastrowid
        conn.close()
        return {"success": True, "id": tid}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/form-templates/{tid}")
def get_form_template(tid: int):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM form_templates WHERE id = ?", (tid,)).fetchone()
    conn.close()
    return dict(row) if row else {"error": "양식을 찾을 수 없습니다."}

class FormTemplateUpdate(BaseModel):
    name: str
    description: str = ""
    schema_json: str

@app.put("/api/form-templates/{tid}")
def update_form_template(tid: int, req: FormTemplateUpdate):
    try:
        conn = sqlite3.connect('requests.db')
        now = datetime.now().isoformat()
        conn.execute("UPDATE form_templates SET name=?, description=?, schema_json=?, updated_at=?, version=version+1 WHERE id=?",
                     (req.name, req.description, req.schema_json, now, tid))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/form-templates/{tid}")
def delete_form_template(tid: int):
    conn = sqlite3.connect('requests.db')
    conn.execute("UPDATE form_templates SET is_active = 0 WHERE id = ?", (tid,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.delete("/api/form-templates/{tid}/permanent")
def delete_form_template_permanent(tid: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.execute("DELETE FROM form_templates WHERE id = ?", (tid,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# --- Form Documents ---
class FormDocumentModel(BaseModel):
    doc_type: str = "pdf"  # 'pdf' or 'form'
    title: str
    description: str = ""
    template_id: int = 0
    pdf_filename: str = ""
    content: str = ""
    visibility_roles: str = "[]"  # JSON string
    report_year: int = 0
    deadline: str = ""
    approval_steps: str = "[]"  # JSON: [{step, target}]
    created_by: str = ""

@app.post("/api/form-documents")
def create_form_document(req: FormDocumentModel):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''INSERT INTO form_documents
            (doc_type, title, description, template_id, pdf_filename, content, visibility_roles, report_year, deadline, status, approval_steps, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)''',
            (req.doc_type, req.title, req.description, req.template_id or None, req.pdf_filename, req.content,
             req.visibility_roles, req.report_year or None, req.deadline, req.approval_steps, req.created_by))
        conn.commit()
        did = c.lastrowid
        conn.close()
        return {"success": True, "id": did}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/form-documents")
def get_form_documents(status: str = "", doc_type: str = ""):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    q = "SELECT * FROM form_documents WHERE 1=1"
    params = []
    if status:
        q += " AND status = ?"
        params.append(status)
    if doc_type:
        q += " AND doc_type = ?"
        params.append(doc_type)
    q += " ORDER BY updated_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/form-documents/{did}")
def get_form_document(did: int):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM form_documents WHERE id = ?", (did,)).fetchone()
    conn.close()
    if not row:
        return {"error": "문서를 찾을 수 없습니다."}
    result = dict(row)
    if result.get('template_id'):
        conn2 = sqlite3.connect('requests.db')
        conn2.row_factory = sqlite3.Row
        tpl = conn2.execute("SELECT * FROM form_templates WHERE id = ?", (result['template_id'],)).fetchone()
        conn2.close()
        if tpl:
            result['template'] = dict(tpl)
    return result

class FormDocumentUpdate(BaseModel):
    title: str = ""
    description: str = ""
    content: str = ""
    visibility_roles: str = "[]"
    deadline: str = ""
    status: str = ""

@app.put("/api/form-documents/{did}")
def update_form_document(did: int, req: FormDocumentUpdate):
    try:
        conn = sqlite3.connect('requests.db')
        now = datetime.now().isoformat()
        sets = ["updated_at = ?"]
        params = [now]
        if req.title:
            sets.append("title = ?")
            params.append(req.title)
        if req.description:
            sets.append("description = ?")
            params.append(req.description)
        if req.content:
            sets.append("content = ?")
            params.append(req.content)
        if req.visibility_roles:
            sets.append("visibility_roles = ?")
            params.append(req.visibility_roles)
        if req.deadline:
            sets.append("deadline = ?")
            params.append(req.deadline)
        if req.status:
            sets.append("status = ?")
            params.append(req.status)
        params.append(did)
        conn.execute(f"UPDATE form_documents SET {', '.join(sets)} WHERE id = ?", params)
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# --- Form Responses ---
class FormResponseModel(BaseModel):
    document_id: int
    respondent_code: str
    respondent_name: str
    respondent_org: str = ""
    noh_code: str = ""
    response_data: str  # JSON

@app.post("/api/form-responses")
def submit_form_response(req: FormResponseModel):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        # Check for existing response (update if draft/rejected)
        c.execute("SELECT id, status FROM form_responses WHERE document_id = ? AND respondent_code = ?",
                  (req.document_id, req.respondent_code))
        existing = c.fetchone()
        now = datetime.now().isoformat()
        if existing:
            if existing[1] in ['ASSEMBLY_APPROVED']:
                conn.close()
                return {"error": "이미 최종 승인된 응답은 수정할 수 없습니다."}
            c.execute("UPDATE form_responses SET response_data=?, respondent_name=?, respondent_org=?, noh_code=?, status='SUBMITTED', updated_at=? WHERE id=?",
                      (req.response_data, req.respondent_name, req.respondent_org, req.noh_code, now, existing[0]))
            rid = existing[0]
        else:
            c.execute('''INSERT INTO form_responses (document_id, respondent_code, respondent_name, respondent_org, noh_code, response_data)
                         VALUES (?, ?, ?, ?, ?, ?)''',
                      (req.document_id, req.respondent_code, req.respondent_name, req.respondent_org, req.noh_code, req.response_data))
            rid = c.lastrowid
        conn.commit()
        conn.close()
        return {"success": True, "id": rid}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/form-responses")
def get_form_responses(document_id: int = 0, respondent_code: str = "", status: str = ""):
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    q = "SELECT * FROM form_responses WHERE 1=1"
    params = []
    if document_id:
        q += " AND document_id = ?"
        params.append(document_id)
    if respondent_code:
        q += " AND respondent_code = ?"
        params.append(respondent_code)
    if status:
        q += " AND status = ?"
        params.append(status)
    q += " ORDER BY updated_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Approval workflow: step-based approve/reject ---
class StepApprovalModel(BaseModel):
    action: str  # 'approve' or 'reject'
    actor_name: str
    actor_role: str  # 'church', 'sichal', 'presbytery', 'assembly'
    comment: str = ""

@app.post("/api/form-responses/{rid}/step-approve")
def step_approve_response(rid: int, req: StepApprovalModel):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        resp = conn.execute("SELECT * FROM form_responses WHERE id = ?", (rid,)).fetchone()
        if not resp:
            conn.close()
            return {"error": "응답을 찾을 수 없습니다."}
        # Get document approval_steps
        doc = conn.execute("SELECT approval_steps FROM form_documents WHERE id = ?", (resp['document_id'],)).fetchone()
        steps = json.loads(doc['approval_steps']) if doc and doc['approval_steps'] else []
        current_step = resp['current_step'] or 0
        history = json.loads(resp['approval_history']) if resp['approval_history'] else []
        now = datetime.now().isoformat()

        history.append({
            'step': current_step,
            'actor': req.actor_name,
            'role': req.actor_role,
            'action': req.action,
            'comment': req.comment,
            'date': now
        })

        if req.action == 'reject':
            new_status = 'REJECTED'
            new_step = current_step
        elif req.action == 'approve':
            new_step = current_step + 1
            if new_step >= len(steps):
                new_status = 'ASSEMBLY_APPROVED'  # Final
            else:
                new_status = f'STEP_{new_step}'
        else:
            conn.close()
            return {"error": "잘못된 액션입니다."}

        conn.execute(
            "UPDATE form_responses SET status=?, current_step=?, approval_history=?, updated_at=? WHERE id=?",
            (new_status, new_step, json.dumps(history, ensure_ascii=False), now, rid)
        )
        conn.commit()
        conn.close()
        return {"success": True, "new_status": new_status, "new_step": new_step}
    except Exception as e:
        return {"error": str(e)}

# --- Get responses pending for a specific approval role ---
@app.get("/api/form-responses/pending")
def get_pending_responses(role: str = ""):
    """Get responses that are pending approval at a step matching the given role"""
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    # Get all non-final responses
    responses = conn.execute(
        "SELECT fr.*, fd.title as doc_title, fd.approval_steps, fd.doc_type "
        "FROM form_responses fr JOIN form_documents fd ON fr.document_id = fd.id "
        "WHERE fr.status NOT IN ('ASSEMBLY_APPROVED', 'REJECTED') "
        "ORDER BY fr.updated_at DESC"
    ).fetchall()
    result = []
    for r in responses:
        row = dict(r)
        steps = json.loads(row.get('approval_steps') or '[]')
        current = row.get('current_step') or 0
        if current < len(steps) and steps[current].get('target', '').lower() == role.lower():
            result.append(row)
        elif not steps and role:  # No steps defined, show to everyone
            result.append(row)
    conn.close()
    return result

class FormResponseApproval(BaseModel):
    action: str  # 'approve' or 'reject'
    actor_name: str
    actor_role: str
    comment: str = ""

@app.post("/api/admin/form-responses/{rid}/approve")
def approve_form_response(rid: int, req: FormResponseApproval):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        resp = c.execute("SELECT * FROM form_responses WHERE id = ?", (rid,)).fetchone()
        if not resp:
            return {"error": "응답을 찾을 수 없습니다."}
        current = resp['status']
        if req.action == 'reject':
            new_status = 'REJECTED'
        elif req.action == 'approve':
            if current == 'SUBMITTED':
                new_status = 'NOH_APPROVED'
            elif current == 'NOH_APPROVED':
                new_status = 'ASSEMBLY_APPROVED'
            else:
                return {"error": f"현재 상태({current})에서 승인할 수 없습니다."}
        else:
            return {"error": "잘못된 액션입니다."}
        now = datetime.now().isoformat()
        c.execute("UPDATE form_responses SET status=?, updated_at=? WHERE id=?", (new_status, now, rid))
        c.execute('''INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
                     VALUES (?, 'form_response', ?, ?, ?, ?, ?)''',
                  (rid, new_status, req.action, req.actor_name, req.actor_role, req.comment))
        conn.commit()
        conn.close()
        return {"success": True, "new_status": new_status}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/admin/stats")
def get_admin_stats():
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("SELECT status, COUNT(*) FROM cert_requests GROUP BY status")
        cert_stats = dict(c.fetchall())
        c.execute("SELECT status, COUNT(*) FROM modify_requests GROUP BY status")
        mod_stats = dict(c.fetchall())
        conn.close()
        return {
            "cert_requests": cert_stats,
            "modify_requests": mod_stats,
            "status_labels": STATUS_LABELS,
        }
    except Exception as e:
        return {"error": str(e)}


class LoginRequest(BaseModel):
    code: str

@app.post("/api/auth/login")
def simple_login(req: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        query = """
            SELECT TOP 1 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.BIRTHDAY, m.EMAIL
            FROM VI_MIN_INFO m
            WHERE m.MinisterCode = %s
        """
        cursor.execute(query, (req.code,))
        result = cursor.fetchone()
        if not result:
            return {"error": "해당 코드로 등록된 정보를 찾을 수 없습니다."}
        return {"success": True, "user": result}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


@app.get("/api/ministers/{code}")
def get_minister_detail(code: str):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        query = """
            SELECT TOP 1 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.BIRTHDAY, m.EMAIL
            FROM VI_MIN_INFO m
            WHERE m.MinisterCode = %s
        """
        cursor.execute(query, (code,))
        result = cursor.fetchone()
        if not result:
            return {"error": "Minister not found."}
        # Attach user_profiles data (profile image, background, status)
        try:
            sql_conn = sqlite3.connect('requests.db')
            sql_c = sql_conn.cursor()
            sql_c.execute('SELECT profile_image_url, status_message, background_image_url FROM user_profiles WHERE minister_code=?', (code,))
            prow = sql_c.fetchone()
            sql_conn.close()
            if prow:
                result["custom_image"] = prow[0] or ""
                result["status_message"] = prow[1] or ""
                result["background_image"] = prow[2] or ""
        except:
            pass
        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

class ModifyRequest(BaseModel):
    minister_name: str
    field: str
    old_value: str
    new_value: str
    memo: str = ""

@app.post("/api/ministers/{code}/request-modify")
def submit_modify_request(code: str, req: ModifyRequest):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT INTO modify_requests (minister_code, minister_name, field, old_value, new_value, memo)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (code, req.minister_name, req.field, req.old_value, req.new_value, req.memo))
        conn.commit()
        conn.close()
        return {"success": True, "message": "수정 요청이 접수되었습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/admin/requests")
def get_modify_requests():
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM modify_requests ORDER BY created_at DESC")
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/admin/requests/{req_id}/approve")
def approve_modify_request(req_id: int):
    # 1. Get request details
    try:
        conn_lite = sqlite3.connect('requests.db')
        conn_lite.row_factory = sqlite3.Row
        c = conn_lite.cursor()
        c.execute("SELECT * FROM modify_requests WHERE id = ?", (req_id,))
        req = c.fetchone()
        
        if not req:
            return {"error": "요청이 존재하지 않습니다."}
        if req['status'] != 'PENDING':
            return {"error": "이미 처리된 요청입니다."}
            
        # 2. Update SQLite status (Since 'pbh' user lacks UPDATE permissions on MS SQL Server, 
        # we only track the status here. The actual DB update must be done by CBA/DBA manually).
        c.execute("UPDATE modify_requests SET status = 'APPROVED' WHERE id = ?", (req_id,))
        conn_lite.commit()
        conn_lite.close()
        
        return {"success": True, "message": "승인 처리되었습니다. (실제 데이터베이스 반영은 본부 시스템 관리자가 수동으로 진행해야 합니다)"}
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/admin/requests/{req_id}/reject")
def reject_modify_request(req_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("UPDATE modify_requests SET status = 'REJECTED' WHERE id = ?", (req_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "수정 요청이 반려되었습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/churches/{chr_code}/staff")
def get_church_staff(chr_code: str):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        query = """
            SELECT 
                r.MinisterCode, m.MinisterName, 
                v.DUTYNAME, 
                m.Tel_Mobile as TEL_MOBILE, 
                m.Email as EMAIL,
                r.AppDate,
                r.TradeDate
            FROM TB_Chr201 r
            JOIN TB_Chr200 m ON r.MinisterCode = m.MinisterCode
            LEFT JOIN VI_MIN_INFO v ON r.MinisterCode = v.MinisterCode
            WHERE r.ChrCode = %s
            ORDER BY 
                CASE WHEN r.TradeDate IS NULL OR r.TradeDate = '' THEN 0 ELSE 1 END,
                r.AppDate ASC
        """
        cursor.execute(query, (chr_code,))
        results = cursor.fetchall()
        # Add is_current flag
        for r in results:
            trade = r.get('TradeDate', '')
            r['is_current'] = not trade or trade.strip() == ''
            # Format year range
            app = r.get('AppDate', '')
            if app and len(app) >= 4:
                r['start_year'] = app[:4]
            else:
                r['start_year'] = ''
            if trade and len(trade) >= 4:
                r['end_year'] = trade[:4]
            else:
                r['end_year'] = ''
        return results
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

# --- FCM Token Topic Subscription API ---

class FCMSubscribeRequest(BaseModel):
    token: str
    topic: str = "all_users"


# NOTE: /api/fcm/subscribe endpoint is defined later in the file (after FCM helper functions)

# --- Push Notification APIs ---

class PushSubscription(BaseModel):
    minister_code: str
    minister_name: str = ""
    noh_code: str = ""
    sichal_code: str = ""
    push_token: str
    device_info: str = ""

@app.post("/api/push/subscribe")
def push_subscribe(req: PushSubscription):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT OR REPLACE INTO push_subscriptions 
            (minister_code, minister_name, noh_code, sichal_code, push_token, device_info, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (req.minister_code, req.minister_name, req.noh_code, req.sichal_code, 
              req.push_token, req.device_info, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        logging.info(f'[FCM] Push subscription saved: {req.minister_name} ({req.minister_code})')
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/push/subscribers")
def get_subscribers(scope: str = "assembly", noh_code: str = "", sichal_code: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # For now, pull ministers from MSSQL as potential recipients
        ms_conn = get_connection()
        cursor = ms_conn.cursor(as_dict=True)
        query = """
            SELECT MinisterCode, MinisterName, NOHNAME, NohCode, SichalCode
            FROM (
                SELECT DISTINCT m.MinisterCode, m.MinisterName, m.NOHNAME,
                       r.NohCode, c.SichalCode
                FROM VI_MIN_INFO m
                LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                    AND (r.TradeDate IS NULL OR r.TradeDate = '')
                LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
                
                UNION
                
                SELECT DISTINCT j.MINISTERCODE as MinisterCode, j.MINISTERNAME as MinisterName, j.NOHNAME,
                       j.NOHCODE as NohCode, '' as SichalCode
                FROM VI_MIN_JANG_LIST j
            ) t
            WHERE 1=1
        """
        params = []
        if noh_code:
            query += " AND NohCode = %s"
            params.append(noh_code)
        if sichal_code:
            query += " AND SichalCode = %s"
            params.append(sichal_code)
        query += " ORDER BY MinisterName"
        cursor.execute(query, tuple(params))
        ministers = cursor.fetchall()
        
        # 이름의 뒤 공백 제거
        for m in ministers:
            if m.get('MinisterName'):
                m['MinisterName'] = m['MinisterName'].strip()
                
        ms_conn.close()
        conn.close()
        return ministers
    except Exception as e:
        return {"error": str(e)}

# --- Push Group APIs ---

class PushGroupCreate(BaseModel):
    name: str
    scope: str = "assembly"
    member_codes: list = []

@app.get("/api/push/groups")
def get_push_groups(scope: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT * FROM push_groups"
        params = []
        if scope:
            query += " WHERE scope = ?"
            params.append(scope)
        query += " ORDER BY created_at DESC"
        c.execute(query, params)
        rows = []
        for row in c.fetchall():
            d = dict(row)
            d['member_codes'] = json.loads(d['member_codes']) if d['member_codes'] else []
            rows.append(d)
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/push/groups")
def create_push_group(req: PushGroupCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("INSERT INTO push_groups (name, scope, member_codes) VALUES (?, ?, ?)",
                  (req.name, req.scope, json.dumps(req.member_codes)))
        conn.commit()
        gid = c.lastrowid
        conn.close()
        return {"success": True, "id": gid}
    except Exception as e:
        return {"error": str(e)}

@app.put("/api/push/groups/{group_id}")
def update_push_group(group_id: int, req: PushGroupCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("UPDATE push_groups SET name=?, scope=?, member_codes=? WHERE id=?",
                  (req.name, req.scope, json.dumps(req.member_codes), group_id))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/push/groups/{group_id}")
def delete_push_group(group_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM push_groups WHERE id = ?", (group_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# --- Push Campaign APIs ---

class PushCampaignCreate(BaseModel):
    title: str
    body: str = ""
    link_url: str = ""
    scope: str = "assembly"
    target_type: str = "all"  # all, group, individual
    target_data: dict = {}   # {group_id: N} or {minister_codes: [...]}
    sender_name: str = ""
    sender_role: str = ""
    scheduled_at: str = ""   # ISO datetime for scheduled send

@app.get("/api/push/campaigns")
def get_push_campaigns(scope: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT * FROM push_campaigns"
        params = []
        if scope:
            query += " WHERE scope = ?"
            params.append(scope)
        query += " ORDER BY created_at DESC"
        c.execute(query, params)
        rows = []
        for row in c.fetchall():
            d = dict(row)
            d['target_data'] = json.loads(d['target_data']) if d['target_data'] else {}
            rows.append(d)
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/push/campaigns")
def create_push_campaign(req: PushCampaignCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        status = 'scheduled' if req.scheduled_at else 'draft'
        c.execute('''
            INSERT INTO push_campaigns 
            (title, body, link_url, scope, target_type, target_data, status, scheduled_at, sender_name, sender_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (req.title, req.body, req.link_url, req.scope, req.target_type,
              json.dumps(req.target_data, ensure_ascii=False), status,
              req.scheduled_at or None, req.sender_name, req.sender_role))
        conn.commit()
        cid = c.lastrowid
        conn.close()
        return {"success": True, "id": cid}
    except Exception as e:
        return {"error": str(e)}

class PushSendAction(BaseModel):
    send_type: str = "now"  # now, test, schedule
    test_minister_code: str = ""  # for test sends

@app.post("/api/push/campaigns/{campaign_id}/send")
def send_push_campaign(campaign_id: int, req: PushSendAction):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM push_campaigns WHERE id = ?", (campaign_id,))
        campaign = c.fetchone()
        if not campaign:
            conn.close()
            return {"error": "캠페인을 찾을 수 없습니다."}
        
        campaign = dict(campaign)
        target_data = json.loads(campaign['target_data']) if campaign['target_data'] else {}
        now = datetime.now().isoformat()
        
        # Determine recipients
        recipients = []
        if req.send_type == 'test':
            # Test: send only to the requesting user
            recipients = [{'MinisterCode': req.test_minister_code, 'MinisterName': '테스트', 'NohCode': '', 'SichalCode': ''}]
        elif campaign['target_type'] == 'all':
            # 모두에게: 목회자 + 장로
            try:
                ms_conn = get_connection()
                cursor = ms_conn.cursor(as_dict=True)
                cursor.execute("""
                    SELECT DISTINCT m.MinisterCode, m.MinisterName, r.NohCode, c.SichalCode
                    FROM VI_MIN_INFO m
                    LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                        AND (r.TradeDate IS NULL OR r.TradeDate = '')
                    LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
                """)
                ministers = cursor.fetchall()
                cursor.execute("""
                    SELECT DISTINCT j.MINISTERCODE as MinisterCode, j.MINISTERNAME as MinisterName, j.NOHCODE as NohCode, '' as SichalCode
                    FROM VI_MIN_JANG_LIST j
                """)
                elders = cursor.fetchall()
                recipients = ministers + elders
                ms_conn.close()
            except:
                recipients = []
        elif campaign['target_type'] == 'all_pastors':
            # 전체 목회자
            try:
                ms_conn = get_connection()
                cursor = ms_conn.cursor(as_dict=True)
                cursor.execute("""
                    SELECT DISTINCT m.MinisterCode, m.MinisterName, r.NohCode, c.SichalCode
                    FROM VI_MIN_INFO m
                    LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                        AND (r.TradeDate IS NULL OR r.TradeDate = '')
                    LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
                """)
                recipients = cursor.fetchall()
                ms_conn.close()
            except:
                recipients = []
        elif campaign['target_type'] == 'all_senior_pastors':
            # 전체 담임목사
            try:
                ms_conn = get_connection()
                cursor = ms_conn.cursor(as_dict=True)
                cursor.execute("""
                    SELECT DISTINCT m.MinisterCode, m.MinisterName, r.NohCode, c.SichalCode
                    FROM VI_MIN_INFO m
                    LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                        AND (r.TradeDate IS NULL OR r.TradeDate = '')
                    LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
                    WHERE m.DUTYNAME = '담임목사'
                """)
                recipients = cursor.fetchall()
                ms_conn.close()
            except:
                recipients = []
        elif campaign['target_type'] == 'all_elders':
            # 전체 장로
            try:
                ms_conn = get_connection()
                cursor = ms_conn.cursor(as_dict=True)
                cursor.execute("""
                    SELECT DISTINCT j.MINISTERCODE as MinisterCode, j.MINISTERNAME as MinisterName, j.NOHCODE as NohCode, '' as SichalCode
                    FROM VI_MIN_JANG_LIST j
                """)
                recipients = cursor.fetchall()
                ms_conn.close()
            except:
                recipients = []
        elif campaign['target_type'] == 'group':
            group_id = target_data.get('group_id')
            if group_id:
                c.execute("SELECT member_codes FROM push_groups WHERE id = ?", (group_id,))
                g = c.fetchone()
                if g:
                    codes = json.loads(g['member_codes']) if g['member_codes'] else []
                    for code in codes:
                        recipients.append({'MinisterCode': code, 'MinisterName': '', 'NohCode': '', 'SichalCode': ''})
        elif campaign['target_type'] == 'individual':
            codes = target_data.get('minister_codes', [])
            for code in codes:
                recipients.append({'MinisterCode': code, 'MinisterName': '', 'NohCode': '', 'SichalCode': ''})
        
        # Create delivery records
        for r in recipients:
            c.execute('''
                INSERT OR IGNORE INTO push_deliveries 
                (campaign_id, minister_code, minister_name, noh_code, sichal_code, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            ''', (campaign_id, r.get('MinisterCode', ''), r.get('MinisterName', ''),
                  r.get('NohCode', ''), r.get('SichalCode', '')))
        
        # Update campaign status
        new_status = 'sent' if req.send_type != 'test' else campaign['status']
        c.execute("""
            UPDATE push_campaigns 
            SET status = ?, sent_at = ?, total_targets = ?
            WHERE id = ?
        """, (new_status, now, len(recipients), campaign_id))
        
        conn.commit()
        
        # --- 실제 FCM 푸시 발송 ---
        fcm_result = {'success': 0, 'failure': 0, 'error': None}
        if FCM_AVAILABLE:
            try:
                if campaign['target_type'] == 'all':
                    # 전체 발송: 토픽 메시지 사용 (가장 효율적)
                    _send_fcm_topic_notification(
                        topic='all_users',
                        title=campaign['title'],
                        body=campaign['body'],
                        notice_id=str(campaign_id)
                    )
                    fcm_result['success'] = len(recipients)
                else:
                    # 개별/그룹/조건 발송: 해당 목회자들의 토큰을 DB에서 조회 후 multicast
                    codes = [r.get('MinisterCode', '') for r in recipients]
                    tokens = []
                    if codes:
                        chunk_size = 900
                        for i in range(0, len(codes), chunk_size):
                            chunk = codes[i:i+chunk_size]
                            placeholders = ','.join(['?' for _ in chunk])
                            c.execute(f'SELECT DISTINCT push_token FROM push_subscriptions WHERE minister_code IN ({placeholders})', chunk)
                            tokens.extend([row['push_token'] for row in c.fetchall() if row['push_token']])
                        
                        tokens = list(set(tokens))
                        
                        if tokens:
                            fcm_result = _send_fcm_to_tokens(
                                tokens=tokens,
                                title=campaign['title'],
                                body=campaign['body'],
                                data={'campaign_id': str(campaign_id)}
                            )
                        else:
                            fcm_result['error'] = '등록된 푸시 토큰이 없습니다'
                logging.info(f'[FCM] Campaign #{campaign_id} sent: {fcm_result}')
            except Exception as fcm_err:
                fcm_result['error'] = str(fcm_err)
                logging.error(f'[FCM] Campaign #{campaign_id} send failed: {fcm_err}')
        
        conn.close()
        send_label = {'now': '발송', 'test': '테스트 발송', 'schedule': '예약'}
        return {
            "success": True, 
            "message": f"{len(recipients)}명에게 {send_label.get(req.send_type, '발송')} 완료",
            "recipient_count": len(recipients),
            "fcm_result": fcm_result
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/push/campaigns/{campaign_id}/analytics")
def get_campaign_analytics(campaign_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get campaign
        c.execute("SELECT * FROM push_campaigns WHERE id = ?", (campaign_id,))
        campaign = c.fetchone()
        if not campaign:
            conn.close()
            return {"error": "캠페인을 찾을 수 없습니다."}
        campaign = dict(campaign)
        campaign['target_data'] = json.loads(campaign['target_data']) if campaign['target_data'] else {}
        
        # Get deliveries
        c.execute("SELECT * FROM push_deliveries WHERE campaign_id = ?", (campaign_id,))
        deliveries = [dict(row) for row in c.fetchall()]
        
        # Stats by noh
        c.execute("""
            SELECT noh_code, 
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened
            FROM push_deliveries WHERE campaign_id = ?
            GROUP BY noh_code
        """, (campaign_id,))
        noh_stats = [dict(row) for row in c.fetchall()]
        
        # Stats by sichal
        c.execute("""
            SELECT sichal_code,
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened
            FROM push_deliveries WHERE campaign_id = ?
            GROUP BY sichal_code
        """, (campaign_id,))
        sichal_stats = [dict(row) for row in c.fetchall()]
        
        conn.close()
        
        total = len(deliveries)
        opened = sum(1 for d in deliveries if d['status'] == 'opened')
        delivered = sum(1 for d in deliveries if d['status'] in ('delivered', 'opened'))
        
        return {
            "campaign": campaign,
            "summary": {
                "total": total,
                "delivered": delivered,
                "opened": opened,
                "open_rate": round(opened / total * 100, 1) if total > 0 else 0,
                "delivery_rate": round(delivered / total * 100, 1) if total > 0 else 0,
            },
            "noh_stats": noh_stats,
            "sichal_stats": sichal_stats,
            "deliveries": deliveries,
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/push/campaigns/{campaign_id}/track")
def track_push_open(campaign_id: int, minister_code: str = ""):
    """Track that a user opened a push notification"""
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        now = datetime.now().isoformat()
        c.execute("""
            UPDATE push_deliveries 
            SET status = 'opened', opened_at = ?
            WHERE campaign_id = ? AND minister_code = ?
        """, (now, campaign_id, minister_code))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/push/campaigns/{campaign_id}")
def delete_push_campaign(campaign_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM push_deliveries WHERE campaign_id = ?", (campaign_id,))
        c.execute("DELETE FROM push_campaigns WHERE id = ?", (campaign_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# --- Read Receipts APIs ---

class ReadReceiptCreate(BaseModel):
    item_type: str  # 'notice' or 'document'
    item_id: int
    reader_code: str
    reader_name: str = ""
    reader_org: str = ""

@app.post("/api/read-receipts")
def create_read_receipt(req: ReadReceiptCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT OR IGNORE INTO read_receipts (item_type, item_id, reader_code, reader_name, reader_org)
            VALUES (?, ?, ?, ?, ?)
        ''', (req.item_type, req.item_id, req.reader_code, req.reader_name, req.reader_org))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/read-receipts/{item_type}/{item_id}")
def get_read_receipts(item_type: str, item_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM read_receipts WHERE item_type = ? AND item_id = ? ORDER BY read_at DESC",
                  (item_type, item_id))
        receipts = [dict(row) for row in c.fetchall()]
        conn.close()
        return {
            "total": len(receipts),
            "receipts": receipts,
        }
    except Exception as e:
        return {"error": str(e)}

# --- Scope-based Recipients API ---

@app.get("/api/recipients/available")
def get_available_recipients(sender_scope: str = "assembly", noh_code: str = "", sichal_code: str = ""):
    """Return available recipient targets based on sender scope rules"""
    try:
        targets = []
        
        if sender_scope == "assembly":
            # 총회: 모든 노회/시찰/교회/목회자
            targets = [
                {"type": "presbytery", "code": "all", "name": "전체 노회"},
                {"type": "sichal", "code": "all", "name": "전체 시찰"},
                {"type": "church", "code": "all", "name": "전체 교회"},
                {"type": "minister", "code": "all", "name": "전체 목회자"},
            ]
        elif sender_scope == "presbytery":
            # 노회: 총회/타노회/소속시찰/소속교회/소속목회자
            targets = [
                {"type": "assembly", "code": "assembly", "name": "총회"},
                {"type": "presbytery", "code": "all", "name": "타 노회"},
                {"type": "sichal", "code": "all", "name": "소속 시찰 전체"},
                {"type": "church", "code": "all", "name": "소속 교회 전체"},
                {"type": "minister", "code": "all", "name": "소속 목회자 전체"},
            ]
        elif sender_scope == "sichal":
            # 시찰: 소속노회/소속교회/소속목회자
            targets = [
                {"type": "presbytery", "code": noh_code or "noh", "name": "소속 노회"},
                {"type": "church", "code": "all", "name": "소속 교회 전체"},
                {"type": "minister", "code": "all", "name": "소속 목회자 전체"},
            ]
        
        # Also fetch individual ministers/churches for search
        individual_ministers = []
        try:
            ms_conn = get_connection()
            cursor = ms_conn.cursor(as_dict=True)
            base_query = """
                SELECT DISTINCT m.MinisterCode, m.MinisterName, m.NOHNAME,
                       r.NohCode, c.SichalCode, c.ChrName, c.ChrCode
                FROM VI_MIN_INFO m
                LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                    AND (r.TradeDate IS NULL OR r.TradeDate = '')
                LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
                WHERE 1=1
            """
            params = []
            if sender_scope == "presbytery" and noh_code:
                base_query += " AND r.NohCode = %s"
                params.append(noh_code)
            elif sender_scope == "sichal" and sichal_code:
                base_query += " AND c.SichalCode = %s"
                params.append(sichal_code)
            base_query += " ORDER BY m.MinisterName"
            cursor.execute(base_query, tuple(params))
            individual_ministers = cursor.fetchall()
            ms_conn.close()
        except:
            pass
        
        return {
            "bulk_targets": targets,
            "ministers": individual_ministers,  # removed limit to allow full client-side search
        }
    except Exception as e:
        return {"error": str(e)}

# --- Official Document APIs ---

@app.post("/api/documents/upload")
async def upload_document_pdf(file: UploadFile = File(...)):
    try:
        import uuid
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        filename = f"{uuid.uuid4().hex[:12]}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content = await file.read()
        with open(filepath, 'wb') as f:
            f.write(content)
        return {"success": True, "filename": filename, "original_name": file.filename}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documents/download/{filename}")
def download_document(filename: str):
    import datetime
    
    # Check 24-hour validity for cert_requests
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT status, updated_at FROM cert_requests WHERE pdf_filename = ?", (filename,))
            cert = c.fetchone()
            if cert and cert['status'] == 'ISSUED' and cert['updated_at']:
                try:
                    updated_str = cert['updated_at']
                    if 'T' in updated_str:
                        updated_at = datetime.datetime.fromisoformat(updated_str.replace('Z', '+00:00'))
                        now = datetime.datetime.now(datetime.timezone.utc)
                    else:
                        updated_at = datetime.datetime.strptime(updated_str, "%Y-%m-%d %H:%M:%S")
                        now = datetime.datetime.now()
                    
                    if (now - updated_at).total_seconds() > 24 * 3600:
                        return {"error": "다운로드 유효 기간(24시간)이 만료되었습니다. 재신청해 주시기 바랍니다."}
                except Exception:
                    pass
    except Exception:
        pass

    filepath = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="application/pdf", filename=filename)
    return {"error": "파일을 찾을 수 없습니다."}

class DocumentCreate(BaseModel):
    doc_number: str = ""
    title: str
    content: str = ""
    sender_org: str = ""
    sender_name: str = ""
    sender_role: str = ""
    sender_scope: str = "assembly"
    recipients: list = []    # [{type, code, name}]
    cc_list: list = []
    sent_date: str = ""
    signature_token: str = ""
    pdf_filename: str = ""
    scope: str = "assembly"

@app.post("/api/documents")
def create_document(req: DocumentCreate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        now = datetime.now().isoformat()
        c.execute('''
            INSERT INTO official_documents 
            (doc_number, title, content, sender_org, sender_name, sender_role, sender_scope,
             recipients, cc_list, sent_date, signature_token, pdf_filename, scope, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)
        ''', (req.doc_number, req.title, req.content, req.sender_org, req.sender_name,
              req.sender_role, req.sender_scope,
              json.dumps(req.recipients, ensure_ascii=False),
              json.dumps(req.cc_list, ensure_ascii=False),
              req.sent_date or now[:10], req.signature_token, req.pdf_filename,
              req.scope, now))
        conn.commit()
        doc_id = c.lastrowid
        conn.close()
        return {"success": True, "id": doc_id, "message": "공문이 발송되었습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documents")
def get_documents(scope: str = "", status: str = ""):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        query = "SELECT * FROM official_documents WHERE 1=1"
        params = []
        if scope:
            query += " AND scope = ?"
            params.append(scope)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC"
        c.execute(query, params)
        rows = []
        for row in c.fetchall():
            d = dict(row)
            d['recipients'] = json.loads(d['recipients']) if d['recipients'] else []
            d['cc_list'] = json.loads(d['cc_list']) if d['cc_list'] else []
            rows.append(d)
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documents/sent")
def get_sent_documents(sender_scope: str = "assembly"):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM official_documents WHERE sender_scope = ? ORDER BY created_at DESC", (sender_scope,))
        rows = []
        for row in c.fetchall():
            d = dict(row)
            d['recipients'] = json.loads(d['recipients']) if d['recipients'] else []
            d['cc_list'] = json.loads(d['cc_list']) if d['cc_list'] else []
            rows.append(d)
        conn.close()
        return rows
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documents/inbox")
def get_inbox_documents(scope: str = "assembly", org_code: str = ""):
    """Get documents where this org is a recipient or cc"""
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM official_documents WHERE status = 'sent' ORDER BY created_at DESC")
        all_docs = c.fetchall()
        inbox = []
        for row in all_docs:
            d = dict(row)
            d['recipients'] = json.loads(d['recipients']) if d['recipients'] else []
            d['cc_list'] = json.loads(d['cc_list']) if d['cc_list'] else []
            # Check if this scope/org is in recipients or cc
            is_recipient = any(
                r.get('type') == scope or r.get('code') == org_code or r.get('type') == 'all'
                for r in d['recipients']
            )
            is_cc = any(
                r.get('type') == scope or r.get('code') == org_code
                for r in d['cc_list']
            )
            if is_recipient or is_cc:
                d['is_cc'] = is_cc and not is_recipient
                inbox.append(d)
        conn.close()
        return inbox
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documents/{doc_id}")
def get_document_detail(doc_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM official_documents WHERE id = ?", (doc_id,))
        row = c.fetchone()
        conn.close()
        if not row:
            return {"error": "문서를 찾을 수 없습니다."}
        d = dict(row)
        d['recipients'] = json.loads(d['recipients']) if d['recipients'] else []
        d['cc_list'] = json.loads(d['cc_list']) if d['cc_list'] else []
        return d
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM official_documents WHERE id = ?", (doc_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# --- Static file serving for built React frontend ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

CLIENT_BUILD = Path(__file__).parent.parent / "client" / "dist"

if CLIENT_BUILD.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(CLIENT_BUILD / "assets")), name="static-assets")
    
    # Serve files from public/assets (logo, banner, etc.)
    public_assets = CLIENT_BUILD / "assets"

# Serve uploaded files (profiles, ads, etc.)
UPLOAD_DIR = Path(__file__).parent / "uploads"

@app.get("/api/uploads/profiles/{filename}")
def serve_profile_image(filename: str):
    file_path = UPLOAD_DIR / "profiles" / filename
    if file_path.is_file():
        return FileResponse(str(file_path))
    return {"error": "not found"}

@app.get("/api/uploads/ads/{filename}")
def serve_ad_image(filename: str):
    file_path = UPLOAD_DIR / "ads" / filename
    if file_path.is_file():
        return FileResponse(str(file_path))
    return {"error": "not found"}

# --- FCM (Firebase Cloud Messaging) APIs ---

class FCMSubscribeRequest(BaseModel):
    token: str
    topic: str = "all_users"

def _send_fcm_topic_notification(topic: str, title: str, body: str, notice_id: str = ""):
    """FCM 토픽으로 푸시 알림 발송"""
    if not FCM_AVAILABLE:
        logging.warning('[FCM] Not available, skipping send')
        return
    
    base_url = 'https://prok-ga.web.app'
    click_url = f'{base_url}/?notice={notice_id}' if notice_id else base_url
    
    message = messaging.Message(
        data={
            'notice_id': notice_id,
            'title': title,
            'body': body,
            'icon': '/assets/pwa-192x192.png',
        },
        topic=topic,
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon=f'{base_url}/assets/pwa-192x192.png',
                badge=f'{base_url}/assets/pwa-192x192.png',
                tag=f'notice-{notice_id}',
                require_interaction=True,
            ),
            fcm_options=messaging.WebpushFCMOptions(
                link=click_url,
            ),
        ),
    )
    
    response = messaging.send(message)
    logging.info(f'[FCM] Message sent: {response}')
    return response

@app.post("/api/fcm/subscribe")
def fcm_subscribe(req: FCMSubscribeRequest):
    """클라이언트 FCM 토큰을 토픽에 구독"""
    if not FCM_AVAILABLE:
        return {"success": False, "error": "FCM not configured"}
    
    try:
        response = messaging.subscribe_to_topic([req.token], req.topic)
        logging.info(f'[FCM] Subscribe result: success={response.success_count}, failure={response.failure_count}')
        return {
            "success": response.success_count > 0,
            "success_count": response.success_count,
            "failure_count": response.failure_count
        }
    except Exception as e:
        logging.error(f'[FCM] Subscribe error: {e}')
        return {"success": False, "error": str(e)}

@app.post("/api/fcm/test")
def fcm_test_push():
    """FCM 테스트 발송 (관리자 전용)"""
    if not FCM_AVAILABLE:
        return {"success": False, "error": "FCM not configured"}
    
    try:
        result = _send_fcm_topic_notification(
            topic='all_users',
            title='🔔 테스트 알림',
            body='기장주소록 푸시 알림 테스트입니다.',
            notice_id='0'
        )
        return {"success": True, "message_id": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ── System Admin: Session Heartbeat ──
class SessionHeartbeat(BaseModel):
    session_id: str = ""
    minister_code: str = ""
    minister_name: str = ""
    page: str = "/"
    device_info: str = ""

@app.post("/api/system/heartbeat")
def session_heartbeat(req: SessionHeartbeat, request: Request):
    """Record or refresh an active user session (called every 30s from client)"""
    sid = req.session_id or f"{req.minister_code}_{_time.time()}"
    ip = request.client.host if request.client else "unknown"
    now = datetime.now().isoformat()
    _active_sessions[sid] = {
        "session_id": sid,
        "minister_code": req.minister_code,
        "minister_name": req.minister_name,
        "page": req.page,
        "device_info": req.device_info,
        "ip": ip,
        "last_seen": now,
    }
    return {"success": True, "session_id": sid}

@app.get("/api/system/sessions")
def get_active_sessions():
    """Return currently active sessions (within timeout window)"""
    cutoff = datetime.now().timestamp() - _SESSION_TIMEOUT
    active = []
    expired_keys = []
    for sid, sess in _active_sessions.items():
        try:
            last_ts = datetime.fromisoformat(sess["last_seen"]).timestamp()
        except Exception:
            last_ts = 0
        if last_ts >= cutoff:
            active.append(sess)
        else:
            expired_keys.append(sid)
    # Clean up expired
    for k in expired_keys:
        del _active_sessions[k]
    return {"sessions": active, "count": len(active)}

@app.get("/api/system/info")
def get_system_info():
    """System dashboard: server health, DB counts, storage, uptime"""
    info = {
        "server_start_time": _server_start_time,
        "current_time": datetime.now().isoformat(),
        "active_sessions": len([
            s for s in _active_sessions.values()
            if datetime.fromisoformat(s["last_seen"]).timestamp() >= datetime.now().timestamp() - _SESSION_TIMEOUT
        ]),
    }

    # SQLite stats
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        tables_stats = {}
        for tbl in ['notices', 'push_subscriptions', 'cert_requests', 'push_campaigns',
                     'admin_roles', 'official_documents', 'user_profiles', 'ads',
                     'form_templates', 'form_documents', 'form_responses']:
            try:
                c.execute(f"SELECT COUNT(*) FROM {tbl}")
                tables_stats[tbl] = c.fetchone()[0]
            except Exception:
                tables_stats[tbl] = -1
        conn.close()
        info["sqlite_tables"] = tables_stats
        info["sqlite_status"] = "connected"
    except Exception as e:
        info["sqlite_status"] = f"error: {e}"
        info["sqlite_tables"] = {}

    # MSSQL stats
    try:
        ms = get_connection()
        cur = ms.cursor(as_dict=True)
        cur.execute("SELECT COUNT(*) AS cnt FROM VI_MIN_INFO")
        info["mssql_minister_count"] = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) AS cnt FROM TB_Chr100")
        info["mssql_church_count"] = cur.fetchone()["cnt"]
        ms.close()
        info["mssql_status"] = "connected"
    except Exception as e:
        info["mssql_status"] = f"error: {e}"
        info["mssql_minister_count"] = 0
        info["mssql_church_count"] = 0

    # Push subscription stats
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM push_subscriptions")
        info["push_subscriber_count"] = c.fetchone()[0]
        c.execute("SELECT COUNT(DISTINCT minister_code) FROM push_subscriptions WHERE minister_code != ''")
        info["push_unique_users"] = c.fetchone()[0]
        conn.close()
    except Exception:
        info["push_subscriber_count"] = 0
        info["push_unique_users"] = 0

    # Disk usage for uploads
    try:
        upload_size = 0
        for dirpath, dirnames, filenames in os.walk("uploads"):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                upload_size += os.path.getsize(fp)
        info["uploads_size_mb"] = round(upload_size / (1024 * 1024), 2)
    except Exception:
        info["uploads_size_mb"] = 0

    # requests.db file size
    try:
        info["sqlite_size_mb"] = round(os.path.getsize("requests.db") / (1024 * 1024), 2)
    except Exception:
        info["sqlite_size_mb"] = 0

    return info

@app.get("/api/system/health")
def system_health_check():
    """Quick health check for both databases"""
    result = {"sqlite": "unknown", "mssql": "unknown"}
    try:
        conn = sqlite3.connect('requests.db')
        conn.execute("SELECT 1")
        conn.close()
        result["sqlite"] = "ok"
    except Exception as e:
        result["sqlite"] = f"error: {e}"

    try:
        ms = get_connection()
        ms.close()
        result["mssql"] = "ok"
    except Exception as e:
        result["mssql"] = f"error: {e}"

    all_ok = result["sqlite"] == "ok" and result["mssql"] == "ok"
    result["status"] = "healthy" if all_ok else "degraded"
    return result

if CLIENT_BUILD.exists():
    # SPA fallback: serve index.html for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Never intercept API routes
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": "not_found"})
        # Check if the file exists in the build directory
        file_path = CLIENT_BUILD / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html (React Router handles routing)
        return FileResponse(str(CLIENT_BUILD / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
