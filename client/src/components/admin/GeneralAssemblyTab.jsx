import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import RoleManager from './RoleManager';
import NoticeManager from './NoticeManager';
import CertTypeManager from './CertTypeManager';
import PushManager from './PushManager';
import DocumentManager from './DocumentManager';

const GeneralAssemblyTab = () => {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');

  const fetchData = () => {
    Promise.all([
      fetch(`${API_BASE}/api/admin/cert-requests`).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/stats`).then(r => r.json()),
    ]).then(([reqs, st]) => {
      setRequests(Array.isArray(reqs) ? reqs : []);
      setStats(st);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (selected) {
    return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="assembly" />;
  }

  const certStats = stats?.cert_requests || {};
  const pending = (certStats['NOH_CONFIRMED'] || 0) + (certStats['APPROVED'] || 0);

  const categories = [
    { id: 'dashboard', label: '📊 대시보드' },
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

      {activeView === 'dashboard' && (
        <div className="admin-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-number">{requests.length}</div>
            <div className="admin-stat-label">전체 요청</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-number" style={{ color: '#FF9500' }}>{pending}</div>
            <div className="admin-stat-label">총회 처리 대기</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-number" style={{ color: '#34C759' }}>{certStats['ISSUED'] || 0}</div>
            <div className="admin-stat-label">발급 완료</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-number" style={{ color: '#FF3B30' }}>{certStats['REJECTED'] || 0}</div>
            <div className="admin-stat-label">반려</div>
          </div>
        </div>
      )}

      {activeView === 'notices' && (
        <NoticeManager scope="assembly" authorRole="총회관리자" />
      )}

      {activeView === 'documents' && (
        <DocumentManager scope="assembly" senderOrg="한국기독교장로회 총회" senderRole="총회관리자" />
      )}

      {activeView === 'cert' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-outline" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setActiveView('cert-types')}>📜 증명서 유형 관리</button>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>전체 증명서 요청</h3>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelected} />}
        </div>
      )}

      {activeView === 'cert-types' && (
        <div>
          <button className="btn btn-outline" style={{ fontSize: 13, padding: '6px 14px', marginBottom: 16 }} onClick={() => setActiveView('cert')}>← 증명서 요청 목록</button>
          <CertTypeManager />
        </div>
      )}

      {activeView === 'transfer' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>이명 요청</h3>
          <p style={{ fontSize: 14, color: 'var(--system-gray)' }}>들어오는 이명 / 나가는 이명 관리 (준비 중)</p>
        </div>
      )}

      {activeView === 'push' && (
        <PushManager scope="assembly" senderRole="총회관리자" />
      )}

      {activeView === 'roles' && (
        <RoleManager
          roleType="noh_secretary"
          roleLabel="노회서기"
          scopeLabel="노회"
          scopeKey="noh_code"
          scopeNameKey="noh_name"
        />
      )}
    </div>
  );
};

export default GeneralAssemblyTab;
