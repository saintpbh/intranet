from fastapi import FastAPI, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymssql
import os
import json

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database credentials
DB_USER = "pbh"
DB_PASSWORD = "prok3000"
DB_SERVER = "192.168.0.145"
DB_DATABASE = "KJ_CHURCH"

def get_connection():
    # Use standard connection, usually MS SQL Korean uses cp949 or default utf8
    return pymssql.connect(
        server=DB_SERVER, 
        user=DB_USER, 
        password=DB_PASSWORD, 
        database=DB_DATABASE, 
        charset='cp949'
    )

@app.get("/api/churches")
def get_churches(search: str = ""):
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        search_term = f"%{search}%".encode('cp949')
        query = """
            SELECT TOP 100 
                c.ChrCode, c.ChrName, n.NohName, s.SichalName, 
                c.Tel_Church, c.Tel_Mobile, c.Tel_Fax, c.Address, c.Juso, c.PostNo, c.Email 
            FROM TB_Chr100 c 
            LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode 
            LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
            WHERE c.ChrName LIKE %s OR n.NohName LIKE %s
            ORDER BY n.NohName, c.ChrName
        """
        cursor.execute(query, (search_term, search_term))
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
            memo TEXT
        )
    ''')
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

@app.get("/api/notices")
def get_notices(scope: str = "", scope_code: str = "", limit: int = 50):
    try:
        conn = sqlite3.connect('requests.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
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
        return {"success": True, "id": notice_id, "message": "공지가 등록되었습니다."}
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
}

STATUS_LABELS = {
    'SUBMITTED': '신청됨',
    'CHURCH_CONFIRMED': '교회 확인',
    'SICHAL_CONFIRMED': '시찰 확인',
    'NOH_CONFIRMED': '노회 확인',
    'APPROVED': '총회 승인',
    'ISSUED': '발급 완료',
    'REJECTED': '반려',
}

STAGE_ROLE = {
    'SUBMITTED': 'church',
    'CHURCH_CONFIRMED': 'sichal',
    'SICHAL_CONFIRMED': 'presbytery',
    'NOH_CONFIRMED': 'assembly',
    'APPROVED': 'assembly',
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
        
        if req.action == 'reject':
            new_status = 'REJECTED'
        else:
            new_status = NEXT_STATUS.get(current_status)
            if not new_status:
                return {"error": f"현재 상태({current_status})에서 승인할 수 없습니다."}
        
        now = datetime.now().isoformat()
        c.execute("UPDATE cert_requests SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, req_id))
        c.execute('''
            INSERT INTO approval_history (request_id, request_type, stage, action, actor_name, actor_role, comment)
            VALUES (?, 'cert', ?, ?, ?, ?, ?)
        ''', (req_id, new_status, req.action, req.actor_name, req.actor_role, req.comment))
        conn.commit()
        conn.close()
        return {"success": True, "new_status": new_status, "status_label": STATUS_LABELS.get(new_status, new_status)}
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
            SELECT DISTINCT m.MinisterCode, m.MinisterName, m.NOHNAME,
                   r.NohCode, c.SichalCode
            FROM VI_MIN_INFO m
            LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                AND (r.TradeDate IS NULL OR r.TradeDate = '')
            LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
            WHERE 1=1
        """
        params = []
        if noh_code:
            query += " AND r.NohCode = %s"
            params.append(noh_code)
        if sichal_code:
            query += " AND c.SichalCode = %s"
            params.append(sichal_code)
        query += " ORDER BY m.MinisterName"
        cursor.execute(query, tuple(params))
        ministers = cursor.fetchall()
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
            # Get all ministers from MSSQL
            try:
                ms_conn = get_connection()
                cursor = ms_conn.cursor(as_dict=True)
                cursor.execute("""
                    SELECT DISTINCT m.MinisterCode, m.MinisterName, r.NohCode, c.SichalCode
                    FROM VI_MIN_INFO m
                    LEFT JOIN TB_Chr201 r ON m.MinisterCode = r.MinisterCode 
                        AND (r.TradeDate IS NULL OR r.TradeDate = '')
                    LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
                    ORDER BY m.MinisterName
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
        conn.close()
        
        # TODO: Actual FCM push send here
        
        send_label = {'now': '발송', 'test': '테스트 발송', 'schedule': '예약'}
        return {
            "success": True, 
            "message": f"{len(recipients)}명에게 {send_label.get(req.send_type, '발송')} 완료",
            "recipient_count": len(recipients)
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
            "ministers": individual_ministers[:200],  # limit
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
    
    # SPA fallback: serve index.html for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Check if the file exists in the build directory
        file_path = CLIENT_BUILD / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html (React Router handles routing)
        return FileResponse(str(CLIENT_BUILD / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
