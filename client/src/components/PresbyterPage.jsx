import { useState, useEffect, useCallback } from 'react';
import API_BASE from '../api';
import { useAuth } from '../AuthContext';
import { useBackButton } from '../useBackButton';

const isNew = (dateStr) => {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) < 3 * 24 * 60 * 60 * 1000;
};

const PresbyterPage = () => {
  const { user, isLoggedIn } = useAuth();
  const [notices, setNotices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const presbyName = user?.presbytery || '';

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/notices?scope=presbytery`).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/roles?role=noh_secretary`).then(r => r.json()),
    ]).then(([n, r]) => {
      setNotices(Array.isArray(n) ? n : []);
      setRoles(Array.isArray(r) ? r : []);
    }).finally(() => setLoading(false));
  }, []);

  const clearNotice = useCallback(() => setSelectedNotice(null), []);
  useBackButton(!!selectedNotice, clearNotice);

  // Notice detail
  if (selectedNotice) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-bar">
            <button className="btn-back" onClick={clearNotice}>뒤로</button>
          </div>
        </header>
        <main className="app-main" style={{ padding: '0 16px 32px' }}>
          <span className="badge" style={{ marginBottom: 8, display: 'inline-block' }}>
            {selectedNotice.is_pinned ? '📌 ' : ''}{selectedNotice.category}
          </span>
          {isNew(selectedNotice.created_at) && <span style={{ marginLeft: 8, fontSize: 12, color: '#FF3B30', fontWeight: 700 }}>🆕 NEW</span>}
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, lineHeight: 1.35 }}>{selectedNotice.title}</h2>
          <p style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>
            {selectedNotice.created_at?.substring(0, 10)} · {selectedNotice.author_name || '관리자'}
          </p>
          <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--label)', whiteSpace: 'pre-wrap' }}>
            {selectedNotice.content}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <img src="/assets/admin_logo.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>{presbyName || '노회'}</h1>
          </div>
        </div>
      </header>
      <main className="app-main" style={{ padding: '0 16px' }}>
        {!isLoggedIn ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <div style={{ color: 'var(--system-gray)', fontSize: 15, marginBottom: 8 }}>로그인 후 이용 가능합니다.</div>
            <div style={{ color: 'var(--system-gray2)', fontSize: 13 }}>내정보 탭에서 로그인해 주세요.</div>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--system-gray)' }}>불러오는 중...</div>
        ) : (
          <>
            {/* Notices section */}
            <div className="section-header">📢 공지/알림</div>
            {notices.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--system-gray)' }}>
                등록된 노회 소식이 없습니다.
              </div>
            ) : (
              <div className="grouped-list">
                {notices.map(n => (
                  <div key={n.id} className="result-row" onClick={() => setSelectedNotice(n)} style={{ cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="result-name" style={{ fontSize: 15 }}>
                        <span className="badge" style={{ marginRight: 6, fontSize: 11 }}>
                          {n.is_pinned ? '📌 ' : ''}{n.category}
                        </span>
                        {n.title}
                        {isNew(n.created_at) && <span style={{ color: '#FF3B30', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>🆕</span>}
                      </div>
                      <div className="result-subtitle">{n.created_at?.substring(0, 10)} · {n.author_name || '관리자'}</div>
                    </div>
                    <svg className="chevron" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* Officers section */}
            {roles.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: 20 }}>👥 임원 명단</div>
                <div className="grouped-list">
                  {roles.map(r => (
                    <div key={r.id} className="result-row" style={{ cursor: 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <div className="profile-avatar" style={{ width: 36, height: 36, minWidth: 36, fontSize: 14 }}>
                          <span className="initials" style={{ fontSize: 14 }}>{r.minister_name?.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="result-name" style={{ fontSize: 15 }}>{r.minister_name}</div>
                          <div className="result-subtitle">{r.noh_name} 노회서기</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PresbyterPage;
