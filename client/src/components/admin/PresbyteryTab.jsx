import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import RoleManager from './RoleManager';
import NoticeManager from './NoticeManager';
import PushManager from './PushManager';
import DocumentManager from './DocumentManager';
import ChurchReportForm from './ChurchReportForm';
import AdminDocumentBrowser from './AdminDocumentBrowser';
import SubmissionInbox from './SubmissionInbox';

/* ── Stitch design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  statCard: { background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', transition: 'transform 0.3s' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
  gradientBtn: { padding: '8px 20px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(0,112,235,0.25)' },
  ghostBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(196,198,206,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#43474d' },
  navPill: (active) => ({
    padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(0,112,235,0.08)' : 'transparent',
    color: active ? '#0070eb' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 13,
    fontFamily: "'Manrope', 'Pretendard'", transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 6,
  }),
  iconBox: (bg, fg) => ({ width: 44, height: 44, borderRadius: 16, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: fg }),
};

const StatusBadge = ({ status }) => {
  const labels = { DRAFT: '임시저장', SUBMITTED: '제출됨', NOH_APPROVED: '노회 승인', ASSEMBLY_APPROVED: '총회 확정', REJECTED: '반려' };
  const colors = { DRAFT: '#8E8E93', SUBMITTED: '#FF9500', NOH_APPROVED: '#007AFF', ASSEMBLY_APPROVED: '#34C759', REJECTED: '#FF3B30' };
  const c = colors[status] || '#8e8e93';
  return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${c}12`, color: c, fontWeight: 700 }}>{labels[status] || status}</span>;
};

const PresbyteryTab = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('notices');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/admin/cert-requests`).then(r => r.json()),
      fetch(`${API_BASE}/api/church-reports?noh_code=${user?.noh_code || ''}`).then(r => r.json())
    ]).then(([certs, reps]) => {
      setRequests(Array.isArray(certs) ? certs : []);
      setReports(Array.isArray(reps) ? reps : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user?.noh_code]);

  if (selected) return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="presbytery" />;
  if (selectedReportId) return <ChurchReportForm user={user} reportId={selectedReportId} onBack={() => { setSelectedReportId(null); fetchData(); }} />;

  const pendingCount = requests.filter(r => r.status === 'SICHAL_CONFIRMED').length;
  const pendingReportCount = reports.filter(r => r.status === 'SUBMITTED').length;

  const categories = [
    { id: 'notices', icon: 'campaign', label: '알림/공지' },
    { id: 'documents', icon: 'description', label: '공문' },
    { id: 'admin-docs', icon: 'folder_open', label: '행정문서' },
    { id: 'submissions', icon: 'inbox', label: '제출문서' },
    { id: 'cert', icon: 'verified', label: '증명서' },
    { id: 'report', icon: 'assessment', label: '상황 보고', badge: pendingReportCount },
    { id: 'transfer', icon: 'swap_horiz', label: '이명 요청' },
    { id: 'push', icon: 'notifications_active', label: '푸시 알림' },
    { id: 'roles', icon: 'group', label: '담당자' },
  ];

  const handleApproveReport = async (reqId, action) => {
    if (!confirm(action === 'approve' ? '이 보고서를 승인하시겠습니까?' : '이 보고서를 반려하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/church-reports/${reqId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, actor_name: user?.name || '관리자', actor_role: 'presbytery', comment: '' })
      });
      const data = await res.json();
      if (data.success) { alert('처리되었습니다.'); fetchData(); } else alert(data.error);
    } catch { alert('오류가 발생했습니다.'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {categories.map(v => (
          <button key={v.id} style={S.navPill(activeView === v.id)} onClick={() => setActiveView(v.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{v.icon}</span>
            {v.label}
            {v.badge > 0 && <span style={{ background: '#FF3B30', color: '#fff', padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{v.badge}</span>}
          </button>
        ))}
      </div>

      {activeView === 'notices' && <NoticeManager scope="presbytery" authorRole="노회서기" />}
      {activeView === 'documents' && <DocumentManager scope="presbytery" senderOrg="노회" senderRole="노회서기" />}
      {activeView === 'admin-docs' && <AdminDocumentBrowser user={user} scope="presbytery" />}
      {activeView === 'submissions' && <SubmissionInbox user={user} role="presbytery" />}
      
      {activeView === 'cert' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={S.statCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={S.iconBox('#f1f5f9', '#0A2540')}><span className="material-symbols-outlined">description</span></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Total</span>
              </div>
              <p style={{ ...S.subText, marginBottom: 4 }}>노회 관련 요청</p>
              <h3 style={{ fontSize: 28, fontWeight: 800, color: '#0A2540', fontFamily: "'Manrope'" }}>{requests.length}<span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>건</span></h3>
            </div>
            <div style={S.statCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={S.iconBox('#fff7ed', '#f97316')}><span className="material-symbols-outlined">schedule</span></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Pending</span>
              </div>
              <p style={{ ...S.subText, marginBottom: 4 }}>노회 확인 대기</p>
              <h3 style={{ fontSize: 28, fontWeight: 800, color: '#f97316', fontFamily: "'Manrope'" }}>{pendingCount}<span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>건</span></h3>
            </div>
          </div>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 16 }}>노회 요청 목록</h3>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelected} />}
        </>
      )}

      {activeView === 'report' && (
        <>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 8 }}>교회 상황 보고서 (노회 산하)</h3>
          <p style={{ ...S.subText, marginBottom: 24 }}>소속 교회들이 제출한 통계표를 검토하고 노회 차원에서 승인합니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>제출된 보고서가 없습니다.</div>
              ) : reports.map(r => (
                <div key={r.id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#0A2540' }}>{r.church_name}</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{r.report_year}년도</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>제출자: {r.submitted_by} / 최종수정: {r.updated_at?.substring(0, 10)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button style={S.ghostBtn} onClick={() => setSelectedReportId(r.id)}>📄 통계표 열람</button>
                    {r.status === 'SUBMITTED' && (
                      <>
                        <button style={{ ...S.ghostBtn, color: '#FF3B30', borderColor: 'rgba(255,59,48,0.2)' }} onClick={() => handleApproveReport(r.id, 'reject')}>반려</button>
                        <button style={{ ...S.gradientBtn, background: '#34C759' }} onClick={() => handleApproveReport(r.id, 'approve')}>✓ 노회 승인</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeView === 'transfer' && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#c4c6ce', marginBottom: 16, display: 'block' }}>swap_horiz</span>
          <h3 style={{ ...S.heading, fontSize: 20, marginBottom: 8 }}>이명 요청</h3>
          <p style={S.subText}>들어오는 이명 / 나가는 이명 관리 (준비 중)</p>
        </div>
      )}
      {activeView === 'push' && <PushManager scope="presbytery" senderRole="노회서기" />}
      {activeView === 'roles' && <RoleManager roleType="sichal_secretary" roleLabel="시찰서기" scopeLabel="시찰" scopeKey="sichal_code" scopeNameKey="sichal_name" />}
    </div>
  );
};

export default PresbyteryTab;
