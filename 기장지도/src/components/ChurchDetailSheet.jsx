import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Phone, MessageSquare, Home, Video, ChevronRight, Navigation, Edit3, Image as ImageIcon, Link as LinkIcon, Clock, Plus, Trash2, Save, Star, Eye, Share2, Check } from 'lucide-react';
import CommunicationBoard from './CommunicationBoard';
import { supabase } from '../supabaseClient';
import { isFavorite, toggleFavorite } from '../utils/favorites';

// Hope Light Theme color tokens
// Hope Light Theme color tokens
const W = {
  glass: 'rgba(255, 255, 255, 0.15)', // 지도가 훨씬 잘 보이도록 투명도 극대화, 블러 감소
  glassBorder: 'rgba(255, 255, 255, 0.6)',
  cardBg: '#ffffff', // 불투명 (깨끗한 흰색)
  cardBorder: 'rgba(0, 0, 0, 0.06)', // 카드가 입체적으로 보이게 약간의 테두리 강조
  text: '#1e293b', // 시안성 좋은 진한 텍스트
  textSub: '#475569',
  textMuted: '#94a3b8',
  accent: '#2563eb', // 밝은 파란색
  accentLight: 'rgba(37, 99, 235, 0.08)',
  accentBorder: 'rgba(37, 99, 235, 0.15)',
  green: '#10b981',
  cyan: '#0ea5e9',
  purple: '#8b5cf6',
  shadow: '0 24px 64px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.6) inset', // 그림자 조금 더 살려서 창 구분
  inputBg: '#f8fafc',
  inputBorder: '#e2e8f0',
};

