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
      <div className="empty-state">
        <img src="/assets/banner_v2.png" alt="새 역사 70년" className="empty-state-banner" />
        <p>이름, 노회명, 교회명으로 검색해 주세요.</p>
      </div>
    );
  }
  if (loading) return <div className="loading">불러오는 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (data.length === 0) return (
    <div className="no-results">
      <img src="/assets/banner_v2.png" alt="새 역사 70년" className="empty-state-banner" style={{opacity: 0.5, maxWidth: '200px', marginBottom: '16px'}} />
      <p>검색 결과가 없습니다.</p>
    </div>
  );

  return (
    <div className="list-container">
      <div className="result-count">{data.length}건의 검색 결과</div>
      <div className="grouped-list">
        {data.map((item, idx) => {
           const details = [item.NohName, item.SichalName].filter(Boolean);
           return (
            <div key={idx} className="result-row" onClick={() => onSelect(item)}>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="result-name">{item.ChrName?.trim()}</div>
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
export default ChurchList;
