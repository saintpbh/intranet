import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const STATUS_COLORS = {
  SUBMITTED: { bg: 'rgba(255, 149, 0, 0.1)', color: '#FF9500' },
  CHURCH_CONFIRMED: { bg: 'rgba(0, 122, 255, 0.1)', color: '#007AFF' },
  SICHAL_CONFIRMED: { bg: 'rgba(88, 86, 214, 0.1)', color: '#5856D6' },
  NOH_CONFIRMED: { bg: 'rgba(0, 199, 190, 0.1)', color: '#00C7BE' },
  APPROVED: { bg: 'rgba(52, 199, 89, 0.1)', color: '#34C759' },
  ISSUED: { bg: 'rgba(52, 199, 89, 0.15)', color: '#248A3D' },
  REJECTED: { bg: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30' },
  MODIFY_REQUESTED: { bg: 'rgba(162, 28, 175, 0.1)', color: '#A21CAF' },
};

const STATUS_LABELS = {
  SUBMITTED: '신청됨', CHURCH_CONFIRMED: '교회 확인', SICHAL_CONFIRMED: '시찰 확인',
  NOH_CONFIRMED: '노회 확인', APPROVED: '총회 승인', ISSUED: '발급 완료', REJECTED: '반려',
  MODIFY_REQUESTED: '수정 요청됨',
};

const StatusBadge = ({ status }) => {
  const style = STATUS_COLORS[status] || {};
  return (
    <span className="badge" style={{ background: style.bg, color: style.color, border: 'none' }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
};

// --- Shared Request List ---
const RequestList = ({ requests, onSelect, showChurch = true }) => (
  <table className="admin-table">
    <thead>
      <tr>
        <th>No.</th>
        <th>신청일</th>
        <th>신청인</th>
        {showChurch && <th>교회</th>}
        <th>증명서</th>
        <th>상태</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {requests.length === 0 && (
        <tr><td colSpan={showChurch ? 7 : 6} style={{ textAlign: 'center', color: 'var(--system-gray)', padding: 40 }}>
          요청이 없습니다.
        </td></tr>
      )}
      {requests.map((r) => (
        <tr key={r.id}>
          <td>{r.id}</td>
          <td>{r.created_at?.substring(0, 10)}</td>
          <td style={{ fontWeight: 500 }}>{r.minister_name}</td>
          {showChurch && <td>{r.chr_name || '—'}</td>}
          <td>{r.cert_label}</td>
          <td><StatusBadge status={r.status} /></td>
          <td><button className="btn btn-outline" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => onSelect(r)}>상세</button></td>
        </tr>
      ))}
    </tbody>
  </table>
);

// --- Request Detail with Timeline ---
const RequestDetail = ({ request, onBack, onAction, actionRole }) => {
  const [detail, setDetail] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [docNumber, setDocNumber] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfOriginal, setPdfOriginal] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/cert-requests/${request.id}`)
      .then(r => r.json()).then(setDetail).finally(() => setLoading(false));
  }, [request.id]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfOriginal(file.name);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/documents/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { setPdfFilename(data.filename); }
      else { alert('업로드 실패'); }
    } catch { alert('업로드 오류'); }
    setUploading(false);
  };

  const handleAction = async (action) => {
    const res = await fetch(`${API_BASE}/api/admin/cert-requests/${request.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action, actor_name: '관리자', actor_role: actionRole, comment,
        doc_number: action === 'approve' ? docNumber : '',
        pdf_filename: action === 'approve' ? pdfFilename : ''
      }),
    });
    const data = await res.json();
    if (data.success) {
      setDetail(prev => ({ ...prev, status: data.new_status, status_label: data.status_label }));
      setComment(''); setDocNumber(''); setPdfFilename(''); setPdfOriginal('');
      // Refresh history
      const updated = await fetch(`${API_BASE}/api/admin/cert-requests/${request.id}`).then(r => r.json());
      setDetail(updated);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--system-gray)' }}>불러오는 중...</div>;
  if (!detail) return null;

  const REQUIRED_ROLE = {
    SUBMITTED: 'church',
    CHURCH_CONFIRMED: 'sichal',
    SICHAL_CONFIRMED: 'presbytery',
    NOH_CONFIRMED: 'assembly',
    APPROVED: 'assembly',
    ISSUED: 'assembly',
    MODIFY_REQUESTED: 'assembly',
  };

  const canApprove = detail.status !== 'REJECTED' && REQUIRED_ROLE[detail.status] === actionRole;
  const isReissue = detail.status === 'ISSUED' || detail.status === 'MODIFY_REQUESTED';

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--system-blue)', fontSize: 14, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>
        ← 목록으로
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="admin-stat-card" style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 8 }}>신청 정보</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{detail.minister_name}</div>
          <div style={{ fontSize: 14, color: 'var(--system-gray)' }}>{detail.chr_name} · {detail.noh_name}</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>{detail.cert_label}</div>
          {detail.memo && <div style={{ fontSize: 13, color: 'var(--system-gray)', marginTop: 4 }}>비고: {detail.memo}</div>}
        </div>
        <div className="admin-stat-card" style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 8 }}>현재 상태</div>
          <StatusBadge status={detail.status} />
          <div style={{ fontSize: 13, color: 'var(--system-gray)', marginTop: 12 }}>신청일: {detail.created_at?.substring(0, 10)}</div>
          <div style={{ fontSize: 13, color: 'var(--system-gray)' }}>갱신일: {detail.updated_at?.substring(0, 10)}</div>
          {detail.doc_number && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: 'var(--system-blue)' }}>문서번호: {detail.doc_number}</div>}
          {detail.pdf_filename && (
            <a href={`${API_BASE}/api/documents/download/${detail.pdf_filename}`} target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', fontSize: 12, marginTop: 8, background: 'rgba(52,199,89,0.1)', color: '#248A3D', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
              📎 증명서 다운로드
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>결재 이력</h3>
      <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        {(detail.history || []).map((h, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 12, paddingBottom: 16, marginBottom: idx < detail.history.length - 1 ? 16 : 0, borderBottom: idx < detail.history.length - 1 ? '0.5px solid var(--opaque-separator)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.action === 'reject' ? '#FF3B30' : 'var(--system-blue)', marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{STATUS_LABELS[h.stage] || h.stage}</div>
              <div style={{ fontSize: 13, color: 'var(--system-gray)', marginTop: 2 }}>
                {h.actor_name} ({h.actor_role}) · {h.created_at?.substring(0, 16).replace('T', ' ')}
              </div>
              {h.comment && <div style={{ fontSize: 13, marginTop: 4 }}>{h.comment}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {canApprove && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>결재 처리</h3>
          <textarea
            placeholder="코멘트 (선택)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: '100%', padding: 12, border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, resize: 'none', marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
            rows={2}
          />
          {actionRole === 'assembly' && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--grouped-bg)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--system-gray)' }}>최종 발급 시 첨부 (선택)</div>
              <input type="text" placeholder="문서번호 (예: 총회-2026-001)" value={docNumber} onChange={e => setDocNumber(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <div>
                <input type="file" accept=".pdf" onChange={handleFileSelect} style={{ fontSize: 13 }} />
                {uploading && <span style={{ fontSize: 12, color: 'var(--system-gray)', marginLeft: 8 }}>업로드 중...</span>}
                {pdfFilename && <div style={{ fontSize: 12, color: '#34C759', marginTop: 4 }}>✅ {pdfOriginal || pdfFilename} 업로드됨</div>}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={() => handleAction('approve')}>
              {isReissue ? '재발급 (승인)' : '승인'}
            </button>
            <button className="btn" style={{ flex: 1, padding: 12, background: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30' }} onClick={() => handleAction('reject')}>반려</button>
          </div>
        </div>
      )}
    </div>
  );
};

export { StatusBadge, RequestList, RequestDetail, STATUS_LABELS, STATUS_COLORS };
