import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { StatusBadge, STATUS_LABELS } from './SharedAdmin';

const PersonalTab = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/cert-requests`)
      .then(r => r.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  // Detail view with timeline
  if (selectedReq) {
    return (
      <div>
        <button onClick={() => setSelectedReq(null)} style={{ background: 'none', border: 'none', color: 'var(--system-blue)', fontSize: 14, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>
          ← 목록으로
        </button>
        <div className="admin-stat-card" style={{ textAlign: 'left', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedReq.cert_label}</div>
          <StatusBadge status={selectedReq.status} />
          <div style={{ fontSize: 14, color: 'var(--system-gray)', marginTop: 12 }}>
            신청일: {selectedReq.created_at?.substring(0, 10)}
          </div>
          {selectedReq.memo && <div style={{ fontSize: 14, marginTop: 4 }}>비고: {selectedReq.memo}</div>}
        </div>

        {/* Progress steps */}
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>진행 현황</h3>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: '20px' }}>
          {['SUBMITTED', 'CHURCH_CONFIRMED', 'SICHAL_CONFIRMED', 'NOH_CONFIRMED', 'APPROVED', 'ISSUED'].map((step, idx) => {
            const steps = ['SUBMITTED', 'CHURCH_CONFIRMED', 'SICHAL_CONFIRMED', 'NOH_CONFIRMED', 'APPROVED', 'ISSUED'];
            const currentIdx = steps.indexOf(selectedReq.status);
            const isRejected = selectedReq.status === 'REJECTED';
            const isComplete = !isRejected && idx <= currentIdx;
            const isCurrent = !isRejected && idx === currentIdx;

            return (
              <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', opacity: isComplete ? 1 : 0.35 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isComplete ? (isCurrent ? 'var(--system-blue)' : '#34C759') : 'var(--system-gray4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {isComplete && !isCurrent ? '✓' : idx + 1}
                </div>
                <span style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 400 }}>
                  {STATUS_LABELS[step]}
                </span>
              </div>
            );
          })}
          {selectedReq.status === 'REJECTED' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>✕</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#FF3B30' }}>반려됨</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>내 요청 현황</h3>
      <p style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>
        신청한 증명서의 진행 상태를 확인할 수 있습니다.
      </p>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>신청일</th>
              <th>증명서</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--system-gray)', padding: 40 }}>
                신청한 요청이 없습니다.
              </td></tr>
            )}
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.created_at?.substring(0, 10)}</td>
                <td>{r.cert_label}</td>
                <td><StatusBadge status={r.status} /></td>
                <td><button className="btn btn-outline" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setSelectedReq(r)}>진행 현황</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PersonalTab;