export default function ChurchDetailSheet({ church: initialChurch, onClose, onOpenDirections, userLocation, onFavoritesChange, onTitleClick }) {
  const [activeTab, setActiveTab] = useState('home');
  const [church, setChurch] = useState(initialChurch);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isFav, setIsFav] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showPanorama, setShowPanorama] = useState(false);
  const [panoramaStatus, setPanoramaStatus] = useState('loading'); // 'loading' | 'ready' | 'unavailable'
  const panoramaContainerRef = useRef(null);
  const panoramaInstanceRef = useRef(null);
  
  const [editForm, setEditForm] = useState({
    youtube_video_id: '',
    main_photo_url: '',
    homepage_url: '',
    worship_times: []
  });

  useEffect(() => {
    if (initialChurch) {
      setChurch(initialChurch);
      setIsFav(isFavorite(initialChurch.id));
      setEditForm({
        youtube_video_id: initialChurch.youtube_video_id || '',
        main_photo_url: initialChurch.main_photo_url || '',
        homepage_url: initialChurch.homepage_url || '',
        worship_times: Array.isArray(initialChurch.worship_times) ? initialChurch.worship_times : []
      });
    }
  }, [initialChurch]);

  // Panorama 초기화 — DOM 준비 후 실행 보장
  const panoramaResolvedRef = useRef(false);

  useEffect(() => {
    if (!showPanorama || !church) return;
    setPanoramaStatus('loading');
    panoramaResolvedRef.current = false;

    let cancelled = false;
    let timeoutId = null;
    let rafId = null;

    const markReady = () => {
      if (cancelled || panoramaResolvedRef.current) return;
      panoramaResolvedRef.current = true;
      setPanoramaStatus('ready');
    };

    const markUnavailable = () => {
      if (cancelled || panoramaResolvedRef.current) return;
      panoramaResolvedRef.current = true;
      setPanoramaStatus('unavailable');
    };

    // requestAnimationFrame으로 DOM paint 완료를 보장한 후 초기화
    rafId = requestAnimationFrame(() => {
      if (cancelled) return;

      // 서브모듈 로드 대기 + container 유효성 확인
      const tryInit = (attempts = 0) => {
        if (cancelled) return;
        
        const container = panoramaContainerRef.current;
        const apiReady = window.naver?.maps?.Panorama;
        
        if (!apiReady || !container) {
          if (attempts < 30) {
            timeoutId = setTimeout(() => tryInit(attempts + 1), 200);
          } else {
            markUnavailable();
          }
          return;
        }

        // container 크기 확인 — 0이면 아직 레이아웃 안 됨
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          if (attempts < 30) {
            timeoutId = setTimeout(() => tryInit(attempts + 1), 200);
          } else {
            markUnavailable();
          }
          return;
        }

        const lat = parseFloat(church.lat);
        const lng = parseFloat(church.lng);
        if (isNaN(lat) || isNaN(lng)) {
          markUnavailable();
          return;
        }

        try {
          const pano = new naver.maps.Panorama(container, {
            position: new naver.maps.LatLng(lat, lng),
            pov: { pan: 0, tilt: 0, fov: 100 },
            flightSpot: true,
            aroundControl: true,
            zoomControl: true,
          });
          panoramaInstanceRef.current = pano;

          // 이벤트 기반 상태 감지
          naver.maps.Event.addListener(pano, 'init', () => markReady());
          naver.maps.Event.addListener(pano, 'pano_changed', () => markReady());

          // fallback: 8초 후 DOM 콘텐츠로 최종 판정
          timeoutId = setTimeout(() => {
            if (cancelled || panoramaResolvedRef.current) return;
            try {
              const panoId = pano.getPanoId?.();
              const hasContent = container.querySelector('canvas, img');
              if (panoId || hasContent) {
                markReady();
              } else {
                markUnavailable();
              }
            } catch {
              markUnavailable();
            }
          }, 8000);
        } catch {
          markUnavailable();
        }
      };

      tryInit(0);
    });

    return () => {
      cancelled = true;
      panoramaResolvedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      if (panoramaInstanceRef.current) {
        try { panoramaInstanceRef.current.destroy(); } catch {}
        panoramaInstanceRef.current = null;
      }
    };
  }, [showPanorama, church?.id]);

  const handleOpenPanorama = useCallback(() => {
    setShowPanorama(true);
  }, []);

  const handleClosePanorama = useCallback(() => {
    setShowPanorama(false);
    setPanoramaStatus('loading');
    if (panoramaInstanceRef.current) {
      try { panoramaInstanceRef.current.destroy(); } catch {}
      panoramaInstanceRef.current = null;
    }
  }, []);

  if (!church) return null;

  const handleToggleFavorite = () => {
    const result = toggleFavorite(church);
    setIsFav(result.added);
    if (result.added) {
      alert('관심교회로 등록되었습니다.\n(안내: 현재 브라우저에만 저장되며, 다른 컴퓨터/기기에서는 표시되지 않습니다.)');
    }
    if (onFavoritesChange) {
      onFavoritesChange();
    }
  };

  const handleDirections = () => {
    if (onOpenDirections) {
      onOpenDirections(church);
    }
  };

  const handleEditClick = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      setShowPasswordPrompt(true);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === '0000' || passwordInput === '1234') { // 기본 비밀번호 처리
      setIsEditing(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleCall = () => {
    if (church.phone) {
      window.location.href = `tel:${church.phone}`;
    } else {
      alert("등록된 전화번호가 없습니다.");
    }
  };

  const handleShareSuccess = () => {
    setShowCopyToast(true);
    setTimeout(() => {
      setShowCopyToast(false);
    }, 2500);
  };

  const handleSave = async () => {
    try {
      const { data, error } = await supabase
        .from('churches')
        .update({
          youtube_video_id: editForm.youtube_video_id,
          main_photo_url: editForm.main_photo_url,
          homepage_url: editForm.homepage_url,
          worship_times: editForm.worship_times
        })
        .eq('id', church.id)
        .select()
        .single();
      if (error) throw error;
      alert('정보가 저장되었습니다.');
      setChurch(data);
      setIsEditing(false);
    } catch (e) {
      alert('저장 중 오류가 발생했습니다: ' + e.message);
    }
  };

  const handleAddWorship = () => {
    setEditForm(prev => ({
      ...prev,
      worship_times: [...(prev.worship_times || []), { title: '주일예배 1부', time: '11:00 AM', location: '본당' }]
    }));
  };

  const handleUpdateWorship = (index, field, value) => {
    const newTimes = [...editForm.worship_times];
    newTimes[index][field] = value;
    setEditForm({ ...editForm, worship_times: newTimes });
  };

  const handleRemoveWorship = (index) => {
    const newTimes = editForm.worship_times.filter((_, i) => i !== index);
    setEditForm({ ...editForm, worship_times: newTimes });
  };

  return (
    <div className="relative w-full max-w-[400px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 pointer-events-auto" style={{ background: W.glass, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: '24px', boxShadow: W.shadow, border: `1px solid ${W.glassBorder}` }}>
      
      {/* Header - 밝은 파란색 계열 바탕 */}
      <div 
        className="relative pt-6 pb-5 px-5 shrink-0 overflow-hidden cursor-pointer" 
        style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', borderBottom: `1px solid rgba(255,255,255,0.1)` }}
        onClick={onTitleClick}
        title="클릭하여 지도에서 교회 위치 보기"
      >
        <div className="absolute right-0 top-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: '#60a5fa', opacity: 0.3, transform: 'translate(30%, -30%)' }}></div>

        {/* Copy Toast */}
        <div 
          className="absolute top-16 right-4 z-[60] px-3 py-2 rounded-xl flex items-center gap-2 shadow-xl transition-all duration-300 pointer-events-none"
          style={{ 
            background: 'rgba(34, 197, 94, 0.95)', 
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.2)',
            opacity: showCopyToast ? 1 : 0, 
            transform: showCopyToast ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)' 
          }}
        >
          <Check size={14} style={{ color: '#fff' }} />
          <span className="text-[12px] font-bold text-white">클립보드에 복사됨!</span>
        </div>

        {/* Top buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-[50]">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const defaultName = (church.name || '').endsWith('교회') ? church.name : church.name + '교회';
              const pastorStr = church.pastor_name ? `담임목사: ${church.pastor_name.replace(/목사\s*$/, '').trim()} 목사\n` : '';
              const addressStr = church.address ? `주소: ${church.address}\n` : '';
              const phoneStr = church.tel ? `전화번호: ${church.tel}\n` : '';
              const searchTarget = church.address || defaultName;
              const mapLink = `https://map.naver.com/p/search/${encodeURIComponent(searchTarget)}`;
              const directionsStr = `길찾기(네이버지도): ${mapLink}`;
              const textToShare = `[${defaultName}]\n${pastorStr}${addressStr}${phoneStr}${directionsStr}`;

              const fallbackCopy = () => {
                const textArea = document.createElement("textarea");
                textArea.value = textToShare;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                  const successful = document.execCommand('copy');
                  if (successful) {
                    handleShareSuccess();
                  } else {
                    alert('복사에 실패했습니다. 다른 브라우저를 이용해주세요.');
                  }
                } catch (err) {
                  alert('복사를 지원하지 않는 환경입니다.');
                } finally {
                  textArea.remove();
                }
              };

              if (navigator.share && window.isSecureContext) {
                navigator.share({ title: defaultName, text: textToShare }).catch((err) => {
                  if (err.name !== 'AbortError') fallbackCopy();
                });
              } else if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToShare)
                  .then(() => handleShareSuccess())
                  .catch(() => fallbackCopy());
              } else {
                fallbackCopy();
              }
            }}
            className="rounded-full transition-all flex items-center justify-center hover:scale-105"
            style={{ 
              background: showCopyToast ? 'rgba(34, 197, 94, 0.9)' : 'rgba(255, 255, 255, 0.15)', 
              border: showCopyToast ? '1px solid rgba(34, 197, 94, 1)' : '1px solid rgba(255, 255, 255, 0.2)', 
              width: '40px', height: '40px', backdropFilter: 'blur(10px)',
              transform: showCopyToast ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {showCopyToast ? (
              <Check size={18} style={{ color: '#fff' }} className="animate-in zoom-in" />
            ) : (
              <Share2 size={16} style={{ color: '#fff' }} />
            )}
          </button>
          
          <button 
            onClick={handleToggleFavorite}
            className="rounded-full transition-all flex items-center justify-center"
            style={{ 
              background: isFav ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              width: '40px', height: '40px',
            }}
          >
            <Star size={18} style={{ color: isFav ? '#ffd700' : 'rgba(255,255,255,0.7)' }} fill={isFav ? '#ffd700' : 'none'} />
          </button>
          <button 
            onClick={onClose} 
            className="rounded-full transition-all flex items-center justify-center hover:bg-white/20"
            style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)', width: '40px', height: '40px', backdropFilter: 'blur(10px)' }}
          >
            <X size={20} style={{ color: '#fff' }} />
          </button>
        </div>
        
        <div className="flex flex-col gap-1 mt-2 relative z-10 pr-24">
          <p className="font-bold text-[12px] tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.85)' }}>{church.noh_name || church.noh}</p>
          <div className="flex items-end gap-2.5 flex-wrap">
            <h2 className="text-[26px] font-extrabold tracking-tight leading-tight" style={{ color: '#ffffff' }}>{church.name.endsWith('교회') ? church.name : church.name + '교회'}</h2>
            {church.pastor_name && (
              <span className="text-[14px] font-semibold mb-[4px]" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {church.pastor_name.replace(/목사\s*$/, '').trim()} 목사
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-5 py-3 shrink-0 flex justify-between items-center gap-3 backdrop-blur-md" style={{ borderBottom: `1px solid ${W.cardBorder}`, background: 'rgba(255,255,255,0.4)' }}>
        <div className="flex p-1 rounded-[14px] flex-1 shadow-sm" style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${W.cardBorder}` }}>
          {[
            { key: 'home', icon: Home, label: '교회 정보' },
            { key: 'inquiry', icon: MessageSquare, label: '비밀 문의' },
          ].map(tab => (
            <button 
              key={tab.key}
              onClick={() => setActiveTab(tab.key)} 
              className="flex-1 py-1.5 text-[13px] font-bold flex items-center justify-center gap-1.5 rounded-xl transition-all duration-300"
              style={activeTab === tab.key ? { background: '#ffffff', color: W.accent, boxShadow: '0 2px 8px rgba(0,0,0,0.06)'  } : { color: W.textSub }}
            >
              <tab.icon size={14}/> {tab.label}
            </button>
          ))}
        </div>
        <button onClick={handleEditClick} className="p-2 rounded-[14px] transition-all hover:opacity-80" style={{ background: isEditing ? W.accent : '#ffffff', border: `1px solid ${W.cardBorder}`, color: isEditing ? '#ffffff' : W.textSub, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <Edit3 size={18} />
        </button>
      </div>

      {showPasswordPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center fade-in" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="p-5 rounded-2xl flex flex-col gap-3 shadow-2xl" style={{ background: 'white', border: `1px solid ${W.cardBorder}`, width: '85%' }}>
            <h3 className="font-bold text-[16px]" style={{ color: W.text }}>관리자 권한 확인</h3>
            <p className="text-[12px] leading-relaxed" style={{ color: W.textSub }}>
              교회 정보 수정을 위해 비밀번호를 입력해주세요.<br/>
              <span style={{ color: W.textMuted }}>(테스트용: 0000)</span>
            </p>
            <form onSubmit={handlePasswordSubmit} className="flex gap-2 mt-1">
              <input 
                type="password" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
                className="flex-1 px-3 py-2 border rounded-lg outline-none font-bold tracking-widest text-center" 
                style={{ background: W.inputBg, borderColor: W.inputBorder, color: W.text }}
                placeholder="****" 
                autoFocus
              />
              <button type="submit" className="px-4 py-2 rounded-lg font-bold text-white transition-transform active:scale-95" style={{ background: W.accent }}>
                확인
              </button>
            </form>
            <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput(''); }} className="text-[12px] font-bold mt-1" style={{ color: W.textMuted }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        
        {isEditing ? (
          <div className="p-5 flex flex-col gap-5 fade-in">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: W.accentLight, color: W.accent }}>
                <Edit3 size={16} />
              </div>
              <h3 className="font-extrabold text-[16px]" style={{ color: W.text }}>교회 정보 관리</h3>
            </div>

            <div className="p-4 rounded-2xl flex flex-col gap-4" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
              {[
                { icon: Video, label: '대표 유튜브 영상 ID', key: 'youtube_video_id', placeholder: '예: aBcDeFgHiJk' },
                { icon: ImageIcon, label: '대표 사진 URL', key: 'main_photo_url', placeholder: 'https://...' },
                { icon: LinkIcon, label: '교회 홈페이지 주소', key: 'homepage_url', placeholder: 'https://...' },
                { icon: Home, label: '주차 안내', key: 'parking_info', placeholder: '예: 50대 주차 가능 (무료)' },
                { icon: MapPin, label: '대중교통 안내', key: 'transport_info', placeholder: '예: 지하철 2호선 3번 출구' },
              ].map(f => (
                <label key={f.key} className="flex flex-col gap-1.5 text-[13px] font-bold" style={{ color: W.text }}>
                  <span className="flex items-center gap-1.5"><f.icon size={14} style={{ color: W.accent }}/> {f.label}</span>
                  <input type="text" value={editForm[f.key]} onChange={(e) => setEditForm({...editForm, [f.key]: e.target.value})} placeholder={f.placeholder} className="px-3 py-2 rounded-lg font-medium text-sm" style={{ background: W.inputBg, border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                </label>
              ))}
            </div>

            <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
               <div className="flex items-center justify-between">
                 <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: W.text }}><Clock size={14} style={{ color: W.accent }}/> 예배 시간 안내</span>
                 <button onClick={handleAddWorship} className="text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1" style={{ background: W.accentLight, color: W.accent }}><Plus size={12}/> 추가</button>
               </div>
               <div className="flex flex-col gap-2">
                 {editForm.worship_times.map((wt, i) => (
                   <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl relative group" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${W.inputBorder}` }}>
                     <input type="text" value={wt.title} onChange={(e) => handleUpdateWorship(i, 'title', e.target.value)} placeholder="예배명" className="text-sm font-bold rounded px-2 py-1" style={{ background: 'white', border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                     <div className="flex gap-2">
                       <input type="text" value={wt.time} onChange={(e) => handleUpdateWorship(i, 'time', e.target.value)} placeholder="시간" className="text-xs flex-1 rounded px-2 py-1" style={{ background: 'white', border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                       <input type="text" value={wt.location} onChange={(e) => handleUpdateWorship(i, 'location', e.target.value)} placeholder="장소" className="text-xs flex-1 rounded px-2 py-1" style={{ background: 'white', border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                     </div>
                     <button onClick={() => handleRemoveWorship(i)} className="absolute -top-2 -right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' }}><Trash2 size={12}/></button>
                   </div>
                 ))}
                 {editForm.worship_times.length === 0 && <p className="text-center text-xs py-2" style={{ color: W.textMuted }}>등록된 예배가 없습니다.</p>}
               </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button onClick={handleSave} className="w-full font-extrabold py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all text-white" style={{ background: `linear-gradient(135deg, ${W.accent}, #6b8cff)`, boxShadow: '0 4px 16px rgba(55,102,255,0.25)' }}>
                <Save size={18} /> 변경사항 저장하기
              </button>
              <button 
                onClick={() => setIsEditing(false)} 
                className="w-full font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]" 
                style={{ background: 'rgba(0,0,0,0.03)', color: W.textSub, border: '1px solid rgba(0,0,0,0.05)' }}
              >
                닫기 / 홈으로 돌아가기
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* HOME TAB */}
            {activeTab === 'home' && (
              <div className="p-5 flex flex-col gap-5 fade-in">
                <div className="flex flex-col gap-3">
                  <h3 className="font-extrabold flex items-center gap-2 text-[16px]" style={{ color: W.text }}>
                    <Video size={18} style={{ color: W.accent }} /> 환영합니다
                  </h3>
                  <div className="w-full aspect-video rounded-2xl overflow-hidden relative" style={{ background: '#ffffff', border: `1px solid ${W.cardBorder}` }}>
                    {church.youtube_video_id ? (
                      <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${church.youtube_video_id}`} title="YouTube" allowFullScreen />
                    ) : church.main_photo_url ? (
                      <img src={church.main_photo_url} alt={church.name} className="absolute top-0 left-0 w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full gap-2" style={{ color: W.textMuted }}>
                        <ImageIcon size={32} style={{ color: '#ddd' }}/>
                        <span className="text-sm font-medium">등록된 영상이나 사진이 없습니다</span>
                      </div>
                    )}
                  </div>
                  
                  {(church.homepage_url || church.youtube_video_id || church.youtube_channel_id) && (
                    <div className="flex gap-2 w-full mt-1">
                      {(church.youtube_channel_id || church.youtube_video_id) && (
                        <a href={church.youtube_channel_id ? `https://youtube.com/channel/${church.youtube_channel_id}` : `https://youtube.com/watch?v=${church.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: 'rgba(255,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(255,68,68,0.12)' }}>
                          <Video size={14}/> 유튜브 채널
                        </a>
                      )}
                      {church.homepage_url && (
                        <a href={church.homepage_url} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: 'rgba(8,145,178,0.06)', color: W.cyan, border: '1px solid rgba(8,145,178,0.12)' }}>
                          <LinkIcon size={14}/> 홈페이지 방문
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl leading-relaxed whitespace-pre-wrap text-[14px]" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}`, color: W.textSub }}>
                  {church.intro_text || <span className="italic">{"한국기독교장로회 " + (church.name.endsWith('교회') ? church.name : church.name + '교회') + "에 오신 것을 환영합니다. 함께 예배드리며 은혜 나누기를 소망합니다."}</span>}
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <h3 className="font-extrabold flex items-center gap-2 text-[16px]" style={{ color: W.text }}>
                    <Clock size={18} style={{ color: W.accent }} /> 예배 안내
                  </h3>
                  
                  {Array.isArray(church.worship_times) && church.worship_times.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                      {church.worship_times.map((wt, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between" style={{ borderBottom: i < church.worship_times.length - 1 ? `1px solid ${W.cardBorder}` : 'none' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: W.accent }}></div>
                            <span className="font-bold text-[13px]" style={{ color: W.text }}>{wt.title}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-bold text-[13px]" style={{ color: W.accent }}>{wt.time}</span>
                            {wt.location && <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: W.textMuted }}><MapPin size={9}/>{wt.location}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl p-5 text-center" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                      <p className="text-[13px] font-medium" style={{ color: W.textMuted }}>등록된 예배 시간이 없습니다.</p>
                      <button onClick={handleEditClick} className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border" style={{ borderColor: W.accentBorder, color: W.accent, background: W.accentLight }}>
                        교회 관계자이신가요? 정보 등록하기
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full h-px mt-2" style={{ background: W.cardBorder }}></div>
                
                <div className="flex flex-col gap-3">
                   <h3 className="font-extrabold flex items-center gap-2 text-[16px]" style={{ color: W.text }}>
                    <MapPin size={18} style={{ color: W.cyan }} /> 오시는 길 / 주차
                   </h3>
                   
                   <div className="grid grid-cols-3 gap-2 mb-1">
                     <button onClick={handleCall} className="py-3 justify-center rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                       <Phone size={16} style={{ color: W.green }} />
                       <span className="font-bold text-[12px]" style={{ color: W.text }}>전화</span>
                     </button>
                     
                     <button onClick={handleDirections} className="py-3 justify-center rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all" style={{ background: W.accentLight, border: `1px solid ${W.accentBorder}` }}>
                       <Navigation size={16} style={{ color: W.accent }} />
                       <span className="font-bold text-[12px]" style={{ color: W.accent }}>길찾기</span>
                     </button>

                     <button onClick={handleOpenPanorama} className="py-3 justify-center rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                       <Eye size={16} style={{ color: W.green }} />
                       <span className="font-bold text-[12px]" style={{ color: W.green }}>거리뷰</span>
                     </button>
                   </div>

                   <div className="rounded-2xl flex flex-col" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                     <div className="p-3.5 flex flex-col gap-1" style={{ borderBottom: `1px solid ${W.cardBorder}` }}>
                       <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>주소</span>
                       <span className="font-medium leading-relaxed text-[13px]" style={{ color: W.text }}>{church.address || '주소 정보 없음'}</span>
                     </div>
                     {church.parking_info && (
                       <div className="p-3.5 flex flex-col gap-1" style={{ borderBottom: `1px solid ${W.cardBorder}` }}>
                         <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>주차 안내</span>
                         <span className="font-medium text-[13px]" style={{ color: W.text }}>{church.parking_info}</span>
                       </div>
                     )}
                     {church.transport_info && (
                       <div className="p-3.5 flex flex-col gap-1" style={{ borderBottom: church.phone ? `1px solid ${W.cardBorder}` : 'none' }}>
                         <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>대중교통</span>
                         <span className="font-medium text-[13px]" style={{ color: W.text }}>{church.transport_info}</span>
                       </div>
                     )}
                     {church.phone && (
                       <div className="p-3.5 flex flex-col gap-1">
                         <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>전화번호</span>
                         <span className="font-medium text-[13px]" style={{ color: W.text }}>{church.phone}</span>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            )}

            {/* INQUIRY TAB */}
            {activeTab === 'inquiry' && (
              <div className="bg-white h-full overflow-hidden text-black min-h-[400px]">
                 <CommunicationBoard churchId={church.id} onClose={() => setActiveTab('home')} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Panorama (Street View) Fullscreen Modal */}
      {showPanorama && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#0a0e1a' }}>
          {/* Panorama Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ background: 'rgba(10,14,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Eye size={16} style={{ color: '#10b981' }} />
              </div>
              <div>
                <p className="text-white font-bold text-[14px] leading-tight">{church.name}</p>
                <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>네이버 거리뷰</p>
              </div>
            </div>
            <button 
              onClick={handleClosePanorama}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/10 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <X size={20} style={{ color: '#fff' }} />
            </button>
          </div>

          {/* Panorama Container */}
          <div className="flex-1 relative">
            <div ref={panoramaContainerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
            
            {/* Loading state */}
            {panoramaStatus === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(10,14,26,0.85)' }}>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#10b981', borderRightColor: '#10b981' }}></div>
                </div>
                <p className="text-white/60 text-[13px] font-medium">거리뷰 데이터를 불러오는 중...</p>
              </div>
            )}

            {/* Unavailable state */}
            {panoramaStatus === 'unavailable' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(10,14,26,0.9)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Eye size={28} style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <div className="text-center">
                  <p className="text-white/80 text-[15px] font-bold">거리뷰를 사용할 수 없습니다</p>
                  <p className="text-white/40 text-[12px] mt-1 leading-relaxed">이 지역에는 네이버 거리뷰 데이터가<br/>아직 제공되지 않습니다.</p>
                </div>
                <button 
                  onClick={handleClosePanorama}
                  className="mt-2 px-6 py-2.5 rounded-xl font-bold text-[13px] transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
