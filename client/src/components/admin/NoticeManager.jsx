import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import RecipientPicker from './RecipientPicker';

const NoticeManager = ({ scope, scopeCode = '', scopeName = '', authorRole = '' }) => {
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [form, setForm] = useState({ category: '공지', title: '', content: '', is_pinned: false, send_push: false, target_type: 'all', recipients: [] });
  const [loading, setLoading] = useState(true);
  const [viewReceipts, setViewReceipts] = useState(null);
  const [receipts, setReceipts] = useState([]);

  const fetchNotices = () => {
    const params = new URLSearchParams({ scope });
    if (scopeCode) params.append('scope_code', scopeCode);
    fetch(`${API_BASE}/api/notices?${params}`)
      .then(r => r.json())
      .then(data => setNotices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotices(); }, [scope, scopeCode]);

  const openNew = () => {
    setEditingNotice(null);
    setForm({ category: '공지', title: '', content: '', is_pinned: false, send_push: false, target_type: 'all', recipients: [] });
    setShowForm(true);
  };

  const openEdit = (notice) => {
    setEditingNotice(notice);
    setForm({ 
      category: notice.category, title: notice.title, content: notice.content, 
      is_pinned: !!notice.is_pinned, target_type: notice.target_type || 'all',
      recipients: notice.recipients || [],
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingNotice(null); };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      alert('제목과 내용을 입력해 주세요.'); return;
    }
    if (editingNotice) {
      const res = await fetch(`${API_BASE}/api/notices/${editingNotice.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { closeForm(); fetchNotices(); }
    } else {
      const res = await fetch(`${API_BASE}/api/notices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope, scope_code: scopeCode, scope_name: scopeName,
          ...form, author_name: '관리자', author_role: authorRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.push_sent) {
          alert('✅ 공지가 등록되고 푸시 알림이 발송되었습니다.');
        } else if (form.send_push && data.push_error) {
          alert(`⚠️ 공지는 등록되었지만 푸시 알림 발송에 실패했습니다.\n${data.push_error}`);
        }
        closeForm(); fetchNotices();
      }
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/notices/${id}`, { method: 'DELETE' });
    fetchNotices();
  };

  const handleResendPush = async (id) => {
    if (!confirm('이 공지의 푸시 알림을 다시 발송하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/notices/${id}/resend-push`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + data.message);
      } else {
        alert('⚠️ 발송 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
      console.error(e);
    }
  };

  const showReadReceipts = async (notice) => {
    const res = await fetch(`${API_BASE}/api/read-receipts/notice/${notice.id}`);
    const data = await res.json();
    setReceipts(data.receipts || []);
    setViewReceipts(notice);
  };

  const isNew = (dateStr) => {
    if (!dateStr) return false;
    return (Date.now() - new Date(dateStr).getTime()) < 3 * 24 * 60 * 60 * 1000;
  };

  // Read receipts modal
  if (viewReceipts) {
    return (
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13, marginBottom: 16 }}
          onClick={() => setViewReceipts(null)}>← 목록으로</button>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, border: '1px solid var(--opaque-separator)' }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📊 수신 확인 — {viewReceipts.title}</h4>
          <p style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>
            수신 확인: {receipts.length}명
          </p>
          {receipts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--system-gray)' }}>수신 확인 기록이 없습니다.</div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>이름</th><th>소속</th><th>확인 시간</th></tr></thead>
              <tbody>
                {receipts.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.reader_name}</td>
                    <td>{r.reader_org}</td>
                    <td>{r.read_at?.substring(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>공지/알림 관리</h3>
        {!showForm && (
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={openNew}>
            + 새 공지 작성
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--opaque-separator)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              {editingNotice ? '✏️ 공지 수정' : '📝 새 공지 작성'}
            </h4>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--system-gray)' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['공지', '소식', '안내', '긴급'].map(cat => (
              <button key={cat}
                className={`btn ${form.category === cat ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setForm({ ...form, category: cat })}>
                {cat}
              </button>
            ))}
          </div>
          <input type="text" placeholder="제목" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, marginBottom: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          <textarea placeholder="내용을 입력하세요" value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })} rows={5}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          <div style={{ fontSize: 12, color: 'var(--system-gray)', marginTop: 4, marginLeft: 4 }}>
            💡 텍스트 링크 삽입 방법: <strong>[보여질 텍스트](링크주소)</strong> (예: [일정보기](https://prok-schedule...))
          </div>
          
          {/* Recipient picker */}
          <div style={{ marginTop: 12, padding: 12, background: 'var(--grouped-bg)', borderRadius: 8 }}>
            <RecipientPicker scope={scope} selected={form.recipients}
              onChange={r => setForm({ ...form, recipients: r, target_type: r.length > 0 ? 'select' : 'all' })}
              label="발송 대상" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} />
                📌 상단 고정
              </label>
              {!editingNotice && (
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '4px 10px', borderRadius: 6,
                  background: form.send_push ? 'rgba(52,199,89,0.12)' : 'transparent',
                  border: form.send_push ? '1px solid rgba(52,199,89,0.3)' : '1px solid transparent',
                  transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={form.send_push}
                    onChange={e => setForm({ ...form, send_push: e.target.checked })}
                    style={{ accentColor: '#34C759' }} />
                  🔔 푸시 알림 발송
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={closeForm}>취소</button>
              <button className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={handleSubmit}>
                {editingNotice ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice list */}
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>분류</th>
              <th>제목</th>
              <th>대상</th>
              <th>수신확인</th>
              <th>작성일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notices.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--system-gray)', padding: 32 }}>등록된 공지가 없습니다.</td></tr>
            )}
            {notices.map(n => (
              <tr key={n.id}>
                <td>
                  <span className="badge" style={{ fontSize: 11 }}>
                    {n.is_pinned ? '📌 ' : ''}{n.category}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>
                  {n.title}
                  {isNew(n.created_at) && <span style={{ color: '#FF3B30', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>🆕</span>}
                </td>
                <td style={{ fontSize: 12, color: 'var(--system-gray)' }}>
                  {n.target_type === 'all' || !n.recipients?.length ? '전체' : n.recipients.map(r => r.name).join(', ')}
                </td>
                <td>
                  <button className="btn btn-outline" style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => showReadReceipts(n)}>
                    👁 {n.read_count || 0}명
                  </button>
                </td>
                <td>{n.created_at?.substring(0, 10)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(52,199,89,0.1)', color: '#34C759', borderColor: 'transparent' }}
                      onClick={() => handleResendPush(n.id)}>🔔푸시재발송</button>
                    <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => openEdit(n)}>수정</button>
                    <button className="btn" style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                      onClick={() => handleDelete(n.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default NoticeManager;
