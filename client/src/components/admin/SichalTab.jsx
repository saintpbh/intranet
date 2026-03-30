import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import NoticeManager from './NoticeManager';
import PushManager from './PushManager';
import DocumentManager from './DocumentManager';

const SichalTab = () => {
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

  if (selected) {
    return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="sichal" />;
  }

  const pendingCount = requests.filter(r => r.status === 'CHURCH_CONFIRMED').length;

  const categories = [
    { id: 'notices', label: '📢 알림/공지' },
    { id: 'documents', label: '📄 공문' },
    { id: 'cert', label: '📝 증명서' },
    { id: 'transfer', label: '🔄 이명 요청' },
    { id: 'push', label: '📱 푸시 알림' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {categories.map(v => (
          <button key={v.id} className={`btn ${activeView === v.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setActiveView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'notices' && (
        <NoticeManager scope="sichal" authorRole="시찰서기" />
      )}

      {activeView === 'documents' && (
        <DocumentManager scope="sichal" senderOrg="시찰" senderRole="시찰서기" />
      )}

      {activeView === 'cert' && (
        <>
          <div className="admin-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-number">{requests.length}</div>
              <div className="admin-stat-label">시찰 관련 요청</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-number" style={{ color: '#FF9500' }}>{pendingCount}</div>
              <div className="admin-stat-label">시찰 확인 대기</div>
            </div>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>시찰 요청 목록</h3>
          <p style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>
            교회에서 확인된 요청을 검토하고, 노회로 경유합니다.
          </p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelected} />}
        </>
      )}

      {activeView === 'transfer' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>이명 요청</h3>
          <p style={{ fontSize: 14, color: 'var(--system-gray)' }}>들어오는 이명 / 나가는 이명 관리 (준비 중)</p>
        </div>
      )}

      {activeView === 'push' && (
        <PushManager scope="sichal" senderRole="시찰서기" />
      )}
    </div>
  );
};

export default SichalTab;
