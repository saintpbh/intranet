import { useState } from 'react';
import API_BASE from '../api';
import { useAuth } from '../AuthContext';

const SimpleLogin = () => {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Demo: fetch minister info as login verification
      const res = await fetch(`${API_BASE}/api/ministers/${code.trim()}`);
      const data = await res.json();
      if (data.error) {
        setError('해당 코드로 등록된 정보를 찾을 수 없습니다.');
      } else {
        // Also fetch history to get noh_code/chr_code
        let nohCode = '', chrCode = '';
        try {
          const histRes = await fetch(`${API_BASE}/api/myinfo/${code.trim()}/history`);
          const hist = await histRes.json();
          if (Array.isArray(hist)) {
            const current = hist.find(h => h.is_current);
            if (current) {
              nohCode = current.NohCode || '';
              chrCode = current.ChrCode || '';
            }
          }
        } catch(e) {}

        login({
          code: data.MinisterCode,
          name: data.MinisterName,
          church: data.CHRNAME,
          presbytery: data.NOHNAME,
          duty: data.DUTYNAME,
          phone: data.TEL_MOBILE,
          email: data.EMAIL,
          birthday: data.BIRTHDAY,
          nohCode,
          chrCode,
        });
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <img src="/assets/logo_v3.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>내정보</h1>
          </div>
        </div>
      </header>
      <main className="app-main" style={{ padding: '32px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="profile-avatar" style={{ margin: '0 auto 16px', background: 'var(--system-gray5)' }}>
            <span className="initials" style={{ color: 'var(--system-gray)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>로그인</h2>
          <p style={{ fontSize: 14, color: 'var(--system-gray)' }}>
            목회자 코드를 입력하여 내 정보를 확인하세요.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">목회자 코드</label>
              <input
                type="text"
                className="form-control"
                placeholder="예: 000001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                id="login-code-input"
              />
            </div>
          </div>
          {error && <p style={{ color: 'var(--system-red)', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: 17 }}
            disabled={loading}
            id="login-button"
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--system-gray2)', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
          목회자 코드는 총회 사무국에서 확인할 수 있습니다.<br />
          향후 Firebase 인증으로 전환될 예정입니다.
        </p>
      </main>
    </div>
  );
};

export default SimpleLogin;
