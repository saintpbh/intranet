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
  const [theme, setTheme] = useState(mapData?.theme || '');
  const [logoSymbol, setLogoSymbol] = useState(mapData?.logo_symbol || 'PLUS');

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
      theme: theme,
      logo_symbol: logoSymbol,
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

          {/* 성도앱 연동 설정 (표어 / 로고 심볼) */}
          <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/70">
            <h4 className="text-[12px] font-extrabold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-indigo-100/50 pb-2">
              <span className="material-symbols-outlined text-[16px] text-indigo-500">smartphone</span>
              기장성도앱 연동 설정
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 교회 표어 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-indigo-500">stars</span>
                  교회 표어
                </label>
                <input 
                  type="text"
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  placeholder="예: 생명, 평화, 정의를 심고 일구는 공동체"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>

              {/* 로고 심볼 유형 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-indigo-500">featured_seasonal_and_gifts</span>
                  교회 로고 심볼
                </label>
                <select 
                  value={logoSymbol} 
                  onChange={e => setLogoSymbol(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium bg-white"
                >
                  <option value="PLUS">기본 원형 십자가 (PLUS)</option>
                  <option value="SEABAT">새밭 마크 (SEABAT)</option>
                  <option value="CROSS">정방 십자가 (CROSS)</option>
                  <option value="HEART">사랑 하트 (HEART)</option>
                </select>
              </div>

              {/* 로고 직접 업로드 */}
              <div className="space-y-2 sm:col-span-2 border-t border-slate-100 pt-3 mt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <span className="material-symbols-outlined text-[16px] text-indigo-400">cloud_upload</span>
                  교회 공식 로고 이미지 직접 업로드 (불러오기)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input 
                    type="file"
                    accept="image/*"
                    id="church-logo-file-input"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      try {
                        const targetCode = mapData?.chr_code || chrCode || user?.chrCode || '';
                        if (!targetCode) {
                          alert('교회 코드가 확인되지 않아 로고를 업로드할 수 없습니다.');
                          return;
                        }
                        const res = await fetch(`${API_BASE}/api/churches/${targetCode}/logo`, {
                          method: 'POST',
                          body: formData
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.success) {
                            setLogoSymbol(data.logo_url);
                            alert('로고 이미지가 성공적으로 업로드되었습니다!');
                          } else {
                            alert('업로드 실패: ' + data.error);
                          }
                        } else {
                          alert('서버 응답 오류로 업로드에 실패했습니다.');
                        }
                      } catch (err) {
                        alert('네트워크 오류로 업로드하지 못했습니다: ' + err.message);
                      }
                    }}
                  />
                  <label 
                    htmlFor="church-logo-file-input"
                    className="cursor-pointer bg-gradient-to-r from-indigo-50 to-indigo-100/50 text-indigo-600 hover:from-indigo-100 hover:to-indigo-150 transition-colors px-4 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 active:scale-95 shadow-sm border border-indigo-200/30"
                  >
                    <span className="material-symbols-outlined text-[18px]">image</span>
                    로고 파일 불러오기
                  </label>
                  
                  {logoSymbol && logoSymbol.startsWith('/api/uploads/') ? (
                    <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 shadow-inner">
                      <img src={`${API_BASE}${logoSymbol}`} alt="로고 프리뷰" className="w-6 h-6 rounded-md object-cover border border-indigo-200/50" />
                      <span className="text-[11px] text-indigo-600 font-extrabold">업로드 완료</span>
                      <button 
                        type="button"
                        onClick={() => setLogoSymbol('PLUS')}
                        className="text-red-500 hover:text-red-700 font-bold text-[10px] ml-1.5 active:scale-95 flex items-center"
                      >
                        <span className="material-symbols-outlined text-[13px]">delete</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">기본 로고 사용 중 (사진 파일이 업로드되지 않음)</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              ※ 입력하신 표어와 로고는 성도가 사용하는 기장성도앱 모바일 홈 상단 배너에 실시간 연동되어 표출됩니다. (현재 로고 마크는 성도앱 요청에 의해 화면에서 제거되어 표어만 노출됩니다.)
            </p>
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

/* ── 총회 DB 기본정보 변경 요청 모달 (SlideOver 스타일) ── */
const ChurchInfoEditRequestModal = ({ church, user, onSave, onClose }) => {
  const [selectedFields, setSelectedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({
    CHRNAME: church?.CHRNAME || '',
    NOHNAME: church?.NOHNAME || '',
    SICHALNAME: church?.SICHALNAME || '',
    MOCKNAME: church?.MOCKNAME || '',
    EstDate: church?.EstDate || '',
    Environment: church?.Environment || '',
    OrgYN: church?.OrgYN || ''
  });
  const [reason, setReason] = useState('');

  const toggleField = (field) => {
    setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleValueChange = (field, val) => {
    setFieldValues(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = () => {
    const changes = Object.keys(selectedFields)
      .filter(k => selectedFields[k])
      .map(k => {
        let oldVal = church?.[k] || '';
        let newVal = fieldValues[k];
        return {
          field: k,
          old_value: String(oldVal).trim(),
          new_value: String(newVal).trim()
        };
      });

    if (changes.length === 0) {
      alert('변경을 신청할 항목을 하나 이상 선택하고 새로운 값을 입력해주세요.');
      return;
    }

    if (!reason.trim()) {
      alert('변경 사유를 입력해주세요.');
      return;
    }

    onSave({
      changes,
      reason
    });
  };

  const fieldMeta = [
    { key: 'CHRNAME', label: '교회명', icon: 'church', type: 'text' },
    { key: 'NOHNAME', label: '노회', icon: 'groups', type: 'text' },
    { key: 'SICHALNAME', label: '시찰', icon: 'map', type: 'text' },
    { key: 'MOCKNAME', label: '담임목사', icon: 'person', type: 'text' },
    { key: 'EstDate', label: '설립일', icon: 'calendar_month', type: 'date-text' },
    { key: 'Environment', label: '환경', icon: 'landscape', type: 'environment' },
    { key: 'OrgYN', label: '조직유무', icon: 'verified', type: 'org' }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-20px_50px_rgba(10,37,64,0.15)] flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-transparent rounded-t-[2.5rem]">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-800 font-['Manrope','Pretendard']">총회 DB 변경 요청</h3>
            <p className="text-[11px] text-blue-500 font-semibold mt-0.5">{church?.CHRNAME || ''} — 행정 정보 신청</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-[12px] text-blue-700 leading-relaxed">
            <p className="font-bold flex items-center gap-1.5 mb-1 text-[13px]">
              <span className="material-symbols-outlined text-[16px]">info</span>
              신청 안내 및 주의사항
            </p>
            총회 DB 기본정보는 행정 심사(제출 → 노회 서기 확인 → 총회 수정 완료)를 통해 공식 반영되는 중요 데이터입니다. 변경할 항목을 체크한 후 올바른 정보를 입력해 주세요.
          </div>

          {/* Fields list */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-400">playlist_add_check</span>
              변경할 항목 선택 및 입력
            </label>

            <div className="space-y-3">
              {fieldMeta.map(f => {
                const isSelected = selectedFields[f.key];
                return (
                  <div key={f.key} className={`border rounded-2xl p-4 transition-all ${isSelected ? 'border-blue-400 bg-blue-50/10 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleField(f.key)}
                        className="flex items-center gap-2.5 text-left min-w-0"
                      >
                        <span className={`material-symbols-outlined text-[20px] transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-300'}`}>
                          {isSelected ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-slate-400 flex-shrink-0">{f.icon}</span>
                        <span className="text-[13px] font-bold text-slate-700">{f.label}</span>
                      </button>
                      <span className="text-[11px] text-slate-400">
                        현재: {
                          f.key === 'Environment'
                            ? (ENV_MAP[String(church?.[f.key] || '').trim()] || String(church?.[f.key] || '').trim() || '미지정')
                            : f.key === 'OrgYN'
                            ? (String(church?.[f.key] || '').trim() === '1' ? '조직교회' : String(church?.[f.key] || '').trim() === '0' ? '미조직' : '미지정')
                            : f.key === 'EstDate'
                            ? (formatEstDate(String(church?.[f.key] || '').trim()) || '미지정')
                            : (String(church?.[f.key] || '').trim() || '미지정')
                        }
                      </span>
                    </div>

                    {isSelected && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 animate-fade-in">
                        <label className="text-[10px] font-bold text-blue-500 block mb-1.5">새로운 {f.label} 입력</label>
                        {f.type === 'text' && (
                          <input
                            type="text"
                            value={fieldValues[f.key]}
                            onChange={e => handleValueChange(f.key, e.target.value)}
                            placeholder={`새로운 ${f.label}을 입력해 주세요.`}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-slate-700 font-medium"
                          />
                        )}
                        {f.type === 'date-text' && (
                          <input
                            type="text"
                            value={fieldValues[f.key]}
                            onChange={e => handleValueChange(f.key, e.target.value)}
                            placeholder="예시: 19451202 (8자리 숫자)"
                            maxLength={8}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-slate-700 font-mono"
                          />
                        )}
                        {f.type === 'environment' && (
                          <select
                            value={fieldValues[f.key]}
                            onChange={e => handleValueChange(f.key, e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-slate-700 font-medium bg-white"
                          >
                            <option value="">선택해 주세요</option>
                            <option value="1">도시</option>
                            <option value="2">읍</option>
                            <option value="3">면</option>
                            <option value="4">농어촌</option>
                          </select>
                        )}
                        {f.type === 'org' && (
                          <select
                            value={fieldValues[f.key]}
                            onChange={e => handleValueChange(f.key, e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-slate-700 font-medium bg-white"
                          >
                            <option value="">선택해 주세요</option>
                            <option value="1">조직교회</option>
                            <option value="0">미조직</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 변경 사유 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-400">edit_note</span>
              변경 사유 (필수)
            </label>
            <textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              placeholder="정보를 변경해야 하는 자세한 사유를 적어주세요. 노회 및 총회 행정 담당자 심사에 필요합니다."
              className="w-full border border-slate-200 rounded-2xl p-4 text-[13px] min-h-[100px] max-h-[200px] focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all resize-y text-slate-700 leading-relaxed"
            />
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
            onClick={handleSubmit} 
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            변경 신청 제출하기
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── 디지털 주보 관리 및 편집 모달 (SlideOver 스타일) ── */
const ChurchBulletinEditModal = ({ bulletin, onSave, onClose, churchName }) => {
  const [date, setDate] = useState(bulletin?.date || '');
  const [serviceType, setServiceType] = useState(bulletin?.serviceType || '주일대예배');
  const [bulletinTitle, setBulletinTitle] = useState(bulletin?.bulletinTitle || '');
  const [theme, setTheme] = useState(bulletin?.theme || '');
  const [bibleVerse, setBibleVerse] = useState(bulletin?.bibleVerse || '');
  const [bibleVerseRef, setBibleVerseRef] = useState(bulletin?.bibleVerseRef || '');
  
  const [orders, setOrders] = useState(
    (bulletin?.orders || []).map((o, idx) => ({
      id: o.id || `order-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      sequence: o.sequence || idx + 1,
      title: o.title || '',
      type: o.type || 'TEXT',
      detail: o.detail || '',
      targetKey: o.targetKey || ''
    }))
  );
  
  const [churchNews, setChurchNews] = useState(bulletin?.churchNews?.length ? bulletin.churchNews : ['']);

  const addOrder = () => {
    setOrders([
      ...orders,
      {
        id: `order-${Date.now()}-${orders.length}-${Math.random().toString(36).substr(2, 4)}`,
        sequence: orders.length + 1,
        title: '',
        type: 'TEXT',
        detail: '',
        targetKey: ''
      }
    ]);
  };
  const removeOrder = (id) => {
    const filtered = orders.filter(o => o.id !== id);
    const reordered = filtered.map((o, idx) => ({ ...o, sequence: idx + 1 }));
    setOrders(reordered);
  };
  const updateOrder = (id, field, value) => {
    setOrders(orders.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const addNews = () => setChurchNews([...churchNews, '']);
  const removeNews = (idx) => setChurchNews(churchNews.filter((_, i) => i !== idx));
  const updateNews = (idx, value) => {
    const newNews = [...churchNews];
    newNews[idx] = value;
    setChurchNews(newNews);
  };

  const handleSave = () => {
    const filteredOrders = orders.filter(o => o.title.trim());
    const filteredNews = churchNews.filter(n => n.trim());

    onSave({
      date,
      serviceType,
      bulletinTitle,
      theme,
      bibleVerse,
      bibleVerseRef,
      orders: filteredOrders.map((o, idx) => ({ ...o, sequence: idx + 1 })),
      churchNews: filteredNews
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-20px_50px_rgba(10,37,64,0.15)] flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-transparent rounded-t-[2.5rem]">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-800 font-['Manrope','Pretendard']">디지털 주보(예배) 관리 및 편집</h3>
            <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">{churchName} — 기장성도앱 연동</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-[12px] text-indigo-700 leading-relaxed">
            <p className="font-bold flex items-center gap-1.5 mb-1 text-[13px]">
              <span className="material-symbols-outlined text-[16px] text-indigo-500">cell_tower</span>
              성도앱 실시간 연동 안내
            </p>
            여기에서 주보 내용을 작성하고 [저장하기]를 누르면, 지교회 성도분들이 설치한 **기장성도앱의 디지털 주보 탭**에 내용이 실시간으로 동기화되어 배포됩니다.
          </div>

          {/* 주보 기본 정보 */}
          <div className="space-y-4">
            <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-indigo-400">text_snippet</span>
              주보 기본 정보
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">주보 제목</label>
                <input 
                  type="text" 
                  value={bulletinTitle} 
                  onChange={e => setBulletinTitle(e.target.value)}
                  placeholder="예: 성령강림주일 예배 주보" 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">예배 일자</label>
                <input 
                  type="text" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  placeholder="예: 2026년 5월 31일" 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">예배 구분</label>
                <input 
                  type="text" 
                  value={serviceType} 
                  onChange={e => setServiceType(e.target.value)}
                  placeholder="예: 주일대예배, 주일오후예배" 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">금주의 표어</label>
                <input 
                  type="text" 
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  placeholder="예: 생명, 평화, 정의를 심고 일구는 공동체" 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-500">금주의 요절 말씀 (본문)</label>
                <input 
                  type="text" 
                  value={bibleVerse} 
                  onChange={e => setBibleVerse(e.target.value)}
                  placeholder="예: 오직 정의를 물 같이, 공의를 마르지 않는 강 같이..." 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">요절 장절 정보</label>
                <input 
                  type="text" 
                  value={bibleVerseRef} 
                  onChange={e => setBibleVerseRef(e.target.value)}
                  placeholder="예: 아모스 5:24" 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                />
              </div>
            </div>
          </div>

          {/* 예배 순서 상세 설정 */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-indigo-400">format_list_numbered</span>
                예배 순서 배열
              </span>
              <span className="text-[10px] font-normal text-slate-400">순서명 입력 시 성도앱에 노출됩니다</span>
            </h4>
            
            <div className="space-y-3.5">
              {orders.map((o, idx) => (
                <div key={o.id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 space-y-3 relative group/row animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                      {idx + 1}
                    </span>
                    <input 
                      placeholder="순서명 (예: 개회선언, 신앙고백, 찬양)" 
                      value={o.title}
                      onChange={e => updateOrder(o.id, 'title', e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                    />
                    <select 
                      value={o.type} 
                      onChange={e => updateOrder(o.id, 'type', e.target.value)}
                      className="w-24 bg-white border border-slate-200 rounded-xl px-2 py-2 text-[12px] font-semibold text-slate-600 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                    >
                      <option value="TEXT">일반 텍스트</option>
                      <option value="HYMN">찬송가</option>
                      <option value="BIBLE">성경본문</option>
                      <option value="LITURGY">교독문/기도문</option>
                      <option value="PRAYER">대표기도</option>
                      <option value="SERMON">말씀선포</option>
                    </select>
                    <button 
                      onClick={() => removeOrder(o.id)} 
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center flex-shrink-0 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <input 
                      placeholder="상세 내용 (예: 다같이, 인도자, 맡은이 이름 등)" 
                      value={o.detail}
                      onChange={e => updateOrder(o.id, 'detail', e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-600"
                    />
                    <input 
                      placeholder="참조 키 (예: 찬송가 3장, 교독문 12번 등)" 
                      value={o.targetKey}
                      onChange={e => updateOrder(o.id, 'targetKey', e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-600"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button 
              type="button"
              onClick={addOrder} 
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-100 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all font-bold text-[13px] flex items-center justify-center gap-1 active:scale-98"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              예배 순서 추가하기
            </button>
          </div>

          {/* 교회 소식 설정 */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-indigo-400">notifications</span>
              교회 소식 / 알림판
            </h4>
            
            <div className="space-y-2">
              {churchNews.map((news, idx) => (
                <div key={idx} className="flex gap-2 items-center animate-fade-in">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input 
                    placeholder="소식 내용을 한 줄씩 입력해 주세요 (예: 다음주 대표기도는 홍길동 장로입니다)" 
                    value={news}
                    onChange={e => updateNews(idx, e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-[13px] focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none text-slate-700 font-medium"
                  />
                  <button 
                    onClick={() => removeNews(idx)} 
                    className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center flex-shrink-0 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              type="button"
              onClick={addNews} 
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-100 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all font-bold text-[13px] flex items-center justify-center gap-1 active:scale-98"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              소식 입력란 추가하기
            </button>
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
            저장 및 실시간 배포하기
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
  const [showInfoEdit, setShowInfoEdit] = useState(false);
  const [bulletinData, setBulletinData] = useState(null);
  const [showBulletinEdit, setShowBulletinEdit] = useState(false);
  const [toast, setToast] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedFallback, setCopiedFallback] = useState(false);

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
                if (latest) {
                  setChurch(prev => prev ? { 
                    ...prev, 
                    mission_virtual_account: latest.mission_virtual_account || prev.mission_virtual_account || '',
                    virtual_accounts: latest.virtual_accounts || prev.virtual_accounts || []
                  } : prev);
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

  const fetchBulletinData = useCallback(async (code) => {
    if (!code) return;
    try {
      const res = await fetch(`${API_BASE}/api/churches/${code}/bulletin`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.updated_at) {
          setBulletinData(data);
        } else {
          setBulletinData(null);
        }
      }
    } catch (e) {
      console.warn('[ChurchManage] Bulletin fetch failed:', e.message);
    }
  }, []);

  useEffect(() => { if (isLoggedIn) fetchChurch(); }, [isLoggedIn, fetchChurch]);
  useEffect(() => { 
    if (chrCode) {
      fetchMapData(chrCode); 
      fetchBulletinData(chrCode);
    }
  }, [chrCode, fetchMapData, fetchBulletinData]);

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

  // ── 총회 DB 기본정보 변경 요청 제출 ──
  const handleSubmitInfoEditRequest = async ({ changes, reason }) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/info-edit-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minister_code: user?.code || '',
          minister_name: user?.name || '',
          noh_code: user?.noh_code || '',
          noh_name: user?.presbytery || '',
          changes,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('총회 DB 변경 요청이 제출되었습니다.\n노회 서기 확인 및 총회 승인 단계를 거쳐 공식 반영됩니다.');
        setShowInfoEdit(false);
      } else {
        alert('요청 제출 중 오류가 발생했습니다.');
      }
    } catch (e) {
      alert('서버 요청 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── 디지털 주보 데이터 저장 ──
  const saveBulletinData = async (bulletinPayload) => {
    if (!chrCode) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/churches/${chrCode}/bulletin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulletinPayload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          showToast('디지털 주보가 실시간 배포되었습니다.');
          fetchBulletinData(chrCode);
        } else {
          showToast('주보 저장 실패');
        }
      } else {
        showToast('서버 통신 실패');
      }
    } catch (e) {
      showToast('주보 저장 오류: ' + e.message);
    } finally {
      setSaving(false);
      setShowBulletinEdit(false);
    }
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

            {/* ── 가상계좌 관리 카드 ── */}
            <div className={S.card + ' p-5 relative overflow-hidden group'}>
              {/* Premium abstract background pattern */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/5 -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
              <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-indigo-500/5 pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                  총회 가상계좌 정보
                  <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-full ml-1">실시간</span>
                </h3>
              </div>

              {church.virtual_accounts && church.virtual_accounts.length > 0 ? (
                <div className="space-y-3">
                  {church.virtual_accounts.map((va, i) => (
                    <div key={i} className="bg-gradient-to-r from-blue-50/60 to-indigo-50/30 rounded-2xl p-4 border border-blue-100/50 flex items-center justify-between gap-3 shadow-sm active:scale-[0.99] transition-transform">
                      <div className="min-w-0 flex-1">
                        <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-700 text-[9px] font-extrabold uppercase tracking-wide mb-1 inline-block">
                          {va.account_type || '가상계좌'}
                        </span>
                        <h4 className="font-bold text-[14px] text-slate-800 font-mono tracking-wide mt-0.5">
                          신한은행 <span className="text-blue-600">{va.virtual_account}</span>
                        </h4>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(va.virtual_account);
                          showToast(`${va.account_type || '가상계좌'} 번호가 복사되었습니다.`);
                          setCopiedIndex(i);
                          setTimeout(() => setCopiedIndex(null), 2000);
                        }}
                        className={`px-3.5 py-1.5 rounded-full font-bold text-[11px] active:scale-95 transition-all shadow-sm flex items-center gap-1 flex-shrink-0 ${
                          copiedIndex === i 
                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-100' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {copiedIndex === i ? 'check_circle' : 'content_copy'}
                        </span>
                        {copiedIndex === i ? '복사 완료' : '복사'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : church.mission_virtual_account ? (
                // Fallback for single virtual account if virtual_accounts list hasn't loaded yet
                <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/30 rounded-2xl p-4 border border-blue-100/50 flex items-center justify-between gap-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-700 text-[9px] font-extrabold uppercase tracking-wide mb-1 inline-block">
                      선교주일헌금
                    </span>
                    <h4 className="font-bold text-[14px] text-slate-800 font-mono tracking-wide mt-0.5">
                      신한은행 <span className="text-blue-600">{church.mission_virtual_account}</span>
                    </h4>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(church.mission_virtual_account);
                      showToast('선교주일헌금 계좌번호가 복사되었습니다.');
                      setCopiedFallback(true);
                      setTimeout(() => setCopiedFallback(false), 2000);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-bold text-[11px] active:scale-95 transition-all shadow-sm flex items-center gap-1 flex-shrink-0 ${
                      copiedFallback 
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-100' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {copiedFallback ? 'check_circle' : 'content_copy'}
                    </span>
                    {copiedFallback ? '복사 완료' : '복사'}
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block" style={{ fontVariationSettings: "'FILL' 0" }}>account_balance</span>
                  <p className="text-slate-500 text-[13px] font-semibold leading-relaxed">등록된 총회 가상계좌가 없습니다.</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">가상계좌가 발급되면 여기에 실시간으로 표시됩니다.</p>
                </div>
              )}
            </div>

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
                  {/* 성도앱 연동 정보 요약 */}
                  {(mapData?.theme || mapData?.logo_symbol) && (
                    <div className="bg-gradient-to-r from-indigo-50/50 to-slate-50 rounded-xl p-3.5 border border-indigo-100/30 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">smartphone</span>
                          기장성도앱 실시간 연동
                        </p>
                        {mapData.theme && (
                          <p className="text-[13px] font-extrabold text-slate-700 leading-snug">✨ 표어: {mapData.theme}</p>
                        )}
                        {mapData.logo_symbol && (
                          <p className="text-[11px] text-slate-400 font-semibold mt-1">심볼 마크: <span className="text-indigo-600 font-bold bg-indigo-50/80 px-2 py-0.5 rounded-md">{mapData.logo_symbol}</span></p>
                        )}
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                      </div>
                    </div>
                  )}

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

            {/* ── 기장성도앱 디지털 주보 관리 ── */}
            <div className={S.card + ' p-5 relative overflow-hidden group'}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-[18px]">menu_book</span>
                  디지털 주보(예배) 관리
                  <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full ml-1">성도앱 연동</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowBulletinEdit(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors active:scale-95 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
              </div>

              {bulletinData ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">최근 등록된 주보</p>
                      <p className="text-[13px] font-bold text-slate-700 mt-0.5">
                        {bulletinData.bulletinTitle || "주보 제목 미입력"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {bulletinData.date || "일자 미입력"} | {bulletinData.serviceType || "주일대예배"}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                      실시간 배포중
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                      <strong>예배 순서:</strong> {bulletinData.orders?.length || 0}개 등록됨
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                      <strong>교회 소식:</strong> {bulletinData.churchNews?.length || 0}개 등록됨
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-center cursor-pointer" onClick={() => setShowBulletinEdit(true)}>
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block" style={{ fontVariationSettings: "'FILL' 0" }}>article</span>
                  <p className="text-slate-500 text-[13px] font-semibold">등록된 디지털 주보가 없습니다.</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">여기를 클릭하여 주보를 새로 작성하고 성도앱에 실시간으로 배포해 보세요.</p>
                </div>
              )}
            </div>

            {/* ── 기본 정보 (TB_Chr100 — 간략히 표시) ── */}
            <div 
              onClick={() => setShowInfoEdit(true)}
              className={S.card + ' p-5 cursor-pointer hover:border-blue-200 hover:bg-blue-50/5 transition-all duration-300 flex items-center justify-between group active:scale-[0.99]'}
              title="상세 정보 확인 및 변경 요청"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-blue-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                <span className="font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800">
                  총회 DB 기본정보
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors active:scale-95">
                <span className="material-symbols-outlined text-[18px]">edit</span>
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

      {/* ── 총회 DB 변경 요청 모달 ── */}
      {showInfoEdit && (
        <ChurchInfoEditRequestModal
          church={church}
          user={user}
          onClose={() => setShowInfoEdit(false)}
          onSave={handleSubmitInfoEditRequest}
        />
      )}

      {/* ── 디지털 주보 관리 모달 ── */}
      {showBulletinEdit && (
        <ChurchBulletinEditModal
          bulletin={bulletinData}
          churchName={getChurchDisplayName()}
          onClose={() => setShowBulletinEdit(false)}
          onSave={saveBulletinData}
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
