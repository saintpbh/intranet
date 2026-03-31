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
      const res = await fetch(`${API_BASE}/api/ministers/${code.trim()}`);
      const data = await res.json();
      if (data.error) {
        setError('해당 코드로 등록된 정보를 찾을 수 없습니다.');
      } else {
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
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-variant flex items-center justify-center px-6 py-4">
        <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary tracking-tight">내 정보</h1>
      </header>
      
      <main className="pt-24 px-6 pb-20 max-w-md mx-auto space-y-8 animate-fade-in">
        <div className="text-center pt-8">
          <div className="w-20 h-20 rounded-full bg-surface-variant mx-auto mb-6 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl text-outline">person_outline</span>
          </div>
          <h2 className="font-['Manrope',_'Pretendard'] text-2xl font-bold text-primary mb-2">로그인</h2>
          <p className="text-sm font-medium text-on-surface-variant">
            목회자 코드를 입력하여 내 정보를 확인하세요.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-variant/50">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-code-input" className="text-xs font-bold text-outline uppercase tracking-wider pl-1">
                목회자 코드
              </label>
              <input
                id="login-code-input"
                type="text"
                placeholder="예: 000001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-surface-container-low rounded-xl px-4 py-4 text-[15px] text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:bg-white transition-all"
              />
            </div>
          </div>
          
          {error && (
             <div className="flex items-center justify-center gap-2 p-3 bg-error-container text-on-error-container rounded-xl text-sm font-medium animate-shake">
               <span className="material-symbols-outlined text-[18px]">error</span>
               {error}
             </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-md shadow-secondary/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                확인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        <p className="text-[12px] text-outline text-center leading-relaxed px-4 pt-4 border-t border-surface-variant/50">
          목회자 코드는 총회 사무국에서 확인할 수 있습니다.<br />
          향후 Firebase 인증으로 전환될 예정입니다.
        </p>
      </main>
    </div>
  );
};

export default SimpleLogin;
