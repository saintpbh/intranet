import API_BASE from '../api';
import { useState, useEffect } from 'react';

const ElderList = ({ searchTerm, onSelect }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') { setData([]); return; }
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/elders?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          if (errData.error === 'db_connection_failed') {
            setError('DB연결 오류! 데이터베이스 서버에 접속할 수 없습니다. 다른 기능은 계속 사용 가능합니다.');
          } else {
            setError(errData.message || '서버 오류가 발생했습니다.');
          }
          return;
        }
        const json = await response.json();
        if (json.error) {
          setError(json.error === 'db_connection_failed' ? 'DB연결 오류! 데이터베이스에 접속할 수 없습니다.' : json.error);
          return;
        }
        setData(json);
      } catch (err) { setError('네트워크 오류 — 서버에 연결할 수 없습니다.'); } finally { setLoading(false); }
    };
    fetchData();
  }, [searchTerm]);

  if (!searchTerm || searchTerm.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>person_search</span>
        <p className="text-on-surface-variant font-medium">이름, 노회명, 교회명으로 검색해 주세요.</p>
      </div>
    );
  }
  
  if (loading) return <div className="text-center py-12 text-on-surface-variant font-medium">검색 중...</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="material-symbols-outlined text-5xl text-amber-500 mb-3" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>cloud_off</span>
      <p className="text-error font-bold text-base mb-1">연결 오류</p>
      <p className="text-on-surface-variant text-sm max-w-xs">{error}</p>
    </div>
  );
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>search_off</span>
      <p className="text-on-surface-variant font-medium">검색 결과가 없습니다.</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-surface-container-lowest">
      <div className="flex items-end justify-between mb-6">
        <div>
          <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">직분자</span>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-2xl text-primary">장로 <span className="text-sm font-medium text-outline ml-2">{data.length}명</span></h3>
        </div>
      </div>
      
      <div className="divide-y divide-surface-container-high border-t border-surface-container-high">
        {data.map((item, idx) => {
          return (
            <div 
              key={idx} 
              onClick={() => onSelect(item.PriestCode)}
              className="p-4 flex items-center justify-between group cursor-pointer hover:bg-surface-container-lowest/50 active:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary/40 font-bold border border-outline-variant/20 flex-shrink-0">
                  {item.PriestName?.charAt(0) || 'E'}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-primary group-hover:text-secondary transition-colors text-base truncate">
                    {item.PriestName?.trim()}
                  </h4>
                  <p className="text-xs text-on-surface-variant font-medium truncate mt-0.5">
                    {[item.ChrName, item.NohName].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline-variant/50 group-hover:text-secondary group-hover:translate-x-1 transition-all">chevron_right</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ElderList;
