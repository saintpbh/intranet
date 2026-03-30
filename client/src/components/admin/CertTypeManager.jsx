import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const STAGE_OPTIONS = [
  { stage: 'CHURCH_CONFIRMED', label: '교회 당회장' },
  { stage: 'SICHAL_CONFIRMED', label: '시찰' },
  { stage: 'NOH_CONFIRMED', label: '노회' },
  { stage: 'APPROVED', label: '총회' },
];

const TYPE_OPTIONS = [
  { value: 'approve', label: '결재 (승인 필요)', color: '#007AFF' },
  { value: 'pass', label: '경유 (확인만)', color: '#FF9500' },
];

const CertTypeManager = () => {
  const [certTypes, setCertTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', workflow: [] });
  const [loading, setLoading] = useState(true);

  const fetchTypes = () => {
    fetch(`${API_BASE}/api/cert-types`)
      .then(r => r.json())
      .then(data => setCertTypes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTypes(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', workflow: [] });
    setShowForm(true);
  };

  const openEdit = (ct) => {
    setEditing(ct);
    setForm({ name: ct.name, description: ct.description, workflow: [...ct.workflow] });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const addStep = () => {
    setForm({
      ...form,
      workflow: [...form.workflow, { stage: 'CHURCH_CONFIRMED', label: '교회 당회장', type: 'approve' }]
    });
  };

  const updateStep = (idx, field, value) => {
    const wf = [...form.workflow];
    wf[idx] = { ...wf[idx], [field]: value };
    if (field === 'stage') {
      const opt = STAGE_OPTIONS.find(s => s.stage === value);
      wf[idx].label = opt ? opt.label : value;
    }
    setForm({ ...form, workflow: wf });
  };

  const removeStep = (idx) => {
    setForm({ ...form, workflow: form.workflow.filter((_, i) => i !== idx) });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { alert('증명서 이름을 입력해 주세요.'); return; }
    if (form.workflow.length === 0) { alert('결재 단계를 최소 1개 추가해 주세요.'); return; }

    // Always add ISSUED as the last step
    const workflow = [
      ...form.workflow,
      { stage: 'ISSUED', label: '발급', type: 'issue' }
    ];

    const url = editing
      ? `${API_BASE}/api/cert-types/${editing.id}`
      : `${API_BASE}/api/cert-types`;
    const method = editing ? 'PUT' : 'POST';

    const body = editing
      ? { name: form.name, description: form.description, workflow, is_active: true }
      : { name: form.name, description: form.description, workflow };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) { closeForm(); fetchTypes(); }
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/cert-types/${id}`, { method: 'DELETE' });
    fetchTypes();
  };

  const getTypeLabel = (type) => {
    if (type === 'approve') return '결재';
    if (type === 'pass') return '경유';
    if (type === 'issue') return '발급';
    return type;
  };

  const getTypeColor = (type) => {
    if (type === 'approve') return '#007AFF';
    if (type === 'pass') return '#FF9500';
    if (type === 'issue') return '#34C759';
    return '#8E8E93';
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>📋 증명서 유형 관리</h3>
        {!showForm && (
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={openNew}>
            + 새 유형 추가
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--opaque-separator)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              {editing ? '✏️ 유형 수정' : '📝 새 증명서 유형'}
            </h4>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--system-gray)' }}>✕</button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>증명서 이름</label>
            <input type="text" placeholder="예: 재직증명서" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>설명</label>
            <input type="text" placeholder="예: 현재 교회 재직 확인서" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Workflow builder */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>결재/경유 단계</label>
              <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={addStep}>
                + 단계 추가
              </button>
            </div>

            {/* Visual flow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12, background: '#E5E5EA', fontWeight: 500 }}>신청</span>
              {form.workflow.map((step, idx) => (
                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--system-gray)' }}>→</span>
                  <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12, background: `${getTypeColor(step.type)}20`, color: getTypeColor(step.type), fontWeight: 500 }}>
                    {step.label} ({getTypeLabel(step.type)})
                  </span>
                </span>
              ))}
              <span style={{ color: 'var(--system-gray)' }}>→</span>
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12, background: '#34C75920', color: '#34C759', fontWeight: 500 }}>발급</span>
            </div>

            {form.workflow.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '8px 12px', background: 'var(--grouped-bg)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 24, color: 'var(--system-gray)' }}>{idx + 1}.</span>
                <select value={step.stage} onChange={e => updateStep(idx, 'stage', e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--opaque-separator)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.stage} value={s.stage}>{s.label}</option>
                  ))}
                </select>
                <select value={step.type} onChange={e => updateStep(idx, 'type', e.target.value)}
                  style={{ width: 130, padding: '6px 8px', border: '1px solid var(--opaque-separator)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
                  {TYPE_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button onClick={() => removeStep(idx)}
                  style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={closeForm}>취소</button>
            <button className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={handleSubmit}>
              {editing ? '수정' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* Cert types list */}
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {certTypes.map(ct => (
            <div key={ct.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{ct.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--system-gray)', marginTop: 2 }}>{ct.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openEdit(ct)}>수정</button>
                  <button className="btn" style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                    onClick={() => handleDelete(ct.id)}>삭제</button>
                </div>
              </div>
              {/* Workflow visualization */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#E5E5EA', fontWeight: 500 }}>신청</span>
                {ct.workflow.map((step, idx) => (
                  <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--system-gray)', fontSize: 11 }}>→</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: `${getTypeColor(step.type)}15`, color: getTypeColor(step.type), fontWeight: 500 }}>
                      {step.label}
                      <span style={{ fontSize: 10, opacity: 0.7 }}> ({getTypeLabel(step.type)})</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CertTypeManager;
