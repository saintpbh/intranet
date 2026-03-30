import { useState, useEffect } from 'react';
import API_BASE from '../api';

const MyHistory = ({ user, onBack }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/myinfo/${user.code}/history`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistory(data);
        } else {
          setHistory([]);
        }
      } catch (err) {
        setError('사역 이력을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user.code]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <button className="btn-back" onClick={onBack}>뒤로</button>
          <div className="header-title-group">
            <h1>사역 이력</h1>
          </div>
        </div>
      </header>
      <main className="app-main" style={{ padding: '0 16px' }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user.name}</div>
            <div style={{ fontSize: 14, color: 'var(--system-gray)', marginTop: 4 }}>교회 배정 이력</div>
          </div>
        </div>

        {loading && <div className="loading">불러오는 중...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && history.length === 0 && (
          <div className="no-results">사역 이력이 없습니다.</div>
        )}

        {history.length > 0 && (
          <>
            {/* Current assignments */}
            {history.filter(h => h.is_current).length > 0 && (
              <>
                <div className="section-header">현재 사역지</div>
                <div className="grouped-list">
                  {history.filter(h => h.is_current).map((h, idx) => (
                    <div key={idx} className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <span style={{ fontWeight: 600, fontSize: 16 }}>{h.ChrName || h.CHRNAME}</span>
                        <span className="badge badge-damim" style={{ background: 'rgba(52, 199, 89, 0.1)', color: '#34C759' }}>현재</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--system-gray)', marginTop: 4 }}>
                        {h.DUTYNAME && `${h.DUTYNAME} · `}{h.start_year ? `${h.start_year}년~` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Past assignments */}
            {history.filter(h => !h.is_current).length > 0 && (
              <>
                <div className="section-header">이전 사역지</div>
                <div className="grouped-list">
                  {history.filter(h => !h.is_current).map((h, idx) => (
                    <div key={idx} className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 16 }}>{h.ChrName || h.CHRNAME}</div>
                      <div style={{ fontSize: 14, color: 'var(--system-gray)', marginTop: 4 }}>
                        {h.DUTYNAME && `${h.DUTYNAME} · `}
                        {h.start_year && h.end_year ? `${h.start_year}~${h.end_year}` : ''}
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

export default MyHistory;
