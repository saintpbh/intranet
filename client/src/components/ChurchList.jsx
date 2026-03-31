import API_BASE from '../api';
import { useState, useEffect } from 'react';

const ChurchList = ({ searchTerm, onSelect }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') { setData([]); return; }
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/churches?search=${encodeURIComponent(searchTerm)}`);
        const json = await response.json();
        setData(json);
      } catch (err) { setError('데이터를 불러오는데 실패했습니다.'); } finally { setLoading(false); }
    };
    fetchData();
  }, [searchTerm]);

  if (!searchTerm || searchTerm.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>church</span>
        <p className="text-on-surface-variant font-medium">이름, 노회명, 교회명으로 검색해 주세요.</p>
      </div>
    );
  }
  
  if (loading) return <div className="text-center py-12 text-on-surface-variant font-medium">검색 중...</div>;
  if (error) return <div className="text-center py-12 text-error font-medium">{error}</div>;
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
          <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">소속 교회</span>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-2xl text-primary">교회 목록 <span className="text-sm font-medium text-outline ml-2">{data.length}개</span></h3>
        </div>
      </div>
      
      <div className="space-y-4">
        {data.map((item, idx) => {
          return (
            <div 
              key={idx} 
              onClick={() => onSelect(item)}
              className="bg-white border border-surface-variant/50 rounded-2xl flex flex-col sm:flex-row overflow-hidden shadow-[0_10px_20px_rgba(10,37,64,0.03)] hover:shadow-[0_20px_40px_rgba(10,37,64,0.06)] hover:border-secondary/30 transition-all cursor-pointer active:scale-[0.98] group"
            >
              <div className="h-20 sm:h-auto sm:w-32 bg-surface-container-low flex items-center justify-center flex-shrink-0">
                 <span className="material-symbols-outlined text-5xl text-outline-variant/30">account_balance</span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[11px] font-bold tracking-wide">{item.NOHNAME}</span>
                  <h4 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary truncate leading-tight">{item.CHRNAME?.trim()}</h4>
                </div>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mb-1 font-medium truncate">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  담임: {item.MOCKNAME || '미배정'}
                </p>
                <p className="text-xs text-outline flex items-center gap-1 font-medium truncate">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {item.ADDRESS ? item.ADDRESS.split(' ').slice(0, 3).join(' ') : '주소 미등록'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChurchList;
