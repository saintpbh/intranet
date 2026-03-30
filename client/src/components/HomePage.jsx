import { useState, useEffect, useCallback } from 'react';
import API_BASE from '../api';
import { useBackButton } from '../useBackButton';

const isNew = (dateStr) => {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 3 * 24 * 60 * 60 * 1000;
};

const HomePage = () => {
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/notices?scope=assembly`)
      .then(r => r.json())
      .then(data => setNotices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
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
          <img src="/assets/logo_v3.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>총회소식</h1>
          </div>
        </div>
      </header>
      <main className="app-main" style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--system-gray)' }}>불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ color: 'var(--system-gray)', fontSize: 15 }}>등록된 소식이 없습니다.</div>
          </div>
        ) : (
          <>
            {/* Featured card for pinned or first notice */}
            {notices.length > 0 && (
              <div className="news-featured" onClick={() => setSelectedNotice(notices[0])} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: 16, padding: 24, marginBottom: 16, position: 'relative', minHeight: 120 }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <span className="badge badge-featured" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', marginBottom: 8, display: 'inline-block' }}>
                    {notices[0].is_pinned ? '📌 ' : ''}{notices[0].category}
                  </span>
                  {isNew(notices[0].created_at) && <span style={{ marginLeft: 8, background: '#FF3B30', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>NEW</span>}
                  <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: 1.4, marginTop: 8 }}>{notices[0].title}</h2>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 }}>{notices[0].created_at?.substring(0, 10)}</p>
                </div>
              </div>
            )}

            {/* Rest of notices */}
            {notices.length > 1 && (
              <>
                <div className="section-header">최근 소식</div>
                <div className="grouped-list">
                  {notices.slice(1).map(n => (
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
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default HomePage;
