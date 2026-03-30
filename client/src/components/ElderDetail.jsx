import API_BASE from '../api';
import { useState, useEffect } from 'react';

const ElderDetail = ({ priestCode, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/elders/${priestCode}`);
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
  }, [priestCode]);

  if (loading) return <div className="loading">불러오는 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  const fullAddress = [data.Address, data.Juso].filter(Boolean).join(' ') || '-';

  return (
    <div style={{padding: '0 16px'}}>
      <button className="btn-back" onClick={onBack}>‹ 뒤로</button>

      <div className="profile-header">
        <div className="profile-avatar" style={{backgroundColor: '#C7C7CC'}}>
          <span className="initials" style={{fontSize: '32px'}}>{data.PriestName?.trim()?.charAt(0) || '?'}</span>
        </div>
        <div className="profile-name">{data.PriestName?.trim()}</div>
        <div className="profile-subtitle">{data.NohName} · {data.ChrName}</div>
      </div>

      <div className="card">
        <div className="info-row">
          <span className="info-label">휴대전화</span>
          {data.Tel_Mobile ? <a href={`tel:${data.Tel_Mobile}`} className="info-link">{data.Tel_Mobile}</a> : <span className="info-text">-</span>}
        </div>
        <div className="info-row">
          <span className="info-label">자택전화</span>
          {data.Tel_Home ? <a href={`tel:${data.Tel_Home}`} className="info-link">{data.Tel_Home}</a> : <span className="info-text">-</span>}
        </div>
        <div className="info-row">
          <span className="info-label">이메일</span>
          {data.Email ? <a href={`mailto:${data.Email}`} className="info-link">{data.Email}</a> : <span className="info-text">-</span>}
        </div>
      </div>

      <div className="card" style={{marginTop: '16px'}}>
        <div className="info-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '4px'}}>
          <span className="info-label">소재지</span>
          <span className="info-text" style={{fontSize: '15px', lineHeight: '1.4'}}>
            {fullAddress}
            {data.PostNo ? ` [${data.PostNo.trim()}]` : ''}
          </span>
        </div>
      </div>

      <div className="card" style={{marginTop: '16px'}}>
        {data.Occupation && (
          <div className="info-row">
            <span className="info-label">직업</span>
            <span className="info-text">{data.Occupation}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">소속교회</span>
          <span className="info-text">{data.ChrName || '-'}</span>
        </div>
      </div>
    </div>
  );
};

export default ElderDetail;
