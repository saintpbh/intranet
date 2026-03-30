import { useState, useEffect } from 'react';
import API_BASE from '../../api';

/**
 * RecipientPicker — scope-based recipient selection
 * 총회: 전체 노회/시찰/교회/목회자
 * 노회: 총회/타노회/소속 시찰/교회/목회자
 * 시찰: 소속 노회/교회/목회자
 */
const RecipientPicker = ({ scope, nohCode = '', sichalCode = '', selected = [], onChange, label = '대상 선택' }) => {
  const [bulkTargets, setBulkTargets] = useState([]);
  const [ministers, setMinisters] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ sender_scope: scope });
    if (nohCode) params.append('noh_code', nohCode);
    if (sichalCode) params.append('sichal_code', sichalCode);
    fetch(`${API_BASE}/api/recipients/available?${params}`)
      .then(r => r.json())
      .then(data => {
        setBulkTargets(data.bulk_targets || []);
        setMinisters(data.ministers || []);
      })
      .finally(() => setLoading(false));
  }, [scope, nohCode, sichalCode]);

  const addTarget = (t) => {
    if (!selected.some(s => s.type === t.type && s.code === t.code)) {
      onChange([...selected, t]);
    }
  };

  const removeTarget = (idx) => {
    onChange(selected.filter((_, i) => i !== idx));
  };

  const filtered = ministers.filter(m =>
    !search || (m.MinisterName || '').includes(search) || (m.ChrName || '').includes(search)
  );

  if (loading) return <div style={{ fontSize: 13, color: 'var(--system-gray)', padding: 8 }}>대상 로드 중...</div>;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      
      {/* Bulk targets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {bulkTargets.map((t, i) => {
          const isSelected = selected.some(s => s.type === t.type && s.code === t.code);
          return (
            <button key={i}
              className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => isSelected ? removeTarget(selected.findIndex(s => s.type === t.type && s.code === t.code)) : addTarget(t)}>
              {isSelected ? '✓ ' : '+ '}{t.name}
            </button>
          );
        })}
      </div>

      {/* Selected tags */}
      {selected.filter(s => !bulkTargets.some(b => b.type === s.type && b.code === s.code)).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {selected.filter(s => !bulkTargets.some(b => b.type === s.type && b.code === s.code)).map((s, i) => (
            <span key={i} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 12, background: 'rgba(0,122,255,0.1)', color: '#007AFF', cursor: 'pointer' }}
              onClick={() => removeTarget(selected.indexOf(s))}>
              {s.name} ✕
            </span>
          ))}
        </div>
      )}

      {/* Individual search */}
      <input type="text" placeholder="개별 교회·목회자 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      {search && filtered.length > 0 && (
        <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--opaque-separator)', borderRadius: 8, marginTop: 4 }}>
          {filtered.slice(0, 30).map((m, i) => {
            const entry = { type: 'minister', code: m.MinisterCode, name: `${m.MinisterName} (${m.ChrName || m.NOHNAME || ''})` };
            const isSelected = selected.some(s => s.code === entry.code);
            return (
              <div key={i} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid var(--opaque-separator)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: isSelected ? 'rgba(0,122,255,0.06)' : undefined }}
                onClick={() => isSelected ? removeTarget(selected.findIndex(s => s.code === entry.code)) : addTarget(entry)}>
                <span style={{ fontWeight: 500 }}>{m.MinisterName}</span>
                <span style={{ color: 'var(--system-gray)', fontSize: 12 }}>{m.ChrName || ''} · {m.NOHNAME || ''}</span>
                {isSelected && <span style={{ marginLeft: 'auto', color: 'var(--system-blue)', fontSize: 12 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecipientPicker;
