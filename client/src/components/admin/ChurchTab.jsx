import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';

const ChurchTab = () => {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    fetch(`${API_BASE}/api/admin/cert-requests`)
      .then(r => r.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (selected) {
    return <RequestDetail request={selected} onBack={() => { setSelected(null); fetchData(); }} actionRole="church" />;
  }

  const pendingCount = requests.filter(r => r.status === 'SUBMITTED').length;

  return (
    <div>
      <div className="admin-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-number">{requests.length}</div>
          <div className="admin-stat-label">교회 관련 요청</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number" style={{ color: '#FF9500' }}>{pendingCount}</div>
          <div className="admin-stat-label">교회 접수 대기</div>
        </div>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>교회 요청 목록</h3>
      <p style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>
        소속 교역자의 요청을 접수/확인하고, 시찰로 경유합니다.
      </p>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> :
        <RequestList requests={requests} onSelect={setSelected} />}
    </div>
  );
};

export default ChurchTab;
