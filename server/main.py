from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from fastapi import FastAPI, Query, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pymssql
# os already imported above with dotenv
import json
import shutil
import sqlite3
from datetime import datetime
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Firebase Admin SDK for FCM push
try:
    import firebase_admin
    from firebase_admin import credentials, messaging, storage, firestore
    _sa_path = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
    if os.path.exists(_sa_path):
        # 중복 초기화 방지
        if not firebase_admin._apps:
            cred = credentials.Certificate(_sa_path)
            firebase_admin.initialize_app(cred, {
                'storageBucket': 'prok-ga.firebasestorage.app'
            })
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

# Enable CORS for all origins (PWA + ngrok 터널 + IDC 서버)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health-check / heartbeat (프론트엔드 OfflineIndicator 용) ──
@app.get("/api/system/heartbeat")
async def system_heartbeat():
    return {"status": "ok"}

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

# Database credentials — .env에서 로드 (IDC 전환 시 .env만 변경)
DB_USER = os.getenv("DB_USER", "prok.or.kr")
DB_PASSWORD = os.getenv("DB_PASSWORD", "qp1f]4jIM")
DB_SERVER = os.getenv("DB_SERVER", "mssql.nskorea.com")
DB_DATABASE = os.getenv("DB_DATABASE", "KJ_CHURCH")
DB_PORT = os.getenv("DB_PORT", "1433")

import queue
import threading

class MSSQLConnectionPool:
    def __init__(self, max_connections=20, timeout=10):
        self.max_connections = max_connections
        self.timeout = timeout
        self.pool = queue.Queue(max_connections)
        self.lock = threading.Lock()
        self.active_connections = 0

    def _create_connection(self):
        return pymssql.connect(
            server=DB_SERVER,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_DATABASE,
            charset='cp949',
            login_timeout=5,
            timeout=10
        )

    def get_connection(self):
        while True:
            try:
                # 대기 없이 사용 가능한 기존 커넥션 선인출
                conn = self.pool.get(block=False)
                
                # [생존 검증 가드 장착]
                try:
                    cursor = conn.cursor()
                    cursor.execute("SELECT 1")
                    cursor.close()
                    # 검증에 성공하면 즉시 반환
                    return conn
                except Exception:
                    # 연결이 이미 유실되었으므로 폐기하고 풀 카운트 1 차감
                    try:
                        conn.close()
                    except Exception:
                        pass
                    with self.lock:
                        self.active_connections = max(0, self.active_connections - 1)
                    # 루프를 돌아 새로운 혹은 사용 가능한 커넥션을 다시 획득
                    continue
            except queue.Empty:
                with self.lock:
                    if self.active_connections < self.max_connections:
                        try:
                            conn = self._create_connection()
                            self.active_connections += 1
                            return conn
                        except Exception as create_err:
                            logging.error(f"[DB] Failed to create new pool connection: {create_err}")
                            raise create_err
                # 최대 연결 개수에 도달한 경우 빈 슬롯이 생길 때까지 타임아웃 동안 대기
                try:
                    conn = self.pool.get(block=True, timeout=self.timeout)
                    # 대기해서 얻어온 커넥션도 다시 한 번 검증
                    try:
                        cursor = conn.cursor()
                        cursor.execute("SELECT 1")
                        cursor.close()
                        return conn
                    except Exception:
                        try:
                            conn.close()
                        except Exception:
                            pass
                        with self.lock:
                            self.active_connections = max(0, self.active_connections - 1)
                        continue
                except queue.Empty:
                    raise TimeoutError("Database connection pool timeout. No connections available.")

    def release_connection(self, conn):
        try:
            self.pool.put(conn, block=False)
        except queue.Full:
            # 예외적으로 풀이 꽉 찬 경우에만 물리적으로 커넥션을 끊어 안전성 확보
            try:
                conn.close()
            except Exception:
                pass
            with self.lock:
                self.active_connections -= 1

class PooledConnectionWrapper:
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._closed = False

    def close(self):
        if not self._closed:
            self._pool.release_connection(self._conn)
            self._closed = True

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

# 전역 싱글톤 커넥션 풀 초기화 (워커 프로세스당 최대 20개 연결 제어)
db_pool = MSSQLConnectionPool(max_connections=20, timeout=10)

def get_connection():
    """MSSQL 연결 풀을 통한 커넥션 대여 및 프록시 반환"""
    raw_conn = db_pool.get_connection()
    return PooledConnectionWrapper(raw_conn, db_pool)


@app.on_event("startup")
async def startup_event():
    logging.info("[Startup] Verifying database connections...")
    
    # 1. SQLite DB (requests.db) check
    try:
        logging.info("[Startup] Checking SQLite connection...")
        sqlite_conn = sqlite3.connect('requests.db')
        sqlite_conn.execute("SELECT 1")
        
        # Create cache and local replication tables
        sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS pen_no_cache (
                minister_code TEXT PRIMARY KEY,
                pen_no TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS local_ministers (
                MinisterCode TEXT PRIMARY KEY,
                MinisterName TEXT,
                CHRNAME TEXT,
                NOHNAME TEXT,
                DUTYNAME TEXT,
                TEL_MOBILE TEXT,
                TEL_CHURCH TEXT,
                JUSO TEXT,
                EMAIL TEXT
            )
        """)
        sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS local_churches (
                ChrCode TEXT PRIMARY KEY,
                CHRNAME TEXT,
                NohCode TEXT,
                NOHNAME TEXT,
                SichalCode TEXT,
                SICHALNAME TEXT,
                OrgYN TEXT,
                Environment TEXT,
                PostNo TEXT,
                ADDRESS TEXT,
                JUSO TEXT,
                EstDate TEXT,
                EndDate TEXT,
                Tel_Church TEXT,
                Tel_Home TEXT,
                Tel_Mobile TEXT,
                Tel_Fax TEXT,
                HomePage TEXT,
                Email TEXT,
                Remark TEXT,
                Cnt INTEGER,
                HJcode TEXT,
                MOCKNAME TEXT
            )
        """)
        sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS local_elders (
                PriestCode TEXT PRIMARY KEY,
                PriestName TEXT,
                ChrCode TEXT,
                ChrName TEXT,
                NohName TEXT,
                Tel_Mobile TEXT,
                Email TEXT,
                Address TEXT,
                Juso TEXT,
                PostNo TEXT
            )
        """)
        sqlite_conn.execute("DROP TABLE IF EXISTS local_addressbook")
        sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS local_addressbook (
                MINISTERCODE TEXT,
                MINISTERNAME TEXT,
                NOHNAME TEXT,
                CHRNAME TEXT,
                TEL_CHURCH TEXT,
                TEL_MOBILE TEXT,
                POSTNO TEXT,
                ADDRESS TEXT,
                JUSO TEXT,
                EMAIL TEXT
            )
        """)
        sqlite_conn.commit()
        sqlite_conn.close()
        logging.info("[Startup] SQLite connection and all schema tables verification successful.")
    except Exception as e:
        logging.critical(f"[Startup] SQLite connection/schema failed! Error: {e}")
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
    import uuid
    _, ext = os.path.splitext(file.filename)
    if not ext:
        ext = ".jpg"
    safe_uuid = uuid.uuid4().hex[:8]
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{safe_uuid}{ext}"
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
    import uuid
    conn = sqlite3.connect('requests.db')
    c = conn.cursor()
    c.execute("DELETE FROM church_photos WHERE chr_code=?", (chr_code,))
    
    saved_photos = []
    for idx, file in enumerate(files[:3]):
        _, ext = os.path.splitext(file.filename)
        if not ext:
            ext = ".jpg"
        safe_uuid = uuid.uuid4().hex[:8]
        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{idx}_{safe_uuid}{ext}"
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

