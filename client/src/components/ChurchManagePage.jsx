import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';
import MobileHeader from './mobile/MobileHeader';
import API_BASE from '../api';

const ChurchManagePage = () => {
  const { user, isLoggedIn } = useAuth();
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('info');
  const [inquiries, setInquiries] = useState([]);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [toast, setToast] = useState('');

  // 편집 폼 상태
  const [form, setForm] = useState({
    youtube_video_id: '',
    youtube_channel_id: '',
    main_photo_url: '',
    photo_urls: [],
    homepage_url: '',
    intro_text: '',
    worship_times: [],
    address: '',
    phone: '',
    parking_info: '',
    transport_info: '',
  });

  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 교회명 표시 (총회는 "총회본부")
  const getChurchDisplayName = () => {
    if (!user) return '';
    const name = user.church || '';
    if (!name || name === '총회' || name.includes('총회')) return '총회본부';
    return name.endsWith('교회') ? name : name + '교회';
  };

  // 교회 정보 로드
  const fetchChurch = useCallback(async () => {
    if (!user?.chrCode) {
      setLoading(false);
      setError('교회코드가 없습니다. 사역 이력에서 현재 교회 정보를 확인해주세요.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/church-manage/${user.chrCode}`);
      if (res.status === 404) {
        setError('기장지도에 등록되지 않은 교회입니다.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('서버 오류');
      const data = await res.json();
      setChurch(data);
      setForm({
        youtube_video_id: data.youtube_video_id || '',
        youtube_channel_id: data.youtube_channel_id || '',
        main_photo_url: data.main_photo_url || '',
        photo_urls: Array.isArray(data.photo_urls) ? data.photo_urls : [],
        homepage_url: data.homepage_url || '',
        intro_text: data.intro_text || '',
        worship_times: Array.isArray(data.worship_times) ? data.worship_times : [],
        address: data.address || '',
        phone: data.phone || '',
        parking_info: data.parking_info || '',
        transport_info: data.transport_info || '',
      });
      setError(null);
    } catch (e) {
      setError('교회 정보를 불러올 수 없습니다: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 문의 목록 로드
  const fetchInquiries = useCallback(async () => {
    if (!user?.chrCode) return;
    setInquiryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/church-manage/${user.chrCode}/inquiries`);
      if (res.ok) {
        const data = await res.json();
        setInquiries(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInquiryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isLoggedIn) fetchChurch();
  }, [isLoggedIn, fetchChurch]);

  useEffect(() => {
    if (activeSection === 'inquiry' && isLoggedIn) fetchInquiries();
  }, [activeSection, isLoggedIn, fetchInquiries]);

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/church-manage/${user.chrCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('저장 실패');
      const data = await res.json();
      setChurch(data);
      showToast('✅ 저장되었습니다!');
    } catch (e) {
      alert('저장 중 오류: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 문의 답변
  const handleReply = async (inquiryId) => {
    const text = replyTexts[inquiryId];
    if (!text?.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/church-manage/inquiries/${inquiryId}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text }),
      });
      if (!res.ok) throw new Error('답변 저장 실패');
      showToast('✅ 답변이 저장되었습니다.');
      setReplyTexts(prev => ({ ...prev, [inquiryId]: '' }));
      fetchInquiries();
    } catch (e) {
      alert('답변 저장 오류: ' + e.message);
    }
  };

  // 예배시간 관리
  const addWorship = () => {
    setForm(p => ({ ...p, worship_times: [...p.worship_times, { title: '', time: '', location: '' }] }));
  };
  const updateWorship = (i, field, val) => {
    const arr = [...form.worship_times];
    arr[i] = { ...arr[i], [field]: val };
    setForm(p => ({ ...p, worship_times: arr }));
  };
  const removeWorship = (i) => {
    setForm(p => ({ ...p, worship_times: p.worship_times.filter((_, idx) => idx !== i) }));
  };

  // 사진 URL 관리
  const addPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    setForm(p => ({ ...p, photo_urls: [...p.photo_urls, newPhotoUrl.trim()] }));
    setNewPhotoUrl('');
  };
  const removePhoto = (i) => {
    setForm(p => ({ ...p, photo_urls: p.photo_urls.filter((_, idx) => idx !== i) }));
  };

  if (!isLoggedIn) return <SimpleLogin />;

  // 스타일 토큰
  const S = {
    card: 'bg-white rounded-2xl shadow-[0_4px_24px_rgba(10,37,64,0.06)] border border-slate-100 overflow-hidden',
    sectionTitle: "font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2 mb-3",
    label: 'text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1.5',
    input: 'w-full px-4 py-3 bg-slate-50 rounded-xl text-[14px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white border border-slate-100 transition-all',
    textarea: 'w-full px-4 py-3 bg-slate-50 rounded-xl text-[14px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white border border-slate-100 transition-all resize-none',
    btnPrimary: 'w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2',
    btnSecondary: 'px-3 py-1.5 bg-blue-50 text-blue-600 font-bold text-[12px] rounded-lg active:scale-95 transition-all flex items-center gap-1',
    btnDanger: 'p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-colors',
  };

  const tabs = [
    { key: 'info', label: '교회 정보', icon: 'church' },
    { key: 'media', label: '영상·사진', icon: 'photo_camera' },
    { key: 'inquiry', label: '비밀 문의', icon: 'mail' },
  ];

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans','Pretendard']">
      <MobileHeader title="교회" />

      <main className="pt-24 px-5 max-w-2xl mx-auto space-y-5">
        {/* Toast */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-emerald-500 text-white font-bold text-[13px] rounded-2xl shadow-xl animate-fade-in">
            {toast}
          </div>
        )}

        {/* Church Header Card */}
        <div className="rounded-[2rem] text-white shadow-[0_20px_40px_rgba(10,37,64,0.15)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-500"></div>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 p-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md mx-auto mb-3 flex items-center justify-center border border-white/30">
              <span className="material-symbols-outlined text-3xl">church</span>
            </div>
            <h2 className="text-2xl font-extrabold font-['Manrope','Pretendard'] mb-1 drop-shadow-lg">
              {getChurchDisplayName()}
            </h2>
            {user?.presbytery && (
              <p className="text-white/80 text-sm font-medium bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full inline-block mt-1">
                {user.presbytery}
              </p>
            )}
            <p className="text-white/60 text-[12px] mt-2">
              {user?.name} {user?.duty}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-3xl text-blue-500">progress_activity</span>
          </div>
        ) : error ? (
          <div className={S.card + ' p-6 text-center'}>
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">warning</span>
            <p className="text-slate-600 text-sm font-medium">{error}</p>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className={S.card + ' p-1.5 flex gap-1'}>
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeSection === tab.key
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── 교회 정보 섹션 ─── */}
            {activeSection === 'info' && (
              <div className="space-y-4 animate-fade-in">
                {/* 인삿말 */}
                <div className={S.card + ' p-5'}>
                  <h3 className={S.sectionTitle}>
                    <span className="material-symbols-outlined text-blue-500">chat</span>
                    교회 인삿말
                  </h3>
                  <textarea
                    className={S.textarea}
                    rows={4}
                    value={form.intro_text}
                    onChange={e => setForm(p => ({ ...p, intro_text: e.target.value }))}
                    placeholder="교회를 방문하시는 분들께 보여지는 환영 인삿말을 입력하세요."
                  />
                </div>

                {/* 예배시간 */}
                <div className={S.card + ' p-5'}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={S.sectionTitle + ' !mb-0'}>
                      <span className="material-symbols-outlined text-blue-500">schedule</span>
                      예배시간 안내
                    </h3>
                    <button onClick={addWorship} className={S.btnSecondary}>
                      <span className="material-symbols-outlined text-[14px]">add</span> 추가
                    </button>
                  </div>
                  {form.worship_times.length === 0 && (
                    <p className="text-center text-slate-300 text-sm py-4">등록된 예배가 없습니다.</p>
                  )}
                  <div className="space-y-3">
                    {form.worship_times.map((wt, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1 space-y-2">
                          <input
                            className="w-full px-3 py-2 bg-white rounded-lg text-[13px] font-bold text-slate-800 border border-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={wt.title}
                            onChange={e => updateWorship(i, 'title', e.target.value)}
                            placeholder="예배명 (예: 주일예배 1부)"
                          />
                          <div className="flex gap-2">
                            <input
                              className="flex-1 px-3 py-2 bg-white rounded-lg text-[12px] text-slate-600 border border-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              value={wt.time}
                              onChange={e => updateWorship(i, 'time', e.target.value)}
                              placeholder="시간 (예: 오전 11:00)"
                            />
                            <input
                              className="flex-1 px-3 py-2 bg-white rounded-lg text-[12px] text-slate-600 border border-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              value={wt.location || ''}
                              onChange={e => updateWorship(i, 'location', e.target.value)}
                              placeholder="장소 (예: 본당)"
                            />
                          </div>
                        </div>
                        <button onClick={() => removeWorship(i)} className={S.btnDanger}>
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 주소 & 전화번호 */}
                <div className={S.card + ' p-5 space-y-4'}>
                  <h3 className={S.sectionTitle}>
                    <span className="material-symbols-outlined text-blue-500">location_on</span>
                    연락처 및 위치
                  </h3>
                  <div>
                    <label className={S.label}>주소</label>
                    <input className={S.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="교회 주소" />
                  </div>
                  <div>
                    <label className={S.label}>전화번호</label>
                    <input className={S.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="02-000-0000" />
                  </div>
                  <div>
                    <label className={S.label}>주차 안내</label>
                    <input className={S.input} value={form.parking_info || ''} onChange={e => setForm(p => ({ ...p, parking_info: e.target.value }))} placeholder="예: 50대 주차 가능" />
                  </div>
                  <div>
                    <label className={S.label}>대중교통 안내</label>
                    <input className={S.input} value={form.transport_info || ''} onChange={e => setForm(p => ({ ...p, transport_info: e.target.value }))} placeholder="예: 지하철 2호선 3번 출구" />
                  </div>
                  <div>
                    <label className={S.label}>홈페이지</label>
                    <input className={S.input} value={form.homepage_url} onChange={e => setForm(p => ({ ...p, homepage_url: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>

                <button onClick={handleSave} disabled={saving} className={S.btnPrimary}>
                  {saving ? (
                    <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> 저장 중...</>
                  ) : (
                    <><span className="material-symbols-outlined text-lg">save</span> 변경사항 저장</>
                  )}
                </button>
              </div>
            )}

            {/* ─── 영상·사진 섹션 ─── */}
            {activeSection === 'media' && (
              <div className="space-y-4 animate-fade-in">
                {/* 유튜브 영상 */}
                <div className={S.card + ' p-5'}>
                  <h3 className={S.sectionTitle}>
                    <span className="material-symbols-outlined text-red-500">play_circle</span>
                    대표 영상 (유튜브)
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className={S.label}>유튜브 영상 ID</label>
                      <input className={S.input} value={form.youtube_video_id} onChange={e => setForm(p => ({ ...p, youtube_video_id: e.target.value }))} placeholder="예: dQw4w9WgXcQ" />
                      <p className="text-[11px] text-slate-400 mt-1 ml-1">유튜브 URL에서 v= 뒤의 코드를 입력하세요</p>
                    </div>
                    {form.youtube_video_id && (
                      <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${form.youtube_video_id}`} title="Preview" allowFullScreen />
                      </div>
                    )}
                    <div>
                      <label className={S.label}>유튜브 채널 ID</label>
                      <input className={S.input} value={form.youtube_channel_id} onChange={e => setForm(p => ({ ...p, youtube_channel_id: e.target.value }))} placeholder="예: UCxxxxxxxxxxxxxx" />
                    </div>
                  </div>
                </div>

                {/* 대표 사진 */}
                <div className={S.card + ' p-5'}>
                  <h3 className={S.sectionTitle}>
                    <span className="material-symbols-outlined text-emerald-500">image</span>
                    대표 사진
                  </h3>
                  <div>
                    <label className={S.label}>대표 사진 URL</label>
                    <input className={S.input} value={form.main_photo_url} onChange={e => setForm(p => ({ ...p, main_photo_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  {form.main_photo_url && (
                    <div className="mt-3 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                      <img src={form.main_photo_url} alt="대표 사진" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                </div>

                {/* 사진 캐러셀 */}
                <div className={S.card + ' p-5'}>
                  <h3 className={S.sectionTitle}>
                    <span className="material-symbols-outlined text-purple-500">collections</span>
                    사진 갤러리 ({form.photo_urls.length}장)
                  </h3>
                  <div className="flex gap-2 mb-3">
                    <input className={S.input + ' !flex-1'} value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} placeholder="사진 URL 입력 후 추가" onKeyDown={e => e.key === 'Enter' && addPhoto()} />
                    <button onClick={addPhoto} className={S.btnSecondary}>
                      <span className="material-symbols-outlined text-[14px]">add</span>
                    </button>
                  </div>
                  {form.photo_urls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollSnapType: 'x mandatory' }}>
                      {form.photo_urls.map((url, i) => (
                        <div key={i} className="relative shrink-0 w-32 h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-100" style={{ scrollSnapAlign: 'start' }}>
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" onError={e => { e.target.src = ''; e.target.alt = '로드 실패'; }} />
                          <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 text-white rounded-full flex items-center justify-center text-[10px] font-bold backdrop-blur-sm">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.photo_urls.length === 0 && (
                    <p className="text-center text-slate-300 text-sm py-4">등록된 사진이 없습니다.</p>
                  )}
                </div>

                <button onClick={handleSave} disabled={saving} className={S.btnPrimary}>
                  {saving ? (
                    <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> 저장 중...</>
                  ) : (
                    <><span className="material-symbols-outlined text-lg">save</span> 변경사항 저장</>
                  )}
                </button>
              </div>
            )}

            {/* ─── 비밀 문의 섹션 ─── */}
            {activeSection === 'inquiry' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className={S.sectionTitle + ' !mb-0'}>
                    <span className="material-symbols-outlined text-amber-500">lock</span>
                    비밀 문의 ({inquiries.length}건)
                  </h3>
                  <button onClick={fetchInquiries} className={S.btnSecondary}>
                    <span className="material-symbols-outlined text-[14px]">refresh</span> 새로고침
                  </button>
                </div>

                {inquiryLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="material-symbols-outlined animate-spin text-2xl text-blue-500">progress_activity</span>
                  </div>
                ) : inquiries.length === 0 ? (
                  <div className={S.card + ' p-8 text-center'}>
                    <span className="material-symbols-outlined text-4xl text-slate-200 block mb-2">inbox</span>
                    <p className="text-slate-400 text-sm">접수된 문의가 없습니다.</p>
                  </div>
                ) : (
                  inquiries.map(inq => (
                    <div key={inq.id} className={S.card + ' p-4'}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-bold text-[14px] text-slate-800">{inq.name}</span>
                          <span className="ml-2 text-[11px] text-slate-400">{inq.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inq.is_read ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {inq.is_read ? '답변완료' : '미확인'}
                          </span>
                          <span className="text-[10px] text-slate-300">{new Date(inq.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                      <p className="text-[13px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl mb-2 whitespace-pre-wrap">{inq.content}</p>
                      {inq.reply && (
                        <div className="bg-blue-50 p-3 rounded-xl mb-2 border border-blue-100">
                          <p className="text-[11px] font-bold text-blue-600 mb-1">↳ 답변</p>
                          <p className="text-[13px] text-blue-800 whitespace-pre-wrap">{inq.reply}</p>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <input
                          className="flex-1 px-3 py-2 bg-slate-50 rounded-lg text-[13px] border border-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={replyTexts[inq.id] || ''}
                          onChange={e => setReplyTexts(p => ({ ...p, [inq.id]: e.target.value }))}
                          placeholder={inq.reply ? '답변 수정...' : '답변 작성...'}
                          onKeyDown={e => e.key === 'Enter' && handleReply(inq.id)}
                        />
                        <button onClick={() => handleReply(inq.id)} className="px-4 py-2 bg-blue-600 text-white text-[12px] font-bold rounded-lg active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-[16px]">send</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ChurchManagePage;
