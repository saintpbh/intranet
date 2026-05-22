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

    def _create_connection(self, charset='cp949', login_timeout=5, timeout=10):
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

    def get_connection(self, charset='cp949', login_timeout=5, timeout=10):
        try:
            return self.pool.get(block=False)
        except queue.Empty:
            with self.lock:
                if self.active_connections < self.max_connections:
                    conn = self._create_connection(charset, login_timeout, timeout)
                    self.active_connections += 1
                    return conn
            return self.pool.get(block=True, timeout=self.timeout)

    def release_connection(self, conn):
        try:
            self.pool.put(conn, block=False)
        except queue.Full:
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

# 공통 커넥션 풀 싱글톤 초기화
db_pool = MSSQLConnectionPool(max_connections=20, timeout=10)

def get_connection(charset='cp949', login_timeout=5, timeout=10):
    """MSSQL 연결 풀을 통한 커넥션 대여 및 프록시 반환"""
    raw_conn = db_pool.get_connection(charset, login_timeout, timeout)
    return PooledConnectionWrapper(raw_conn, db_pool)

