import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import FormBuilder from './FormBuilder';

const CELL_TYPES_LABEL = { header: '라벨', text: '텍스트', number: '숫자', date: '날짜', select: '드롭다운', checkbox: '체크', textarea: '장문' };

// ===== Clean Preview Modal =====
const PreviewModal = ({ template, onClose }) => {
  if (!template) return null;
  let schema = null;
  try { schema = JSON.parse(template.schema_json); } catch { /* ignored */ }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 800, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E5EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{template.name}</h3>
            {template.description && <p style={{ fontSize: 12, color: '#8E8E93', margin: '4px 0 0' }}>{template.description}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, opacity: 0.5 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {!schema || !schema.sections ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>스키마 데이터가 없습니다.</div>
          ) : schema.sections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#333', borderBottom: '2px solid #007AFF', paddingBottom: 4 }}>
                {section.title}
              </h4>

              {section.type === 'table' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {section.rows?.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.cells?.map((cell, cIdx) => (
                          <td key={cIdx} colSpan={cell.colspan || 1} rowSpan={cell.rowspan || 1}
                            style={{
                              border: '1px solid #C6C6C8',
                              padding: '8px 10px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              background: cell.type === 'header' ? '#F2F2F7' : '#fff',
                              fontWeight: cell.type === 'header' ? 700 : 400,
                              minWidth: 40,
                            }}>
                            {cell.type === 'header' ? (
                              cell.text || ''
                            ) : cell.type === 'checkbox' || cell.type === 'radio' ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', justifyContent: 'center', alignItems: 'center' }}>
                                {(cell.options && cell.options.length > 0) ? cell.options.map((opt, oi) => (
                                  <label key={oi} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                                    <input type={cell.type === 'radio' ? 'radio' : 'checkbox'} style={{ accentColor: '#007AFF', margin: 0 }} />
                                    <span>{opt}</span>
                                  </label>
                                )) : cell.text ? (
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 12 }}>
                                    <input type={cell.type === 'radio' ? 'radio' : 'checkbox'} style={{ accentColor: '#007AFF', margin: 0 }} />
                                    <span>{cell.text}</span>
                                  </label>
                                ) : null}
                              </div>
                            ) : (
                              <div style={{ borderBottom: '1px dashed #C7C7CC', minHeight: 20, lineHeight: '20px', color: '#C7C7CC', fontSize: 11 }}>
                                {cell.placeholder || cell.field || ''}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {section.type === 'repeater' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #C6C6C8', padding: '8px', background: '#F2F2F7', fontWeight: 700, width: 40 }}>연번</th>
                      {section.columns_def?.map((col, ci) => (
                        <th key={ci} style={{ border: '1px solid #C6C6C8', padding: '8px', background: '#F2F2F7', fontWeight: 700 }}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map(i => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #C6C6C8', padding: '8px', textAlign: 'center', color: '#8E8E93' }}>{i}</td>
                        {section.columns_def?.map((col, ci) => (
                          <td key={ci} style={{ border: '1px solid #C6C6C8', padding: '8px' }}>
                            <div style={{ borderBottom: '1px dashed #C7C7CC', minHeight: 20 }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={(section.columns_def?.length || 0) + 1} style={{ border: '1px solid #C6C6C8', padding: '6px', textAlign: 'center', color: '#C7C7CC', fontSize: 11 }}>
                        ... (최대 {section.maxRows || 30}행)
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #E5E5EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ fontSize: 11, color: '#8E8E93' }}>
            버전 {template.version || 1} · 최종수정: {template.updated_at?.substring(0, 10)} · 작성자: {template.created_by || '-'}
          </div>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '8px 20px', fontSize: 13 }}>닫기</button>
        </div>
      </div>
    </div>
  );
};

// ===== Main Component =====
const FormTemplateList = ({ user }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | template object
  const [previewing, setPreviewing] = useState(null); // template object for preview

  const fetchTemplates = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/form-templates`)
      .then(r => r.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSave = async (name, description, schemaJson) => {
    const body = { name, description, schema_json: schemaJson, created_by: user?.name || '관리자' };
    let res;
    if (editing && editing !== 'new' && editing.id) {
      res = await fetch(`${API_BASE}/api/form-templates/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, schema_json: schemaJson })
      });
    } else {
      res = await fetch(`${API_BASE}/api/form-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    const data = await res.json();
    if (data.success || data.id) {
      alert('저장되었습니다.');
      setEditing(null);
      fetchTemplates();
    } else {
      alert(data.error || '저장 실패');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('이 양식을 비활성화하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/form-templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  };

  const handlePermanentDelete = async (id, name) => {
    if (!confirm(`⚠️ "${name}" 양식을 영구 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
    if (!confirm('정말로 완전히 삭제하시겠습니까? (최종 확인)')) return;
    const res = await fetch(`${API_BASE}/api/form-templates/${id}/permanent`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('삭제되었습니다.');
      fetchTemplates();
    } else {
      alert(data.error || '삭제 실패');
    }
  };

  if (editing) {
    const schema = editing !== 'new' && editing.schema_json ? JSON.parse(editing.schema_json) : null;
    return (
      <FormBuilder
        initialSchema={schema}
        templateName={editing !== 'new' ? editing.name : ''}
        templateDesc={editing !== 'new' ? editing.description : ''}
        onSave={handleSave}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      {/* Preview Modal */}
      {previewing && <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📐 양식 설계도 관리</h3>
          <p style={{ fontSize: 13, color: 'var(--system-gray)' }}>복잡한 표 양식을 직접 설계하고 관리합니다. 이름 클릭시 미리보기</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')} style={{ fontSize: 13, padding: '8px 16px' }}>+ 새 양식 만들기</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--opaque-separator)' }}>등록된 양식이 없습니다.</div>
          ) : templates.map(t => (
            <div key={t.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setPreviewing(t)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#007AFF', textDecoration: 'underline', textDecorationColor: 'rgba(0,122,255,0.3)' }}>{t.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: t.is_active ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: t.is_active ? '#34C759' : '#FF3B30', fontWeight: 600 }}>
                    {t.is_active ? `v${t.version}` : '비활성'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--system-gray)' }}>{t.description || '설명 없음'} · 최종수정: {t.updated_at?.substring(0, 10)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setPreviewing(t)}>👁 미리보기</button>
                <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditing(t)}>✏️ 편집</button>
                {t.is_active && (
                  <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px', color: '#FF9500', borderColor: '#FF9500' }} onClick={() => handleDeactivate(t.id)}>비활성화</button>
                )}
                <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px', color: '#FF3B30', borderColor: '#FF3B30' }} onClick={() => handlePermanentDelete(t.id, t.name)}>🗑 삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormTemplateList;
