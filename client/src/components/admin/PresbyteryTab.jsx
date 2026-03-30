import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import RoleManager from './RoleManager';
import NoticeManager from './NoticeManager';
import PushManager from './PushManager';
import DocumentManager from './DocumentManager';

const PresbyteryTab = () => {
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
    return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="presbytery" />;
  }

  const pendingCount = requests.filter(r => r.status === 'SICHAL_CONFIRMED').length;

  const categories = [
    { id: 'notices', label: '📢 알림/공지' },
    { id: 'documents', label: '📄 공문' },
    { id: 'cert', label: '📝 증명서' },
    { id: 'transfer', label: '🔄 이명 요청' },
    { id: 'push', label: '📱 푸시 알림' },
    { id: 'roles', label: '👥 담당자' },
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
        <NoticeManager scope="presbytery" authorRole="노회서기" />
      )}

      {activeView === 'documents' && (
        <DocumentManager scope="presbytery" senderOrg="노회" senderRole="노회서기" />
      )}

      {activeView === 'cert' && (
        <>
          <div className="admin-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-number">{requests.length}</div>
              <div className="admin-stat-label">노회 관련 요청</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-number" style={{ color: '#FF9500' }}>{pendingCount}</div>
              <div className="admin-stat-label">노회 확인 대기</div>
            </div>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>노회 요청 목록</h3>
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
        <PushManager scope="presbytery" senderRole="노회서기" />
      )}

      {activeView === 'roles' && (
        <RoleManager
          roleType="sichal_secretary"
          roleLabel="시찰서기"
          scopeLabel="시찰"
          scopeKey="sichal_code"
          scopeNameKey="sichal_name"
        />
      )}
    </div>
  );
};

export default PresbyteryTab;
