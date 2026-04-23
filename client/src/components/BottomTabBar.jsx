import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'home', label: '홈', path: '/', icon: 'home' },
  { id: 'documents', label: '증명서', path: '/documents', icon: 'description' },
  { id: 'directory', label: '주소록', path: '/directory', icon: 'group' },
  { id: 'profile', label: '내 정보', path: '/profile', icon: 'person' },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return null;
    if (path.startsWith('/documents') || path.startsWith('/presbytery')) return 'documents';
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
                if (navigator.vibrate) navigator.vibrate(40);
                navigate(tab.path);
              }}
              className={`no-select no-tap-highlight flex flex-col items-center justify-center active:scale-95 transition-transform duration-200 relative ${
                isActive 
                  ? 'text-[#0070eb] after:content-[""] after:w-1 after:h-1 after:bg-[#0070eb] after:rounded-full after:mt-1' 
                  : 'text-slate-400 group hover:text-slate-600 pb-2'
              }`}
            >
              <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                {tab.icon}
              </span>
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
