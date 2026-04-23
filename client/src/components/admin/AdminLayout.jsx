import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import GeneralAssemblyTab from './GeneralAssemblyTab';
import PresbyteryTab from './PresbyteryTab';
import SichalTab from './SichalTab';
import ChurchTab from './ChurchTab';
import PersonalTab from './PersonalTab';
import ApiImage from '../ApiImage';

const adminTabs = [
  { id: 'assembly', label: '총회', icon: 'account_balance', desc: '최종 승인 · 발급' },
  { id: 'presbytery', label: '노회', icon: 'assignment', desc: '확인 · 경유' },
  { id: 'sichal', label: '시찰', icon: 'manage_search', desc: '경유 · 확인' },
  { id: 'church', label: '교회', icon: 'church', desc: '접수 · 확인' },
  { id: 'personal', label: '개인', icon: 'person', desc: '신청 · 조회' },
];

const AdminLayout = () => {
  const [activeTab, setActiveTab] = useState('assembly');
  const [tabHistory, setTabHistory] = useState(['assembly']);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Apply full-width styling by adding a class to the body
  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => document.body.classList.remove('admin-mode');
  }, []);

  // Track tab changes in browser history
  const switchTab = useCallback((tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setTabHistory(prev => [...prev, tabId]);
    // Push a new history entry so back-button works
    window.history.pushState({ adminTab: tabId }, '');
  }, [activeTab]);

  // Back-button handler: go to previous tab, then to home
  useEffect(() => {
    // Push initial guard entry
    window.history.pushState({ adminTab: 'assembly', guard: true }, '');

    const handlePopState = (e) => {
      const state = e.state;

      // If the state has an admin tab, navigate to it
      if (state?.adminTab && state.adminTab !== activeTab) {
        setActiveTab(state.adminTab);
        return;
      }

      // If tab history has entries, go back through tabs
      setTabHistory(prev => {
        if (prev.length > 1) {
          const newHistory = prev.slice(0, -1);
          const prevTab = newHistory[newHistory.length - 1];
          setActiveTab(prevTab);
          window.history.pushState({ adminTab: prevTab, guard: true }, '');
          return newHistory;
        }
        // Already on first tab — navigate back to home instead of exiting
        navigate('/', { replace: true });
        return prev;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, navigate]);

  const renderContent = () => {
    switch (activeTab) {
      case 'assembly': return <GeneralAssemblyTab user={user} />;
      case 'presbytery': return <PresbyteryTab user={user} />;
      case 'sichal': return <SichalTab user={user} />;
      case 'church': return <ChurchTab user={user} />;
      case 'personal': return <PersonalTab user={user} />;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F2F7', fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 280, flexShrink: 0, position: 'fixed', left: 0, top: 0, height: '100vh',
        background: '#fafbff', zIndex: 50, display: 'flex', flexDirection: 'column',
        padding: 24, boxShadow: '20px 0 40px rgba(10,37,64,0.04)', overflowY: 'auto'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40, padding: '0 8px' }}>
          <ApiImage src="/assets/admin_logo.png" alt="한국기독교장로회총회" style={{ height: 36, width: 'auto', objectFit: 'contain' }} className="" />
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {adminTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                  borderRadius: 12, border: 'none', cursor: 'pointer', width: '100%',
                  background: isActive ? 'rgba(0,112,235,0.06)' : 'transparent',
                  color: isActive ? '#0070eb' : '#64748b',
                  fontWeight: isActive ? 700 : 500, fontSize: 14, textAlign: 'left',
                  fontFamily: "'Manrope', 'Pretendard'", transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                {isActive && <div style={{ position: 'absolute', left: -16, width: 4, height: 24, background: '#0070eb', borderRadius: '0 4px 4px 0' }} />}
                <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" }}>{tab.icon}</span>
                <div>
                  <div>{tab.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ paddingTop: 16, borderTop: '1px solid rgba(226,226,231,0.5)' }}>
          <Link to="/" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            color: '#64748b', textDecoration: 'none', fontSize: 14, fontWeight: 500,
            fontFamily: "'Manrope'", transition: 'color 0.2s'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
            <span>사용자 화면으로</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: 280, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 40, width: '100%',
          background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          height: 72, padding: '0 32px'
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A2540', fontFamily: "'Manrope', 'Pretendard'" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, marginRight: 8, verticalAlign: 'middle' }}>
              {adminTabs.find(t => t.id === activeTab)?.icon}
            </span>
            {adminTabs.find(t => t.id === activeTab)?.label} 관리
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0A2540' }}>{user?.name || '관리자'}</p>
              <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Administrator</p>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #0058bc, #0070eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              {(user?.name || '관')[0]}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div style={{ padding: '32px 40px', flex: 1 }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
