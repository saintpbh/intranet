import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import FormRenderer from './FormRenderer';

const StatusBadge = ({ status }) => {
  const labels = { draft: '초안', published: '배포됨', closed: '마감' };
  const colors = { draft: '#8E8E93', published: '#34C759', closed: '#FF3B30' };
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: `${colors[status] || '#8e8e93'}15`, color: colors[status] || '#8e8e93', fontWeight: 600 }}>{labels[status] || status}</span>;
};

const AdminDocumentBrowser = ({ user, scope = 'all' }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fillDoc, setFillDoc] = useState(null); // doc to fill in
  const [myResponses, setMyResponses] = useState([]);

  const fetchDocs = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/form-documents?status=published`).then(r => r.json()),
      fetch(`${API_BASE}/api/form-responses?respondent_code=${user?.code || user?.id || ''}`).then(r => r.json())
    ]).then(([d, r]) => {
      setDocs(Array.isArray(d) ? d : []);
      setMyResponses(Array.isArray(r) ? r : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, []);

  const filtered = docs.filter(d => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getMyResponse = (docId) => myResponses.find(r => r.document_id === docId);

  const responseStatusLabel = (status) => {
    const map = { SUBMITTED: '제출됨', STEP_1: '경유 중', STEP_2: '결재 중', NOH_APPROVED: '노회 승인', ASSEMBLY_APPROVED: '최종 승인', REJECTED: '반려' };
    return map[status] || status;
  };

  if (fillDoc) {
    return (
      <FormRenderer
        document={fillDoc}
        user={user}
        onBack={() => { setFillDoc(null); fetchDocs(); }}
        onSubmitted={() => { setFillDoc(null); fetchDocs(); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📋 행정문서</h3>
          <p style={{ fontSize: 13, color: 'var(--system-gray)' }}>총회에서 배포한 문서를 검색하고 작성할 수 있습니다.</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 문서 제목 또는 설명으로 검색..."
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--opaque-separator)', fontSize: 14, fontFamily: 'inherit', background: 'var(--card-bg)' }} />
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--opaque-separator)' }}>
              {search ? '검색 결과가 없습니다.' : '배포된 행정문서가 없습니다.'}
            </div>
          ) : filtered.map(d => {
            const myResp = getMyResponse(d.id);
            const steps = (() => { try { return JSON.parse(d.approval_steps || '[]'); } catch { return []; } })();
            return (
              <div key={d.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: d.doc_type === 'form' ? 'rgba(0,122,255,0.1)' : 'rgba(255,149,0,0.1)', color: d.doc_type === 'form' ? '#007AFF' : '#FF9500', fontWeight: 600 }}>
                        {d.doc_type === 'form' ? '📊 양식' : '📎 PDF'}
                      </span>
                      {myResp && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: myResp.status === 'ASSEMBLY_APPROVED' ? 'rgba(52,199,89,0.1)' : myResp.status === 'REJECTED' ? 'rgba(255,59,48,0.1)' : 'rgba(0,122,255,0.1)', color: myResp.status === 'ASSEMBLY_APPROVED' ? '#34C759' : myResp.status === 'REJECTED' ? '#FF3B30' : '#007AFF', fontWeight: 600 }}>
                          {responseStatusLabel(myResp.status)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--system-gray)' }}>
                      {d.description && <span>{d.description} · </span>}
                      {d.report_year ? `${d.report_year}년도 · ` : ''}{d.deadline ? `기한: ${d.deadline}` : ''}
                    </div>
                    {steps.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#8E8E93' }}>결재:</span>
                        {steps.map((s, i) => (
                          <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#F2F2F7', color: '#333' }}>
                            {s.step}→{s.target}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    {d.doc_type === 'form' && (
                      <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setFillDoc(d)}>
                        {myResp ? '📝 수정/재제출' : '📝 작성하기'}
                      </button>
                    )}
                    {d.doc_type === 'pdf' && d.pdf_filename && (
                      <a href={`${API_BASE}/uploads/${d.pdf_filename}`} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}>📄 열기</a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDocumentBrowser;
