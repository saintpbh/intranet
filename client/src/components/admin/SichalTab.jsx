import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import NoticeManager from './NoticeManager';
import PushManager from './PushManager';
import DocumentManager from './DocumentManager';
import AdminDocumentBrowser from './AdminDocumentBrowser';
import SubmissionInbox from './SubmissionInbox';

/* ── Stitch design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  statCard: { background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', transition: 'transform 0.3s' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
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

const SichalTab = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('notices');

  const fetchData = () => {
    fetch(`${API_BASE}/api/admin/cert-requests`)
      .then(r => r.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (selected) return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="sichal" />;

  const pendingCount = requests.filter(r => r.status === 'CHURCH_CONFIRMED').length;

  const categories = [
    { id: 'notices', icon: 'campaign', label: '알림/공지' },
    { id: 'documents', icon: 'description', label: '공문' },
    { id: 'admin-docs', icon: 'folder_open', label: '행정문서' },
    { id: 'submissions', icon: 'inbox', label: '제출문서' },
    { id: 'cert', icon: 'verified', label: '증명서' },
    { id: 'transfer', icon: 'swap_horiz', label: '이명 요청' },
    { id: 'push', icon: 'notifications_active', label: '푸시 알림' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {categories.map(v => (
          <button key={v.id} style={S.navPill(activeView === v.id)} onClick={() => setActiveView(v.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{v.icon}</span>
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'notices' && <NoticeManager scope="sichal" authorRole="시찰서기" />}
      {activeView === 'documents' && <DocumentManager scope="sichal" senderOrg="시찰" senderRole="시찰서기" />}
      {activeView === 'admin-docs' && <AdminDocumentBrowser user={user} scope="sichal" />}
      {activeView === 'submissions' && <SubmissionInbox user={user} role="sichal" />}

      {activeView === 'cert' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={S.statCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={S.iconBox('#f1f5f9', '#0A2540')}><span className="material-symbols-outlined">description</span></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Total</span>
              </div>
              <p style={{ ...S.subText, marginBottom: 4 }}>시찰 관련 요청</p>
              <h3 style={{ fontSize: 28, fontWeight: 800, color: '#0A2540', fontFamily: "'Manrope'" }}>{requests.length}<span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>건</span></h3>
            </div>
            <div style={S.statCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={S.iconBox('#fff7ed', '#f97316')}><span className="material-symbols-outlined">schedule</span></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Pending</span>
              </div>
              <p style={{ ...S.subText, marginBottom: 4 }}>시찰 확인 대기</p>
              <h3 style={{ fontSize: 28, fontWeight: 800, color: '#f97316', fontFamily: "'Manrope'" }}>{pendingCount}<span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>건</span></h3>
            </div>
          </div>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 12 }}>시찰 요청 목록</h3>
          <p style={{ ...S.subText, marginBottom: 20 }}>교회에서 확인된 요청을 검토하고, 노회로 경유합니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelected} />}
        </>
      )}

      {activeView === 'transfer' && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, borderRadius: 24 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#c4c6ce', marginBottom: 16, display: 'block' }}>swap_horiz</span>
          <h3 style={{ ...S.heading, fontSize: 20, marginBottom: 8 }}>이명 요청</h3>
          <p style={S.subText}>들어오는 이명 / 나가는 이명 관리 (준비 중)</p>
        </div>
      )}

      {activeView === 'push' && <PushManager scope="sichal" senderRole="시찰서기" />}
    </div>
  );
};

export default SichalTab;
