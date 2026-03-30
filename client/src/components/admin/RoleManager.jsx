import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const RoleManager = ({ roleType, roleLabel, scopeLabel, scopeKey, scopeNameKey, parentScope = null }) => {
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [scopes, setScopes] = useState([]);
  const [selectedScope, setSelectedScope] = useState('');
  const [selectedScopeName, setSelectedScopeName] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  // Load existing roles
  const fetchRoles = () => {
    const params = new URLSearchParams({ role: roleType });
    if (parentScope) params.append('noh_code', parentScope);
    fetch(`${API_BASE}/api/admin/roles?${params}`)
      .then(r => r.json())
      .then(data => setRoles(Array.isArray(data) ? data : []));
  };

  // Load scope options (presbyteries)
  useEffect(() => {
    if (roleType === 'noh_secretary') {
      fetch(`${API_BASE}/api/presbyteries`)
        .then(r => r.json())
        .then(data => setScopes(Array.isArray(data) ? data : []));
    }
    fetchRoles();
  }, []);

  // Search ministers
  useEffect(() => {
    if (searchTerm.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/admin/search-ministers?search=${encodeURIComponent(searchTerm)}`)
        .then(r => r.json())
        .then(data => setSearchResults(Array.isArray(data) ? data : []))
        .finally(() => setSearching(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAssign = async (minister) => {
    const scopeCode = roleType === 'noh_secretary' ? selectedScope : (parentScope || '');
    const scopeName = roleType === 'noh_secretary' ? selectedScopeName : '';
    
    if (roleType === 'noh_secretary' && !scopeCode) {
      alert('노회를 먼저 선택해 주세요.');
      return;
    }

    const res = await fetch(`${API_BASE}/api/admin/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: roleType,
        minister_code: minister.MinisterCode,
        minister_name: minister.MinisterName,
        noh_code: scopeCode,
        noh_name: scopeName || minister.NOHNAME || '',
        assigned_by: '총회관리자',
      }),
    });
    const data = await res.json();
    if (data.success) {
      fetchRoles();
      setSearchTerm('');
      setSearchResults([]);
      setShowAssign(false);
    }
  };

  const handleRemove = async (roleId) => {
    if (!confirm('해제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/admin/roles/${roleId}`, { method: 'DELETE' });
    fetchRoles();
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{roleLabel} 관리</h3>
        <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setShowAssign(!showAssign)}>
          {showAssign ? '닫기' : `+ ${roleLabel} 지정`}
        </button>
      </div>

      {/* Assignment form */}
      {showAssign && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--opaque-separator)' }}>
          {roleType === 'noh_secretary' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>
                {scopeLabel} 선택
              </label>
              <select
                value={selectedScope}
                onChange={(e) => {
                  setSelectedScope(e.target.value);
                  setSelectedScopeName(e.target.options[e.target.selectedIndex].text);
                }}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'var(--grouped-bg)' }}
              >
                <option value="">-- 노회 선택 --</option>
                {scopes.map(s => (
                  <option key={s.NohCode} value={s.NohCode}>{s.NohName}</option>
                ))}
              </select>
            </div>
          )}

          <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>
            목회자 검색
          </label>
          <input
            type="text"
            placeholder="이름으로 검색 (2자 이상)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {searching && <div style={{ fontSize: 13, color: 'var(--system-gray)', marginTop: 8 }}>검색 중...</div>}

          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
              <table className="admin-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr><th>코드</th><th>이름</th><th>교회</th><th>노회</th><th></th></tr>
                </thead>
                <tbody>
                  {searchResults.map(m => (
                    <tr key={m.MinisterCode}>
                      <td style={{ fontFamily: 'monospace' }}>{m.MinisterCode}</td>
                      <td style={{ fontWeight: 500 }}>{m.MinisterName}</td>
                      <td>{m.CHRNAME || '—'}</td>
                      <td>{m.NOHNAME || '—'}</td>
                      <td>
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => handleAssign(m)}>
                          지정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Current assignments */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>{scopeLabel || '노회'}</th>
            <th>지정일</th>
            <th>지정자</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--system-gray)', padding: 32 }}>
              지정된 {roleLabel}가 없습니다.
            </td></tr>
          )}
          {roles.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.minister_name}</td>
              <td>{r.noh_name || r.sichal_name || '—'}</td>
              <td>{r.created_at?.substring(0, 10)}</td>
              <td>{r.assigned_by}</td>
              <td>
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                  onClick={() => handleRemove(r.id)}
                >
                  해제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RoleManager;