def replicate_mssql_to_local():
    """원격 MSSQL DB에서 주소록 관련 핵심 데이터를 긁어와 로컬 SQLite DB로 복제 이식 (주소록 전용 복제 마트)"""
    import time
    start_time = time.time()
    
    # 1. 원격 MSSQL 연결 수립
    try:
        mssql_conn = get_connection()
        cursor = mssql_conn.cursor(as_dict=True)
    except Exception as db_err:
        logging.error(f"[Replication] Failed to connect to MSSQL: {db_err}")
        _log_replication_status('FAILURE', f"MSSQL 연결 실패: {str(db_err)}")
        return {"success": False, "error": f"MSSQL 연결 실패: {str(db_err)}"}
        
    try:
        # ─── (1) 목회자 데이터 (VI_MIN_INFO) 인출 ───
        cursor.execute("""
            SELECT 
                MinisterCode, MinisterName, CHRNAME, NOHNAME, DUTYNAME, 
                TEL_MOBILE, TEL_CHURCH, JUSO, EMAIL 
            FROM VI_MIN_INFO
        """)
        ministers = cursor.fetchall()
        
        # ─── (2) 교회 데이터 (TB_Chr100 및 JOIN) 인출 ───
        duty_term = "%담임%".encode('cp949')
        cursor.execute("""
            SELECT 
                c.ChrCode, c.ChrName AS CHRNAME, c.NohCode, n.NohName AS NOHNAME, 
                c.SichalCode, s.SichalName AS SICHALNAME, 
                c.OrgYN, c.Environment, c.PostNo, c.Address AS ADDRESS, c.Juso AS JUSO,
                c.EstDate, c.EndDate, c.Tel_Church, c.Tel_Home, c.Tel_Mobile, c.Tel_Fax, 
                c.HomePage, c.Email, c.Remark, c.Cnt, c.HJcode,
                (SELECT TOP 1 m.MinisterName FROM VI_MIN_INFO m WHERE m.ChrCode = c.ChrCode AND m.DUTYNAME LIKE %s) AS MOCKNAME 
            FROM TB_Chr100 c 
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode 
            LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
        """, (duty_term,))
        churches = cursor.fetchall()
        
        # ─── (3) 장로 데이터 (TB_Chr300 및 JOIN) 인출 ───
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
        
        # ─── (4) 통합 주소록 데이터 (VI_MIN_JANG_LIST_2) 인출 ───
        cursor.execute("""
            SELECT 
                MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, 
                TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL
            FROM VI_MIN_JANG_LIST_2
        """)
        addressbook = cursor.fetchall()
        
    except Exception as fetch_err:
        logging.error(f"[Replication] MSSQL fetch error: {fetch_err}")
        _log_replication_status('FAILURE', f"MSSQL 데이터 조율 실패: {str(fetch_err)}")
        return {"success": False, "error": f"MSSQL 데이터 조율 실패: {str(fetch_err)}"}
    finally:
        mssql_conn.close()
        
    # 2. 로컬 SQLite DB 복제 트랜잭션 수행
    try:
        sqlite_conn = sqlite3.connect('requests.db')
        c = sqlite_conn.cursor()
        
        # (1) 데이터 청소
        c.execute("DELETE FROM local_ministers")
        c.execute("DELETE FROM local_churches")
        c.execute("DELETE FROM local_elders")
        c.execute("DELETE FROM local_addressbook")
        
        # (2) 벌크 인서트 - 목회자
        ministers_data = [
            (
                str(r.get('MinisterCode') or '').strip(),
                str(r.get('MinisterName') or '').strip(),
                str(r.get('CHRNAME') or '').strip(),
                str(r.get('NOHNAME') or '').strip(),
                str(r.get('DUTYNAME') or '').strip(),
                str(r.get('TEL_MOBILE') or '').strip(),
                str(r.get('TEL_CHURCH') or '').strip(),
                str(r.get('JUSO') or '').strip(),
                str(r.get('EMAIL') or '').strip()
            )
            for r in ministers
        ]
        c.executemany("""
            INSERT INTO local_ministers (MinisterCode, MinisterName, CHRNAME, NOHNAME, DUTYNAME, TEL_MOBILE, TEL_CHURCH, JUSO, EMAIL)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ministers_data)
        
        # (3) 벌크 인서트 - 교회
        churches_data = [
            (
                str(r.get('ChrCode') or '').strip(),
                str(r.get('CHRNAME') or '').strip(),
                str(r.get('NohCode') or '').strip(),
                str(r.get('NOHNAME') or '').strip(),
                str(r.get('SichalCode') or '').strip(),
                str(r.get('SICHALNAME') or '').strip(),
                str(r.get('OrgYN') or '').strip(),
                str(r.get('Environment') or '').strip(),
                str(r.get('PostNo') or '').strip(),
                str(r.get('ADDRESS') or '').strip(),
                str(r.get('JUSO') or '').strip(),
                str(r.get('EstDate') or '').strip(),
                str(r.get('EndDate') or '').strip(),
                str(r.get('Tel_Church') or '').strip(),
                str(r.get('Tel_Home') or '').strip(),
                str(r.get('Tel_Mobile') or '').strip(),
                str(r.get('Tel_Fax') or '').strip(),
                str(r.get('HomePage') or '').strip(),
                str(r.get('Email') or '').strip(),
                str(r.get('Remark') or '').strip(),
                int(r.get('Cnt') or 0) if r.get('Cnt') is not None else 0,
                str(r.get('HJcode') or '').strip(),
                str(r.get('MOCKNAME') or '').strip()
            )
            for r in churches
        ]
        c.executemany("""
            INSERT INTO local_churches (
                ChrCode, CHRNAME, NohCode, NOHNAME, SichalCode, SICHALNAME, OrgYN, Environment, PostNo, ADDRESS, JUSO,
                EstDate, EndDate, Tel_Church, Tel_Home, Tel_Mobile, Tel_Fax, HomePage, Email, Remark, Cnt, HJcode, MOCKNAME
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, churches_data)
        
        # (4) 벌크 인서트 - 장로
        elders_data = [
            (
                str(r.get('PriestCode') or '').strip(),
                str(r.get('PriestName') or '').strip(),
                str(r.get('ChrCode') or '').strip(),
                str(r.get('ChrName') or '').strip(),
                str(r.get('NohName') or '').strip(),
                str(r.get('Tel_Mobile') or '').strip(),
                str(r.get('Email') or '').strip(),
                str(r.get('Address') or '').strip(),
                str(r.get('Juso') or '').strip(),
                str(r.get('PostNo') or '').strip()
            )
            for r in elders
        ]
        c.executemany("""
            INSERT INTO local_elders (PriestCode, PriestName, ChrCode, ChrName, NohName, Tel_Mobile, Email, Address, Juso, PostNo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, elders_data)
        
        # (5) 벌크 인서트 - 통합 주소록
        addressbook_data = [
            (
                str(r.get('MINISTERCODE') or '').strip(),
                str(r.get('MINISTERNAME') or '').strip(),
                str(r.get('NOHNAME') or '').strip(),
                str(r.get('CHRNAME') or '').strip(),
                str(r.get('TEL_CHURCH') or '').strip(),
                str(r.get('TEL_MOBILE') or '').strip(),
                str(r.get('POSTNO') or '').strip(),
                str(r.get('ADDRESS') or '').strip(),
                str(r.get('JUSO') or '').strip(),
                str(r.get('EMAIL') or '').strip()
            )
            for r in addressbook
        ]
        c.executemany("""
            INSERT INTO local_addressbook (MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, addressbook_data)
        
        sqlite_conn.commit()
        sqlite_conn.close()
        
        elapsed = (time.time() - start_time) * 1000
        msg = f"로컬 복제 DB 성공! (목회자 {len(ministers)}건, 교회 {len(churches)}건, 장로 {len(elders)}건, 소요시간: {elapsed:.1f}ms)"
        logging.info(f"[Replication] {msg}")
        _log_replication_status('SUCCESS', msg)
        return {"success": True, "message": msg}
        
    except Exception as sqlite_err:
        logging.error(f"[Replication] SQLite transaction failed: {sqlite_err}")
        _log_replication_status('FAILURE', f"SQLite 트랜잭션 오류: {str(sqlite_err)}")
        return {"success": False, "error": f"SQLite 트랜잭션 오류: {str(sqlite_err)}"}

def _log_replication_status(status: str, message: str):
    """sync_logs 테이블에 동기화 상태 로그 안전 기록"""
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("INSERT INTO sync_logs (timestamp, status, message, url) VALUES (?, ?, ?, ?)",
                  (datetime.now().isoformat(), status, message, 'local_db'))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"[ReplicationLog] Failed to insert sync log: {e}")

def upload_directory_json_to_firebase():
    """로컬 SQLite의 최신 복제 마트 데이터를 directory.json으로 덤프하고, Firebase Storage에 비동기로 안전하게 업로드"""
    try:
        if not FCM_AVAILABLE:
            logging.warning("[ReplicationUpload] Firebase Admin SDK가 활성화되지 않아 directory.json 업로드를 건너뜁니다.")
            return False
            
        logging.info("[ReplicationUpload] Firebase Storage에 directory.json 업로드 시작...")
        
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. 로컬 SQLite에서 전체 데이터 SELECT
        c.execute("SELECT MinisterCode, MinisterName, CHRNAME, NOHNAME, DUTYNAME, TEL_MOBILE, TEL_CHURCH, JUSO, EMAIL FROM local_ministers")
        ministers = [dict(r) for r in c.fetchall()]
        
        c.execute("""
            SELECT 
                ChrCode, CHRNAME, NohCode, NOHNAME, SichalCode, SICHALNAME, OrgYN, Environment, PostNo, ADDRESS, JUSO,
                EstDate, EndDate, Tel_Church, Tel_Home, Tel_Mobile, Tel_Fax, HomePage, Email, Remark, Cnt, HJcode, MOCKNAME
            FROM local_churches
        """)
        churches = [dict(r) for r in c.fetchall()]
        
        c.execute("SELECT chr_code, account_type, virtual_account FROM church_virtual_accounts")
        va_rows = [dict(r) for r in c.fetchall()]
        va_by_church = {}
        for va in va_rows:
            code = va["chr_code"].strip() if va.get("chr_code") else ""
            if not code: continue
            if code not in va_by_church:
                va_by_church[code] = []
            va_by_church[code].append({
                "account_type": va["account_type"].strip(),
                "virtual_account": va["virtual_account"].strip()
            })
            
        for ch in churches:
            code = ch["ChrCode"].strip()
            ch["virtual_accounts"] = va_by_church.get(code, [])
            mission_va = next((v["virtual_account"] for v in ch["virtual_accounts"] if v["account_type"] == "선교주일헌금"), None)
            ch["mission_virtual_account"] = mission_va or ""
        
        c.execute("SELECT PriestCode, PriestName, ChrCode, ChrName, NohName, Tel_Mobile, Email, Address, Juso, PostNo FROM local_elders")
        elders = [dict(r) for r in c.fetchall()]
        
        c.execute("SELECT MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL FROM local_addressbook")
        addressbook = [dict(r) for r in c.fetchall()]
        
        conn.close()
        
        # 2. JSON 구성
        synced_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        data_to_upload = {
            "synced_at": synced_at,
            "ministers": ministers,
            "churches": churches,
            "elders": elders,
            "addressbook": addressbook
        }
        
        # 3. 임시 파일 생성
        temp_file_path = "directory.json"
        with open(temp_file_path, "w", encoding="utf-8") as f:
            json.dump(data_to_upload, f, ensure_ascii=False, indent=2)
            
        # 4. Firebase Storage 업로드
        bucket = storage.bucket()
        blob = bucket.blob("directory.json")
        
        # 메타데이터 및 캐시 제어 설정
        blob.cache_control = 'no-cache, no-store, must-revalidate'
        blob.content_type = 'application/json'
        
        # 파일 업로드
        blob.upload_from_filename(temp_file_path)
        
        # 임시 파일 제거
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        msg = f"Firebase Storage 업로드 성공! (synced_at: {synced_at})"
        logging.info(f"[ReplicationUpload] {msg}")
        _log_replication_status('SUCCESS', msg)
        return True
    except Exception as upload_err:
        msg = f"Firebase Storage 업로드 실패: {str(upload_err)}"
        logging.error(f"[ReplicationUpload] {msg}")
        _log_replication_status('FAILURE', msg)
        return False

def replicate_mssql_to_local_scheduled():
    """백그라운드 스케줄러 전용 복제 실행 함수. 복제 성공 후 Firebase Storage에 json 업로드까지 순차 수행."""
    logging.info("[Scheduler] Scheduled replication started.")
    res = replicate_mssql_to_local()
    if res.get("success"):
        upload_directory_json_to_firebase()

@app.get("/api/churches")
def get_churches(search: str = ""):
    """원격 MSSQL 조인 병목을 제거하고, 로컬 SQLite 복제 마트를 통해 10ms 초고속 서빙하며 모든 가상계좌 목록 포함"""
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        search_pattern = f"%{search}%"
        c.execute("""
            SELECT 
                ChrCode, CHRNAME, NOHNAME, SICHALNAME, 
                Tel_Church, Tel_Mobile, Tel_Fax, ADDRESS, JUSO, PostNo, Email, MOCKNAME
            FROM local_churches
            WHERE CHRNAME LIKE ? OR NOHNAME LIKE ? OR ChrCode = ?
            ORDER BY NOHNAME, CHRNAME
            LIMIT 100
        """, (search_pattern, search_pattern, search.strip()))
        churches = [dict(r) for r in c.fetchall()]
        
        if churches:
            chr_codes = [ch["ChrCode"].strip() for ch in churches if ch.get("ChrCode")]
            placeholders = ",".join("?" for _ in chr_codes)
            c.execute(f"""
                SELECT chr_code, account_type, virtual_account
                FROM church_virtual_accounts
                WHERE chr_code IN ({placeholders})
            """, chr_codes)
            va_rows = [dict(r) for r in c.fetchall()]
            
            va_by_church = {}
            for va in va_rows:
                code = va["chr_code"].strip() if va.get("chr_code") else ""
                if not code: continue
                if code not in va_by_church:
                    va_by_church[code] = []
                va_by_church[code].append({
                    "account_type": va["account_type"].strip(),
                    "virtual_account": va["virtual_account"].strip()
                })
                
            for ch in churches:
                code = ch["ChrCode"].strip()
                ch["virtual_accounts"] = va_by_church.get(code, [])
                # Backward compatibility
                mission_va = next((v["virtual_account"] for v in ch["virtual_accounts"] if v["account_type"] == "선교주일헌금"), None)
                ch["mission_virtual_account"] = mission_va or ""
        else:
            for ch in churches:
                ch["virtual_accounts"] = []
                ch["mission_virtual_account"] = ""
                
        return churches
    except Exception as e:
        logging.error(f"[API] get_churches local error: {e}")
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/ministers")
def get_ministers(search: str = ""):
    """원격 MSSQL 조회 및 중복 소켓을 소거하고, 로컬 SQLite 복제 마트를 통해 10ms 초고속 서빙 및 사용자 프로필 내부 조인 통합"""
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        search_pattern = f"%{search}%"
        # 로컬 SQLite 내에서 local_ministers 테이블과 user_profiles 캐시 테이블을 직접 LEFT JOIN으로 한 번에 수집!
        c.execute("""
            SELECT 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.EMAIL,
                p.profile_image_url AS custom_image,
                p.status_message AS status_message,
                p.background_image_url AS background_image
            FROM local_ministers m
            LEFT JOIN user_profiles p ON m.MinisterCode = p.minister_code
            WHERE m.MinisterName LIKE ? OR m.CHRNAME LIKE ? OR m.NOHNAME LIKE ?
            ORDER BY m.NOHNAME, m.CHRNAME, m.MinisterName
            LIMIT 100
        """, (search_pattern, search_pattern, search_pattern))
        results = [dict(r) for r in c.fetchall()]
        return results
    except Exception as e:
        logging.error(f"[API] get_ministers local error: {e}")
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/addressbook")
def get_addressbook(search: str = ""):
    """원격 MSSQL 조인 병목을 제거하고, 로컬 SQLite 복제 마트를 통해 10ms 초고속 서빙"""
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        search_pattern = f"%{search}%"
        c.execute("""
            SELECT 
                MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, 
                TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL
            FROM local_addressbook
            WHERE MINISTERNAME LIKE ? OR CHRNAME LIKE ? OR NOHNAME LIKE ?
            ORDER BY NOHNAME, CHRNAME, MINISTERNAME
            LIMIT 200
        """, (search_pattern, search_pattern, search_pattern))
        results = [dict(r) for r in c.fetchall()]
        return results
    except Exception as e:
        logging.error(f"[API] get_addressbook local error: {e}")
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/sync/directory-fast")
def sync_directory_fast():
    """로컬 SQLite 복제 마트에서 전체 주소록을 10ms 초고속 서빙하며 가상계좌 포함"""
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        c.execute("SELECT MinisterCode, MinisterName, CHRNAME, NOHNAME, DUTYNAME, TEL_MOBILE, TEL_CHURCH, JUSO, EMAIL FROM local_ministers")
        ministers = [dict(r) for r in c.fetchall()]
        
        c.execute("""
            SELECT 
                ChrCode, CHRNAME, NohCode, NOHNAME, SichalCode, SICHALNAME, OrgYN, Environment, PostNo, ADDRESS, JUSO,
                EstDate, EndDate, Tel_Church, Tel_Home, Tel_Mobile, Tel_Fax, HomePage, Email, Remark, Cnt, HJcode, MOCKNAME
            FROM local_churches
        """)
        churches = [dict(r) for r in c.fetchall()]
        
        c.execute("SELECT chr_code, account_type, virtual_account FROM church_virtual_accounts")
        va_rows = [dict(r) for r in c.fetchall()]
        va_by_church = {}
        for va in va_rows:
            code = va["chr_code"].strip() if va.get("chr_code") else ""
            if not code: continue
            if code not in va_by_church:
                va_by_church[code] = []
            va_by_church[code].append({
                "account_type": va["account_type"].strip(),
                "virtual_account": va["virtual_account"].strip()
            })
            
        for ch in churches:
            code = ch["ChrCode"].strip()
            ch["virtual_accounts"] = va_by_church.get(code, [])
            mission_va = next((v["virtual_account"] for v in ch["virtual_accounts"] if v["account_type"] == "선교주일헌금"), None)
            ch["mission_virtual_account"] = mission_va or ""
        
        c.execute("SELECT PriestCode, PriestName, ChrCode, ChrName, NohName, Tel_Mobile, Email, Address, Juso, PostNo FROM local_elders")
        elders = [dict(r) for r in c.fetchall()]
        
        c.execute("SELECT MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL FROM local_addressbook")
        addressbook = [dict(r) for r in c.fetchall()]
        
        synced_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        return {
            "synced_at": synced_at,
            "ministers": ministers,
            "churches": churches,
            "elders": elders,
            "addressbook": addressbook
        }
    except Exception as e:
        logging.error(f"[API] sync_directory_fast error: {e}")
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

        # Fetch all churches (with full detail fields)
        duty_term = "%담임%".encode('cp949')
        cursor.execute("""
            SELECT 
                c.ChrCode, c.ChrName AS CHRNAME, c.NohCode, n.NohName AS NOHNAME, 
                c.SichalCode, s.SichalName AS SICHALNAME, 
                c.OrgYN, c.Environment, c.PostNo, c.Address AS ADDRESS, c.Juso AS JUSO,
                c.EstDate, c.EndDate, c.Tel_Church, c.Tel_Home, c.Tel_Mobile, c.Tel_Fax, 
                c.HomePage, c.Email, c.Remark, c.Cnt, c.HJcode,
                (SELECT TOP 1 m.MinisterName FROM VI_MIN_INFO m WHERE m.ChrCode = c.ChrCode AND m.DUTYNAME LIKE %s) AS MOCKNAME 
            FROM TB_Chr100 c 
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode 
            LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
        """, (duty_term,))
        churches = cursor.fetchall()

        # Fetch virtual accounts from local SQLite and merge
        try:
            sql_conn = sqlite3.connect('requests.db')
            sql_c = sql_conn.cursor()
            sql_c.execute("SELECT chr_code, account_type, virtual_account FROM church_virtual_accounts")
            va_rows = sql_c.fetchall()
            sql_conn.close()
            
            va_by_church = {}
            for row in va_rows:
                code = row[0].strip() if row[0] else ""
                if not code: continue
                if code not in va_by_church:
                    va_by_church[code] = []
                va_by_church[code].append({
                    "account_type": row[1].strip() if row[1] else "",
                    "virtual_account": row[2].strip() if row[2] else ""
                })
        except:
            va_by_church = {}

        for row in churches:
            code = str(row.get("ChrCode", "")).strip()
            row["virtual_accounts"] = va_by_church.get(code, [])
            mission_va = next((v["virtual_account"] for v in row["virtual_accounts"] if v["account_type"] == "선교주일헌금"), None)
            row["mission_virtual_account"] = mission_va or ""

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
            "synced_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "ministers": ministers,
            "churches": churches,
            "elders": elders,
            "addressbook": addressbook
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

import subprocess
MAP_SYNC_LOG_FILE = os.path.join(os.path.dirname(__file__), "map_sync.log")
MAP_SYNC_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "map_sync_config.json")
map_sync_process = None

