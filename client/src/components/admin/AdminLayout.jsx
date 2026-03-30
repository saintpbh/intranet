import { useState } from 'react';
import { Link } from 'react-router-dom';
import GeneralAssemblyTab from './GeneralAssemblyTab';
import PresbyteryTab from './PresbyteryTab';
import SichalTab from './SichalTab';
import ChurchTab from './ChurchTab';
import PersonalTab from './PersonalTab';

const adminTabs = [
  { id: 'assembly', label: '총회', icon: '🏛️', desc: '최종 승인 · 발급' },
  { id: 'presbytery', label: '노회', icon: '📋', desc: '확인 · 경유' },
  { id: 'sichal', label: '시찰', icon: '🔍', desc: '경유 · 확인' },
  { id: 'church', label: '교회', icon: '⛪', desc: '접수 · 확인' },
  { id: 'personal', label: '개인', icon: '👤', desc: '신청 · 조회' },
];

const AdminLayout = () => {
  const [activeTab, setActiveTab] = useState('assembly');

  const renderContent = () => {
    switch (activeTab) {
      case 'assembly': return <GeneralAssemblyTab />;
      case 'presbytery': return <PresbyteryTab />;
      case 'sichal': return <SichalTab />;
      case 'church': return <ChurchTab />;
      case 'personal': return <PersonalTab />;
      default: return null;
    }
  };

  return (
    <div className="admin-layout" id="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <img src="/assets/logo_v3.png" alt="한국기독교장로회총회" style={{ height: 24 }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 0' }}>관리자 시스템</h2>
        </div>
        <nav className="admin-nav">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ marginRight: 10 }}>{tab.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div>{tab.label}</div>
                <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{tab.desc}</div>
              </div>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" style={{ color: 'var(--system-blue)', textDecoration: 'none', fontSize: 14 }}>
            ← 사용자 화면으로
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        <header className="admin-header">
          <h1>
            {adminTabs.find(t => t.id === activeTab)?.icon}{' '}
            {adminTabs.find(t => t.id === activeTab)?.label} 관리
          </h1>
        </header>
        <div className="admin-content">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
