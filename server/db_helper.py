"""
공통 DB 연결 헬퍼 — 모든 보조 스크립트에서 사용
.env 파일에서 DB_SERVER, DB_USER, DB_PASSWORD, DB_DATABASE, DB_PORT를 읽습니다.
IDC 전환 시 .env만 변경하면 모든 스크립트에 자동 적용됩니다.
"""
import os
import pymssql
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

DB_USER = os.getenv("DB_USER", "pbh")
DB_PASSWORD = os.getenv("DB_PASSWORD", "prok3000")
DB_SERVER = os.getenv("DB_SERVER", "192.168.0.145")
DB_DATABASE = os.getenv("DB_DATABASE", "KJ_CHURCH")
DB_PORT = os.getenv("DB_PORT", "1433")


def get_connection(charset='cp949', login_timeout=5, timeout=10):
    """MSSQL 연결 생성"""
    return pymssql.connect(
        server=DB_SERVER,
        port=int(DB_PORT),
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_DATABASE,
        charset=charset,
        login_timeout=login_timeout,
        timeout=timeout
    )