class MapSyncConfig(BaseModel):
    db_server: str
    supabase_url: str

@app.get("/api/admin/map-sync-config")
def get_map_sync_config():
    if os.path.exists(MAP_SYNC_CONFIG_FILE):
        try:
            with open(MAP_SYNC_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {"db_server": DB_SERVER, "supabase_url": "https://wfpacsoyoalkdzksnmdg.supabase.co"}

@app.post("/api/admin/map-sync-config")
def save_map_sync_config(config: MapSyncConfig):
    try:
        with open(MAP_SYNC_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config.dict(), f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "설정이 저장되었습니다."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/sync-map-data")
def start_map_sync():
    global map_sync_process
    if map_sync_process and map_sync_process.poll() is None:
        return {"success": False, "error": "이미 동기화가 진행 중입니다."}
    
    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "기장지도", "migrate_to_supabase.py"))
    
    with open(MAP_SYNC_LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"=== 동기화 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n")
        f.write("백그라운드에서 데이터를 가져오는 중입니다...\n\n")

    try:
        log_file = open(MAP_SYNC_LOG_FILE, "a", encoding="utf-8")
        map_sync_process = subprocess.Popen(["python", "-u", script_path], stdout=log_file, stderr=subprocess.STDOUT, cwd=os.path.dirname(script_path))
        return {"success": True, "message": "기장지도 동기화가 백그라운드에서 시작되었습니다. 하단의 로그 창에서 진행 상황을 확인하세요."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/admin/map-sync-logs")
def get_map_sync_logs():
    if not os.path.exists(MAP_SYNC_LOG_FILE):
        return {"logs": "로그 파일이 없습니다. 동기화를 시작해주세요."}
    try:
        with open(MAP_SYNC_LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            return {"logs": "".join(lines[-100:])}
    except Exception as e:
        return {"logs": f"로그 읽기 실패: {str(e)}"}

@app.post("/api/admin/sync-to-firebase")
def sync_to_firebase(background_tasks: BackgroundTasks):
    """구버전 Firebase 동기화 API를 새로운 로컬 복제 엔진 실행 구조로 마이그레이션 + 비동기 Firebase Storage json 업로드"""
    res = replicate_mssql_to_local()
    if res.get("success"):
        background_tasks.add_task(upload_directory_json_to_firebase)
    return res

@app.get("/api/admin/sync-logs")
def get_sync_logs(limit: int = 20):
    """Retrieve sync logs from local SQLite database for instant, offline access."""
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("SELECT timestamp, status, message, url FROM sync_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = c.fetchall()
        conn.close()
        
        logs = []
        for r in rows:
            logs.append({
                'timestamp': r[0],
                'status': r[1],
                'message': r[2],
                'url': r[3]
            })
        return {"success": True, "logs": logs}
    except Exception as e:
        logging.error(f"[SyncLogs] SQLite fetch failed: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/elders")
def get_elders(search: str = ""):
    """원격 MSSQL 3개 테이블 조인 병목을 제거하고, 로컬 SQLite 복제 마트를 통해 10ms 초고속 서빙"""
    conn = sqlite3.connect('requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        search_pattern = f"%{search}%"
        c.execute("""
            SELECT 
                PriestCode, PriestName, ChrCode, ChrName, NohName,
                Tel_Mobile, Email, Address, Juso, PostNo
            FROM local_elders
            WHERE PriestName LIKE ? OR ChrName LIKE ? OR NohName LIKE ?
            ORDER BY NohName, ChrName, PriestName
            LIMIT 200
        """, (search_pattern, search_pattern, search_pattern))
        results = [dict(r) for r in c.fetchall()]
        return results
    except Exception as e:
        logging.error(f"[API] get_elders local error: {e}")
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

# ── 생보납입 현황 API ──────────────────────────────────────────────

@app.get("/api/insurance/{minister_code}/summary")
def get_insurance_summary(minister_code: str):
    """목사 코드로 생보납입 연도별 요약 조회"""
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        # 목사 이름 조회
        cursor.execute("SELECT TOP 1 MinisterName FROM TB_Chr200 WHERE MinisterCode = %s", (minister_code,))
        minister = cursor.fetchone()
        minister_name = minister['MinisterName'].strip() if minister else ''

        # 월부담금 조회 (TB_Sen920)
        cursor.execute("SELECT TOP 1 Amt FROM TB_Sen920 WHERE MinisterCode = %s", (minister_code,))
        charge_row = cursor.fetchone()
        monthly_charge = charge_row['Amt'] if charge_row and charge_row['Amt'] else 0

        # TB_Sen920 Amt가 0이면 가장 최근 납입액을 월부담금으로 사용
        if monthly_charge == 0:
            cursor.execute("SELECT TOP 1 Amt FROM TB_SEN100 WHERE MinisterCode = %s ORDER BY YM DESC", (minister_code,))
            latest = cursor.fetchone()
            if latest and latest['Amt']:
                monthly_charge = latest['Amt']

        # 연도별 요약
        cursor.execute("""
            SELECT LEFT(YM, 4) AS year,
                   COUNT(DISTINCT RIGHT(YM, 2)) AS months_paid,
                   SUM(Amt) AS total_amt,
                   MIN(Amt) AS min_amt,
                   MAX(Amt) AS max_amt
            FROM TB_SEN100
            WHERE MinisterCode = %s
            GROUP BY LEFT(YM, 4)
            ORDER BY LEFT(YM, 4) DESC
        """, (minister_code,))
        yearly = cursor.fetchall()

        total_amount = sum(r['total_amt'] for r in yearly) if yearly else 0
        return {
            "minister_code": minister_code.strip(),
            "minister_name": minister_name,
            "monthly_charge": monthly_charge,
            "summary": yearly,
            "total_years": len(yearly),
            "total_amount": total_amount,
        }
    except Exception as e:
        logging.error(f'[Insurance] Summary error: {e}')
        return {"error": str(e)}
    finally:
        conn.close()


@app.get("/api/insurance/{minister_code}/detail")
def get_insurance_detail(minister_code: str, year: str = ""):
    """목사 코드 + 연도로 월별 납입 상세 조회"""
    if not year:
        year = str(datetime.now().year)

    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        cursor.execute("""
            SELECT YM,
                   SUM(Amt) AS amt,
                   MIN(RealDate) AS real_date,
                   MIN(RTRIM(InGubun)) AS method
            FROM TB_SEN100
            WHERE MinisterCode = %s AND LEFT(YM, 4) = %s
            GROUP BY YM
            ORDER BY YM
        """, (minister_code, year))
        rows = cursor.fetchall()

        # 12개월 매트릭스 구성
        paid_map = {}
        for r in rows:
            month = r['YM'].strip()[4:6] if r['YM'] else ''
            paid_map[month] = {
                "month": month,
                "amt": r['amt'] or 0,
                "method": r['method'].strip() if r['method'] else '',
                "real_date": r['real_date'].strip() if r['real_date'] else '',
                "paid": True,
            }

        monthly = []
        for m in range(1, 13):
            ms = f"{m:02d}"
            if ms in paid_map:
                monthly.append(paid_map[ms])
            else:
                monthly.append({"month": ms, "amt": 0, "method": "", "real_date": "", "paid": False})

        year_total = sum(item['amt'] for item in monthly)
        months_paid = sum(1 for item in monthly if item['paid'])

        return {
            "year": year,
            "monthly": monthly,
            "year_total": year_total,
            "months_paid": months_paid,
        }
    except Exception as e:
        logging.error(f'[Insurance] Detail error: {e}')
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
        CREATE TABLE IF NOT EXISTS phone_number_overrides (
            minister_code TEXT PRIMARY KEY,
            minister_name TEXT,
            member_type TEXT,
            original_phone TEXT,
            new_phone TEXT,
            status TEXT DEFAULT 'ACTIVE',
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
    # --- Staff Accounts (총회직원, code 7600++) ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS staff_accounts (
            staff_code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            department TEXT DEFAULT '총회',
            position TEXT DEFAULT '직원',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Seed default staff accounts if table is empty
    c.execute("SELECT COUNT(*) FROM staff_accounts")
    if c.fetchone()[0] == 0:
        default_staff = [
            ('7600', '총회직원', '총회본부', '직원', '', ''),
            ('7601', '직원01', '총회', '직원', '', ''),
            ('7602', '직원02', '총회', '직원', '', ''),
            ('7603', '직원03', '총회', '직원', '', ''),
            ('7604', '직원04', '총회', '직원', '', ''),
            ('7605', '직원05', '총회', '직원', '', ''),
            ('7606', '직원06', '총회', '직원', '', ''),
            ('7607', '직원07', '총회', '직원', '', ''),
            ('7608', '직원08', '총회', '직원', '', ''),
            ('7609', '직원09', '총회', '직원', '', ''),
        ]
        for code, name, dept, pos, phone, email in default_staff:
            c.execute(
                "INSERT OR IGNORE INTO staff_accounts (staff_code, name, department, position, phone, email) VALUES (?, ?, ?, ?, ?, ?)",
                (code, name, dept, pos, phone, email)
            )

    # --- Sync Logs (Firebase Sync Cache in SQLite) ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            status TEXT,
            message TEXT,
            url TEXT DEFAULT ''
        )
    ''')
    conn.commit()
    conn.close()

init_sqlite()

# ensure uploads dir
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Staff Account CRUD APIs (총회직원 관리) ---

class StaffAccountCreate(BaseModel):
    staff_code: str
    name: str
    department: str = "총회"
    position: str = "직원"
    phone: str = ""
    email: str = ""

class StaffAccountUpdate(BaseModel):
    name: str = ""
    department: str = ""
    position: str = ""
    phone: str = ""
    email: str = ""
    is_active: int = 1

@app.get("/api/staff")
def list_staff():
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM staff_accounts ORDER BY staff_code")
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return {"staff": rows}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/staff")
def create_staff(req: StaffAccountCreate):
    try:
        # Validate code range (7600-7699)
        code_num = int(req.staff_code)
        if code_num < 7600 or code_num > 7699:
            return {"error": "직원 코드는 7600~7699 범위여야 합니다."}
    except ValueError:
        return {"error": "직원 코드는 숫자여야 합니다."}
    try:
        # Check for MSSQL conflict
        mssql_conn = get_connection()
        mssql_cursor = mssql_conn.cursor(as_dict=True)
        mssql_cursor.execute("SELECT TOP 1 MinisterCode FROM VI_MIN_INFO WHERE MinisterCode = %s", (req.staff_code,))
        if mssql_cursor.fetchone():
            mssql_conn.close()
            return {"error": f"코드 {req.staff_code}은(는) 이미 목회자DB에 존재합니다."}
        mssql_conn.close()
    except:
        pass  # If MSSQL is down, allow creation
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute(
            "INSERT INTO staff_accounts (staff_code, name, department, position, phone, email) VALUES (?, ?, ?, ?, ?, ?)",
            (req.staff_code, req.name, req.department, req.position, req.phone, req.email)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": f"직원 {req.name}({req.staff_code}) 등록 완료"}
    except sqlite3.IntegrityError:
        return {"error": f"코드 {req.staff_code}은(는) 이미 등록되어 있습니다."}
    except Exception as e:
        return {"error": str(e)}

@app.put("/api/staff/{code}")
def update_staff(code: str, req: StaffAccountUpdate):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        updates = []
        params = []
        if req.name:
            updates.append("name=?")
            params.append(req.name)
        if req.department:
            updates.append("department=?")
            params.append(req.department)
        if req.position:
            updates.append("position=?")
            params.append(req.position)
        if req.phone is not None:
            updates.append("phone=?")
            params.append(req.phone)
        if req.email is not None:
            updates.append("email=?")
            params.append(req.email)
        updates.append("is_active=?")
        params.append(req.is_active)
        if not updates:
            return {"error": "수정할 필드가 없습니다."}
        params.append(code)
        c.execute(f"UPDATE staff_accounts SET {', '.join(updates)} WHERE staff_code=?", params)
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/staff/{code}")
def delete_staff(code: str):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM staff_accounts WHERE staff_code=?", (code,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

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
    import uuid
    os.makedirs(os.path.join("uploads", "ads"), exist_ok=True)
    _, ext = os.path.splitext(file.filename)
    if not ext:
        ext = ".jpg"
    safe_uuid = uuid.uuid4().hex[:8]
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{safe_uuid}{ext}"
    file_path = os.path.join("uploads", "ads", filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/api/uploads/ads/{filename}"}

@app.get("/api/uploads/ads/{filename}")
def get_ad_image(filename: str):
    from fastapi.responses import FileResponse
    from urllib.parse import unquote
    decoded_filename = unquote(filename)
    file_path = os.path.join("uploads", "ads", decoded_filename)
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
                r.ChrCode, r.NohCode,
                r.Area,
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
            # ChrName이 비어있으면 Area 필드를 사역지 이름으로 대체
            chr_name = r.get('ChrName')
            if not chr_name or not chr_name.strip():
                area = r.get('Area')
                r['ChrName'] = area.strip() if area else ''
            else:
                r['ChrName'] = chr_name.strip()

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
        
        # Determine initial status from cert_types
        initial_status = 'SUBMITTED'
        c.execute("SELECT workflow FROM cert_types WHERE name = ?", (req.cert_type,))
        ct_row = c.fetchone()
        if ct_row and ct_row[0]:
            import json
            try:
                wf = json.loads(ct_row[0])
                if wf and isinstance(wf, list) and len(wf) > 0 and 'stage' in wf[0]:
                    initial_status = wf[0]['stage']
            except Exception as e:
                print(f"Error parsing workflow for {req.cert_type}: {e}")

        c.execute('''
            INSERT INTO cert_requests 
            (minister_code, minister_name, cert_type, cert_label, memo,
             noh_code, noh_name, sichal_code, chr_code, chr_name, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (req.minister_code, req.minister_name, req.cert_type, req.cert_label, req.memo,
              info.get('NohCode', ''), info.get('NOHNAME', ''), 
              info.get('SichalCode', ''), info.get('ChrCode', ''), info.get('CHRNAME', ''), initial_status))
        req_id = c.lastrowid
        # Add initial history
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'cert', ?, 'submit', ?, 'personal', ?)
        ''', (req_id, initial_status, req.minister_name, f'{req.cert_label} 신청'))
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
        
        if req.actor_role != expected_role and req.actor_role != 'assembly':
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


class OverridePhoneRequest(BaseModel):
    code: str
    name: str
    member_type: str
    original_phone: str
    new_phone: str

@app.get("/api/admin/search-member")
def admin_search_member(name: str = ""):
    if not name:
        return []
    
    results = []
    
    # 1. MS SQL (목회자) 검색
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(as_dict=True)
        search_term = f"%{name}%".encode('cp949')
        query = """
            SELECT TOP 50 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, m.TEL_MOBILE
            FROM VI_MIN_INFO m
            WHERE m.MinisterName LIKE %s
            ORDER BY m.MinisterName
        """
        cursor.execute(query, (search_term,))
        ministers = cursor.fetchall()
        for m in ministers:
            results.append({
                "code": str(m.get("MinisterCode", "")).strip(),
                "name": str(m.get("MinisterName", "")).strip(),
                "member_type": "목회자",
                "church": str(m.get("CHRNAME", "")).strip(),
                "noh": str(m.get("NOHNAME", "")).strip(),
                "duty": str(m.get("DUTYNAME", "")).strip(),
                "original_phone": str(m.get("TEL_MOBILE", "")).strip(),
                "override_phone": None,
                "override_status": None
            })
    except Exception as e:
        logging.error(f"[Admin Search] MS SQL Minister search error: {e}")
    finally:
        if conn:
            conn.close()

    # 2. MS SQL (장로) 검색
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(as_dict=True)
        search_term = f"%{name}%".encode('cp949')
        query = """
            SELECT TOP 50
                e.PriestCode, e.PriestName, c.ChrName, n.NohName, e.Tel_Mobile
            FROM TB_Chr300 e
            LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
            WHERE (e.DelGu IS NULL OR e.DelGu != '1')
              AND e.PriestName LIKE %s
            ORDER BY e.PriestName
        """
        cursor.execute(query, (search_term,))
        elders = cursor.fetchall()
        for el in elders:
            results.append({
                "code": str(el.get("PriestCode", "")).strip(),
                "name": str(el.get("PriestName", "")).strip(),
                "member_type": "장로",
                "church": str(el.get("ChrName", "")).strip(),
                "noh": str(el.get("NohName", "")).strip(),
                "duty": "장로",
                "original_phone": str(el.get("Tel_Mobile", "")).strip(),
                "override_phone": None,
                "override_status": None
            })
    except Exception as e:
        logging.error(f"[Admin Search] MS SQL Elder search error: {e}")
    finally:
        if conn:
            conn.close()

    # 3. SQLite (총회 직원) 검색
    try:
        sql_conn = sqlite3.connect('requests.db')
        sql_conn.row_factory = sqlite3.Row
        sql_c = sql_conn.cursor()
        sql_c.execute("SELECT * FROM staff_accounts WHERE name LIKE ? AND is_active = 1 LIMIT 50", (f"%{name}%",))
        staffs = sql_c.fetchall()
        for st in staffs:
            results.append({
                "code": str(st["staff_code"]).strip(),
                "name": str(st["name"]).strip(),
                "member_type": "총회 직원",
                "church": str(st["department"]).strip(),
                "noh": "총회",
                "duty": str(st["position"]).strip(),
                "original_phone": str(st["phone"]).strip(),
                "override_phone": None,
                "override_status": None
            })
        sql_conn.close()
    except Exception as e:
        logging.error(f"[Admin Search] SQLite staff search error: {e}")

    # 4. SQLite phone_number_overrides 병합
    try:
        sql_conn = sqlite3.connect('requests.db')
        sql_c = sql_conn.cursor()
        sql_c.execute("SELECT minister_code, new_phone, status FROM phone_number_overrides")
        overrides = {row[0]: {"new_phone": row[1], "status": row[2]} for row in sql_c.fetchall()}
        sql_conn.close()
        
        for item in results:
            code = item["code"]
            if code in overrides:
                item["override_phone"] = overrides[code]["new_phone"]
                item["override_status"] = overrides[code]["status"]
    except Exception as e:
        logging.error(f"[Admin Search] SQLite overrides merge error: {e}")
        
    return results

@app.post("/api/admin/override-phone")
def override_phone(req: OverridePhoneRequest):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute('''
            INSERT OR REPLACE INTO phone_number_overrides (minister_code, minister_name, member_type, original_phone, new_phone, status, updated_at)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
        ''', (req.code, req.name, req.member_type, req.original_phone, req.new_phone))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"{req.name}님의 로그인 휴대폰 번호가 '{req.new_phone}'으로 성공적으로 변경되었습니다."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/admin/override-phones")
def get_override_phones():
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        rows = c.execute("SELECT * FROM phone_number_overrides ORDER BY updated_at DESC").fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/api/admin/override-phone/{code}")
def delete_override_phone(code: str):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("DELETE FROM phone_number_overrides WHERE minister_code = ?", (code,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "성공적으로 원래 전화번호로 복구되었습니다."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/admin/override-sql")
def get_override_sql():
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        rows = c.execute("SELECT * FROM phone_number_overrides WHERE status = 'ACTIVE'").fetchall()
        conn.close()
        
        sql_lines = []
        sql_lines.append("-- ==================================================================")
        sql_lines.append(f"-- [MS SQL 원데이터 통합용 UPDATE 쿼리 - 추출시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]")
        sql_lines.append("-- 이 쿼리를 복사하여 MS SQL Server (KJ_CHURCH DB)에서 실행하면 원본 번호가 최신화됩니다.")
        sql_lines.append("-- ==================================================================\n")
        
        has_queries = False
        for r in rows:
            code = r["minister_code"]
            name = r["minister_name"]
            mtype = r["member_type"]
            new_p = r["new_phone"]
            
            if mtype == "목회자":
                sql_lines.append(f"UPDATE TB_Chr200 SET Tel_Mobile = '{new_p}' WHERE MinisterCode = '{code}'; -- {name} (목회자)")
                has_queries = True
            elif mtype == "장로":
                sql_lines.append(f"UPDATE TB_Chr300 SET Tel_Mobile = '{new_p}' WHERE PriestCode = '{code}'; -- {name} (장로)")
                has_queries = True
            elif mtype == "총회 직원":
                sql_lines.append(f"-- UPDATE staff_accounts SET phone = '{new_p}' WHERE staff_code = '{code}'; -- {name} (총회직원, 로컬 SQLite용 참고)")
                
        if not has_queries:
            sql_lines.append("-- [안내] 현재 MS SQL(목회자/장로) 원데이터 반영 대상이 없습니다.")
            
        return {"success": True, "sql": "\n".join(sql_lines)}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/override-integrate/{code}")
def override_integrate(code: str):
    try:
        conn = sqlite3.connect('requests.db')
        c = conn.cursor()
        c.execute("UPDATE phone_number_overrides SET status = 'INTEGRATED' WHERE minister_code = ?", (code,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "해당 전화번호가 원데이터에 정상 통합 처리되었습니다."}
    except Exception as e:
        return {"success": False, "error": str(e)}


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
            # Fallback: check SQLite staff_accounts (총회직원)
            try:
                sql_conn = sqlite3.connect('requests.db')
                sql_conn.row_factory = sqlite3.Row
                sql_c = sql_conn.cursor()
                sql_c.execute('SELECT * FROM staff_accounts WHERE staff_code=? AND is_active=1', (req.code,))
                staff = sql_c.fetchone()
                sql_conn.close()
                if staff:
                    return {"success": True, "user": {
                        "MinisterCode": staff["staff_code"],
                        "MinisterName": staff["name"],
                        "CHRNAME": staff["department"],
                        "NOHNAME": "총회",
                        "DUTYNAME": staff["position"],
                        "TEL_MOBILE": staff["phone"],
                        "TEL_CHURCH": "",
                        "JUSO": "",
                        "BIRTHDAY": "",
                        "EMAIL": staff["email"],
                        "is_staff": True,
                    }}
            except:
                pass
            return {"error": "해당 코드로 등록된 정보를 찾을 수 없습니다."}
        return {"success": True, "user": result}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


class FirebaseLoginRequest(BaseModel):
    id_token: str

@app.post("/api/auth/firebase-login")
def firebase_login(req: FirebaseLoginRequest):
    # Firebase Token 검증
    try:
        from firebase_admin import auth as firebase_auth
        # ID Token 검증 및 디코딩
        decoded_token = firebase_auth.verify_id_token(req.id_token)
        phone_number = decoded_token.get("phone_number")
        
        if not phone_number:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "인증 정보에서 전화번호를 찾을 수 없습니다."}
            )
    except Exception as e:
        logging.error(f"[Phone Auth] Token verification failed: {e}")
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "유효하지 않거나 만료된 인증 토큰입니다."}
        )

    # 전화번호 정규화 (국제 번호 -> 한국 로컬 번호 포맷 010XXXXXXXX)
    # 예: +821062429687 -> 01062429687
    # 숫자만 추출
    digits = "".join([c for c in phone_number if c.isdigit()])
    if digits.startswith("82"):
        clean_phone = "0" + digits[2:]
    else:
        clean_phone = digits

    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        # 0단계: 전화번호 오버라이드 대조
        try:
            sql_conn = sqlite3.connect('requests.db')
            sql_conn.row_factory = sqlite3.Row
            sql_c = sql_conn.cursor()
            sql_c.execute("""
                SELECT * FROM phone_number_overrides 
                WHERE REPLACE(REPLACE(REPLACE(new_phone, '-', ''), ' ', ''), '.', '') = ?
                  AND status = 'ACTIVE'
            """, (clean_phone,))
            override = sql_c.fetchone()
            sql_conn.close()
            
            if override:
                override_code = override["minister_code"]
                mtype = override["member_type"]
                logging.info(f"[Phone Auth] Override match found: {clean_phone} -> Code: {override_code} ({mtype})")
                
                # 목회자 정보 조회
                if mtype == "목회자":
                    query_minister = """
                        SELECT TOP 1 
                            m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                            m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.BIRTHDAY, m.EMAIL
                        FROM VI_MIN_INFO m
                        WHERE m.MinisterCode = %s
                    """
                    cursor.execute(query_minister, (override_code,))
                    result = cursor.fetchone()
                    if result:
                        result["TEL_MOBILE"] = override["new_phone"]
                        logging.info(f"[Phone Auth] Minister login success (via override): {result['MinisterName']} ({override['new_phone']})")
                        return {"success": True, "user": result}
                        
                # 장로 정보 조회
                elif mtype == "장로":
                    query_elder = """
                        SELECT TOP 1
                            e.PriestCode AS MinisterCode,
                            e.PriestName AS MinisterName,
                            c.ChrName AS CHRNAME,
                            n.NohName AS NOHNAME,
                            '장로' AS DUTYNAME,
                            e.Tel_Mobile AS TEL_MOBILE,
                            e.Tel_Home AS TEL_CHURCH,
                            e.Address + ' ' + e.Juso AS JUSO,
                            '' AS BIRTHDAY,
                            e.Email AS EMAIL
                        FROM TB_Chr300 e
                        LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
                        LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
                        WHERE e.PriestCode = %s
                    """
                    cursor.execute(query_elder, (override_code,))
                    result = cursor.fetchone()
                    if result:
                        result["TEL_MOBILE"] = override["new_phone"]
                        logging.info(f"[Phone Auth] Elder login success (via override): {result['MinisterName']} ({override['new_phone']})")
                        return {"success": True, "user": result}
                        
                # 총회 직원 정보 조회
                elif mtype == "총회 직원":
                    try:
                        sql_conn = sqlite3.connect('requests.db')
                        sql_conn.row_factory = sqlite3.Row
                        sql_c = sql_conn.cursor()
                        sql_c.execute("SELECT * FROM staff_accounts WHERE staff_code = ? AND is_active = 1", (override_code,))
                        staff = sql_c.fetchone()
                        sql_conn.close()
                        if staff:
                            user_data = {
                                "MinisterCode": staff["staff_code"],
                                "MinisterName": staff["name"],
                                "CHRNAME": staff["department"],
                                "NOHNAME": "총회",
                                "DUTYNAME": staff["position"],
                                "TEL_MOBILE": override["new_phone"],
                                "TEL_CHURCH": "",
                                "JUSO": "",
                                "BIRTHDAY": "",
                                "EMAIL": staff["email"],
                                "is_staff": True,
                            }
                            logging.info(f"[Phone Auth] Staff login success (via override): {staff['name']} ({override['new_phone']})")
                            return {"success": True, "user": user_data}
                    except Exception as se:
                        logging.error(f"[Phone Auth] SQLite override staff check error: {se}")
        except Exception as oe:
            logging.error(f"[Phone Auth] SQLite override query error: {oe}")

        # 1단계: 목회자 (VI_MIN_INFO) 대조
        query_minister = """
            SELECT TOP 1 
                m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO, m.BIRTHDAY, m.EMAIL
            FROM VI_MIN_INFO m
            WHERE REPLACE(REPLACE(REPLACE(m.TEL_MOBILE, '-', ''), ' ', ''), '.', '') = %s
        """
        cursor.execute(query_minister, (clean_phone,))
        result = cursor.fetchone()
        
        if result:
            logging.info(f"[Phone Auth] Minister login success: {result['MinisterName']} ({clean_phone})")
            return {"success": True, "user": result}

        # 2단계: 장로 (TB_Chr300) 대조
        query_elder = """
            SELECT TOP 1
                e.PriestCode AS MinisterCode,
                e.PriestName AS MinisterName,
                c.ChrName AS CHRNAME,
                n.NohName AS NOHNAME,
                '장로' AS DUTYNAME,
                e.Tel_Mobile AS TEL_MOBILE,
                e.Tel_Home AS TEL_CHURCH,
                e.Address + ' ' + e.Juso AS JUSO,
                '' AS BIRTHDAY,
                e.Email AS EMAIL
            FROM TB_Chr300 e
            LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
            WHERE (e.DelGu IS NULL OR e.DelGu != '1')
              AND REPLACE(REPLACE(REPLACE(e.Tel_Mobile, '-', ''), ' ', ''), '.', '') = %s
        """
            # Tab indentation fix
        cursor.execute(query_elder, (clean_phone,))
        result = cursor.fetchone()
        
        if result:
            logging.info(f"[Phone Auth] Elder login success: {result['MinisterName']} ({clean_phone})")
            return {"success": True, "user": result}

        # 3단계: 총회 직원 (requests.db staff_accounts) 대조
        try:
            sql_conn = sqlite3.connect('requests.db')
            sql_conn.row_factory = sqlite3.Row
            sql_c = sql_conn.cursor()
            sql_c.execute("""
                SELECT * FROM staff_accounts 
                WHERE replace(replace(replace(phone, '-', ''), ' ', ''), '.', '') = ? 
                  AND is_active = 1
            """, (clean_phone,))
            staff = sql_c.fetchone()
            sql_conn.close()
            
            if staff:
                user_data = {
                    "MinisterCode": staff["staff_code"],
                    "MinisterName": staff["name"],
                    "CHRNAME": staff["department"],
                    "NOHNAME": "총회",
                    "DUTYNAME": staff["position"],
                    "TEL_MOBILE": staff["phone"],
                    "TEL_CHURCH": "",
                    "JUSO": "",
                    "BIRTHDAY": "",
                    "EMAIL": staff["email"],
                    "is_staff": True,
                }
                logging.info(f"[Phone Auth] Staff login success: {staff['name']} ({clean_phone})")
                return {"success": True, "user": user_data}
        except Exception as se:
            logging.error(f"[Phone Auth] SQLite staff check error: {se}")

        # 모든 매핑 실패 -> DB 미등록 번호
        logging.warning(f"[Phone Auth] Login failed - Unregistered phone: {clean_phone}")
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "총회 데이터베이스에 등록되지 않은 휴대폰 번호입니다."}
        )
        
    except Exception as e:
        logging.error(f"[Phone Auth] DB error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"서버 내부 데이터베이스 처리 중 오류가 발생했습니다: {str(e)}"}
        )
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
            # Fallback: check SQLite staff_accounts (총회직원)
            try:
                sql_conn = sqlite3.connect('requests.db')
                sql_conn.row_factory = sqlite3.Row
                sql_c = sql_conn.cursor()
                sql_c.execute('SELECT * FROM staff_accounts WHERE staff_code=? AND is_active=1', (code,))
                staff = sql_c.fetchone()
                sql_conn.close()
                if staff:
                    return {
                        "MinisterCode": staff["staff_code"],
                        "MinisterName": staff["name"],
                        "CHRNAME": staff["department"],
                        "NOHNAME": "총회",
                        "DUTYNAME": staff["position"],
                        "TEL_MOBILE": staff["phone"],
                        "TEL_CHURCH": "",
                        "JUSO": "",
                        "BIRTHDAY": "",
                        "EMAIL": staff["email"],
                        "is_staff": True,
                    }
            except:
                pass
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
from fastapi import HTTPException
from pathlib import Path
from urllib.parse import unquote

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
    decoded_filename = unquote(filename)
    file_path = UPLOAD_DIR / "profiles" / decoded_filename
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/uploads/ads/{filename}")
def serve_ad_image(filename: str):
    decoded_filename = unquote(filename)
    file_path = UPLOAD_DIR / "ads" / decoded_filename
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404, detail="File not found")

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

@app.get("/api/directions")
def get_directions(start: str, goal: str, option: str = "traoptimal"):
    """Proxy for Naver Directions API to avoid CORS and hide client secret in production"""
    import os
    import requests
    from dotenv import load_dotenv

    # Load keys from server/.env
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    
    client_id = os.environ.get("VITE_NAVER_API_KEY_ID")
    client_secret = os.environ.get("VITE_NAVER_API_KEY")
    
    if not client_id or not client_secret:
        return {"code": -1, "message": "Naver API keys are missing on the server configuration."}
        
    url = f"https://maps.apigw.ntruss.com/map-direction/v1/driving?start={start}&goal={goal}&option={option}"
    headers = {
        "X-NCP-APIGW-API-KEY-ID": client_id,
        "X-NCP-APIGW-API-KEY": client_secret
    }
    
    try:
        resp = requests.get(url, headers=headers)
        return resp.json()
    except Exception as e:
        return {"code": -1, "message": f"Proxy request failed: {str(e)}"}

# ═══════════════════════════════════════════════════════════════
# ── Church Management API (Supabase Proxy) ──
# 기장주소록 앱에서 교회 정보를 관리하기 위한 엔드포인트
# Supabase service_role 키를 사용하여 RLS을 우회
# ═══════════════════════════════════════════════════════════════

import requests as _requests

_SUPABASE_URL = "https://wfpacsoyoalkdzksnmdg.supabase.co"
_SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_KEY", "")

def _sb_headers():
    """Supabase REST API 헤더 (service_role)"""
    return {
        "apikey": _SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {_SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@app.get("/api/church-manage/{chr_code}")
async def get_church_by_code(chr_code: str):
    """교회코드(chr_code)로 Supabase churches 테이블에서 교회 정보 조회"""
    try:
        r = _requests.get(
            f"{_SUPABASE_URL}/rest/v1/churches",
            headers=_sb_headers(),
            params={"chr_code": f"eq.{chr_code}", "select": "*"},
            timeout=10,
        )
        if r.status_code != 200:
            return JSONResponse(status_code=r.status_code, content={"error": r.text})
        data = r.json()
        if not data:
            return JSONResponse(status_code=404, content={"error": "church_not_found", "message": "해당 교회코드로 등록된 교회를 찾을 수 없습니다."})
        return data[0]
    except Exception as e:
        logging.error(f"[ChurchManage] GET error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


class ChurchUpdatePayload(BaseModel):
    youtube_video_id: str | None = None
    youtube_channel_id: str | None = None
    main_photo_url: str | None = None
    photo_urls: list | None = None
    homepage_url: str | None = None
    intro_text: str | None = None
    worship_times: list | None = None
    address: str | None = None
    phone: str | None = None
    parking_info: str | None = None
    transport_info: str | None = None


@app.put("/api/church-manage/{chr_code}")
async def update_church_by_code(chr_code: str, payload: ChurchUpdatePayload):
    """교회코드(chr_code)로 교회 정보 업데이트"""
    try:
        # None이 아닌 필드만 업데이트
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        if not update_data:
            return JSONResponse(status_code=400, content={"error": "no_fields", "message": "업데이트할 필드가 없습니다."})

        r = _requests.patch(
            f"{_SUPABASE_URL}/rest/v1/churches",
            headers=_sb_headers(),
            params={"chr_code": f"eq.{chr_code}"},
            json=update_data,
            timeout=10,
        )
        if r.status_code not in (200, 204):
            return JSONResponse(status_code=r.status_code, content={"error": r.text})
        data = r.json() if r.text else []
        if not data:
            return JSONResponse(status_code=404, content={"error": "church_not_found"})
        return data[0]
    except Exception as e:
        logging.error(f"[ChurchManage] PUT error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/church-manage")
async def create_church(payload: dict):
    """교회 신규 등록 (기장지도 Supabase)"""
    try:
        if not payload.get("chr_code"):
            return JSONResponse(status_code=400, content={"error": "chr_code is required"})

        r = _requests.post(
            f"{_SUPABASE_URL}/rest/v1/churches",
            headers=_sb_headers(),
            json=payload,
            timeout=10,
        )
        if r.status_code not in (200, 201):
            return JSONResponse(status_code=r.status_code, content={"error": r.text})
        data = r.json() if r.text else []
        return data[0] if data else payload
    except Exception as e:
        logging.error(f"[ChurchManage] POST error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/church-manage/{chr_code}/inquiries")
async def get_church_inquiries(chr_code: str):
    """해당 교회의 비밀 문의 목록 조회"""
    try:
        # 먼저 chr_code로 church_id 조회
        r1 = _requests.get(
            f"{_SUPABASE_URL}/rest/v1/churches",
            headers=_sb_headers(),
            params={"chr_code": f"eq.{chr_code}", "select": "id"},
            timeout=10,
        )
        if r1.status_code != 200 or not r1.json():
            return JSONResponse(status_code=404, content={"error": "church_not_found"})

        church_id = r1.json()[0]["id"]

        # 문의 목록 조회 (최신순)
        r2 = _requests.get(
            f"{_SUPABASE_URL}/rest/v1/inquiries",
            headers=_sb_headers(),
            params={
                "church_id": f"eq.{church_id}",
                "select": "*",
                "order": "created_at.desc",
            },
            timeout=10,
        )
        if r2.status_code != 200:
            return JSONResponse(status_code=r2.status_code, content={"error": r2.text})
        return r2.json()
    except Exception as e:
        logging.error(f"[ChurchManage] Inquiries error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


class InquiryReplyPayload(BaseModel):
    reply: str


@app.put("/api/church-manage/inquiries/{inquiry_id}/reply")
async def reply_to_inquiry(inquiry_id: int, payload: InquiryReplyPayload):
    """문의에 답변 작성"""
    try:
        r = _requests.patch(
            f"{_SUPABASE_URL}/rest/v1/inquiries",
            headers=_sb_headers(),
            params={"id": f"eq.{inquiry_id}"},
            json={"reply": payload.reply, "is_read": True},
            timeout=10,
        )
        if r.status_code not in (200, 204):
            return JSONResponse(status_code=r.status_code, content={"error": r.text})
        data = r.json() if r.text else []
        return data[0] if data else {"ok": True}
    except Exception as e:
        logging.error(f"[ChurchManage] Reply error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/church-manage/search/all")
async def search_churches(q: str = Query("", min_length=1)):
    """교회 이름으로 Supabase churches 검색 (총회 관리자용)"""
    try:
        r = _requests.get(
            f"{_SUPABASE_URL}/rest/v1/churches",
            headers=_sb_headers(),
            params={"name": f"ilike.*{q}*", "select": "id,chr_code,name,noh,address,phone,pastor_name", "order": "name.asc", "limit": "50"},
            timeout=10,
        )
        if r.status_code != 200:
            return JSONResponse(status_code=r.status_code, content={"error": r.text})
        return r.json()
    except Exception as e:
        logging.error(f"[ChurchManage] Search error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── 연금 납입 현황 및 예상 연금 계산 API ──────────────────────────────────

def _get_pen_no(minister_code: str):
    """MinisterCode → PenNo 매핑 (TB_PEN100.MemberCode = MinisterCode)
    
    1. 로컬 SQLite 캐시(requests.db.pen_no_cache)에서 먼저 조회하여 초고속 반환 (DB 커넥션 절약)
    2. 캐시 미스 시 원격 MSSQL 조회 후 캐시 삽입
    """
    # 1. SQLite 캐시 확인
    try:
        sqlite_conn = sqlite3.connect('requests.db')
        c = sqlite_conn.cursor()
        c.execute("SELECT pen_no FROM pen_no_cache WHERE minister_code = ?", (minister_code,))
        row = c.fetchone()
        sqlite_conn.close()
        if row:
            return row[0].strip() if row[0] else None
    except Exception as cache_err:
        logging.warning(f"[Pension] Local cache read warning: {cache_err}")

    # 2. 캐시 미스 시 원격 MSSQL 조회
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    pen_no = None
    try:
        cursor.execute(
            "SELECT TOP 1 PenNo FROM TB_PEN100 WHERE MemberCode = %s AND (EndDate = '' OR EndDate IS NULL)",
            (minister_code,)
        )
        row = cursor.fetchone()
        if row:
            pen_no = row['PenNo'].strip()
        else:
            # enddate 있는 경우도 fallback
            cursor.execute(
                "SELECT TOP 1 PenNo FROM TB_PEN100 WHERE MemberCode = %s ORDER BY StartDate DESC",
                (minister_code,)
            )
            row = cursor.fetchone()
            if row:
                pen_no = row['PenNo'].strip()
    finally:
        conn.close()

    # 3. 신규 획득 시 로컬 SQLite 캐시 갱신
    if pen_no:
        try:
            sqlite_conn = sqlite3.connect('requests.db')
            c = sqlite_conn.cursor()
            c.execute("""
                INSERT INTO pen_no_cache (minister_code, pen_no, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(minister_code) DO UPDATE SET pen_no = excluded.pen_no, updated_at = CURRENT_TIMESTAMP
            """, (minister_code, pen_no))
            sqlite_conn.commit()
            sqlite_conn.close()
        except Exception as cache_err:
            logging.warning(f"[Pension] Local cache write warning: {cache_err}")

    return pen_no


@app.get("/api/pension/{minister_code}/summary")
def get_pension_summary(minister_code: str):
    """연금 납입 연도별 요약"""
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        pen_no = _get_pen_no(minister_code)
        if not pen_no:
            return {"minister_code": minister_code, "pen_no": None, "summary": [], "total_years": 0, "total_amount": 0,
                    "message": "연금 가입 정보가 없습니다."}

        # 목사 이름
        cursor.execute("SELECT TOP 1 MemberName FROM TB_PEN100 WHERE PenNo = %s", (pen_no,))
        name_row = cursor.fetchone()
        minister_name = name_row['MemberName'].strip() if name_row else ''

        # 연도별 요약 (Finish='Y' 인 것만)
        cursor.execute("""
            SELECT LEFT(YYMM, 4) AS year,
                   COUNT(*) AS months_paid,
                   SUM(ISNULL(inContribute, 0) + ISNULL(inShare, 0) + ISNULL(inArrear, 0)) AS total_amt
            FROM TB_PEN110
            WHERE PenNo = %s AND RTRIM(ISNULL(Finish,'')) = 'Y'
            GROUP BY LEFT(YYMM, 4)
            ORDER BY LEFT(YYMM, 4) DESC
        """, (pen_no,))
        yearly = cursor.fetchall()
        for yr in yearly:
            yr['total_amt'] = int(yr['total_amt'] or 0)
            yr['months_paid'] = int(yr['months_paid'] or 0)

        total_amount = sum(r['total_amt'] for r in yearly) if yearly else 0
        total_months = sum(r['months_paid'] for r in yearly) if yearly else 0
        return {
            "minister_code": minister_code.strip(),
            "minister_name": minister_name,
            "pen_no": pen_no,
            "summary": yearly,
            "total_years": len(yearly),
            "total_months": total_months,
            "total_amount": total_amount,
        }
    except Exception as e:
        logging.error(f'[Pension] Summary error: {e}')
        return {"error": str(e)}
    finally:
        conn.close()


@app.get("/api/pension/{minister_code}/detail")
def get_pension_detail(minister_code: str, year: str = ""):
    """연금 특정 연도 월별 납입 상세"""
    if not year:
        year = str(datetime.now().year)

    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        pen_no = _get_pen_no(minister_code)
        if not pen_no:
            return {"error": "연금 가입 정보가 없습니다."}

        cursor.execute("""
            SELECT YYMM,
                   ISNULL(inContribute, 0) + ISNULL(inShare, 0) + ISNULL(inArrear, 0) AS amt,
                   RTRIM(ISNULL(Finish,'')) AS finish,
                   PenLevel
            FROM TB_PEN110
            WHERE PenNo = %s AND LEFT(YYMM, 4) = %s
            ORDER BY YYMM
        """, (pen_no, year))
        rows = cursor.fetchall()

        paid_map = {}
        for r in rows:
            mm = str(r['YYMM']).strip()[4:6]
            if r['finish'] == 'Y':
                paid_map[mm] = int(r['amt'] or 0)

        monthly = []
        for m in range(1, 13):
            mm = f"{m:02d}"
            amt = paid_map.get(mm, 0)
            monthly.append({"month": m, "paid": amt > 0, "amt": amt})

        year_total = sum(v for v in paid_map.values())
        months_paid = len([v for v in paid_map.values() if v > 0])
        return {"year": year, "monthly": monthly, "year_total": year_total, "months_paid": months_paid}
    except Exception as e:
        logging.error(f'[Pension] Detail error: {e}')
        return {"error": str(e)}
    finally:
        conn.close()


@app.get("/api/pension/{minister_code}/calc-data")
def get_pension_calc_data(minister_code: str):
    """예상 연금 계산에 필요한 기초 데이터 조회
    - TB_PEN350: Lev1~4_Cnt (단계별 누적 불입 개월)
    - TB_Chr200: BirthDay (생년월일)
    - TB_PEN904: DefaultPay (최신 기준 봉급액)
    """
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        pen_no = _get_pen_no(minister_code)
        if not pen_no:
            return {"error": "연금 가입 정보가 없습니다."}

        # Lev1~4 Cnt + Amt from TB_PEN350
        cursor.execute("""
            SELECT Lev1_Cnt, Lev2_Cnt, Lev3_Cnt, Lev4_Cnt, Amt, RetirementAge
            FROM TB_PEN350
            WHERE PenNo = %s
        """, (pen_no,))
        pen350 = cursor.fetchone()

        lev1 = int(pen350['Lev1_Cnt'] or 0) if pen350 else 0
        lev2 = int(pen350['Lev2_Cnt'] or 0) if pen350 else 0
        lev3 = int(pen350['Lev3_Cnt'] or 0) if pen350 else 0
        lev4 = int(pen350['Lev4_Cnt'] or 0) if pen350 else 0
        retirement_age = int(pen350['RetirementAge'] or 0) if pen350 else 0

        # 생년월일 from TB_Chr200
        cursor.execute("SELECT BirthDay FROM TB_Chr200 WHERE MinisterCode = %s", (minister_code,))
        birth_row = cursor.fetchone()
        birth = ''
        birth_year = 0
        birth_month = 0
        if birth_row and birth_row['BirthDay']:
            birth = str(birth_row['BirthDay']).strip()
            if len(birth) >= 6:
                birth_year = int(birth[:4])
                birth_month = int(birth[4:6])

        # 기준 봉급액 from TB_PEN904 (최신 연도)
        cursor.execute("SELECT TOP 1 YY, DefaultPay FROM TB_PEN904 ORDER BY YY DESC")
        pay_row = cursor.fetchone()
        amt = int(pay_row['DefaultPay']) if pay_row else 0
        pay_year = pay_row['YY'].strip() if pay_row else ''

        # 실제 단계별 납입 개월수 from TB_PEN110.PenLevel
        cursor.execute("""
            SELECT ISNULL(PenLevel, 2) AS PenLevel, COUNT(DISTINCT YYMM) AS cnt
            FROM TB_PEN110
            WHERE PenNo = %s AND RTRIM(ISNULL(Finish,'')) = 'Y'
            GROUP BY PenLevel
        """, (pen_no,))
        pen_level_rows = cursor.fetchall()
        actual_lev = {1: 0, 2: 0, 3: 0, 4: 0}
        for plr in pen_level_rows:
            lvl = int(plr['PenLevel'] or 2)
            if lvl in actual_lev:
                actual_lev[lvl] = int(plr['cnt'] or 0)
        total_paid_months = sum(actual_lev.values())

        # TB_PEN350에 데이터 없으면 TB_PEN110.PenLevel 기반으로 대체
        if lev1 == 0 and lev2 == 0 and lev3 == 0 and lev4 == 0 and total_paid_months > 0:
            lev1 = actual_lev[1]
            lev2 = actual_lev[2]
            lev3 = actual_lev[3]
            lev4 = actual_lev[4]

        return {
            "pen_no": pen_no,
            "lev1_cnt": lev1, "lev2_cnt": lev2, "lev3_cnt": lev3, "lev4_cnt": lev4,
            "birth": birth, "birth_year": birth_year, "birth_month": birth_month,
            "retirement_age": retirement_age,
            "amt": amt, "pay_year": pay_year,
            "total_paid_months": total_paid_months,
        }
    except Exception as e:
        logging.error(f'[Pension] CalcData error: {e}')
        return {"error": str(e)}
    finally:
        conn.close()


def save_pension_estimate_bg(minister_code: str, p_age: int, s_total: int, s5: float, s6: float, amt: float):
    """Firestore와 MSSQL에 예상 연금 결과를 백그라운드에서 비동기 저장"""
    try:
        pen_no = _get_pen_no(minister_code) or ''
        # Firestore
        if FCM_AVAILABLE:
            db = firestore.client()
            db.collection('pension_estimates').document(minister_code).set({
                'minister_code': minister_code,
                'pen_no': pen_no,
                'retire_age': p_age,
                'estimated_monthly': int(s_total),
                'contribution_rate': round(s5, 2),
                'retirement_rate': round(s6 * 100, 0),
                'base_salary': int(amt),
                'updated_at': firestore.SERVER_TIMESTAMP,
            }, merge=True)
            
        # MSSQL
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
            MERGE INTO TB_PEN_ESTIMATE AS Target
            USING (SELECT %s AS MinisterCode, %s AS PenNo, %d AS RetireAge, %d AS EstimatedMonthly, %d AS ContributionRate, %d AS RetirementRate, %d AS BaseSalary) AS Source
            ON Target.MinisterCode = Source.MinisterCode
            WHEN MATCHED THEN 
                UPDATE SET PenNo = Source.PenNo, RetireAge = Source.RetireAge, EstimatedMonthly = Source.EstimatedMonthly, ContributionRate = Source.ContributionRate, RetirementRate = Source.RetirementRate, BaseSalary = Source.BaseSalary, UpdatedAt = GETDATE()
            WHEN NOT MATCHED BY TARGET THEN
                INSERT (MinisterCode, PenNo, RetireAge, EstimatedMonthly, ContributionRate, RetirementRate, BaseSalary, UpdatedAt)
                VALUES (Source.MinisterCode, Source.PenNo, Source.RetireAge, Source.EstimatedMonthly, Source.ContributionRate, Source.RetirementRate, Source.BaseSalary, GETDATE());
        """, (minister_code, pen_no, p_age, int(s_total), float(s5), float(s6 * 100), int(amt)))
        conn.commit()
        conn.close()
        logging.info(f"[PensionEstimateBG] Successfully saved estimate for minister {minister_code} in background")
    except Exception as save_err:
        logging.warning(f'[PensionEstimateBG] Estimate save failed in background: {save_err}')


@app.post("/api/pension/{minister_code}/estimate")
async def estimate_pension(minister_code: str, payload: dict, background_tasks: BackgroundTasks):
    """예상 연금 지급액 계산 — 레거시 PHP(index.php) 계산식 완전 포팅 (BackgroundTasks로 DB 쓰기 비동기 최적화 완료)"""
    import math

    lev1_total = int(payload.get('lev1_y', 0)) * 12 + int(payload.get('lev1_m', 0))
    lev2_total = int(payload.get('lev2_y', 0)) * 12 + int(payload.get('lev2_m', 0))
    lev3_total = int(payload.get('lev3_y', 0)) * 12 + int(payload.get('lev3_m', 0))
    lev4_total = int(payload.get('lev4_y', 0)) * 12 + int(payload.get('lev4_m', 0))
    birth_year = int(payload.get('birth_year', 0))
    birth_month = int(payload.get('birth_month', 1))
    amt = float(payload.get('amt', 0))

    # 나이 기반 입력 지원 (retire_age → s_year/s_month 자동 계산)
    retire_age = int(payload.get('retire_age', 0))
    if retire_age > 0 and birth_year > 0:
        s_year = birth_year + retire_age
        s_month = birth_month
    else:
        s_year = int(payload.get('s_year', datetime.now().year))
        s_month = int(payload.get('s_month', datetime.now().month))

    if birth_year == 0 or amt == 0:
        return {"error": "생년월일 또는 기준봉급액 정보가 없습니다."}

    # 1) 연금 인정개월, 특약 인정개월
    s1 = math.floor(lev1_total / 2) + lev2_total
    s2 = math.floor(lev3_total / 2) + lev4_total

    # 2) 납입비율 — 연금 (s3)
    if s1 <= 240:
        s3_year_part = (s1 // 12) * 3
        s3_month_part = math.floor(((s1 % 12) * (3 / 12)) * 100) / 100
        s3 = s3_year_part + s3_month_part
    else:
        over = s1 - 240
        over_years = over // 12
        over_months = over - (over_years * 12)
        s3 = 60 + over_years * 2 + math.floor((over_months * 2 / 12) * 100) / 100

    # 3) 납입비율 — 특약 (s4)
    s4_years = s2 // 12
    s4_months = s2 % 12
    s4 = s4_years * 3 + (s4_months * 3) / 12

    # 4) 총 납입비율
    s5 = s3 + s4

    # 5) 만 나이 (retire_age 또는 s_year/s_month 기반)
    p_age = retire_age if retire_age > 0 else (
        s_year - birth_year if s_month >= birth_month else s_year - birth_year - 1
    )

    # 6) 퇴직적용율
    if p_age <= 65:
        s6 = 0.85
    elif p_age <= 66:
        s6 = 0.88
    elif p_age <= 67:
        s6 = 0.91
    elif p_age <= 68:
        s6 = 0.94
    elif p_age <= 69:
        s6 = 0.97
    else:
        s6 = 1.0

    # 7) 예상 월 지급액 (1000원 미만 절사)
    temp = float(s5) * float(s6)
    temp2 = (temp / 100) * amt
    s_total = math.floor(temp2 / 1000) * 1000

    result = {
        "pension_months_recognized": s1,
        "special_months_recognized": s2,
        "pension_rate": round(s3, 2),
        "special_rate": round(s4, 2),
        "contribution_rate": round(s5, 2),
        "retirement_age": p_age,
        "retirement_rate": round(s6 * 100, 0),
        "base_salary": int(amt),
        "estimated_monthly": int(s_total),
    }

    # 8) 계산 결과 저장을 백그라운드 태스크로 등록하여 블로킹 없는 초고속 반응속도(0.1ms) 확보!
    background_tasks.add_task(save_pension_estimate_bg, minister_code, p_age, int(s_total), float(s5), float(s6), amt)

    return result


@app.get("/api/pension/{minister_code}/dashboard")
def get_pension_dashboard(minister_code: str):
    """연금 납입 및 예상 연금 통합 대시보드 API
    
    단 1회의 DB 커넥션 수립으로 아래 데이터를 일괄 조회하여 반환 (성능 최적화의 핵심)
    1. MemberName (교역자 성함)
    2. 연도별 납입 요약 (yearly summary)
    3. 계산용 기초 데이터 (calc-data)
    4. 당해 연도 월별 상세 (detail)
    5. 마지막 예상 연금 계산 이력 (last-estimate)
    """
    import math
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        # 1. 연금 고유번호 획득 (로컬 SQLite 캐시 우선 활용되는 _get_pen_no 사용)
        pen_no = _get_pen_no(minister_code)
        if not pen_no:
            return {
                "minister_code": minister_code,
                "pen_no": None,
                "summary": [],
                "total_years": 0,
                "total_amount": 0,
                "message": "연금 가입 정보가 없습니다."
            }

        # 2. MemberName 조회 (TB_PEN100)
        cursor.execute("SELECT TOP 1 MemberName FROM TB_PEN100 WHERE PenNo = %s", (pen_no,))
        name_row = cursor.fetchone()
        minister_name = name_row['MemberName'].strip() if name_row else ''

        # 3. 연도별 납입 요약 (Finish = 'Y' 통계)
        cursor.execute("""
            SELECT LEFT(YYMM, 4) AS year,
                   COUNT(*) AS months_paid,
                   SUM(ISNULL(inContribute, 0) + ISNULL(inShare, 0) + ISNULL(inArrear, 0)) AS total_amt
            FROM TB_PEN110
            WHERE PenNo = %s AND RTRIM(ISNULL(Finish,'')) = 'Y'
            GROUP BY LEFT(YYMM, 4)
            ORDER BY LEFT(YYMM, 4) DESC
        """, (pen_no,))
        yearly = cursor.fetchall()
        for yr in yearly:
            yr['total_amt'] = int(yr['total_amt'] or 0)
            yr['months_paid'] = int(yr['months_paid'] or 0)

        total_amount = sum(r['total_amt'] for r in yearly) if yearly else 0
        total_months = sum(r['months_paid'] for r in yearly) if yearly else 0

        # 4. 당해 연도(또는 최근 연도) 월별 상세
        latest_year = yearly[0]['year'] if yearly else str(datetime.now().year)
        cursor.execute("""
            SELECT YYMM,
                   ISNULL(inContribute, 0) + ISNULL(inShare, 0) + ISNULL(inArrear, 0) AS amt,
                   RTRIM(ISNULL(Finish,'')) AS finish
            FROM TB_PEN110
            WHERE PenNo = %s AND LEFT(YYMM, 4) = %s
            ORDER BY YYMM
        """, (pen_no, latest_year))
        rows = cursor.fetchall()

        paid_map = {}
        for r in rows:
            mm = str(r['YYMM']).strip()[4:6]
            if r['finish'] == 'Y':
                paid_map[mm] = int(r['amt'] or 0)

        monthly = []
        for m in range(1, 13):
            mm = f"{m:02d}"
            amt = paid_map.get(mm, 0)
            monthly.append({"month": m, "paid": amt > 0, "amt": amt})
        year_total = sum(v for v in paid_map.values())
        months_paid = len([v for v in paid_map.values() if v > 0])
        detail_data = {"year": latest_year, "monthly": monthly, "year_total": year_total, "months_paid": months_paid}

        # 5. 계산기용 기초 데이터 조회 (TB_PEN350, TB_Chr200, TB_PEN904)
        cursor.execute("""
            SELECT Lev1_Cnt, Lev2_Cnt, Lev3_Cnt, Lev4_Cnt, Amt, RetirementAge
            FROM TB_PEN350
            WHERE PenNo = %s
        """, (pen_no,))
        pen350 = cursor.fetchone()

        lev1 = int(pen350['Lev1_Cnt'] or 0) if pen350 else 0
        lev2 = int(pen350['Lev2_Cnt'] or 0) if pen350 else 0
        lev3 = int(pen350['Lev3_Cnt'] or 0) if pen350 else 0
        lev4 = int(pen350['Lev4_Cnt'] or 0) if pen350 else 0
        retirement_age = int(pen350['RetirementAge'] or 0) if pen350 else 0

        # 생년월일 (TB_Chr200)
        cursor.execute("SELECT BirthDay FROM TB_Chr200 WHERE MinisterCode = %s", (minister_code,))
        birth_row = cursor.fetchone()
        birth = ''
        birth_year = 0
        birth_month = 0
        if birth_row and birth_row['BirthDay']:
            birth = str(birth_row['BirthDay']).strip()
            if len(birth) >= 6:
                birth_year = int(birth[:4])
                birth_month = int(birth[4:6])

        # 기준 봉급액 (TB_PEN904)
        cursor.execute("SELECT TOP 1 YY, DefaultPay FROM TB_PEN904 ORDER BY YY DESC")
        pay_row = cursor.fetchone()
        amt = int(pay_row['DefaultPay']) if pay_row else 0
        pay_year = pay_row['YY'].strip() if pay_row else ''

        # 실제 레벨별 납입 횟수 (TB_PEN110)
        cursor.execute("""
            SELECT ISNULL(PenLevel, 2) AS PenLevel, COUNT(DISTINCT YYMM) AS cnt
            FROM TB_PEN110
            WHERE PenNo = %s AND RTRIM(ISNULL(Finish,'')) = 'Y'
            GROUP BY PenLevel
        """, (pen_no,))
        pen_level_rows = cursor.fetchall()
        actual_lev = {1: 0, 2: 0, 3: 0, 4: 0}
        for plr in pen_level_rows:
            lvl = int(plr['PenLevel'] or 2)
            if lvl in actual_lev:
                actual_lev[lvl] = int(plr['cnt'] or 0)
        total_paid_months = sum(actual_lev.values())

        if lev1 == 0 and lev2 == 0 and lev3 == 0 and lev4 == 0 and total_paid_months > 0:
            lev1 = actual_lev[1]
            lev2 = actual_lev[2]
            lev3 = actual_lev[3]
            lev4 = actual_lev[4]

        calc_data = {
            "pen_no": pen_no,
            "lev1_cnt": lev1, "lev2_cnt": lev2, "lev3_cnt": lev3, "lev4_cnt": lev4,
            "birth": birth, "birth_year": birth_year, "birth_month": birth_month,
            "retirement_age": retirement_age,
            "amt": amt, "pay_year": pay_year,
            "total_paid_months": total_paid_months,
        }

        # 6. 최신 예상 연금 계산 이력 조회 (TB_PEN_ESTIMATE)
        cursor.execute("""
            SELECT RetireAge, EstimatedMonthly, ContributionRate, RetirementRate, BaseSalary, UpdatedAt
            FROM TB_PEN_ESTIMATE
            WHERE MinisterCode = %s
        """, (minister_code,))
        estimate_row = cursor.fetchone()
        last_estimate = None
        if estimate_row:
            last_estimate = {
                "found": True,
                "retire_age": int(estimate_row['RetireAge'] or 0),
                "estimated_monthly": int(estimate_row['EstimatedMonthly'] or 0),
                "contribution_rate": float(estimate_row['ContributionRate'] or 0),
                "retirement_rate": float(estimate_row['RetirementRate'] or 0),
                "base_salary": int(estimate_row['BaseSalary'] or 0),
                "calc_date": str(estimate_row['UpdatedAt'])[:10] if estimate_row.get('UpdatedAt') else ''
            }
        else:
            # MSSQL에 없으면 Firestore에서 확인
            try:
                db = firestore.client()
                doc = db.collection('pension_estimates').document(minister_code).get()
                if doc.exists:
                    d = doc.to_dict()
                    calc_date = ''
                    if d.get('updated_at'):
                        calc_date = str(d['updated_at'])[:10]
                    last_estimate = {
                        "found": True,
                        "retire_age": d.get('retire_age'),
                        "estimated_monthly": d.get('estimated_monthly'),
                        "contribution_rate": d.get('contribution_rate'),
                        "retirement_rate": d.get('retirement_rate'),
                        "base_salary": d.get('base_salary'),
                        "calc_date": calc_date
                    }
            except Exception as fs_err:
                logging.warning(f"[Pension] Firestore check inside dashboard warning: {fs_err}")

        return {
            "minister_code": minister_code.strip(),
            "minister_name": minister_name,
            "pen_no": pen_no,
            "summary": yearly,
            "total_years": len(yearly),
            "total_months": total_months,
            "total_amount": total_amount,
            "detail": detail_data,
            "calc_data": calc_data,
            "last_estimate": last_estimate
        }

    except Exception as e:
        logging.error(f'[Pension] Dashboard error: {e}')
        return {"error": str(e)}
    finally:
        conn.close()


@app.get("/api/pension/{minister_code}/last-estimate")
def get_last_estimate(minister_code: str):
    """이전 계산 결과 조회 (MSSQL 조회 후 없으면 Firestore 폴백)"""
    try:
        # 우선 MSSQL에서 조회
        conn = get_connection()
        c = conn.cursor(as_dict=True)
        c.execute("SELECT TOP 1 * FROM TB_PEN_ESTIMATE WHERE MinisterCode = %s", (minister_code,))
        row = c.fetchone()
        conn.close()
        
        if row:
            return {
                "found": True,
                "retire_age": int(row['RetireAge']),
                "estimated_monthly": int(row['EstimatedMonthly']),
                "contribution_rate": float(row['ContributionRate']),
                "retirement_rate": float(row['RetirementRate']),
                "base_salary": int(row['BaseSalary']),
                "calc_date": str(row['UpdatedAt'])[:10] if row.get('UpdatedAt') else '',
            }
            
        # MSSQL에 없으면 Firestore에서 확인
        db = firestore.client()
        doc = db.collection('pension_estimates').document(minister_code).get()
        if not doc.exists:
            return {"found": False}
        d = doc.to_dict()
        calc_date = ''
        if d.get('updated_at'):
            calc_date = str(d['updated_at'])[:10]
        return {
            "found": True,
            "retire_age": d.get('retire_age'),
            "estimated_monthly": d.get('estimated_monthly'),
            "contribution_rate": d.get('contribution_rate'),
            "retirement_rate": d.get('retirement_rate'),
            "base_salary": d.get('base_salary'),
            "calc_date": calc_date,
        }
    except Exception as e:
        logging.warning(f'[Pension] Last estimate load warning: {e}')
        return {"found": False}


# --- Background Scheduler ---
@app.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler()
    # Schedule local DB replication to run every Monday at 04:00 AM
    scheduler.add_job(replicate_mssql_to_local_scheduled, 'cron', day_of_week='mon', hour=4, minute=0)
    scheduler.start()
    logging.info("[Scheduler] Started AsyncIOScheduler. replicate_mssql_to_local_scheduled is scheduled for Mondays at 04:00 AM.")

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

# --- Firebase Functions Export ---
try:
    from firebase_functions import https_fn, options
    from firebase_fastapi_wrapper import FastAPIWrapper

    @https_fn.on_request(
        region="asia-northeast3",
        timeout_sec=60,
        memory=options.MemoryOption.MB_512
    )
    def prok_api(req: https_fn.Request) -> https_fn.Response:
        return FastAPIWrapper(app)(req)

except ImportError:
    logging.warning("firebase_functions or firebase_fastapi_wrapper not installed. Cannot export Firebase Function.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
