import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const FormRenderer = ({ document, user, onBack, onSubmitted }) => {
  const [schema, setSchema] = useState(null);
  const [formData, setFormData] = useState({});
  const [repeaterData, setRepeaterData] = useState({}); // sectionId -> [{field:value}]
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!document?.template_id) { setLoading(false); return; }
    fetch(`${API_BASE}/api/form-templates/${document.template_id}`)
      .then(r => r.json())
      .then(data => {
        if (data.schema_json) {
          try {
            const parsed = JSON.parse(data.schema_json);
            setSchema(parsed);
            // Init repeater data
            const reps = {};
            (parsed.sections || []).forEach(s => {
              if (s.type === 'repeater') reps[s.id] = [{}];
            });
            setRepeaterData(reps);
          } catch { }
        }
      }).finally(() => setLoading(false));
  }, [document?.template_id]);

  const setValue = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const setRepeaterValue = (sId, rowIdx, field, value) => {
    setRepeaterData(prev => ({
      ...prev,
      [sId]: (prev[sId] || []).map((row, i) => i === rowIdx ? { ...row, [field]: value } : row)
    }));
  };

  const addRepeaterRow = (sId) => {
    setRepeaterData(prev => ({ ...prev, [sId]: [...(prev[sId] || []), {}] }));
  };

  const removeRepeaterRow = (sId, idx) => {
    setRepeaterData(prev => ({ ...prev, [sId]: (prev[sId] || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async () => {
    if (!confirm('응답을 제출하시겠습니까?')) return;
    setSubmitting(true);
    const responseData = { fields: formData, repeaters: repeaterData };
    try {
      const res = await fetch(`${API_BASE}/api/form-responses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: document.id,
          respondent_code: user?.code || user?.id || '',
          respondent_name: user?.name || '',
          respondent_org: user?.church_name || user?.org || '',
          noh_code: user?.noh_code || '',
          response_data: JSON.stringify(responseData)
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('제출되었습니다.');
        if (onSubmitted) onSubmitted();
      } else alert(data.error || '제출 실패');
    } catch { alert('오류가 발생했습니다.'); }
    setSubmitting(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>양식 불러오는 중...</div>;
  if (!schema) return <div style={{ textAlign: 'center', padding: 40, color: '#FF3B30' }}>양식 데이터를 찾을 수 없습니다.</div>;

  const renderCell = (cell) => {
    if (cell.type === 'header') {
      return <span style={{ fontWeight: 700, fontSize: 12 }}>{cell.text}</span>;
    }
    const val = formData[cell.field] || '';
    const S = { width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, textAlign: 'center', outline: 'none' };
    switch (cell.type) {
      case 'text':
        return <input type="text" value={val} onChange={e => setValue(cell.field, e.target.value)} placeholder={cell.placeholder || ''} style={S} />;
      case 'number':
        return <input type="number" value={val} onChange={e => setValue(cell.field, e.target.value)} placeholder={cell.placeholder || ''} style={S} />;
      case 'date':
        return <input type="date" value={val} onChange={e => setValue(cell.field, e.target.value)} style={S} />;
      case 'select':
        return (
          <select value={val} onChange={e => setValue(cell.field, e.target.value)} style={{ ...S, padding: '2px' }}>
            <option value="">선택</option>
            {(cell.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'checkbox':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {(cell.options || []).map(o => (
              <label key={o} style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                <input type="checkbox" checked={(val || []).includes(o)} onChange={() => {
                  const arr = val || [];
                  setValue(cell.field, arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
                }} />{o}
              </label>
            ))}
          </div>
        );
      case 'radio':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {(cell.options || []).map(o => (
              <label key={o} style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                <input type="radio" name={cell.field} checked={val === o} onChange={() => setValue(cell.field, o)} />{o}
              </label>
            ))}
          </div>
        );
      case 'textarea':
        return <textarea value={val} onChange={e => setValue(cell.field, e.target.value)} placeholder={cell.placeholder || ''} rows={2} style={{ ...S, resize: 'vertical', textAlign: 'left' }} />;
      default:
        return <input type="text" value={val} onChange={e => setValue(cell.field, e.target.value)} style={S} />;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#007AFF', cursor: 'pointer', fontSize: 14 }}>← 돌아가기</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ fontSize: 13, padding: '8px 20px' }}>
          {submitting ? '제출 중...' : '📤 제출하기'}
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, border: '1px solid var(--opaque-separator)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>{schema.title || document.title}</h3>
        {document.description && <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--system-gray)', marginBottom: 16 }}>{document.description}</p>}

        {schema.sections.map((section, sIdx) => (
          <div key={section.id} style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, padding: '6px 10px', background: 'var(--grouped-bg)', borderRadius: 6 }}>{section.title}</h4>

            {section.type === 'table' && (
              <table className="report-table">
                <tbody>
                  {section.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.cells.map((cell, cIdx) => (
                        <td key={cIdx} colSpan={cell.colspan} rowSpan={cell.rowspan}
                          style={{ background: cell.type === 'header' ? '#f4f4f4' : '#fff', fontWeight: cell.type === 'header' ? 700 : 400, verticalAlign: 'middle' }}>
                          {renderCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {section.type === 'repeater' && (
              <div>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>연번</th>
                      {(section.columns_def || []).map((col, ci) => <th key={ci}>{col.label}</th>)}
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(repeaterData[section.id] || []).map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ textAlign: 'center', color: '#8E8E93' }}>{rIdx + 1}</td>
                        {(section.columns_def || []).map((col, ci) => (
                          <td key={ci}>
                            <input type={col.type === 'number' ? 'number' : 'text'} value={row[col.field] || ''} onChange={e => setRepeaterValue(section.id, rIdx, col.field, e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, outline: 'none' }} />
                          </td>
                        ))}
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => removeRepeaterRow(section.id, rIdx)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => addRepeaterRow(section.id)} style={{ fontSize: 12, color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>+ 행 추가</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FormRenderer;
