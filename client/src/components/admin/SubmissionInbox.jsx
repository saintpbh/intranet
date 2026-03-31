import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const SubmissionInbox = ({ user, role = 'assembly' }) => {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/form-responses/pending?role=${role}`)
      .then(r => r.json())
      .then(data => setResponses(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPending(); }, [role]);

  const handleAction = async (rid, action) => {
    const comment = action === 'reject' ? prompt('반려 사유를 입력해 주세요:') : '';
    if (action === 'reject' && comment === null) return;
    if (!confirm(action === 'approve' ? '승인하시겠습니까?' : '반려하시겠습니까?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/form-responses/${rid}/step-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          actor_name: user?.name || '관리자',
          actor_role: role,
          comment: comment || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(action === 'approve' ? '승인되었습니다.' : '반려되었습니다.');
        fetchPending();
      } else {
        alert(data.error || '처리 실패');
      }
    } catch { alert('오류가 발생했습니다.'); }
  };

  const roleLabel = { assembly: '총회', presbytery: '노회', sichal: '시찰', church: '교회' };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📬 제출문서 ({roleLabel[role] || role} 결재)</h3>
        <p style={{ fontSize: 13, color: 'var(--system-gray)' }}>하위 기관에서 올라온 문서를 승인/반려합니다.</p>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--opaque-separator)' }}>
              결재 대기 중인 제출문서가 없습니다.
            </div>
          ) : responses.map(r => {
            const isExpanded = expandedId === r.id;
            const history = (() => { try { return JSON.parse(r.approval_history || '[]'); } catch { return []; } })();
            const steps = (() => { try { return JSON.parse(r.approval_steps || '[]'); } catch { return []; } })();
            const currentStep = r.current_step || 0;

            return (
              <div key={r.id} style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--opaque-separator)', overflow: 'hidden' }}>
                <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{r.doc_title || `문서#${r.document_id}`}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,149,0,0.1)', color: '#FF9500', fontWeight: 600 }}>결재 대기</span>
                      {steps[currentStep] && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#E8F0FE', color: '#007AFF' }}>
                          {steps[currentStep].step}: {steps[currentStep].target}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--system-gray)' }}>
                      제출자: {r.respondent_name} ({r.respondent_org}) · 제출일: {r.updated_at?.substring(0, 10)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px', color: '#FF3B30', borderColor: '#FF3B30' }}
                      onClick={() => handleAction(r.id, 'reject')}>반려</button>
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px', background: '#34C759' }}
                      onClick={() => handleAction(r.id, 'approve')}>✓ 승인</button>
                  </div>
                </div>

                {/* Expanded: approval timeline */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--opaque-separator)' }}>
                    {/* Steps progress */}
                    {steps.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, padding: '12px 0 8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {steps.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{
                              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              background: i < currentStep ? 'rgba(52,199,89,0.1)' : i === currentStep ? 'rgba(255,149,0,0.1)' : '#F2F2F7',
                              color: i < currentStep ? '#34C759' : i === currentStep ? '#FF9500' : '#8E8E93'
                            }}>
                              {i < currentStep ? '✓ ' : ''}{s.step}: {s.target}
                            </div>
                            {i < steps.length - 1 && <span style={{ color: '#C7C7CC', fontSize: 12 }}>→</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* History */}
                    {history.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', marginBottom: 6 }}>결재 이력</div>
                        {history.map((h, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              background: h.action === 'approve' ? '#34C759' : '#FF3B30', color: 'white'
                            }}>{h.action === 'approve' ? '✓' : '✕'}</div>
                            <span style={{ fontWeight: 500 }}>{h.actor} ({h.role})</span>
                            <span style={{ color: '#8E8E93' }}>{h.date?.substring(0, 10)}</span>
                            {h.comment && <span style={{ color: '#FF3B30', fontStyle: 'italic' }}>"{h.comment}"</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#C7C7CC', padding: '8px 0' }}>아직 결재 이력이 없습니다.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubmissionInbox;
