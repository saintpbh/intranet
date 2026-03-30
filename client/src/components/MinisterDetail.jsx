import API_BASE from '../api';
import { useState, useEffect } from 'react';

const MinisterDetail = ({ ministerCode, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ministers/${ministerCode}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ministerCode]);

  if (loading) return <div className="loading">불러오는 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return (
    <div style={{padding: '0 16px'}}>

      <div className="profile-header">
        <div className="profile-avatar" style={{backgroundColor: '#C7C7CC'}}>
          <span className="initials" style={{fontSize: '32px'}}>{data.MinisterName?.trim()?.charAt(0) || '?'}</span>
        </div>
        <div className="profile-name">{data.MinisterName?.trim()}</div>
        <div className="profile-subtitle">{data.NOHNAME} · {data.CHRNAME}</div>
        {data.DUTYNAME && <span className="badge" style={{marginTop: '4px'}}>{data.DUTYNAME}</span>}
      </div>

      <div className="card">
        <div className="info-row">
          <span className="info-label">휴대전화</span>
          {data.TEL_MOBILE ? <a href={`tel:${data.TEL_MOBILE}`} className="info-link">{data.TEL_MOBILE}</a> : <span className="info-text">-</span>}
        </div>
        <div className="info-row">
          <span className="info-label">교회전화</span>
          {data.TEL_CHURCH ? <a href={`tel:${data.TEL_CHURCH}`} className="info-link">{data.TEL_CHURCH}</a> : <span className="info-text">-</span>}
        </div>
        <div className="info-row">
          <span className="info-label">이메일</span>
          {data.EMAIL ? <a href={`mailto:${data.EMAIL}`} className="info-link">{data.EMAIL}</a> : <span className="info-text">-</span>}
        </div>
      </div>

      <div className="card" style={{marginTop: '16px'}}>
        <div className="info-row">
          <span className="info-label">목회자코드</span>
          <span className="info-text" style={{fontFamily: 'monospace', letterSpacing: '0.5px'}}>{data.MinisterCode}</span>
        </div>
        <div className="info-row">
          <span className="info-label">소속교회</span>
          <span className="info-text">{data.CHRNAME || '-'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">노회</span>
          <span className="info-text">{data.NOHNAME || '-'}</span>
        </div>
        {data.JUSO && (
          <div className="info-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '4px'}}>
            <span className="info-label">소재지</span>
            <span className="info-text">{data.JUSO}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MinisterDetail;
