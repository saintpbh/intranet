import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import RoleManager from './RoleManager';
import NoticeManager from './NoticeManager';
import CertTypeManager from './CertTypeManager';
import PushManager from './PushManager';
import DocumentManager from './DocumentManager';
import ChurchReportForm from './ChurchReportForm';
import FormTemplateList from './FormTemplateList';
import FormDocumentManager from './FormDocumentManager';
import VisibilityRoleManager from './VisibilityRoleManager';
import SubmissionInbox from './SubmissionInbox';
import AdManager from './AdManager';

/* ── Stitch "Digital Sanctuary" design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 32, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  statCard: { background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', transition: 'transform 0.3s', cursor: 'default' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
  gradientBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(0,112,235,0.25)', fontFamily: "'Plus Jakarta Sans'" },
  ghostBtn: { padding: '10px 20px', background: 'transparent', border: '1px solid rgba(196,198,206,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#43474d', fontFamily: "'Plus Jakarta Sans'" },
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
  const labels = { DRAFT: '임시저장', SUBMITTED: '노회 대기', NOH_APPROVED: '총회 확정 대기', ASSEMBLY_APPROVED: '총회 확정', REJECTED: '반려' };
  const colors = { DRAFT: '#8E8E93', SUBMITTED: '#FF9500', NOH_APPROVED: '#007AFF', ASSEMBLY_APPROVED: '#34C759', REJECTED: '#FF3B30' };
  const c = colors[status] || '#8e8e93';
  return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${c}12`, color: c, fontWeight: 700, letterSpacing: '0.02em' }}>{labels[status] || status}</span>;
};

const GeneralAssemblyTab = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');

  const fetchData = () => {
    Promise.all([
      fetch(`${API_BASE}/api/admin/cert-requests`).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/stats`).then(r => r.json()),
      fetch(`${API_BASE}/api/church-reports`).then(r => r.json())
    ]).then(([reqs, st, reps]) => {
      setRequests(Array.isArray(reqs) ? reqs : []);
      setStats(st);
      setReports(Array.isArray(reps) ? reps : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (selected) return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="assembly" />;
  if (selectedReportId) return <ChurchReportForm user={user} reportId={selectedReportId} onBack={() => { setSelectedReportId(null); fetchData(); }} />;

  const certStats = stats?.cert_requests || {};
  const pending = (certStats['NOH_CONFIRMED'] || 0) + (certStats['APPROVED'] || 0);
  const pendingReportCount = reports.filter(r => r.status === 'NOH_APPROVED').length;

  const categories = [
    { id: 'dashboard', icon: 'dashboard', label: '대시보드' },
    { id: 'notices', icon: 'campaign', label: '알림/공지' },
    { id: 'documents', icon: 'description', label: '공문' },
    { id: 'cert', icon: 'verified', label: '증명서' },
    { id: 'report', icon: 'assessment', label: '상황 보고', badge: pendingReportCount },
    { id: 'form-builder', icon: 'edit_note', label: '양식 빌더' },
    { id: 'form-docs', icon: 'folder_open', label: '문서관리' },
    { id: 'submissions', icon: 'inbox', label: '제출문서' },
    { id: 'visibility-tags', icon: 'label', label: '역할태그' },
    { id: 'transfer', icon: 'swap_horiz', label: '이명 요청' },
    { id: 'ads', icon: 'ad_group', label: '광고 관리' },
    { id: 'push', icon: 'notifications_active', label: '푸시 알림' },
    { id: 'roles', icon: 'group', label: '담당자' },
  ];

  const handleApproveReport = async (reqId, action) => {
    if (!confirm(action === 'approve' ? '이 보고서를 총회 차원에서 확정하시겠습니까?' : '이 보고서를 반려 처리하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/church-reports/${reqId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, actor_name: user?.name || '총회관리자', actor_role: 'assembly', comment: '' })
      });
      const data = await res.json();
      if (data.success) { alert('처리되었습니다.'); fetchData(); } else alert(data.error);
    } catch { alert('오류가 발생했습니다.'); }
  };

  return (
    <div>
      {/* Navigation Pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {categories.map(v => (
          <button key={v.id} style={S.navPill(activeView === v.id)} onClick={() => setActiveView(v.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{v.icon}</span>
            {v.label}
            {v.badge > 0 && <span style={{ background: '#FF3B30', color: '#fff', padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{v.badge}</span>}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {activeView === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {[
              { icon: 'description', bg: '#f1f5f9', fg: '#0A2540', label: '전체 증명서 요청', value: requests.length, color: '#0A2540', tag: 'Overview' },
              { icon: 'schedule', bg: '#fff7ed', fg: '#f97316', label: '총회 처리 대기', value: pending, color: '#f97316', tag: 'Pending' },
              { icon: 'assessment', bg: '#eff6ff', fg: '#2563eb', label: '올해 통계표 제출', value: reports.length, color: '#2563eb', tag: 'Annual' },
              { icon: 'error_outline', bg: '#fef2f2', fg: '#ef4444', label: '총회 확정 대기', value: pendingReportCount, color: '#ef4444', tag: 'Critical' },
            ].map((c, i) => (
              <div key={i} style={S.statCard} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={S.iconBox(c.bg, c.fg)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{c.icon}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{c.tag}</span>
                </div>
                <p style={{ ...S.subText, marginBottom: 4 }}>{c.label}</p>
                <h3 style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: "'Manrope'" }}>{c.value}<span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>건</span></h3>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === 'notices' && <NoticeManager scope="assembly" authorRole="총회관리자" />}
      {activeView === 'documents' && <DocumentManager scope="assembly" senderOrg="한국기독교장로회 총회" senderRole="총회관리자" />}

      {activeView === 'cert' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button style={S.ghostBtn} onClick={() => setActiveView('cert-types')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>edit_document</span>
              증명서 유형 관리
            </button>
          </div>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 16 }}>전체 증명서 요청</h3>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelected} />}
        </div>
      )}

      {activeView === 'report' && (
        <>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 8 }}>전국 교회 상황 보고서</h3>
          <p style={{ ...S.subText, marginBottom: 24 }}>노회를 거쳐 올라온 통계표를 검토하고 총회 차원에서 최종 확정합니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>제출된 보고서가 없습니다.</div>
              ) : reports.map(r => (
                <div key={r.id} style={{ ...S.card, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#0A2540' }}>{r.church_name}</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{r.noh_name}</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{r.report_year}년도</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>제출자: {r.submitted_by} / 최종수정: {r.updated_at?.substring(0, 10)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button style={S.ghostBtn} onClick={() => setSelectedReportId(r.id)}>📄 통계표 열람</button>
                    {r.status === 'NOH_APPROVED' && (
                      <>
                        <button style={{ ...S.ghostBtn, color: '#FF3B30', borderColor: 'rgba(255,59,48,0.2)' }} onClick={() => handleApproveReport(r.id, 'reject')}>반려</button>
                        <button style={{ ...S.gradientBtn, background: '#34C759', fontSize: 13, padding: '8px 20px' }} onClick={() => handleApproveReport(r.id, 'approve')}>✓ 총회 확정</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeView === 'cert-types' && (
        <div>
          <button style={S.ghostBtn} onClick={() => setActiveView('cert')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>arrow_back</span>
            증명서 요청 목록
          </button>
          <div style={{ marginTop: 16 }}><CertTypeManager /></div>
        </div>
      )}

      {activeView === 'form-builder' && <FormTemplateList user={user} />}
      {activeView === 'form-docs' && <FormDocumentManager user={user} />}
      {activeView === 'submissions' && <SubmissionInbox user={user} role="assembly" />}
      {activeView === 'visibility-tags' && <VisibilityRoleManager />}

      {activeView === 'transfer' && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#c4c6ce', marginBottom: 16, display: 'block' }}>swap_horiz</span>
          <h3 style={{ ...S.heading, fontSize: 20, marginBottom: 8 }}>이명 요청</h3>
          <p style={{ ...S.subText }}>들어오는 이명 / 나가는 이명 관리 (준비 중)</p>
        </div>
      )}
      {activeView === 'push' && <PushManager scope="assembly" senderRole="총회관리자" />}
      {activeView === 'ads' && <AdManager />}
      {activeView === 'roles' && <RoleManager roleType="noh_secretary" roleLabel="노회서기" scopeLabel="노회" scopeKey="noh_code" scopeNameKey="noh_name" />}
    </div>
  );
};

export default GeneralAssemblyTab;
