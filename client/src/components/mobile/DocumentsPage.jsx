import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import API_BASE from '../../api';

const getTypeLabel = (type) => {
  if (type === 'approve') return '결재';
  if (type === 'pass') return '경유';
  if (type === 'issue') return '발급';
  return type;
};

const getTypeColor = (type) => {
  if (type === 'approve') return 'text-secondary bg-secondary/10';
  if (type === 'pass') return 'text-[var(--system-orange)] bg-[var(--system-orange)]/10';
  if (type === 'issue') return 'text-primary bg-primary/10';
  return 'text-outline bg-surface-variant';
};

const DocumentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [certTypes, setCertTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modifyRequestId, setModifyRequestId] = useState(null);
  const [modifyComment, setModifyComment] = useState('');

  const fetchTypes = () => {
    fetch(`${API_BASE}/api/cert-types?active_only=true`)
      .then(r => r.json())
      .then(data => setCertTypes(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoadingTypes(false));
  };

  const fetchHistory = () => {
    if (!user?.code) return;
    fetch(`${API_BASE}/api/cert-requests/me?minister_code=${user.code}`)
      .then(r => r.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoadingRequests(false));
  };

  const handleModifyRequest = async (e, reqId) => {
    e.preventDefault();
    if (!modifyComment.trim()) return alert('수정 요청 사유를 입력해주세요.');
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/cert-requests/${reqId}/request-modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minister_code: user.code, comment: modifyComment })
      });
      const data = await response.json();
      if (data.success) {
        alert('수정 요청이 접수되었습니다.');
        setModifyRequestId(null);
        setModifyComment('');
        fetchHistory();
      } else {
        alert(data.error || '수정 요청 실패');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchHistory();
  }, [user]);

  const isExpired = (dateStr) => {
    if (!dateStr) return true;
    const expiryDate = new Date(dateStr);
    expiryDate.setHours(expiryDate.getHours() + 24);
    return Date.now() > expiryDate.getTime();
  };

  const handleApply = async () => {
    if (!selectedCert) return;
    if (!window.confirm(`${selectedCert.name} 신청을 진행하시겠습니까?`)) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/cert-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minister_code: user.code,
          minister_name: user.name,
          cert_type: selectedCert.name,
          cert_label: selectedCert.name,
          memo,
        }),
      });
      if (response.ok) {
        alert('신청이 완료되었습니다.');
        setMemo('');
        setSelectedCert(null);
        fetchHistory();
      } else {
        alert('신청에 실패했습니다.');
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDocs = certTypes.filter(doc => doc.name.includes(searchQuery) || doc.description.includes(searchQuery));

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-white/70 backdrop-blur-xl shadow-[0_20px_40px_rgba(10,37,64,0.06)] flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform duration-200 text-slate-900">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>arrow_back</span>
          </button>
          <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg tracking-tight text-slate-900">증명서 신청</h1>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container/10 bg-surface-container-high flex items-center justify-center">
          <span className="font-bold text-primary">{user?.name?.charAt(0) || 'U'}</span>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-12">
        {/* Editorial Header */}
        <section>
          <span className="text-secondary font-semibold tracking-widest text-[10px] uppercase mb-2 block font-['Plus_Jakarta_Sans']">서비스</span>
          <h2 className="text-4xl font-extrabold text-primary leading-tight mb-4 font-['Manrope',_'Pretendard']">증명서 발급</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs">
            기독교장로회 공식 증명서를 발급받으세요.
          </p>
        </section>

        {/* Realtime History Section */}
        <section>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">history</span>
            진행 과정 및 발급 이력
          </h3>
          
          {loadingRequests ? (
            <div className="text-center py-6 text-on-surface-variant text-sm">불러오는 중...</div>
          ) : requests.length === 0 ? (
            <div className="bg-surface-container-lowest border border-dashed border-surface-variant rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-outline-variant text-3xl mb-2">inbox</span>
              <p className="text-sm font-medium text-outline">신청 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => {
                const expired = r.status === 'ISSUED' && isExpired(r.updated_at);
                const isIssued = r.status === 'ISSUED';
                const isRejected = r.status === 'REJECTED';
                const isModifyRequested = r.status === 'MODIFY_REQUESTED';
                
                let hoursLeft = 0;
                if (isIssued && !expired && r.updated_at) {
                  const expiryDate = new Date(r.updated_at);
                  expiryDate.setHours(expiryDate.getHours() + 24);
                  hoursLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60));
                }

                return (
                  <div key={r.id} className="bg-white rounded-2xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-surface-variant/50 relative overflow-hidden flex flex-col gap-3">
                    {/* Status Bar Indicator */}
                    {isIssued && !expired && <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>}
                    {expired && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>}
                    {isRejected && <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>}
                    {isModifyRequested && <div className="absolute top-0 left-0 w-1.5 h-full bg-fuchsia-600"></div>}
                    
                    <div className="flex justify-between items-start pl-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          {r.doc_number && <span className="bg-primary-fixed/30 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md">{r.doc_number}</span>}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                             isIssued ? 'bg-green-100 text-green-700' : 
                             isRejected ? 'bg-orange-100 text-orange-700' :
                             isModifyRequested ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-surface-variant text-outline'
                          }`}>
                            {isIssued ? '발급 완료' : (isRejected ? '반려' : isModifyRequested ? '수정 요청됨' : '진행 중')}
                          </span>
                        </div>
                        <h4 className="font-['Manrope',_'Pretendard'] font-bold text-base text-on-surface mb-1">{r.cert_label}</h4>
                        <div className="space-y-0.5">
                          <p className="text-xs text-outline font-medium">신청일: <span className="text-on-surface-variant">{r.created_at?.substring(0, 10)}</span></p>
                          {(isIssued || isRejected || isModifyRequested) && (
                            <p className="text-xs text-outline font-medium">최종 결재: <span className="text-on-surface-variant">{r.updated_at?.substring(0, 10)}</span></p>
                          )}
                        </div>
                      </div>
                      
                      {isIssued && r.pdf_filename && (
                        <div className="text-right shrink-0 ml-2">
                          {expired ? (
                            <div className="flex flex-col items-end mt-1">
                              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md mb-1">기간 만료 (24시간 경과)</span>
                              <span className="text-[9px] text-outline-variant">재신청이 필요합니다</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-2">
                              <a href={`${API_BASE}/api/documents/download/${r.pdf_filename}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 bg-secondary text-white hover:bg-secondary/90 shadow-md shadow-secondary/20 font-bold text-xs px-3 py-2 rounded-xl transition-all active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[16px]">download</span>
                                PDF 다운로드
                              </a>
                              <button
                                onClick={() => { setModifyRequestId(modifyRequestId === r.id ? null : r.id); setModifyComment(''); }}
                                className="text-[10px] font-medium text-outline hover:text-outline-variant underline underline-offset-2"
                              >
                                파일에 문제가 있나요? (수정요청)
                              </button>
                              <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-md mt-1">
                                잔여 {hoursLeft}시간
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {(isModifyRequested || (isIssued && !r.pdf_filename)) && (
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-[10px] font-bold text-outline-variant bg-surface-variant px-2 py-1 rounded-md">
                            관리자 처리 중
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Modification Request Inline Form */}
                    {modifyRequestId === r.id && isIssued && !expired && (
                      <div className="mt-2 pt-3 border-t border-surface-variant">
                        <p className="text-xs text-on-surface font-bold mb-2">증명서 오기재 수정 요청</p>
                        <form onSubmit={(e) => handleModifyRequest(e, r.id)} className="flex flex-col gap-2">
                          <textarea
                            className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 resize-none h-20"
                            placeholder="어떤 정보가 잘못 기재되어 있는지 남겨주세요."
                            value={modifyComment}
                            onChange={e => setModifyComment(e.target.value)}
                            required
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button type="button" onClick={() => setModifyRequestId(null)} className="px-3 py-1.5 text-xs font-bold text-outline hover:bg-surface-variant rounded-lg transition-colors">취소</button>
                            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50">
                              {submitting ? '요청 중...' : '요청하기'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* New Application Section */}
        <section>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">post_add</span>
            새로 발급받기
          </h3>
          
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>search</span>
            </div>
            <input 
              type="text" 
              placeholder="증명서 종류 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-high border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-secondary-container/20 text-on-surface placeholder:text-outline transition-all"
            />
          </div>

          {loadingTypes ? (
            <div className="text-center py-6 text-on-surface-variant text-sm">유형 불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredDocs.map((doc) => {
                const isSelected = selectedCert?.id === doc.id;
                return (
                  <div 
                    key={doc.id} 
                    className={`group bg-white rounded-2xl p-5 shadow-[0_10px_20px_rgba(10,37,64,0.03)] border-2 transition-all cursor-pointer select-none ${
                       isSelected ? 'border-secondary bg-secondary/5' : 'border-surface-variant hover:border-outline-variant'
                    }`}
                    onClick={() => setSelectedCert(isSelected ? null : doc)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`text-lg font-bold font-['Manrope',_'Pretendard'] ${isSelected ? 'text-secondary' : 'text-primary'}`}>{doc.name}</h3>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                        isSelected ? 'border-secondary bg-secondary' : 'border-outline-variant/50 bg-transparent'
                      }`}>
                        {isSelected && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                      </div>
                    </div>
                    
                    <p className="text-on-surface-variant text-sm mb-4 leading-relaxed">
                      {doc.description}
                    </p>
                    
                    {/* Workflow Visualization */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-surface-container-lowest p-2.5 rounded-xl border border-surface-variant/50">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface">신청</span>
                      {doc.workflow && doc.workflow.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-outline-variant">arrow_right_alt</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getTypeColor(step.type)}`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Expandable Form */}
                    {isSelected && (
                      <div className="mt-6 pt-4 border-t border-surface-variant/50 animate-fade-in" onClick={e => e.stopPropagation()}>
                        <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-2">
                          비고 (선택)
                        </label>
                        <textarea
                          className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-variant/50 resize-none h-20 mb-4"
                          placeholder="추가 요청 사항이나 사유를 적어주세요."
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                        />
                        <button 
                          onClick={handleApply}
                          disabled={submitting}
                          className="w-full py-3.5 bg-gradient-to-r from-secondary to-secondary-container text-white rounded-xl font-bold text-sm shadow-[0_8px_16px_rgba(0,112,235,0.2)] active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                              신청 처리 중...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-lg">send</span>
                              신청 완료하기
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Support Section - 임시 숨김 처리 (나중에 다시 사용 가능)
        <div className="mt-12 p-8 rounded-lg bg-primary-container text-white relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-2 font-['Manrope',_'Pretendard']">도움이 필요하신가요?</h4>
            <p className="text-on-primary-container text-sm mb-4">
              원하는 증명서를 찾을 수 없거나 발급에 문제가 있다면 행정실로 문의해 주세요.
            </p>
            <button className="text-xs font-bold border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition-colors">
              고객센터 문의
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-secondary-container/30 rounded-full blur-3xl"></div>
        </div>
        */}
      </main>
    </div>
  );
};

export default DocumentsPage;
