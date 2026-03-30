import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import RecipientPicker from './RecipientPicker';

const DOC_STATUS = { draft: '작성 중', sent: '발송됨', received: '수신', read: '열람' };
const DOC_COLORS = { draft: '#8E8E93', sent: '#007AFF', received: '#FF9500', read: '#34C759' };

const DocumentManager = ({ scope = 'assembly', senderOrg = '총회', senderRole = '총회관리자' }) => {
  const [view, setView] = useState('sent');
  const [sentDocs, setSentDocs] = useState([]);
  const [inboxDocs, setInboxDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [showReceipts, setShowReceipts] = useState(false);

  // Compose form
  const [form, setForm] = useState({
    doc_number: '', title: '', content: '', sent_date: '', signature_token: '', pdf_filename: '',
  });
  const [pdfOriginal, setPdfOriginal] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [ccList, setCcList] = useState([]);

  const fetchDocs = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/documents/sent?sender_scope=${scope}`).then(r => r.json()),
      fetch(`${API_BASE}/api/documents/inbox?scope=${scope}`).then(r => r.json()),
    ]).then(([sent, inbox]) => {
      setSentDocs(Array.isArray(sent) ? sent : []);
      setInboxDocs(Array.isArray(inbox) ? inbox : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, [scope]);

  // PDF upload
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
      if (data.success) { setForm(f => ({ ...f, pdf_filename: data.filename })); }
      else { alert('업로드 실패'); }
    } catch { alert('업로드 오류'); }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { alert('제목을 입력해 주세요.'); return; }
    if (recipients.length === 0) { alert('수신처를 선택해 주세요.'); return; }
    const res = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form, sender_org: senderOrg, sender_name: senderRole, sender_role: senderRole,
        sender_scope: scope, recipients, cc_list: ccList, scope,
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      setView('sent'); fetchDocs();
      setForm({ doc_number: '', title: '', content: '', sent_date: '', signature_token: '', pdf_filename: '' });
      setRecipients([]); setCcList([]); setPdfOriginal('');
    }
  };

  const openCompose = () => {
    setForm({ doc_number: '', title: '', content: '', sent_date: new Date().toISOString().substring(0, 10), signature_token: '', pdf_filename: '' });
    setRecipients([]); setCcList([]); setPdfOriginal('');
    setView('compose');
  };

  const openDetail = (doc) => { setSelectedDoc(doc); setView('detail'); };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/documents/${id}`, { method: 'DELETE' });
    fetchDocs();
  };

  const viewReadReceipts = async (doc) => {
    const res = await fetch(`${API_BASE}/api/read-receipts/document/${doc.id}`);
    const data = await res.json();
    setReceipts(data.receipts || []);
    setShowReceipts(true);
  };

  // --- Document list ---
  const DocList = ({ docs, showSender = false }) => (
    docs.length === 0 ? (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>공문이 없습니다.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map(d => (
          <div key={d.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)', cursor: 'pointer' }}
            onClick={() => openDetail(d)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {d.doc_number && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,122,255,0.1)', color: '#007AFF', fontWeight: 600 }}>{d.doc_number}</span>}
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: `${DOC_COLORS[d.status]}20`, color: DOC_COLORS[d.status], fontWeight: 600 }}>
                    {DOC_STATUS[d.status]}
                  </span>
                  {d.pdf_filename && <span style={{ fontSize: 11, color: '#FF3B30' }}>📎 PDF</span>}
                  {d.is_cc && <span style={{ fontSize: 11, color: 'var(--system-gray)' }}>(참조)</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: 'var(--system-gray)' }}>
                  {showSender ? `발신: ${d.sender_org} · ` : ''}{d.sent_date || d.created_at?.substring(0, 10)}
                  {d.recipients?.length > 0 && ` · 수신: ${d.recipients.map(r => r.name).join(', ')}`}
                </div>
              </div>
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ marginTop: 8 }}>
                <path d="M1 1L6 6L1 11" stroke="var(--system-gray)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        ))}
      </div>
    )
  );

  // --- Detail view ---
  if (view === 'detail' && selectedDoc) {
    return (
      <div>
        <button className="btn btn-outline" style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }}
          onClick={() => { setView(selectedDoc.sender_scope === scope ? 'sent' : 'inbox'); setShowReceipts(false); }}>
          ← 목록으로
        </button>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--opaque-separator)' }}>
          {selectedDoc.doc_number && (
            <div style={{ fontSize: 13, color: 'var(--system-gray)', marginBottom: 8 }}>문서번호: {selectedDoc.doc_number}</div>
          )}
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{selectedDoc.title}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 12px', fontSize: 14, marginBottom: 16 }}>
            <span style={{ color: 'var(--system-gray)', fontWeight: 500 }}>발신</span>
            <span>{selectedDoc.sender_org} ({selectedDoc.sender_role})</span>
            <span style={{ color: 'var(--system-gray)', fontWeight: 500 }}>수신</span>
            <span>{selectedDoc.recipients?.map(r => r.name).join(', ') || '-'}</span>
            {selectedDoc.cc_list?.length > 0 && (
              <>
                <span style={{ color: 'var(--system-gray)', fontWeight: 500 }}>참조</span>
                <span>{selectedDoc.cc_list.map(r => r.name).join(', ')}</span>
              </>
            )}
            <span style={{ color: 'var(--system-gray)', fontWeight: 500 }}>발신일</span>
            <span>{selectedDoc.sent_date}</span>
          </div>

          {selectedDoc.content && (
            <div style={{ padding: 16, background: 'var(--grouped-bg)', borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {selectedDoc.content}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedDoc.pdf_filename && (
              <a href={`${API_BASE}/api/documents/download/${selectedDoc.pdf_filename}`} target="_blank" rel="noreferrer"
                className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', textDecoration: 'none' }}>
                📎 PDF 다운로드
              </a>
            )}
            <button className="btn btn-outline" style={{ padding: '10px 16px' }} onClick={() => viewReadReceipts(selectedDoc)}>
              👁 수신확인 보기
            </button>
          </div>

          {selectedDoc.signature_token && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--opaque-separator)', paddingTop: 12, fontSize: 13, color: 'var(--system-gray)' }}>
              서명 토큰: <code style={{ background: 'var(--grouped-bg)', padding: '2px 6px', borderRadius: 4 }}>{selectedDoc.signature_token}</code>
            </div>
          )}

          {/* Read receipts in detail */}
          {showReceipts && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--opaque-separator)', paddingTop: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📊 수신 확인 ({receipts.length}명)</h4>
              {receipts.length === 0 ? (
                <div style={{ color: 'var(--system-gray)', fontSize: 13 }}>수신 확인 기록이 없습니다.</div>
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
          )}
        </div>
      </div>
    );
  }

  // --- Compose ---
  if (view === 'compose') {
    return (
      <div>
        <button className="btn btn-outline" style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }} onClick={() => setView('sent')}>← 취소</button>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--opaque-separator)' }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📄 공문 작성</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start' }}>
            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>문서번호</label>
            <input type="text" placeholder="총회-2026-001" value={form.doc_number} onChange={e => setForm({...form, doc_number: e.target.value})}
              style={{ padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />

            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>발신</label>
            <div style={{ padding: '10px 12px', background: 'var(--grouped-bg)', borderRadius: 8, fontSize: 14 }}>{senderOrg} ({senderRole})</div>

            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>발신일</label>
            <input type="date" value={form.sent_date} onChange={e => setForm({...form, sent_date: e.target.value})}
              style={{ padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />

            {/* Recipients using RecipientPicker */}
            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 4 }}>수신 *</label>
            <div style={{ padding: 12, background: 'var(--grouped-bg)', borderRadius: 8 }}>
              <RecipientPicker scope={scope} selected={recipients} onChange={setRecipients} label="수신 대상 지정" />
            </div>

            {/* CC using RecipientPicker */}
            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 4 }}>참조</label>
            <div style={{ padding: 12, background: 'var(--grouped-bg)', borderRadius: 8 }}>
              <RecipientPicker scope={scope} selected={ccList} onChange={setCcList} label="참조 대상 지정" />
            </div>

            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>제목 *</label>
            <input type="text" placeholder="공문 제목" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              style={{ padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />

            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>내용</label>
            <textarea placeholder="공문 내용" value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={5}
              style={{ padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />

            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>PDF 첨부</label>
            <div>
              <input type="file" accept=".pdf" onChange={handleFileSelect} style={{ fontSize: 13 }} />
              {uploading && <span style={{ fontSize: 12, color: 'var(--system-gray)', marginLeft: 8 }}>업로드 중...</span>}
              {form.pdf_filename && <div style={{ fontSize: 12, color: '#34C759', marginTop: 4 }}>✅ {pdfOriginal || form.pdf_filename} 업로드 완료</div>}
            </div>

            <label style={{ fontSize: 13, color: 'var(--system-gray)', paddingTop: 10 }}>서명 토큰</label>
            <input type="text" placeholder="서명 인증 토큰" value={form.signature_token} onChange={e => setForm({...form, signature_token: e.target.value})}
              style={{ padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, borderTop: '1px solid var(--opaque-separator)', paddingTop: 16 }}>
            <button className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={() => setView('sent')}>취소</button>
            <button className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={handleSubmit}>📤 발송하기</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main list view ---
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${view === 'sent' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setView('sent')}>📤 보낸 공문 ({sentDocs.length})</button>
        <button className={`btn ${view === 'inbox' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setView('inbox')}>📥 받은 공문 ({inboxDocs.length})</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={openCompose}>✏️ 공문 작성</button>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
        view === 'sent' ? <DocList docs={sentDocs} /> : <DocList docs={inboxDocs} showSender={true} />
      )}
    </div>
  );
};

export default DocumentManager;
