import API_BASE from '../api';
import { useState, useEffect } from 'react';

const ChurchDetail = ({ church, onBack }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormer, setShowFormer] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/churches/${church.ChrCode}/staff`);
        const data = await response.json();
        setStaff(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [church.ChrCode]);

  const currentStaff = staff.filter(s => s.is_current);
  const formerStaff = staff.filter(s => !s.is_current);
  const seniorPastor = currentStaff.find(s => s.DUTYNAME && s.DUTYNAME.includes('담임'));
  const otherCurrentStaff = currentStaff.filter(s => s !== seniorPastor);

  const StaffRow = ({ person, showYears }) => (
    <div className="info-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '10px 0'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <strong>{person.MinisterName?.trim()}</strong>
          {person.DUTYNAME && <span className="badge">{person.DUTYNAME}</span>}
        </div>
        {showYears && person.start_year && (
          <span style={{fontSize: '13px', color: 'var(--text-secondary)'}}>
            {person.start_year}{person.end_year ? `–${person.end_year}` : '–'}
          </span>
        )}
      </div>
      <div style={{fontSize: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
        {person.TEL_MOBILE && <a href={`tel:${person.TEL_MOBILE}`} className="info-link">{person.TEL_MOBILE}</a>}
        {person.EMAIL && <a href={`mailto:${person.EMAIL}`} className="info-link">{person.EMAIL}</a>}
      </div>
    </div>
  );

  return (
    <div style={{padding: '0 16px'}}>
      <button className="btn-back" onClick={onBack}>‹ 뒤로</button>

      <div className="profile-header">
        <div className="profile-avatar" style={{backgroundColor: '#C7C7CC'}}>
          <span className="initials" style={{fontSize: '28px'}}>{church.ChrName?.trim()?.charAt(0) || '?'}</span>
        </div>
        <div className="profile-name">{church.ChrName?.trim()}</div>
        <div className="profile-subtitle">{church.SichalName} ({church.NohName})</div>
      </div>

      {seniorPastor && (
        <div className="card senior-pastor-card">
          <div className="info-row" style={{alignItems: 'center'}}>
            <span className="info-label" style={{fontWeight: 600}}>담임목사</span>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <strong>{seniorPastor.MinisterName?.trim()}</strong>
              {seniorPastor.TEL_MOBILE && <a href={`tel:${seniorPastor.TEL_MOBILE}`} className="info-link">{seniorPastor.TEL_MOBILE}</a>}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{marginTop: '12px'}}>
        <div className="info-row">
          <span className="info-label">교회전화</span>
          {church.Tel_Church ? <a href={`tel:${church.Tel_Church}`} className="info-link">{church.Tel_Church}</a> : <span className="info-text">-</span>}
        </div>
        <div className="info-row">
          <span className="info-label">이메일</span>
          {church.Email ? <a href={`mailto:${church.Email}`} className="info-link">{church.Email}</a> : <span className="info-text">-</span>}
        </div>
        <div className="info-row">
          <span className="info-label">팩스</span>
          <span className="info-text">{church.Tel_Fax || '-'}</span>
        </div>
      </div>

      <div className="card" style={{marginTop: '16px'}}>
        <div className="info-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '4px'}}>
          <span className="info-label">소재지</span>
          <span className="info-text" style={{fontSize: '15px', lineHeight: '1.4'}}>
            {[church.Address, church.Juso].filter(Boolean).join(' ') || '-'}
            {church.PostNo ? ` [${church.PostNo.trim()}]` : ''}
          </span>
        </div>
      </div>

      {otherCurrentStaff.length > 0 && (
        <>
          <div style={{fontSize: '13px', color: 'var(--text-secondary)', margin: '16px 0 8px', padding: '0 4px'}}>
            현재 교역자 ({otherCurrentStaff.length}명)
          </div>
          <div className="card">
            {otherCurrentStaff.map((person, idx) => (
              <StaffRow key={idx} person={person} showYears={false} />
            ))}
          </div>
        </>
      )}

      {formerStaff.length > 0 && (
        <>
          {!showFormer ? (
            <button className="former-staff-btn" onClick={() => setShowFormer(true)}>
              이전 교역자 보기 ({formerStaff.length}명)
            </button>
          ) : (
            <>
              <div style={{fontSize: '13px', color: 'var(--text-secondary)', margin: '16px 0 8px', padding: '0 4px', display: 'flex', justifyContent: 'space-between'}}>
                <span>이전 교역자 ({formerStaff.length}명)</span>
                <button onClick={() => setShowFormer(false)} style={{background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px'}}>접기</button>
              </div>
              <div className="card">
                {formerStaff.map((person, idx) => (
                  <StaffRow key={idx} person={person} showYears={true} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {loading && <div className="loading">교역자 정보 불러오는 중...</div>}
    </div>
  );
};

export default ChurchDetail;
