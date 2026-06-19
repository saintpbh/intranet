import { useLocation, useNavigate } from 'react-router-dom';
import { triggerHaptic } from '../utils/haptics';

const tabs = [
  { id: 'home', label: '홈', path: '/', icon: 'home' },
  { id: 'directory', label: '주소록', path: '/directory', icon: 'group' },
  { id: 'church', label: '교회', path: '/church', icon: 'church' },
  { id: 'documents', label: '연금/생보', path: '/documents', icon: 'sheep' },
  { id: 'profile', label: '내 정보', path: '/profile', icon: 'person' },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return null;
    if (path.startsWith('/documents') || path.startsWith('/presbytery')) return 'documents';
    if (path.startsWith('/church')) return 'church';
    if (path.startsWith('/directory') || path.startsWith('/search') || path.startsWith('/minister') || path.startsWith('/elder')) return 'directory';
    if (path.startsWith('/profile') || path.startsWith('/myinfo')) return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-8 pb-8 pt-4 bg-white/80 backdrop-blur-2xl">
      <div className="fixed bottom-6 left-6 right-6 h-16 bg-white/90 rounded-full shadow-[0_20px_40px_rgba(10,37,64,0.06)] flex justify-around items-center px-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic(40);
                
                // Dispatch reset events for the corresponding tabs to clear any open sub-views or states
                if (tab.id === 'home') {
                  window.dispatchEvent(new CustomEvent('reset-home-view'));
                } else if (tab.id === 'documents') {
                  window.dispatchEvent(new CustomEvent('reset-documents-view'));
                } else if (tab.id === 'church') {
                  window.dispatchEvent(new CustomEvent('reset-church-view'));
                } else if (tab.id === 'directory') {
                  window.dispatchEvent(new CustomEvent('reset-directory-view'));
                } else if (tab.id === 'profile') {
                  window.dispatchEvent(new CustomEvent('reset-profile-view'));
                }

                navigate(tab.path);
              }}
              className={`no-select no-tap-highlight flex flex-col items-center justify-center active:scale-95 transition-transform duration-200 relative ${
                isActive 
                  ? 'text-[#0070eb] after:content-[""] after:w-1 after:h-1 after:bg-[#0070eb] after:rounded-full after:mt-1' 
                  : 'text-slate-400 group hover:text-slate-600 pb-2'
              }`}
            >
              {tab.icon === 'sheep' ? (
                <svg className="w-6 h-6 mb-1 text-current fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  {/* Head */}
                  <path d="M6 12c-1.5 0-2.5 1-2.5 2s1 1.5 2 1.5h1" />
                  <path d="M5 12c0-1.5 1-2.5 2.5-2.5" />
                  {/* Body/Wool */}
                  <path d="M7.5 9.5C7.5 8 9 7 10.5 7c1.5 0 2.5 1 3 2 .5-1 2-1 3 0 1 0 2 .5 2.5 1.5 1 0 2 1 2 2.5s-1 2.5-2.5 2.5" />
                  <path d="M6.5 15.5h12" />
                  {/* Legs */}
                  <path d="M9 15.5v4" />
                  <path d="M12 15.5v4" />
                  <path d="M15 15.5v4" />
                  <path d="M17 15.5v4" />
                </svg>
              ) : (
                <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                  {tab.icon}
                </span>
              )}
              <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
