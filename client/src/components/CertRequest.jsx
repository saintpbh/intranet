import { useState, useEffect } from 'react';
import API_BASE from '../api';

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

const CertRequest = ({ user, onBack }) => {
  const [certTypes, setCertTypes] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [memo, setMemo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [modifyRequestId, setModifyRequestId] = useState(null);
  const [modifyComment, setModifyComment] = useState('');

  const fetchHistory = () => {
    fetch(`${API_BASE}/api/cert-requests/me?minister_code=${user.code}`)
      .then(r => r.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .finally(() => setLoadingRequests(false));
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/cert-types?active_only=true`)
      .then(r => r.json())
      .then(data => setCertTypes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
      
    fetchHistory();
  }, [user.code]);

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

  const isExpired = (dateStr) => {
    if (!dateStr) return true;
    const expiryDate = new Date(dateStr);
    expiryDate.setHours(expiryDate.getHours() + 24);
    return Date.now() > expiryDate.getTime();
  };

  const handleSubmit = async () => {
    if (!selectedCert) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/cert-request`, {
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
      setSubmitted(true);
    } catch (err) {
      alert('요청 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
      fetchHistory(); // Refresh history
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased pb-20">
        <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-variant flex items-center justify-between px-6 py-4">
          <button className="flex items-center justify-center p-2 -ml-2 text-on-surface-variant hover:text-primary transition-colors active:scale-90" onClick={() => { setSubmitted(false); setSelectedCert(null); }}>
            <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          </button>
          <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary tracking-tight">증명서 요청</h1>
          <div className="w-8"></div>
        </header>
        
        <main className="pt-32 px-6 max-w-md mx-auto text-center animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 shadow-inner">
             <span className="material-symbols-outlined text-[48px] text-green-600">check_circle</span>
          </div>
          <h2 className="font-['Manrope',_'Pretendard'] text-2xl font-bold text-primary mb-3">요청이 접수되었습니다</h2>
          <p className="text-sm font-medium text-on-surface-variant leading-relaxed mb-8">
            <span className="font-bold text-primary">{selectedCert.name}</span> 발급 요청이 성공적으로 접수되었습니다.<br />
            결재 흐름에 따라 순서대로 처리됩니다.
          </p>

          {/* Show workflow */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-10 bg-white p-4 rounded-2xl shadow-sm border border-surface-variant/50">
            <span className="px-3 py-1 bg-surface-variant rounded-full text-[11px] font-bold text-on-surface">신청</span>
            {selectedCert.workflow.map((step, idx) => (
              <span key={idx} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline-variant text-[16px]">chevron_right</span>
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${getTypeColor(step.type)}`}>
                  {step.label} ({getTypeLabel(step.type)})
                </span>
              </span>
            ))}
          </div>

          <button 
            className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-md shadow-secondary/20 active:scale-95 transition-all text-[15px]" 
            onClick={onBack}
          >
            확인 및 돌아가기
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased pb-20">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-variant flex items-center justify-between px-6 py-4">
        <button className="flex items-center justify-center p-2 -ml-2 text-on-surface-variant hover:text-primary transition-colors active:scale-90" onClick={onBack}>
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary tracking-tight">증명서 요청</h1>
        <div className="w-8"></div>
      </header>
      
      <main className="pt-24 px-6 max-w-md mx-auto space-y-8 animate-fade-in">
        {loadingRequests ? (
          <div className="text-center py-12 text-on-surface-variant font-medium">이력 불러오는 중...</div>
        ) : (
          <section className="mb-10">
            <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-4 px-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">history</span>
              내 발급 이력
            </h3>
            
            {requests.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-lowest rounded-3xl border border-dashed border-surface-variant">
                <span className="material-symbols-outlined text-3xl text-outline-variant mb-2">inbox</span>
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
                    <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-surface-variant/50 relative overflow-hidden flex flex-col gap-3">
                      {isIssued && !expired && <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>}
                      {expired && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>}
                      {isRejected && <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>}
                      {isModifyRequested && <div className="absolute top-0 left-0 w-1.5 h-full bg-fuchsia-600"></div>}
                      
                      <div className="flex justify-between items-start pl-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {r.doc_number && <span className="bg-primary-fixed/30 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md">{r.doc_number}</span>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                               isIssued ? 'bg-green-100 text-green-700' : 
                               isRejected ? 'bg-orange-100 text-orange-700' : 
                               isModifyRequested ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-surface-variant text-outline'
                            }`}>
                              {isIssued ? '발급 완료' : (isRejected ? '반려' : isModifyRequested ? '수정 요청됨' : '진행 중')}
                            </span>
                          </div>
                          <h4 className="font-['Manrope',_'Pretendard'] font-bold text-[16px] text-on-surface mb-1">{r.cert_label}</h4>
                          <div className="space-y-0.5">
                            <p className="text-[12px] text-outline font-medium">신청일: <span className="text-on-surface-variant">{r.created_at?.substring(0, 10)}</span></p>
                            {(isIssued || isRejected || isModifyRequested) && (
                              <p className="text-[12px] text-outline font-medium">최종 결재: <span className="text-on-surface-variant">{r.updated_at?.substring(0, 10)}</span></p>
                            )}
                          </div>
                        </div>
                        
                        {isIssued && r.pdf_filename && (
                          <div className="text-right shrink-0 ml-2">
                            {expired ? (
                              <div className="flex flex-col items-end mt-1">
                                <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md mb-1">기간 만료 (24시간 경과)</span>
                                <span className="text-[9px] text-outline-variant">재신청이 필요합니다</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-2">
                                <a href={`${API_BASE}/api/documents/download/${r.pdf_filename}`} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-secondary text-white hover:bg-secondary/90 shadow-md shadow-secondary/20 font-bold text-[12px] px-3 py-2 rounded-xl transition-all active:scale-95"
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
        )}

        {loading ? (
          <div className="text-center py-12 text-on-surface-variant font-medium">증명서 목록 불러오는 중...</div>
        ) : (
          <section>
            <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-4 px-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">post_add</span>
              새로 발급받기
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              {certTypes.map((cert) => {
                const isSelected = selectedCert?.id === cert.id;
                return (
                  <div
                    key={cert.id}
                    onClick={() => setSelectedCert(cert)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                      isSelected 
                        ? 'bg-secondary/5 border-secondary shadow-[0_0_0_2px_rgba(0,88,188,0.2)]' 
                        : 'bg-white border-surface-variant/50 hover:border-outline-variant shadow-sm'
                    } flex items-center justify-between`}
                  >
                    <div className="flex-1 pr-4">
                      <h4 className={`font-['Manrope',_'Pretendard'] font-bold text-[16px] leading-tight mb-1 ${isSelected ? 'text-secondary' : 'text-on-surface'}`}>
                        {cert.name}
                      </h4>
                      <p className="text-[12px] text-on-surface-variant font-medium mb-3 leading-relaxed opacity-90">{cert.description}</p>
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cert.workflow.filter(s => s.type !== 'issue').map((step, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            {idx > 0 && <span className="material-symbols-outlined text-[12px] text-outline-variant">chevron_right</span>}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getTypeColor(step.type)}`}>
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isSelected ? 'border-secondary bg-secondary' : 'border-outline-variant/50 bg-transparent'
                    }`}>
                      {isSelected && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCert && (
              <div className="mt-8 space-y-4 animate-fade-in">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-variant/50">
                  <label htmlFor="memo-input" className="block text-xs font-bold text-outline uppercase tracking-wider pl-1 mb-2">
                    비고 (선택)
                  </label>
                  <textarea
                    id="memo-input"
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-[14px] text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:bg-white transition-all h-24 resize-none"
                    placeholder="추가 요청 사항이 있으면 입력해 주세요."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </div>

                <button
                  className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-[0_8px_16px_rgba(0,112,235,0.2)] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 text-[16px] mt-6"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      전송 중...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">send</span>
                      요청하기
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default CertRequest;
