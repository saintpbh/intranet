import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';
import MyProfile from './MyProfile';
import MyHistory from './MyHistory';
import CertRequest from './CertRequest';
import { useState, useCallback } from 'react';
import { useBackButton } from '../useBackButton';

const MyInfoPage = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const [view, setView] = useState('main');

  const goBack = useCallback(() => setView('main'), []);
  useBackButton(view !== 'main' && isLoggedIn, goBack);

  if (!isLoggedIn) return <SimpleLogin />;

  if (view === 'profile') return <MyProfile user={user} onBack={goBack} />;
  if (view === 'history') return <MyHistory user={user} onBack={goBack} />;
  if (view === 'cert') return <CertRequest user={user} onBack={goBack} />;

  const menuItems = [
    { id: 'profile', label: '현재 정보', icon: '👤', desc: '내 등록 정보 확인' },
    { id: 'history', label: '사역 이력', icon: '📋', desc: '교회 배정 이력 조회' },
    { id: 'cert', label: '증명서 요청', icon: '📄', desc: '재직증명서 등 발급 요청' },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <img src="/assets/logo_v3.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>내정보</h1>
          </div>
          <button onClick={logout} className="header-nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            로그아웃
          </button>
        </div>
      </header>
      <main className="app-main" style={{ padding: '0 16px' }}>
        {/* Profile summary */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="profile-header" style={{ padding: '20px 16px' }}>
            <div className="profile-avatar">
              <span className="initials">{user.name?.charAt(0)}</span>
            </div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-subtitle">
              {[user.duty, user.church, user.presbytery].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="section-header">메뉴</div>
        <div className="grouped-list">
          {menuItems.map((item) => (
            <div key={item.id} className="result-row" onClick={() => setView(item.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="result-name" style={{ fontSize: 16 }}>
                  <span style={{ marginRight: 8 }}>{item.icon}</span>
                  {item.label}
                </div>
                <div className="result-subtitle" style={{ paddingLeft: 32 }}>{item.desc}</div>
              </div>
              <svg className="chevron" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>

        {/* Future features */}
        <div className="section-header" style={{ marginTop: 24 }}>추가 기능 (예정)</div>
        <div className="grouped-list" style={{ opacity: 0.5, marginBottom: 32 }}>
          {[
            { label: '알림 설정', icon: '🔔' },
            { label: '연회비 납부', icon: '💳' },
            { label: '교육 이수 현황', icon: '🎓' },
          ].map((item, idx) => (
            <div key={idx} className="result-row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1 }}>
                <div className="result-name" style={{ fontSize: 16, color: 'var(--system-gray)' }}>
                  <span style={{ marginRight: 8 }}>{item.icon}</span>
                  {item.label}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--system-gray3)' }}>준비중</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default MyInfoPage;
