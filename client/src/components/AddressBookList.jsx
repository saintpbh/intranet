import API_BASE from '../api';
import { useState, useEffect } from 'react';
import ApiImage from './ApiImage';

const AddressBookList = ({ searchTerm, onSelect }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') { setData([]); return; }
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/addressbook?search=${encodeURIComponent(searchTerm)}`);
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
      <div className="empty-state">
        <ApiImage src="/assets/banner_v2.png" alt="새 역사 70년" className="empty-state-banner" />
        <p>이름, 노회명, 교회명으로 검색해 주세요.</p>
      </div>
    );
  }
  if (loading) return <div className="loading">불러오는 중...</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="material-symbols-outlined text-5xl text-amber-500 mb-3" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>cloud_off</span>
      <p className="text-error font-bold text-base mb-1">연결 오류</p>
      <p className="text-on-surface-variant text-sm max-w-xs">{error}</p>
    </div>
  );
  if (data.length === 0) return (
    <div className="no-results">
      <ApiImage src="/assets/banner_v2.png" alt="새 역사 70년" className="empty-state-banner" style={{opacity: 0.5, maxWidth: '200px', marginBottom: '16px'}} />
      <p>검색 결과가 없습니다.</p>
    </div>
  );

  return (
    <div className="list-container">
      <div className="result-count">{data.length}건의 검색 결과</div>
      <div className="grouped-list">
        {data.map((item, idx) => {
           const details = [item.NOHNAME, item.CHRNAME].filter(Boolean);
           return (
            <div key={idx} className="result-row" onClick={() => onSelect(item.MINISTERCODE)}>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="result-name">{item.MINISTERNAME?.trim()}</div>
                {details.length > 0 && <div className="result-subtitle">{details.join(' · ')}</div>}
              </div>
              <svg className="chevron" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default AddressBookList;
