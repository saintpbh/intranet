import API_BASE from '../api';
import { useState, useEffect } from 'react';
import ApiImage from './ApiImage';

const MinisterList = ({ searchTerm, onSelect }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') { setData([]); return; }
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/ministers?search=${encodeURIComponent(searchTerm)}`);
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
          <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">Leadership</span>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-2xl text-primary">Pastors <span className="text-sm font-medium text-outline ml-2">{data.length}명</span></h3>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {data.map((item, idx) => {
          return (
            <div 
              key={idx} 
              onClick={() => onSelect(item.MinisterCode)}
              className="bg-white border border-surface-variant/50 rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-md hover:border-secondary/30 transition-all group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-container flex-shrink-0 flex items-center justify-center shadow-inner overflow-hidden border border-outline-variant/20 relative">
                   {item.custom_image ? (
                     <ApiImage src={`${API_BASE}${item.custom_image}`} alt={item.MinisterName} className="w-full h-full object-cover" />
                   ) : (
                     <span className="text-2xl font-bold text-primary opacity-40">{item.MinisterName?.charAt(0) || 'M'}</span>
                   )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h4 className="font-['Manrope',_'Pretendard'] font-bold text-[17px] text-primary truncate">
                    {item.MinisterName?.trim()}
                  </h4>
                  <p className="text-secondary font-semibold text-[13px] mb-0.5 truncate mt-1">
                    {item.DUTYNAME || '목사'}
                  </p>
                  <p className="text-on-surface-variant text-[13px] font-medium truncate">
                    {[item.CHRNAME, item.NOHNAME].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <span className="material-symbols-outlined text-sm text-secondary">arrow_forward_ios</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MinisterList;
