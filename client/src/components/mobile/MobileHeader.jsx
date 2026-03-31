import { useAuth } from '../../AuthContext';

const MobileHeader = ({ title, showBack = false, onBack }) => {
  const { user } = useAuth();
  
  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-white/70 backdrop-blur-2xl shadow-[0_20px_40px_rgba(10,37,64,0.06)] flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-4">
        {showBack && (
          <button onClick={onBack} className="active:scale-95 transition-transform duration-200 text-slate-900 flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>arrow_back</span>
          </button>
        )}
        {!showBack && (
          <img src="/assets/admin_logo.png" alt="Logo" className="h-6 w-auto" />
        )}
        {title && <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg tracking-tight text-primary-container">{title}</h1>}
      </div>
      {user && (
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container/10 bg-surface-container-high flex items-center justify-center shadow-sm">
          <span className="font-bold text-primary">{user?.name?.charAt(0) || 'U'}</span>
        </div>
      )}
    </header>
  );
};

export default MobileHeader;
