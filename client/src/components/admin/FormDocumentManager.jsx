import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const StatusBadge = ({ status }) => {
  const labels = { draft: '초안', published: '배포됨', closed: '마감' };
  const colors = { draft: '#8E8E93', published: '#34C759', closed: '#FF3B30' };
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: `${colors[status] || '#8e8e93'}15`, color: colors[status] || '#8e8e93', fontWeight: 600 }}>{labels[status] || status}</span>;
};

const FormDocumentManager = ({ user }) => {
  const [docs, setDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'responses'
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [responses, setResponses] = useState([]);

  // Create form
  const [form, setForm] = useState({
    doc_type: 'pdf', title: '', description: '', template_id: 0,
    pdf_filename: '', content: '', visibility_roles: [], report_year: new Date().getFullYear(), deadline: '',
    approval_steps: [] // [{step, target}]
  });
  const [uploading, setUploading] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/form-documents`).then(r => r.json()),
      fetch(`${API_BASE}/api/form-templates?active_only=true`).then(r => r.json()),
      fetch(`${API_BASE}/api/visibility-roles`).then(r => r.json()),
    ]).then(([d, t, r]) => {
      setDocs(Array.isArray(d) ? d : []);
      setTemplates(Array.isArray(t) ? t : []);
      setRoles(Array.isArray(r) ? r : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/documents/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) setForm(f => ({ ...f, pdf_filename: data.filename }));
      else alert('업로드 실패');
    } catch { alert('업로드 오류'); }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { alert('제목을 입력해 주세요.'); return; }
    const body = { ...form, visibility_roles: JSON.stringify(form.visibility_roles), approval_steps: JSON.stringify(form.approval_steps), created_by: user?.name || '관리자' };
    const res = await fetch(`${API_BASE}/api/form-documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      alert('문서가 생성되었습니다.');
      setView('list');
      setForm({ doc_type: 'pdf', title: '', description: '', template_id: 0, pdf_filename: '', content: '', visibility_roles: [], report_year: new Date().getFullYear(), deadline: '', approval_steps: [] });
      fetchAll();
    } else alert(data.error || '생성 실패');
  };

  const handlePublish = async (id) => {
    if (!confirm('이 문서를 배포하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/form-documents/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' })
    });
    fetchAll();
  };

  const fetchResponses = async (doc) => {
    setSelectedDoc(doc);
    const res = await fetch(`${API_BASE}/api/form-responses?document_id=${doc.id}`);
    const data = await res.json();
    setResponses(Array.isArray(data) ? data : []);
    setView('responses');
  };

  const toggleRole = (tag) => {
    setForm(f => ({
      ...f,
      visibility_roles: f.visibility_roles.includes(tag)
        ? f.visibility_roles.filter(r => r !== tag)
        : [...f.visibility_roles, tag]
    }));
  };

  const S = { padding: '8px 12px', border: '1px solid #C6C6C8', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' };

  // --- Responses view ---
  if (view === 'responses' && selectedDoc) {
    return (
      <div>
        <button className="btn btn-outline" onClick={() => setView('list')} style={{ marginBottom: 16, fontSize: 13, padding: '6px 14px' }}>← 문서 목록</button>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>📊 응답 현황: {selectedDoc.title}</h3>
        {responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--opaque-separator)' }}>제출된 응답이 없습니다.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>제출자</th><th>소속</th><th>상태</th><th>제출일</th></tr></thead>
            <tbody>
              {responses.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.respondent_name}</td>
                  <td>{r.respondent_org}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: r.status === 'ASSEMBLY_APPROVED' ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)', color: r.status === 'ASSEMBLY_APPROVED' ? '#34C759' : '#FF9500', fontWeight: 600 }}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.updated_at?.substring(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // --- Create view ---
  if (view === 'create') {
    return (
      <div>
        <button className="btn btn-outline" onClick={() => setView('list')} style={{ marginBottom: 16, fontSize: 13, padding: '6px 14px' }}>← 취소</button>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--opaque-separator)' }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>📄 새 문서 발행</h4>

          {/* Document type */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#E5E5EA', padding: 3, borderRadius: 10 }}>
            {['pdf', 'form'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, doc_type: t }))}
                style={{ flex: 1, padding: 8, border: 'none', borderRadius: 8, background: form.doc_type === t ? '#fff' : 'transparent', fontWeight: form.doc_type === t ? 600 : 400, fontSize: 14, cursor: 'pointer', boxShadow: form.doc_type === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {t === 'pdf' ? '📎 PDF 첨부 문서' : '📊 웹 양식 문서'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start' }}>
            <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>제목 *</label>
            <input type="text" placeholder="문서 제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...S }} />

            <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>설명</label>
            <textarea placeholder="문서 안내문" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...S, resize: 'vertical' }} />

            {form.doc_type === 'pdf' && (
              <>
                <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>본문</label>
                <textarea placeholder="본문 내용 (선택)" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={3} style={{ ...S, resize: 'vertical' }} />

                <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>PDF 첨부</label>
                <div>
                  <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ fontSize: 13 }} />
                  {uploading && <span style={{ fontSize: 12, color: '#8E8E93', marginLeft: 8 }}>업로드 중...</span>}
                  {form.pdf_filename && <div style={{ fontSize: 12, color: '#34C759', marginTop: 4 }}>✅ 업로드 완료</div>}
                </div>
              </>
            )}

            {form.doc_type === 'form' && (
              <>
                <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>양식 선택 *</label>
                <select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: parseInt(e.target.value) }))} style={{ ...S }}>
                  <option value="0">양식을 선택하세요</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
                </select>
              </>
            )}

            <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>연도</label>
            <input type="number" value={form.report_year} onChange={e => setForm(f => ({ ...f, report_year: parseInt(e.target.value) }))} style={{ ...S, width: 100 }} />

            <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 10 }}>제출 기한</label>
            <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={{ ...S, width: 180 }} />

            <label style={{ fontSize: 13, color: '#8E8E93', paddingTop: 4 }}>노출 범위</label>
            <div style={{ padding: 12, background: 'var(--grouped-bg)', borderRadius: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {roles.map(r => (
                  <label key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', padding: '4px 10px', borderRadius: 16, border: form.visibility_roles.includes(r.role_tag) ? '2px solid #007AFF' : '1px solid #C6C6C8', background: form.visibility_roles.includes(r.role_tag) ? 'rgba(0,122,255,0.08)' : 'white' }}>
                    <input type="checkbox" checked={form.visibility_roles.includes(r.role_tag)} onChange={() => toggleRole(r.role_tag)} style={{ display: 'none' }} />
                    {form.visibility_roles.includes(r.role_tag) ? '✓ ' : ''}{r.role_tag}
                  </label>
                ))}
              </div>
              {form.visibility_roles.length === 0 && <div style={{ fontSize: 12, color: '#FF9500', marginTop: 4 }}>⚠ 범위가 지정되지 않으면 모든 사용자에게 공개됩니다.</div>}
            </div>
          </div>

          {/* Approval Steps */}
          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: 13, color: '#8E8E93', fontWeight: 600 }}>📋 결재 단계</label>
            <div style={{ background: 'var(--grouped-bg)', borderRadius: 8, padding: 12, marginTop: 6 }}>
              {form.approval_steps.length === 0 && (
                <div style={{ fontSize: 12, color: '#C7C7CC', marginBottom: 8 }}>결재 단계를 추가하면 문서가 단계별로 승인됩니다.</div>
              )}
              {form.approval_steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#8E8E93', width: 20, textAlign: 'center' }}>{i + 1}</span>
                  <select value={s.step} onChange={e => {
                    const arr = [...form.approval_steps];
                    arr[i] = { ...arr[i], step: e.target.value };
                    setForm(f => ({ ...f, approval_steps: arr }));
                  }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #C6C6C8', fontSize: 12 }}>
                    <option value="보고">보고</option>
                    <option value="경유">경유</option>
                    <option value="결재">결재</option>
                    <option value="최종결재">최종결재</option>
                  </select>
                  <select value={s.target} onChange={e => {
                    const arr = [...form.approval_steps];
                    arr[i] = { ...arr[i], target: e.target.value };
                    setForm(f => ({ ...f, approval_steps: arr }));
                  }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #C6C6C8', fontSize: 12, flex: 1 }}>
                    <option value="church">교회</option>
                    <option value="sichal">시찰</option>
                    <option value="presbytery">노회</option>
                    <option value="assembly">총회</option>
                  </select>
                  <button onClick={() => setForm(f => ({ ...f, approval_steps: f.approval_steps.filter((_, j) => j !== i) }))}
                    style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, approval_steps: [...f.approval_steps, { step: '경유', target: 'presbytery' }] }))}
                style={{ fontSize: 12, color: '#007AFF', background: 'none', border: '1px dashed #007AFF', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginTop: 4 }}>
                + 단계 추가
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, borderTop: '1px solid var(--opaque-separator)', paddingTop: 16 }}>
            <button className="btn btn-outline" onClick={() => setView('list')} style={{ padding: '10px 20px' }}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate} style={{ padding: '10px 24px' }}>📤 문서 생성</button>
          </div>
        </div>
      </div>
    );
  }

  // --- List view ---
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📂 발행 문서 관리</h3>
          <p style={{ fontSize: 13, color: 'var(--system-gray)' }}>PDF 첨부 문서 또는 웹 양식 문서를 생성하고 배포합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setView('create')} style={{ fontSize: 13, padding: '8px 16px' }}>+ 새 문서 발행</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--opaque-separator)' }}>발행한 문서가 없습니다.</div>
          ) : docs.map(d => (
            <div key={d.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</span>
                    <StatusBadge status={d.status} />
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: d.doc_type === 'form' ? 'rgba(0,122,255,0.1)' : 'rgba(255,149,0,0.1)', color: d.doc_type === 'form' ? '#007AFF' : '#FF9500', fontWeight: 600 }}>
                      {d.doc_type === 'form' ? '📊 양식' : '📎 PDF'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--system-gray)' }}>
                    {d.report_year ? `${d.report_year}년도 · ` : ''}{d.deadline ? `기한: ${d.deadline} · ` : ''}수정: {d.updated_at?.substring(0, 10)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {d.doc_type === 'form' && <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => fetchResponses(d)}>📊 응답</button>}
                  {d.status === 'draft' && <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px', background: '#34C759' }} onClick={() => handlePublish(d.id)}>🚀 배포</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormDocumentManager;
