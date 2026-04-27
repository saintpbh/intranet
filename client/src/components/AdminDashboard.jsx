import API_BASE from '../api';
import { useState, useEffect } from 'react';

const AdminDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/requests`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setRequests(data);
      setIsOffline(false);
    } catch (err) {
      console.error(err);
      setIsOffline(true);
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
  if (isOffline) return (
    <div style={{padding: '40px', textAlign: 'center'}}>
      <span className="material-symbols-outlined" style={{fontSize: 48, color: '#ef4444', marginBottom: 16}}>cloud_off</span>
      <h2 style={{color: '#ef4444', margin: '0 0 8px 0'}}>관리자 서버가 오프라인 상태입니다</h2>
      <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
        관리자 기능은 실시간 데이터베이스 연동이 필요합니다.<br/>
        <strong>목사님 PC에서 서버(start_prok_api.ps1)를 켜주세요.</strong><br/>
        <button onClick={() => fetchRequests()} style={{marginTop: 16, padding: '8px 16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer'}}>다시 시도</button>
      </p>
    </div>
  );

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
                {req.status === 'PENDING' ? '대기 중' : req.status === 'APPROVED' ? '승인됨' : req.status === 'REJECTED' ? '반려됨' : req.status}
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
