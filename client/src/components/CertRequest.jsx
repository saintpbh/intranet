import { useState, useEffect } from 'react';
import API_BASE from '../api';

const getTypeLabel = (type) => {
  if (type === 'approve') return '결재';
  if (type === 'pass') return '경유';
  if (type === 'issue') return '발급';
  return type;
};

const getTypeColor = (type) => {
  if (type === 'approve') return '#007AFF';
  if (type === 'pass') return '#FF9500';
  if (type === 'issue') return '#34C759';
  return '#8E8E93';
};

const CertRequest = ({ user, onBack }) => {
  const [certTypes, setCertTypes] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [memo, setMemo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/cert-types?active_only=true`)
      .then(r => r.json())
      .then(data => setCertTypes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedCert) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/cert-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minister_code: user.code,
          minister_name: user.name,
          cert_type: selectedCert.name,
          cert_label: selectedCert.name,
          memo,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      alert('요청 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-bar">
            <button className="btn-back" onClick={onBack}>뒤로</button>
            <div className="header-title-group"><h1>증명서 요청</h1></div>
          </div>
        </header>
        <main className="app-main" style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>요청이 접수되었습니다</h2>
          <p style={{ fontSize: 15, color: 'var(--system-gray)', lineHeight: 1.6, marginBottom: 24 }}>
            {selectedCert.name} 발급 요청이 접수되었습니다.<br />
            결재 흐름에 따라 순서대로 처리됩니다.
          </p>
          {/* Show workflow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#E5E5EA', fontWeight: 500 }}>신청</span>
            {selectedCert.workflow.map((step, idx) => (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--system-gray)', fontSize: 11 }}>→</span>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: `${getTypeColor(step.type)}15`, color: getTypeColor(step.type), fontWeight: 500 }}>
                  {step.label} ({getTypeLabel(step.type)})
                </span>
              </span>
            ))}
          </div>
          <button className="btn btn-primary" onClick={onBack} style={{ padding: '12px 32px' }}>
            확인
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <button className="btn-back" onClick={onBack}>뒤로</button>
          <div className="header-title-group"><h1>증명서 요청</h1></div>
        </div>
      </header>
      <main className="app-main" style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--system-gray)' }}>불러오는 중...</div>
        ) : (
          <>
            <div className="section-header">증명서 종류 선택</div>
            <div className="grouped-list">
              {certTypes.map((cert) => (
                <div
                  key={cert.id}
                  className="result-row"
                  onClick={() => setSelectedCert(cert)}
                  style={{
                    background: selectedCert?.id === cert.id ? 'rgba(0, 122, 255, 0.06)' : undefined,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="result-name" style={{ fontSize: 16 }}>{cert.name}</div>
                    <div className="result-subtitle">{cert.description}</div>
                    {/* Mini workflow preview */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                      {cert.workflow.filter(s => s.type !== 'issue').map((step, idx) => (
                        <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {idx > 0 && <span style={{ color: 'var(--system-gray3)', fontSize: 9 }}>→</span>}
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: `${getTypeColor(step.type)}15`, color: getTypeColor(step.type) }}>
                            {step.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {selectedCert?.id === cert.id && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--system-blue)" stroke="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {selectedCert && (
              <>
                <div className="section-header">비고 (선택)</div>
                <div className="card" style={{ padding: 0 }}>
                  <div className="form-group">
                    <textarea
                      className="form-control"
                      placeholder="추가 요청 사항이 있으면 입력해 주세요."
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      rows={3}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ width: '100%', padding: '14px', fontSize: 17, marginTop: 24, marginBottom: 32 }}
                >
                  {submitting ? '전송 중...' : '요청하기'}
                </button>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CertRequest;
