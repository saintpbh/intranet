import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { StatusBadge, STATUS_LABELS } from './SharedAdmin';
import AdminDocumentBrowser from './AdminDocumentBrowser';

/* ── Stitch design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
  ghostBtn: { padding: '6px 14px', background: 'transparent', border: '1px solid rgba(196,198,206,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#43474d' },
  navPill: (active) => ({
    padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(0,112,235,0.08)' : 'transparent',
    color: active ? '#0070eb' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 13,
    fontFamily: "'Manrope', 'Pretendard'", transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 6,
  }),
};

const PersonalTab = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [activeTab, setActiveTab] = useState('cert');

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
        <button onClick={() => setSelectedReq(null)} style={{ background: 'none', border: 'none', color: '#0070eb', fontSize: 14, cursor: 'pointer', marginBottom: 20, fontFamily: "'Manrope'", fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> 목록으로
        </button>
        <div style={{ ...S.card, textAlign: 'left', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: '#0A2540', fontFamily: "'Manrope'" }}>{selectedReq.cert_label}</div>
          <StatusBadge status={selectedReq.status} />
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 12 }}>
            신청일: {selectedReq.created_at?.substring(0, 10)}
          </div>
          {selectedReq.memo && <div style={{ fontSize: 14, marginTop: 4, color: '#43474d' }}>비고: {selectedReq.memo}</div>}
        </div>

        <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 16 }}>진행 현황</h3>
        <div style={S.card}>
          {['SUBMITTED', 'CHURCH_CONFIRMED', 'SICHAL_CONFIRMED', 'NOH_CONFIRMED', 'APPROVED', 'ISSUED'].map((step, idx) => {
            const steps = ['SUBMITTED', 'CHURCH_CONFIRMED', 'SICHAL_CONFIRMED', 'NOH_CONFIRMED', 'APPROVED', 'ISSUED'];
            const currentIdx = steps.indexOf(selectedReq.status);
            const isRejected = selectedReq.status === 'REJECTED';
            const isComplete = !isRejected && idx <= currentIdx;
            const isCurrent = !isRejected && idx === currentIdx;

            return (
              <div key={step} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', opacity: isComplete ? 1 : 0.35 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isComplete ? (isCurrent ? '#0070eb' : '#34C759') : '#e2e2e7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  boxShadow: isComplete ? '0 4px 12px rgba(0,112,235,0.2)' : 'none',
                }}>
                  {isComplete && !isCurrent ? '✓' : idx + 1}
                </div>
                <span style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#0070eb' : '#43474d', fontFamily: "'Plus Jakarta Sans'" }}>
                  {STATUS_LABELS[step]}
                </span>
              </div>
            );
          })}
          {selectedReq.status === 'REJECTED' && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>✕</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FF3B30' }}>반려됨</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {[{ id: 'cert', icon: 'workspace_premium', label: '증명서 요청' }, { id: 'admin-docs', icon: 'folder_open', label: '행정문서' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.navPill(activeTab === t.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'admin-docs' && <AdminDocumentBrowser user={user} scope="personal" />}

      {activeTab === 'cert' && (
        <div>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 8 }}>내 요청 현황</h3>
          <p style={{ ...S.subText, marginBottom: 20 }}>신청한 증명서의 진행 상태를 확인할 수 있습니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#c4c6ce', display: 'block', marginBottom: 12 }}>inbox</span>
                  신청한 요청이 없습니다.
                </div>
              ) : requests.map(r => (
                <div key={r.id} style={{ ...S.card, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2540', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0A2540', marginBottom: 2 }}>{r.cert_label}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.created_at?.substring(0, 10)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge status={r.status} />
                    <button style={S.ghostBtn} onClick={() => setSelectedReq(r)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>timeline</span> 현황
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PersonalTab;
