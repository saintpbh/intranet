import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const VisibilityRoleManager = () => {
  const [roles, setRoles] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRoles = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/visibility-roles`)
      .then(r => r.json())
      .then(data => setRoles(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleAdd = async () => {
    if (!newTag.trim()) return;
    const maxOrder = roles.reduce((m, r) => Math.max(m, r.display_order || 0), 0);
    const res = await fetch(`${API_BASE}/api/visibility-roles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_tag: newTag.trim(), display_order: maxOrder + 1 })
    });
    const data = await res.json();
    if (data.success) { setNewTag(''); fetchRoles(); }
    else alert(data.error || '추가 실패');
  };

  const handleDelete = async (id, tag) => {
    if (!confirm(`"${tag}" 역할 태그를 삭제하시겠습니까?`)) return;
    await fetch(`${API_BASE}/api/visibility-roles/${id}`, { method: 'DELETE' });
    fetchRoles();
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🏷️ 노출 범위 역할 태그 관리</h3>
      <p style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>
        문서의 열람 대상을 지정하기 위한 역할 태그를 관리합니다. 추가된 태그는 문서 발행 시 "노출 범위"로 선택 가능합니다.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="새 역할 태그 (예: 시무장로)" onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ padding: '8px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', flex: 1 }} />
        <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '8px 16px', fontSize: 13 }}>+ 추가</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {roles.map(r => (
            <div key={r.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
              background: 'var(--card-bg)', border: '1px solid var(--opaque-separator)', borderRadius: 20, fontSize: 14
            }}>
              <span style={{ fontWeight: 500 }}>{r.role_tag}</span>
              <button onClick={() => handleDelete(r.id, r.role_tag)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VisibilityRoleManager;
