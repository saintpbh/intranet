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
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased pb-20">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-variant flex items-center justify-between px-6 py-4">
        <button className="flex items-center justify-center p-2 -ml-2 text-on-surface-variant hover:text-primary transition-colors active:scale-90" onClick={onBack}>
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary tracking-tight">사역 이력</h1>
        <div className="w-8"></div>
      </header>

      <main className="pt-24 px-6 max-w-md mx-auto space-y-8 animate-fade-in">
        {/* Profile Summary Card */}
        <div className="bg-gradient-to-br from-surface-container-low to-white rounded-[2rem] p-6 shadow-sm border border-surface-variant/50 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold shadow-inner mb-3">
             {user.name?.charAt(0)}
          </div>
          <h2 className="font-['Manrope',_'Pretendard'] text-xl font-bold text-primary">{user.name}</h2>
          <p className="text-sm font-medium text-on-surface-variant mt-1">교회 배정 이력</p>
        </div>

        {loading && <div className="text-center py-12 text-on-surface-variant font-medium">불러오는 중...</div>}
        {error && <div className="text-center py-12 text-error font-medium bg-error-container/30 rounded-2xl">{error}</div>}

        {!loading && !error && history.length === 0 && (
          <div className="text-center py-16 bg-surface-container-lowest rounded-[2rem] border border-dashed border-surface-variant">
             <span className="material-symbols-outlined text-4xl text-outline-variant mb-3">history_toggle_off</span>
             <p className="text-on-surface-variant font-medium">사역 이력이 없습니다.</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-6">
            {/* Current assignments */}
            {history.filter(h => h.is_current).length > 0 && (
              <section>
                <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-4 px-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">church</span>
                  현재 사역지
                </h3>
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-surface-variant/50 space-y-4 relative">
                  {history.filter(h => h.is_current).map((h, idx) => (
                    <div key={idx} className="flex flex-col relative pl-4 border-l-2 border-secondary">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-['Manrope',_'Pretendard'] font-bold text-[17px] text-on-surface">{h.ChrName || h.CHRNAME}</span>
                        <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">현재 진행중</span>
                      </div>
                      <div className="text-sm font-medium text-on-surface-variant mt-0.5">
                        {h.DUTYNAME && <span className="text-primary font-bold mr-1">{h.DUTYNAME}</span>} 
                        <span className="text-outline text-[13px]">• {h.start_year ? `${h.start_year}년 ~` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Past assignments */}
            {history.filter(h => !h.is_current).length > 0 && (
              <section>
                <h3 className="font-['Manrope',_'Pretendard'] font-bold text-on-surface-variant mb-4 px-2 flex items-center gap-2 opacity-80">
                  <span className="material-symbols-outlined text-outline text-xl">history</span>
                  이전 사역지
                </h3>
                <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-surface-variant/30 space-y-5 relative">
                  {history.filter(h => !h.is_current).map((h, idx) => (
                    <div key={idx} className="flex flex-col relative pl-4 border-l-2 border-outline-variant/30 pb-4 last:pb-0">
                      <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-outline-variant/50"></div>
                      <div className="font-['Manrope',_'Pretendard'] font-bold text-[16px] text-on-surface-variant mb-1">{h.ChrName || h.CHRNAME}</div>
                      <div className="text-[13px] font-medium text-outline">
                        {h.DUTYNAME && <span className="font-bold mr-1">{h.DUTYNAME}</span>}
                        {h.start_year && h.end_year ? `• ${h.start_year} ~ ${h.end_year}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyHistory;
