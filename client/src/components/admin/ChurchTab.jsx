import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import ChurchReportForm from './ChurchReportForm';
import AdminDocumentBrowser from './AdminDocumentBrowser';
import SubmissionInbox from './SubmissionInbox';

/* ── Stitch design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
  gradientBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(0,112,235,0.25)' },
  ghostBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(196,198,206,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#43474d' },
  navPill: (active) => ({
    padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(0,112,235,0.08)' : 'transparent',
    color: active ? '#0070eb' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 13,
    fontFamily: "'Manrope', 'Pretendard'", transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 6,
  }),
};

const StatusBadge = ({ status }) => {
  const labels = { DRAFT: '임시저장', SUBMITTED: '제출됨', NOH_APPROVED: '노회 확인', ASSEMBLY_APPROVED: '총회 확정', REJECTED: '반려' };
  const colors = { DRAFT: '#8E8E93', SUBMITTED: '#FF9500', NOH_APPROVED: '#007AFF', ASSEMBLY_APPROVED: '#34C759', REJECTED: '#FF3B30' };
  const c = colors[status] || '#8e8e93';
  return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${c}12`, color: c, fontWeight: 700 }}>{labels[status] || status}</span>;
};

const ChurchTab = ({ user }) => {
  const [activeMenu, setActiveMenu] = useState('cert');
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [creatingReport, setCreatingReport] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── 지도·교회관리 state ──
  const [church, setChurch] = useState(null);
  const [churchLoading, setChurchLoading] = useState(false);
  const [churchError, setChurchError] = useState(null);
  const [churchSaving, setChurchSaving] = useState(false);
  const [churchForm, setChurchForm] = useState({});
  const [inquiries, setInquiries] = useState([]);
  const [inqLoading, setInqLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [churchToast, setChurchToast] = useState('');

  const showChurchToast = (msg) => { setChurchToast(msg); setTimeout(() => setChurchToast(''), 2500); };

  const fetchChurch = () => {
    const code = user?.chr_code;
    if (!code) { setChurchError('교회코드(chr_code)가 없습니다.'); return; }
    setChurchLoading(true);
    fetch(`${API_BASE}/api/church-manage/${code}`)
      .then(r => r.ok ? r.json() : Promise.reject('not found'))
      .then(d => {
        setChurch(d);
        setChurchForm({
          youtube_video_id: d.youtube_video_id || '', youtube_channel_id: d.youtube_channel_id || '',
          main_photo_url: d.main_photo_url || '', photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls : [],
          homepage_url: d.homepage_url || '', intro_text: d.intro_text || '',
          worship_times: Array.isArray(d.worship_times) ? d.worship_times : [],
          address: d.address || '', phone: d.phone || '',
        });
        setChurchError(null);
      })
      .catch(() => setChurchError('기장지도에 등록되지 않은 교회입니다.'))
      .finally(() => setChurchLoading(false));
  };

  const fetchInquiries = () => {
    const code = user?.chr_code;
    if (!code) return;
    setInqLoading(true);
    fetch(`${API_BASE}/api/church-manage/${code}/inquiries`)
      .then(r => r.ok ? r.json() : []).then(d => setInquiries(d)).finally(() => setInqLoading(false));
  };

  useEffect(() => { if (activeMenu === 'map-church') { fetchChurch(); fetchInquiries(); } }, [activeMenu]);

  const saveChurch = () => {
    setChurchSaving(true);
    fetch(`${API_BASE}/api/church-manage/${user.chr_code}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(churchForm),
    }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { setChurch(d); showChurchToast('✅ 저장 완료'); })
      .catch(() => alert('저장 실패')).finally(() => setChurchSaving(false));
  };

  const replyInquiry = (id) => {
    const text = replyTexts[id]; if (!text?.trim()) return;
    fetch(`${API_BASE}/api/church-manage/inquiries/${id}/reply`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: text }),
    }).then(r => { if (r.ok) { showChurchToast('✅ 답변 저장'); setReplyTexts(p => ({...p, [id]: ''})); fetchInquiries(); } });
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/admin/cert-requests`).then(r => r.json()),
      fetch(`${API_BASE}/api/church-reports?church_code=${user.chr_code || ''}`).then(r => r.json())
    ]).then(([certs, reps]) => {
      setRequests(Array.isArray(certs) ? certs : []);
      setReports(Array.isArray(reps) ? reps : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user.chr_code]);

  if (selectedCert) return <RequestDetail request={selectedCert} onBack={() => { setSelectedCert(null); fetchData(); }} actionRole="church" />;
  if (creatingReport || selectedReportId) return <ChurchReportForm user={user} reportId={selectedReportId} onBack={() => { setCreatingReport(false); setSelectedReportId(null); fetchData(); }} onSaved={() => { setCreatingReport(false); setSelectedReportId(null); fetchData(); }} />;

  const menus = [
    { id: 'cert', icon: 'verified', label: '증명서 관리' },
    { id: 'admin-docs', icon: 'folder_open', label: '행정문서' },
    { id: 'submissions', icon: 'inbox', label: '제출문서' },
    { id: 'report', icon: 'assessment', label: '상황 통계 보고' },
    { id: 'map-church', icon: 'map', label: '지도·교회관리' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {menus.map(m => (
          <button key={m.id} onClick={() => setActiveMenu(m.id)} style={S.navPill(activeMenu === m.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {activeMenu === 'cert' && (
        <>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 8 }}>교회 증명서 요청 목록</h3>
          <p style={{ ...S.subText, marginBottom: 20 }}>소속 교역자의 요청을 접수/확인하고, 시찰로 경유합니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelectedCert} />}
        </>
      )}

      {activeMenu === 'admin-docs' && <AdminDocumentBrowser user={user} scope="church" />}
      {activeMenu === 'submissions' && <SubmissionInbox user={user} role="church" />}

      {activeMenu === 'report' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>교회 보고서 제출</h3>
              <p style={S.subText}>매 연말 교회의 정보와 상황 통계를 노회로 보고합니다.</p>
            </div>
            <button style={S.gradientBtn} onClick={() => setCreatingReport(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>add_circle</span>
              새 보고서 작성
            </button>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>제출된 보고서가 없습니다.</div>
              ) : reports.map(r => (
                <div key={r.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>{r.report_year}년도 교회 상황 통계표</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>최종수정: {r.updated_at?.substring(0, 10)}</div>
                  </div>
                  <button style={S.ghostBtn} onClick={() => setSelectedReportId(r.id)}>열람 / 편집</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeMenu === 'map-church' && (
        <>
          {churchToast && <div style={{ position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:99,padding:'8px 20px',background:'#059669',color:'#fff',borderRadius:12,fontWeight:700,fontSize:13,boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>{churchToast}</div>}
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>기장지도 — 내 교회 정보 관리</h3>
          <p style={{ ...S.subText, marginBottom: 20 }}>기장지도 앱에 표시되는 교회 정보를 수정합니다.</p>
          {churchLoading ? <div style={{ textAlign:'center',padding:40,color:'#94a3b8' }}>불러오는 중...</div>
           : churchError ? <div style={{ ...S.card, textAlign:'center',padding:40,color:'#ef4444' }}>{churchError}</div>
           : church && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              {/* 왼쪽: 기본정보 */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#0070eb'}}>chat</span> 인삿말</div>
                  <textarea value={churchForm.intro_text} onChange={e => setChurchForm(p=>({...p, intro_text:e.target.value}))} rows={3} style={{ width:'100%',padding:10,borderRadius:10,border:'1px solid #e2e8f0',fontSize:13,resize:'vertical' }} placeholder="교회 환영 인삿말" />
                </div>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#0070eb'}}>schedule</span> 예배시간</div>
                  {churchForm.worship_times?.map((wt,i) => (
                    <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                      <input value={wt.title} onChange={e => { const a=[...churchForm.worship_times]; a[i]={...a[i],title:e.target.value}; setChurchForm(p=>({...p,worship_times:a})); }} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="예배명" />
                      <input value={wt.time} onChange={e => { const a=[...churchForm.worship_times]; a[i]={...a[i],time:e.target.value}; setChurchForm(p=>({...p,worship_times:a})); }} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="시간" />
                      <input value={wt.location||''} onChange={e => { const a=[...churchForm.worship_times]; a[i]={...a[i],location:e.target.value}; setChurchForm(p=>({...p,worship_times:a})); }} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="장소" />
                      <button onClick={() => setChurchForm(p=>({...p,worship_times:p.worship_times.filter((_,j)=>j!==i)}))} style={{ padding:'4px 6px',background:'#fee2e2',color:'#ef4444',border:'none',borderRadius:6,cursor:'pointer',fontSize:11 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setChurchForm(p=>({...p,worship_times:[...p.worship_times,{title:'',time:'',location:''}]}))} style={{ ...S.ghostBtn, fontSize:11, padding:'4px 10px' }}>+ 예배 추가</button>
                </div>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#0070eb'}}>location_on</span> 연락처·위치</div>
                  {[['address','주소'],['phone','전화번호'],['homepage_url','홈페이지']].map(([k,l]) => (
                    <div key={k} style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:2 }}>{l}</div>
                      <input value={churchForm[k]||''} onChange={e => setChurchForm(p=>({...p,[k]:e.target.value}))} style={{ width:'100%',padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:13 }} />
                    </div>
                  ))}
                </div>
                <button onClick={saveChurch} disabled={churchSaving} style={{ ...S.gradientBtn, width:'100%', opacity: churchSaving?0.6:1 }}>{churchSaving ? '저장 중...' : '💾 변경사항 저장'}</button>
              </div>
              {/* 오른쪽: 미디어 + 문의 */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#ef4444'}}>play_circle</span> 유튜브 영상</div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:2 }}>영상 ID</div>
                    <input value={churchForm.youtube_video_id} onChange={e => setChurchForm(p=>({...p,youtube_video_id:e.target.value}))} style={{ width:'100%',padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:13 }} placeholder="dQw4w9WgXcQ" />
                  </div>
                  {churchForm.youtube_video_id && <div style={{ aspectRatio:'16/9',borderRadius:12,overflow:'hidden',marginTop:8 }}><iframe src={`https://www.youtube.com/embed/${churchForm.youtube_video_id}`} style={{ width:'100%',height:'100%',border:'none' }} title="YT" allowFullScreen /></div>}
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:2 }}>채널 ID</div>
                    <input value={churchForm.youtube_channel_id} onChange={e => setChurchForm(p=>({...p,youtube_channel_id:e.target.value}))} style={{ width:'100%',padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:13 }} placeholder="UCxxxxxx" />
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#8b5cf6'}}>collections</span> 사진 갤러리 ({churchForm.photo_urls?.length || 0}장)</div>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    <input value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} style={{ flex:1,padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="사진 URL" onKeyDown={e => { if(e.key==='Enter' && newPhotoUrl.trim()) { setChurchForm(p=>({...p,photo_urls:[...p.photo_urls,newPhotoUrl.trim()]})); setNewPhotoUrl(''); }}} />
                    <button onClick={() => { if(newPhotoUrl.trim()) { setChurchForm(p=>({...p,photo_urls:[...p.photo_urls,newPhotoUrl.trim()]})); setNewPhotoUrl(''); }}} style={{ ...S.ghostBtn, padding:'6px 12px', fontSize:12 }}>추가</button>
                  </div>
                  {churchForm.photo_urls?.length > 0 && <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>{churchForm.photo_urls.map((u,i) => (<div key={i} style={{ position:'relative',flexShrink:0,width:100,height:70,borderRadius:10,overflow:'hidden',background:'#f1f5f9' }}><img src={u} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} /><button onClick={() => setChurchForm(p=>({...p,photo_urls:p.photo_urls.filter((_,j)=>j!==i)}))} style={{ position:'absolute',top:2,right:2,width:18,height:18,borderRadius:9,background:'rgba(239,68,68,0.8)',color:'#fff',border:'none',fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button></div>))}</div>}
                </div>
                <div style={S.card}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#f59e0b'}}>mail</span> 비밀 문의 ({inquiries.length}건)</div>
                    <button onClick={fetchInquiries} style={{ ...S.ghostBtn, fontSize:11, padding:'4px 10px' }}>새로고침</button>
                  </div>
                  {inqLoading ? <div style={{ textAlign:'center',padding:20,color:'#94a3b8',fontSize:13 }}>로딩...</div>
                   : inquiries.length === 0 ? <div style={{ textAlign:'center',padding:20,color:'#94a3b8',fontSize:13 }}>접수된 문의가 없습니다.</div>
                   : <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>{inquiries.map(inq => (
                    <div key={inq.id} style={{ padding:10, background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:700 }}>{inq.name} <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>{inq.phone}</span></span>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background: inq.is_read?'#d1fae5':'#fef3c7', color: inq.is_read?'#059669':'#d97706', fontWeight:700 }}>{inq.is_read?'답변완료':'미확인'}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#475569', marginBottom:4, whiteSpace:'pre-wrap' }}>{inq.content}</div>
                      {inq.reply && <div style={{ fontSize:12, color:'#1d4ed8', background:'#eff6ff', padding:6, borderRadius:6, marginBottom:4 }}>↳ {inq.reply}</div>}
                      <div style={{ display:'flex', gap:4 }}>
                        <input value={replyTexts[inq.id]||''} onChange={e => setReplyTexts(p=>({...p,[inq.id]:e.target.value}))} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="답변 작성..." onKeyDown={e => e.key==='Enter' && replyInquiry(inq.id)} />
                        <button onClick={() => replyInquiry(inq.id)} style={{ padding:'4px 10px',background:'#0070eb',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer' }}>전송</button>
                      </div>
                    </div>
                  ))}</div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChurchTab;
