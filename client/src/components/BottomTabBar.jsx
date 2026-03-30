import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  {
    id: 'home', label: '홈', path: '/',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'presbytery', label: '노회', path: '/presbytery',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'search', label: '검색', path: '/search',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: 'myinfo', label: '내정보', path: '/myinfo',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return null; // Admin has no tab active
    if (path.startsWith('/presbytery')) return 'presbytery';
    if (path.startsWith('/search') || path.startsWith('/minister') || path.startsWith('/elder')) return 'search';
    if (path.startsWith('/myinfo')) return 'myinfo';
    return 'home';
  };

  const activeTab = getActiveTab();

  // Don't show tab bar on admin pages
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <nav className="bottom-tab-bar" id="bottom-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
          id={`tab-${tab.id}`}
        >
          <span className="bottom-tab-icon">{tab.icon}</span>
          <span className="bottom-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomTabBar;
