import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import ChurchReportForm from './ChurchReportForm';
import AdminDocumentBrowser from './AdminDocumentBrowser';
import SubmissionInbox from './SubmissionInbox';

/* ── Stitch design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
  gradientBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(0,112,235,0.25)' },
  ghostBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(196,198,206,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#43474d' },
  navPill: (active) => ({
    padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(0,112,235,0.08)' : 'transparent',
    color: active ? '#0070eb' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 13,
    fontFamily: "'Manrope', 'Pretendard'", transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 6,
  }),
};

const StatusBadge = ({ status }) => {
  const labels = { DRAFT: '임시저장', SUBMITTED: '제출됨', NOH_APPROVED: '노회 확인', ASSEMBLY_APPROVED: '총회 확정', REJECTED: '반려' };
  const colors = { DRAFT: '#8E8E93', SUBMITTED: '#FF9500', NOH_APPROVED: '#007AFF', ASSEMBLY_APPROVED: '#34C759', REJECTED: '#FF3B30' };
  const c = colors[status] || '#8e8e93';
  return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${c}12`, color: c, fontWeight: 700 }}>{labels[status] || status}</span>;
};

const ChurchTab = ({ user }) => {
  const [activeMenu, setActiveMenu] = useState('cert');
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [creatingReport, setCreatingReport] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/admin/cert-requests`).then(r => r.json()),
      fetch(`${API_BASE}/api/church-reports?church_code=${user.chr_code || ''}`).then(r => r.json())
    ]).then(([certs, reps]) => {
      setRequests(Array.isArray(certs) ? certs : []);
      setReports(Array.isArray(reps) ? reps : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user.chr_code]);

  if (selectedCert) return <RequestDetail request={selectedCert} onBack={() => { setSelectedCert(null); fetchData(); }} actionRole="church" />;
  if (creatingReport || selectedReportId) return <ChurchReportForm user={user} reportId={selectedReportId} onBack={() => { setCreatingReport(false); setSelectedReportId(null); fetchData(); }} onSaved={() => { setCreatingReport(false); setSelectedReportId(null); fetchData(); }} />;

  const menus = [
    { id: 'cert', icon: 'verified', label: '증명서 관리' },
    { id: 'admin-docs', icon: 'folder_open', label: '행정문서' },
    { id: 'submissions', icon: 'inbox', label: '제출문서' },
    { id: 'report', icon: 'assessment', label: '상황 통계 보고' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {menus.map(m => (
          <button key={m.id} onClick={() => setActiveMenu(m.id)} style={S.navPill(activeMenu === m.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {activeMenu === 'cert' && (
        <>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 8 }}>교회 증명서 요청 목록</h3>
          <p style={{ ...S.subText, marginBottom: 20 }}>소속 교역자의 요청을 접수/확인하고, 시찰로 경유합니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelectedCert} />}
        </>
      )}

      {activeMenu === 'admin-docs' && <AdminDocumentBrowser user={user} scope="church" />}
      {activeMenu === 'submissions' && <SubmissionInbox user={user} role="church" />}

      {activeMenu === 'report' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>교회 보고서 제출</h3>
              <p style={S.subText}>매 연말 교회의 정보와 상황 통계를 노회로 보고합니다.</p>
            </div>
            <button style={S.gradientBtn} onClick={() => setCreatingReport(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>add_circle</span>
              새 보고서 작성
            </button>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>제출된 보고서가 없습니다.</div>
              ) : reports.map(r => (
                <div key={r.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>{r.report_year}년도 교회 상황 통계표</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>최종수정: {r.updated_at?.substring(0, 10)}</div>
                  </div>
                  <button style={S.ghostBtn} onClick={() => setSelectedReportId(r.id)}>열람 / 편집</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChurchTab;
