import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';
import MobileHeader from './mobile/MobileHeader';
import SyncDateLabel from './SyncDateLabel';
import API_BASE from '../api';
import { getChurchByChrCode, updateChurchByChrCode, insertChurch } from '../utils/supabaseRest';

const ENV_MAP = { '1': '도시', '2': '읍', '3': '면', '4': '농어촌' };

function formatEstDate(raw) {
  if (!raw || raw.length < 8) return raw || '';
  return `${raw.slice(0, 4)}년 ${raw.slice(4, 6)}월 ${raw.slice(6, 8)}일`;
}

/* ── 기장지도 통합 편집 모달 (SlideOver 스타일) ── */
const GijangMapEditModal = ({ mapData, onSave, onClose, churchName }) => {
  const [intro, setIntro] = useState(mapData?.intro_text || '');
  const [worshipTimes, setWorshipTimes] = useState(
    (mapData?.worship_times || []).map(w => ({ title: w.title || w.name || '', time: w.time || '' }))
  );
  const [youtubeVideoId, setYoutubeVideoId] = useState(mapData?.youtube_video_id || '');
  const [youtubeChannelId, setYoutubeChannelId] = useState(mapData?.youtube_channel_id || '');
  const [homepageUrl, setHomepageUrl] = useState(mapData?.homepage_url || '');
  const [parkingInfo, setParkingInfo] = useState(mapData?.parking_info || '');
  const [transportInfo, setTransportInfo] = useState(mapData?.transport_info || '');

  // 예배시간 추가/삭제
  const addWorship = () => setWorshipTimes([...worshipTimes, { title: '', time: '' }]);
  const removeWorship = i => setWorshipTimes(worshipTimes.filter((_, idx) => idx !== i));
  const updateWorship = (i, k, v) => {
    const n = [...worshipTimes];
    n[i] = { ...n[i], [k]: v };
    setWorshipTimes(n);
  };

  const handleSave = () => {
    // 빈 예배시간 행 필터링
    const filteredWorship = worshipTimes.filter(w => w.title.trim() || w.time.trim());
    onSave({
      intro_text: intro,
      worship_times: filteredWorship,
      youtube_video_id: youtubeVideoId,
      youtube_channel_id: youtubeChannelId,
      homepage_url: homepageUrl,
      parking_info: parkingInfo,
      transport_info: transportInfo,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-20px_50px_rgba(10,37,64,0.15)] flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-transparent rounded-t-[2.5rem]">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-800 font-['Manrope','Pretendard']">기장지도 교회정보 편집</h3>
            <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">{churchName}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
          
          {/* 교회 소개 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-indigo-400">waving_hand</span>
              인삿말 (교회 소개)
            </label>
            <textarea 
              value={intro} 
              onChange={e => setIntro(e.target.value)}
              placeholder="교회 방문자들에게 보여줄 따뜻한 인삿말을 적어주세요."
              className="w-full border border-slate-200 rounded-2xl p-4 text-[13px] min-h-[100px] max-h-[200px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all resize-y text-slate-700 leading-relaxed"
            />
          </div>

          {/* 예배시간 동적 에디터 */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-indigo-400">schedule</span>
              예배시간 안내
            </label>
            <div className="space-y-2.5">
              {worshipTimes.map((w, i) => (
                <div key={i} className="flex gap-2 items-center animate-fade-in">
                  <input 
                    placeholder="예배명 (예: 주일낮예배)" 
                    value={w.title}
                    onChange={e => updateWorship(i, 'title', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                  />
                  <input 
                    placeholder="시간 (예: 오전 11:00)" 
                    value={w.time}
                    onChange={e => updateWorship(i, 'time', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                  />
                  <button 
                    onClick={() => removeWorship(i)} 
                    className="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center flex-shrink-0 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
            <button 
              type="button"
              onClick={addWorship} 
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-100 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all font-bold text-[13px] flex items-center justify-center gap-1 active:scale-98"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              예배시간 행 추가하기
            </button>
          </div>

          {/* 홈페이지 및 SNS 채널 */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">온라인 미디어 정보</h4>
            
            {/* 홈페이지 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-green-500">language</span>
                홈페이지 URL
              </label>
              <input 
                type="url"
                value={homepageUrl} 
                onChange={e => setHomepageUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 유튜브 비디오 ID */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-red-500">smart_display</span>
                  유튜브 비디오 ID
                </label>
                <input 
                  type="text"
                  value={youtubeVideoId} 
                  onChange={e => setYoutubeVideoId(e.target.value)}
                  placeholder="예: dQw4w9WgXcQ (메인 소개영상)"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>

              {/* 유튜브 채널 ID */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-red-500">subscriptions</span>
                  유튜브 채널 ID
                </label>
                <input 
                  type="text"
                  value={youtubeChannelId} 
                  onChange={e => setYoutubeChannelId(e.target.value)}
                  placeholder="예: UC_x5XG1OV2P6uYZ5FHSFwNg"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
            </div>
          </div>

          {/* 주차 및 오시는 길 */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">오시는 길 및 주차</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 주차 안내 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-teal-500">local_parking</span>
                  주차 안내
                </label>
                <textarea 
                  value={parkingInfo} 
                  onChange={e => setParkingInfo(e.target.value)}
                  placeholder="교회 주차공간 또는 인근 유/무료 주차장 정보를 적어주세요."
                  className="w-full border border-slate-200 rounded-xl p-3 text-[13px] min-h-[80px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 leading-relaxed resize-none"
                />
              </div>

              {/* 대중교통 안내 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-teal-500">directions_bus</span>
                  대중교통 안내
                </label>
                <textarea 
                  value={transportInfo} 
                  onChange={e => setTransportInfo(e.target.value)}
                  placeholder="인근 지하철역이나 버스정류장 및 도보 이동 경로를 알려주세요."
                  className="w-full border border-slate-200 rounded-xl p-3 text-[13px] min-h-[80px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-100 flex gap-3 bg-slate-50 rounded-b-[2.5rem]">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm bg-white hover:bg-slate-50 transition-colors active:scale-95"
          >
            취소
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

const ChurchManagePage = () => {
  const { user, isLoggedIn } = useAuth();
  const [church, setChurch] = useState(null);       // TB_Chr100 (IndexedDB or API)
  const [mapData, setMapData] = useState(null);      // 기장지도 Supabase
  const [mapError, setMapError] = useState(false);   // Supabase 연결 실패
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editMap, setEditMap] = useState(false);
  const [toast, setToast] = useState('');

  const chrCode = church?.ChrCode?.trim?.() || user?.chrCode?.trim?.() || '';

  const getChurchDisplayName = () => {
    if (church?.CHRNAME) return (church.CHRNAME || '').trim();
    if (!user) return '';
    const name = user.church || '';
    if (!name || name.includes('총회')) return '총회본부';
    return name.endsWith('교회') ? name : name + '교회';
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // ── TB_Chr100 데이터 로드 (IndexedDB → 로컬 API 폴백) ──
  const fetchChurch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { getCachedSearch, syncFullDirectory } = await import('../utils/offlineDb');
      let found = null;

      // "총회본부" 등 교회 DB에 없는 소속 감지
      const churchName = (user?.church || '').trim();
      const isHeadquarters = !churchName || churchName.includes('총회') || churchName.includes('본부');
      const userChrCode = (user?.chrCode || '').trim();

      // 1차: IndexedDB 캐시에서 검색 (유효한 chrCode가 있는 경우만)
      if (userChrCode && !isHeadquarters) {
        const res = await getCachedSearch('churches', userChrCode);
        if (res?.length) {
          // chrCode 정확 매칭 확인
          found = res.find(c => (c.ChrCode || '').trim() === userChrCode) || null;
        }
      }
      if (!found && churchName && !isHeadquarters) {
        const res = await getCachedSearch('churches', churchName);
        if (res?.length) {
          found = res.find(c => {
            const n = (c.CHRNAME || '').trim();
            return n === churchName || n === churchName + '교회' || churchName === n + '교회';
          }) || null; // 정확 매칭 없으면 null (잘못된 교회 방지)
        }
      }

      // 2차: IndexedDB에 없으면 로컬 서버 API 직접 호출 시도
      if (!found && navigator.onLine && !isHeadquarters) {
        try {
          const searchTerm = userChrCode || churchName;
          if (searchTerm) {
            const apiRes = await fetch(`${API_BASE}/api/churches?search=${encodeURIComponent(searchTerm)}`);
            if (apiRes.ok) {
              const apiData = await apiRes.json();
              const churches = Array.isArray(apiData) ? apiData : (apiData.data || []);
              if (churches.length) {
                if (userChrCode) {
                  found = churches.find(c => (c.ChrCode || '').trim() === userChrCode) || null;
                } else {
                  found = churches.find(c => {
                    const n = (c.CHRNAME || '').trim();
                    return n === churchName || n === churchName + '교회';
                  }) || null;
                }
              }
            }
          }
        } catch (apiErr) {
          console.warn('[ChurchManage] API fallback failed:', apiErr.message);
        }
      }

      // 3차: 아무것도 없으면 user 정보로 최소 데이터 구성
      if (!found) {
        // 백그라운드 동기화 트리거 (다음번에는 사용 가능하도록)
        syncFullDirectory().catch(() => {});
        
        // user 정보만으로 최소한의 교회 객체 구성 (완전 빈 화면 방지)
        if (churchName || userChrCode) {
          found = {
            ChrCode: userChrCode || '',
            CHRNAME: churchName || '',
            NOHNAME: user.NOHNAME || user.noh_name || user.presbytery || '',
            SICHALNAME: user.SICHALNAME || user.sichal_name || '',
            MOCKNAME: user.name || '',
            _isMinimal: true,  // 최소 데이터 플래그
            _isHeadquarters: isHeadquarters,
          };
        }
      }

      if (found) {
        setChurch(found);
        // 백그라운드에서 실시간 최신 정보 (선교주일 가상계좌 등) 한 번 더 Fetch해서 병합
        if (navigator.onLine && found.ChrCode && !found._isHeadquarters) {
          fetch(`${API_BASE}/api/churches?search=${encodeURIComponent(found.ChrCode.trim())}`)
            .then(res => res.ok ? res.json() : null)
            .then(apiData => {
              if (apiData) {
                const churches = Array.isArray(apiData) ? apiData : (apiData.data || []);
                const latest = churches.find(c => (c.ChrCode || '').trim() === found.ChrCode.trim());
                if (latest && latest.mission_virtual_account) {
                  setChurch(prev => prev ? { ...prev, mission_virtual_account: latest.mission_virtual_account } : prev);
                }
              }
            })
            .catch(err => console.warn('[ChurchManage] Realtime merge failed:', err));
        }
      }
      else setError('교회 데이터를 찾을 수 없습니다. 데이터 동기화 후 다시 시도해 주세요.');
    } catch (e) { setError('교회 정보를 불러올 수 없습니다: ' + e.message); }
    finally { setLoading(false); }
  }, [user]);

  // ── 기장지도 Supabase 데이터 로드 (타임아웃 5초, 실패 허용) ──
  const fetchMapData = useCallback(async (code) => {
    if (!code) return;
    setMapLoading(true);
    setMapError(false);
    try {
      // 5초 타임아웃 적용 — Supabase가 죽어있으면 빠르게 포기
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const data = await Promise.race([getChurchByChrCode(code), timeoutPromise]);
      setMapData(data); // null if not registered
    } catch (e) {
      console.warn('[ChurchManage] Supabase fetch failed (timeout or DNS):', e.message);
      setMapError(true);
    }
    finally { setMapLoading(false); }
  }, []);

  useEffect(() => { if (isLoggedIn) fetchChurch(); }, [isLoggedIn, fetchChurch]);
  useEffect(() => { if (chrCode) fetchMapData(chrCode); }, [chrCode, fetchMapData]);

  useEffect(() => {
    const handleResetView = () => {
      setEditMap(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('reset-church-view', handleResetView);
    return () => window.removeEventListener('reset-church-view', handleResetView);
  }, []);

  // ── 기장지도 일괄 저장 ──
  const saveMapData = async (fieldsObj) => {
    if (!chrCode) return;
    setSaving(true);
    try {
      let result;
      if (mapData) {
        result = await updateChurchByChrCode(chrCode, fieldsObj);
      } else {
        // 기장지도에 아직 없으면 신규 등록
        result = await insertChurch({
          chr_code: chrCode,
          name: getChurchDisplayName(),
          ...fieldsObj,
        });
      }
      if (result) {
        setMapData(result);
        showToast('저장되었습니다');
      } else {
        showToast('저장 실패 — 다시 시도해 주세요');
      }
    } catch (e) { showToast('저장 오류: ' + e.message); }
    finally { setSaving(false); setEditMap(false); }
  };

  if (!isLoggedIn) return <SimpleLogin />;

  // ── Style tokens ──
  const S = {
    card: 'bg-white rounded-2xl shadow-[0_4px_24px_rgba(10,37,64,0.06)] border border-slate-100 overflow-hidden',
    title: "font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2 mb-4",
    label: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider',
    value: 'text-[14px] font-semibold text-slate-800 mt-0.5',
    row: 'flex justify-between items-start py-3 border-b border-slate-50 last:border-b-0',
  };

  const DataRow = ({ icon, label, value, highlight = false }) => {
    if (!value || (typeof value === 'string' && !value.trim())) return null;
    return (
      <div className={S.row}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-[16px] text-blue-400 flex-shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className={S.label}>{label}</p>
            <p className={`${S.value} ${highlight ? 'text-blue-600' : ''} break-all`}>{value}</p>
          </div>
        </div>
      </div>
    );
  };

  /* 편집 가능 행 */
  const EditableRow = ({ icon, label, value, fieldKey, multiline = false, color = 'text-blue-400' }) => (
    <div className={S.row + ' cursor-pointer group'} onClick={() => setEditField({ key: fieldKey, title: label, multiline, currentValue: value || '' })}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`material-symbols-outlined text-[16px] ${color} flex-shrink-0`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className={S.label}>{label}</p>
          {value ? (
            <p className={S.value + ' break-all whitespace-pre-wrap'}>{value}</p>
          ) : (
            <p className="text-[13px] text-slate-300 italic mt-0.5">미입력 — 탭하여 입력</p>
          )}
        </div>
      </div>
      <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-blue-500 transition-colors self-center ml-2">edit</span>
    </div>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans','Pretendard']">
      <MobileHeader title="교회" />
      <main className="pt-24 px-5 max-w-2xl mx-auto space-y-5">

        {/* ── Header Card ── */}
        <div className="rounded-[2rem] text-white shadow-[0_20px_40px_rgba(10,37,64,0.15)] relative overflow-hidden">
          {mapData?.main_photo_url ? (
            <img src={mapData.main_photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          <div className={`absolute inset-0 ${mapData?.main_photo_url ? 'bg-gradient-to-t from-black/80 via-black/40 to-black/20' : 'bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-500'}`}></div>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 p-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md mx-auto mb-3 flex items-center justify-center border border-white/30">
              <span className="material-symbols-outlined text-3xl">church</span>
            </div>
            <h2 className="text-2xl font-extrabold font-['Manrope','Pretendard'] mb-1 drop-shadow-lg">{getChurchDisplayName()}</h2>
            {(church?.NOHNAME || user?.presbytery) && (
              <p className="text-white/80 text-sm font-medium bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full inline-block mt-1">{(church?.NOHNAME || user?.presbytery || '').trim()}</p>
            )}
            {church?.MOCKNAME && <p className="text-white/60 text-[12px] mt-2">담임목사: {church.MOCKNAME.trim()}</p>}
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
        ) : church ? (
          <>
            <SyncDateLabel />

            {/* 최소 데이터 알림 */}
            {church._isMinimal && (
              <div className={S.card + ' p-4 bg-amber-50 border-amber-200'}>
                <div className="flex items-center gap-2 text-amber-700 text-sm">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <p className="font-medium">로그인 정보만 표시 중입니다. 데이터 동기화 후 상세 정보가 표시됩니다.</p>
                </div>
              </div>
            )}

            {/* ── 기장지도 정보 (요약 카드) ── */}
            <div className={S.card + ' p-5 relative overflow-hidden group'}>
              {/* Background gradient pattern */}
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-[18px]">map</span>
                  기장지도 교회정보
                  {mapLoading && <span className="material-symbols-outlined animate-spin text-[14px] text-slate-400 ml-1">progress_activity</span>}
                  {!mapData && !mapLoading && !mapError && <span className="text-[11px] text-orange-500 font-medium ml-2">(미등록)</span>}
                </h3>
                {!mapError && (
                  <button 
                    type="button"
                    onClick={() => setEditMap(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors active:scale-95 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                )}
              </div>

              {mapError ? (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <span className="material-symbols-outlined text-2xl text-slate-300 mb-2 block">cloud_off</span>
                  <p className="text-slate-500 text-sm">기장지도 서버에 연결할 수 없습니다.</p>
                  <p className="text-slate-400 text-xs mt-1">Supabase 프로젝트가 일시 중지된 상태일 수 있습니다.</p>
                  <button onClick={() => fetchMapData(chrCode)} className="mt-3 text-blue-600 text-sm font-semibold">다시 시도</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {mapData?.intro_text ? (
                    <div className="bg-indigo-50/40 rounded-xl p-3.5 border border-indigo-100/50">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">교회 소개</p>
                      <p className="text-[13px] text-slate-700 leading-relaxed break-all whitespace-pre-wrap">{mapData.intro_text}</p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-400 italic">등록된 교회 소개 인삿말이 없습니다.</p>
                  )}

                  {/* 핵심 정보 격자 레이아웃 */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* 홈페이지 */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-green-50 text-green-500 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px]">language</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">홈페이지</p>
                        {mapData?.homepage_url ? (
                          <a href={mapData.homepage_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-blue-600 truncate block hover:underline">
                            바로가기
                          </a>
                        ) : (
                          <span className="text-[12px] text-slate-400 italic">미등록</span>
                        )}
                      </div>
                    </div>

                    {/* 유튜브 채널 */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px]">subscriptions</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">유튜브 채널</p>
                        {mapData?.youtube_channel_id ? (
                          <a href={`https://youtube.com/channel/${mapData.youtube_channel_id}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-blue-600 truncate block hover:underline">
                            바로가기
                          </a>
                        ) : (
                          <span className="text-[12px] text-slate-400 italic">미등록</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 예배시간 요약 */}
                  {mapData?.worship_times?.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        주요 예배시간
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                        {mapData.worship_times.map((w, i) => (
                          <div key={i} className="flex justify-between items-center text-[12px] border-b border-dashed border-slate-100 last:border-b-0 pb-1 last:pb-0">
                            <span className="font-bold text-slate-700">{w.title || w.name}</span>
                            <span className="text-slate-500">{w.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 교통 및 주차 */}
                  {(mapData?.parking_info || mapData?.transport_info) && (
                    <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {mapData.parking_info && (
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-teal-500">local_parking</span>
                            주차 안내
                          </p>
                          <p className="text-[12px] text-slate-600 line-clamp-2 break-all">{mapData.parking_info}</p>
                        </div>
                      )}
                      {mapData.transport_info && (
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-teal-500">directions_bus</span>
                            대중교통
                          </p>
                          <p className="text-[12px] text-slate-600 line-clamp-2 break-all">{mapData.transport_info}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 유튜브 미리보기 */}
                  {mapData?.youtube_video_id && (
                    <div className="mt-3 rounded-xl overflow-hidden shadow-sm border border-slate-100">
                      <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${mapData.youtube_video_id}`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="교회 영상"></iframe>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 기본 정보 (TB_Chr100 — 읽기전용) ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}>
                <span className="material-symbols-outlined text-blue-500">info</span>
                총회 DB 기본정보
                <span className="text-[10px] text-slate-400 font-normal ml-auto">읽기전용</span>
              </h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="tag" label="교회코드" value={chrCode} />
                {church.mission_virtual_account && (
                  <DataRow 
                    icon="account_balance_wallet" 
                    label="선교주일 헌금 가상계좌" 
                    value={`신한은행 ${church.mission_virtual_account}`} 
                    highlight 
                  />
                )}
                <DataRow icon="church" label="교회명" value={(church.CHRNAME || '').trim()} highlight />
                <DataRow icon="groups" label="노회" value={(church.NOHNAME || '').trim()} />
                <DataRow icon="map" label="시찰" value={(church.SICHALNAME || '').trim()} />
                <DataRow icon="person" label="담임목사" value={(church.MOCKNAME || '').trim()} highlight />
                <DataRow icon="calendar_month" label="설립일" value={formatEstDate((church.EstDate || '').trim())} />
                <DataRow icon="landscape" label="환경" value={ENV_MAP[(church.Environment || '').trim()] || (church.Environment || '').trim()} />
                <DataRow icon="verified" label="조직유무" value={(church.OrgYN || '').trim() === '1' ? '조직교회' : (church.OrgYN || '').trim() === '0' ? '미조직' : ''} />
              </div>
            </div>

            {/* ── 연락처 ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}><span className="material-symbols-outlined text-green-500">call</span>연락처</h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="phone" label="교회 전화" value={(church.Tel_Church || '').trim()} />
                <DataRow icon="phone_android" label="핸드폰" value={(church.Tel_Mobile || '').trim()} />
                <DataRow icon="phone_in_talk" label="자택 전화" value={(church.Tel_Home || '').trim()} />
                <DataRow icon="fax" label="팩스" value={(church.Tel_Fax || '').trim()} />
                <DataRow icon="mail" label="이메일" value={(church.Email || '').trim()} />
                <DataRow icon="language" label="홈페이지" value={(church.HomePage || '').trim()} />
              </div>
            </div>

            {/* ── 주소 ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}><span className="material-symbols-outlined text-orange-500">location_on</span>주소 정보</h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="markunread_mailbox" label="우편번호" value={(church.PostNo || '').trim()} />
                <DataRow icon="home" label="주소 (구주소)" value={(church.ADDRESS || '').trim()} />
                <DataRow icon="edit_location" label="주소 (도로명)" value={(church.JUSO || '').trim()} />
              </div>
            </div>

            {/* 비고/메모 — 민감 정보 포함으로 비노출 처리 */}
          </>
        ) : null}
      </main>

      {/* ── Gijang Map Edit Modal ── */}
      {editMap && (
        <GijangMapEditModal
          mapData={mapData}
          churchName={getChurchDisplayName()}
          onClose={() => setEditMap(false)}
          onSave={saveMapData}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-800 text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl animate-fade-in">{toast}</div>
      )}
      {saving && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin text-blue-500">progress_activity</span>
            <span className="text-sm font-semibold text-slate-700">저장 중...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChurchManagePage;
