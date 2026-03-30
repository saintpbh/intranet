import API_BASE from '../api';
import { useState, useEffect } from 'react';

const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/requests`);
      const data = await response.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchRequests();
      } else {
        alert(data.error || '처리 실패');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div style={{padding: '16px'}}>
      <h2 style={{margin: '0 0 16px', color: 'var(--text-primary)'}}>수정 요청 관리</h2>
      {requests.length === 0 ? (
        <p style={{color: 'var(--text-secondary)'}}>수정 요청이 없습니다.</p>
      ) : (
        requests.map(req => (
          <div key={req.id} className="card" style={{marginBottom: '12px', padding: '12px 16px'}}>
            <div style={{marginBottom: '8px'}}>
              <strong>{req.minister_name}</strong>
              <span className="badge" style={{marginLeft: '8px', fontSize: '11px',
                backgroundColor: req.status === 'PENDING' ? '#FF9500' : req.status === 'APPROVED' ? '#34C759' : '#FF3B30',
                color: 'white', padding: '2px 8px', borderRadius: '10px'}}>
                {req.status}
              </span>
            </div>
            <div style={{fontSize: '14px', color: 'var(--text-secondary)'}}>
              <div>필드: {req.field}</div>
              <div>기존: {req.old_value} → 변경: {req.new_value}</div>
              {req.memo && <div>메모: {req.memo}</div>}
              <div style={{fontSize: '12px', marginTop: '4px'}}>{req.created_at}</div>
            </div>
            {req.status === 'PENDING' && (
              <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                <button onClick={() => handleAction(req.id, 'approve')}
                  style={{padding: '6px 16px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'}}>
                  승인
                </button>
                <button onClick={() => handleAction(req.id, 'reject')}
                  style={{padding: '6px 16px', backgroundColor: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'}}>
                  반려
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default AdminDashboard;
