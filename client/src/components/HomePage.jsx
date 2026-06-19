import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API_BASE from '../api';
import { useBackButton } from '../useBackButton';
import MobileHeader from './mobile/MobileHeader';
import { useAuth } from '../AuthContext';
import { LinkifyText } from '../utils/linkify';
import { requestNotificationPermission, isTokenRegistered, onForegroundMessage } from '../firebase';
import { getActiveAds } from '../utils/adService';

const isNew = (dateStr) => {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 3 * 24 * 60 * 60 * 1000;
};

const scopeOrder = { assembly: 0, presbytery: 1, sichal: 2 };
const scopeLabel = { assembly: '총회', presbytery: '노회', sichal: '시찰' };
const scopeColor = { assembly: '#0a2540', presbytery: '#0058bc', sichal: '#34C759' };

/* ─────────────── 광고 상세 뷰 (프리미엄 디자인) ─────────────── */
const AdDetailView = ({ ad, onBack }) => {
  if (!ad) return null;

  const daysLeft = (() => {
    const end = new Date(ad.end_date);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  // body의 overflow 제한을 해제하여 스크롤 허용
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const origBodyOverflow = body.style.overflow;
    const origHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = origBodyOverflow;
      html.style.overflow = origHtmlOverflow;
    };
  }, []);

  // Portal로 #root 바깥(body 직속)에 렌더링 → 모든 부모 CSS 제약 우회
  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 99999,
      overflowY: 'scroll',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      background: '#f8f9fc',
      fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif",
    }}>
      <MobileHeader showBack={true} onBack={onBack} title="" />

      {/* Hero Image */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxHeight: 320,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0a2540, #0058bc)',
      }}>
        {ad.thumbnail_url ? (
          <img
            src={ad.thumbnail_url}
            alt={ad.title}
            style={{
              width: '100%',
              height: 320,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : ad.image_url ? (() => {
          const c = ad.image_crop;
          return (
            <img
              src={ad.image_url}
              alt={ad.title}
              style={{
                width: '100%',
                height: 320,
                objectFit: 'cover',
                objectPosition: c ? `${c.x}% ${c.y}%` : '50% 50%',
                transform: c?.zoom > 1 ? `scale(${c.zoom})` : 'none',
                transformOrigin: c ? `${c.x}% ${c.y}%` : 'center',
                display: 'block',
              }}
            />
          );
        })() : null}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
        }} />
        {/* Title overlay */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
        }}>
          <h1 style={{
            color: '#fff',
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.3,
            textShadow: '0 2px 16px rgba(0,0,0,0.3)',
            margin: 0,
            fontFamily: "'Manrope', 'Pretendard', sans-serif",
          }}>
            {ad.title}
          </h1>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ padding: '0 20px', maxWidth: 640, margin: '0 auto' }}>

        {/* Meta Info Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 0',
          borderBottom: '1px solid rgba(10,37,64,0.06)',
          flexWrap: 'wrap',
        }}>
          {ad.advertiser && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0058bc, #0070eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
              }}>
                {ad.advertiser.charAt(0)}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0a2540' }}>
                {ad.advertiser}
              </span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 20,
            background: daysLeft > 7 ? '#E8F5E9' : daysLeft > 0 ? '#FFF3E0' : '#F2F2F7',
            color: daysLeft > 7 ? '#34C759' : daysLeft > 0 ? '#FF9500' : '#8E8E93',
          }}>
            {daysLeft > 0 ? `D-${daysLeft}` : '기간 만료'}
          </span>
          <span style={{
            fontSize: 11,
            color: '#74777e',
            fontWeight: 500,
          }}>
            {ad.start_date} ~ {ad.end_date}
          </span>
        </div>

        {/* Article Content */}
        {ad.content && (
          <div style={{
            padding: '24px 0',
            lineHeight: 1.9,
            fontSize: 15,
            color: '#1a1a2e',
            whiteSpace: 'pre-wrap',
            wordBreak: 'keep-all',
          }}>
            <LinkifyText text={ad.content} />
          </div>
        )}

        {/* No content fallback */}
        {!ad.content && (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
            <p style={{ color: '#74777e', fontSize: 14, lineHeight: 1.6 }}>
              광고 상세 내용이 등록되지 않았습니다.
            </p>
          </div>
        )}

        {/* CTA Section */}
        <div style={{
          padding: '20px 0 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {ad.link_url && (
            <a
              href={ad.link_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #0058bc, #0070eb)',
                color: '#fff',
                borderRadius: 16,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 15,
                boxShadow: '0 8px 24px rgba(0,112,235,0.25)',
                transition: 'transform 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>open_in_new</span>
              자세히 보기
            </a>
          )}
          {ad.contact && (
            <a
              href={`tel:${ad.contact.replace(/[^0-9+]/g, '')}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 24px',
                background: '#fff',
                color: '#0a2540',
                borderRadius: 16,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 15,
                border: '1.5px solid rgba(10,37,64,0.1)',
                boxShadow: '0 4px 12px rgba(10,37,64,0.04)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>call</span>
              문의하기 ({ad.contact})
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ─────────────── HomePage ─────────────── */
const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notices, setNotices] = useState([]);
  const [ads, setAds] = useState([]);
  const [adIdx, setAdIdx] = useState(0);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedAd, setSelectedAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [fgToast, setFgToast] = useState(null);
  const fcmInitRef = useRef(false);
  const touchStartRef = useRef(null);

  useEffect(() => {
    const nohName = user?.NOHNAME || user?.noh_name || '';
    const sichalName = user?.SICHALNAME || user?.sichal_name || '';
    
    // 공지사항: 로컬 서버 API
    const noticePromise = fetch(`${API_BASE}/api/notices?target_noh=${encodeURIComponent(nohName)}&target_sichal=${encodeURIComponent(sichalName)}`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    // 광고 배너: Firestore (온라인 직접)
    const adPromise = getActiveAds().catch(() => []);

    Promise.all([noticePromise, adPromise]).then(([noticeData, adData]) => {
      const sorted = (Array.isArray(noticeData) ? noticeData : [])
        .sort((a, b) => (scopeOrder[a.scope] ?? 99) - (scopeOrder[b.scope] ?? 99));
      setNotices(sorted);
      setAds(Array.isArray(adData) ? adData : []);
      setApiError(false);
    }).catch(err => {
      console.error("API Fetch Error:", err);
      setApiError(true);
      setNotices([]);
      setAds([]);
    }).finally(() => setLoading(false));
  }, [user]);

  // FCM 푸시 알림 토큰 등록 (최초 1회 및 변경 시)
  useEffect(() => {
    if (fcmInitRef.current || !user) return;
    fcmInitRef.current = true;

    // PWA 설치 안내창이 화면에 켜져 있는 동안에는 알림설정 팝업이 겹쳐서 뜨지 않도록 대기 조율
    const requestPushWithGuard = () => {
      if (window.__pwaPromptActive) {
        // PWA 안내창이 활성 상태면 2초 뒤에 다시 체크하도록 지연
        setTimeout(requestPushWithGuard, 2000);
      } else {
        requestNotificationPermission(API_BASE, user);
      }
    };

    // 최초 6초 뒤에 알림설정 권한 여부를 체크 (PWA 설치 안내창이 먼저 뜰 수 있는 시간을 우선 제공)
    const timer = setTimeout(requestPushWithGuard, 6000);
    return () => clearTimeout(timer);
  }, [user]);

  // 포그라운드 FCM 메시지 수신 → 인앱 토스트
  useEffect(() => {
    onForegroundMessage((payload) => {
      const { title, body } = payload.notification || payload.data || {};
      const noticeId = payload.data?.notice_id;
      setFgToast({ title, body, noticeId });
      setTimeout(() => setFgToast(null), 6000);
    });
  }, []);

  // URL 딥링크: /?notice=123 → 해당 공지 자동 open
  useEffect(() => {
    const noticeId = searchParams.get('notice');
    if (noticeId && !selectedNotice) {
      fetch(`${API_BASE}/api/notices/${noticeId}`)
        .then(r => r.json())
        .then(data => {
          if (data && !data.error) {
            setSelectedNotice(data);
          }
        })
        .catch(() => {});
      // URL에서 notice 파라미터 제거 (히스토리 깨끗하게)
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, selectedNotice, setSearchParams]);

  // Ad auto-slide every 4 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setAdIdx(p => (p + 1) % ads.length), 4000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const clearNotice = useCallback(() => setSelectedNotice(null), []);
  const clearAd = useCallback(() => setSelectedAd(null), []);
  useBackButton(!!selectedNotice || !!selectedAd, selectedAd ? clearAd : clearNotice);

  useEffect(() => {
    const handleResetView = () => {
      setSelectedNotice(null);
      setSelectedAd(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('reset-home-view', handleResetView);
    return () => window.removeEventListener('reset-home-view', handleResetView);
  }, []);

  // Ad swipe handlers
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartRef.current === null || ads.length <= 1) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setAdIdx(p => (p + 1) % ads.length);
      } else {
        setAdIdx(p => (p - 1 + ads.length) % ads.length);
      }
    }
    touchStartRef.current = null;
  };

  // Ad Detail View
  if (selectedAd) {
    return <AdDetailView ad={selectedAd} onBack={clearAd} />;
  }

  // Notice Detail View
  if (selectedNotice) {
    return (
      <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
        <MobileHeader showBack={true} onBack={clearNotice} title="소식 상세" />
        <main className="pt-24 px-6 max-w-2xl mx-auto">
          <div className="mb-8">
            <span className="inline-block text-[10px] font-bold text-secondary bg-secondary-container/10 px-3 py-1 rounded-full uppercase mb-4 font-['Plus_Jakarta_Sans']">
              {selectedNotice.is_pinned && '📌 '} {scopeLabel[selectedNotice.scope] || ''} · {selectedNotice.category}
            </span>
            {isNew(selectedNotice.created_at) && (
              <span className="inline-block ml-2 text-[10px] font-bold text-white bg-error px-2 py-1 rounded-full uppercase">NEW</span>
            )}
            <h2 className="text-3xl font-extrabold text-primary leading-tight mb-4 font-['Manrope',_'Pretendard']">
              {selectedNotice.title}
            </h2>
            <p className="text-on-surface-variant text-sm font-medium">
              {selectedNotice.created_at?.substring(0, 10)} · {selectedNotice.author_name || '관리자'}
            </p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_20px_40px_rgba(10,37,64,0.04)] text-on-surface leading-loose whitespace-pre-wrap text-[15px]">
            <LinkifyText text={selectedNotice.content} />
          </div>
        </main>
      </div>
    );
  }

  // Home Dashboard
  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader title="한국기독교장로회 주소록" />

      {/* Foreground Push Toast */}
      {fgToast && (
        <div 
          onClick={() => {
            if (fgToast.noticeId) {
              fetch(`${API_BASE}/api/notices/${fgToast.noticeId}`)
                .then(r => r.json())
                .then(data => { if (data && !data.error) setSelectedNotice(data); });
            }
            setFgToast(null);
          }}
          className="fixed top-20 left-4 right-4 z-[999] bg-primary text-white rounded-2xl p-4 shadow-[0_20px_40px_rgba(0,0,0,0.2)] cursor-pointer animate-[slideDown_0.3s_ease-out]"
        >
          <p className="font-bold text-sm">🔔 {fgToast.title}</p>
          <p className="text-xs opacity-90 mt-1 line-clamp-2">{fgToast.body}</p>
        </div>
      )}

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Welcome Section - compact */}
        <section>
          <h2 className="text-2xl font-extrabold text-primary leading-tight font-['Manrope',_'Pretendard']">
            {user?.name || '사용자'} {(() => {
              const duty = user?.duty || '';
              if (duty.includes('목사')) return '목사님';
              if (duty.includes('준목')) return '준목님';
              if (duty.includes('장로')) return '장로님';
              if (duty.includes('전도사')) return '전도사님';
              if (duty.includes('권사')) return '권사님';
              if (duty.includes('집사')) return '집사님';
              return '님';
            })()}, 평안하세요.
          </h2>
        </section>

        {/* Quick Actions - compact */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/documents')} className="flex items-center gap-3 p-4 bg-gradient-to-br from-secondary to-secondary-container text-white rounded-2xl shadow-[0_10px_20px_rgba(0,112,235,0.15)] active:scale-95 transition-all">
              <span className="material-symbols-outlined text-2xl opacity-90" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>savings</span>
              <div className="text-left">
                <span className="font-bold text-sm font-['Manrope',_'Pretendard'] block">연금/생보</span>
                <span className="text-[11px] opacity-80 font-medium">납입 현황 및 조회</span>
              </div>
            </button>
            <button onClick={() => navigate('/directory')} className="flex items-center gap-3 p-4 bg-surface-container-lowest text-primary rounded-2xl shadow-[0_20px_40px_rgba(10,37,64,0.04)] active:scale-95 transition-all">
              <span className="material-symbols-outlined text-2xl text-primary-container" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>contact_page</span>
              <div className="text-left">
                <span className="font-bold text-sm font-['Manrope',_'Pretendard'] block">주소록 검색</span>
                <span className="text-[11px] text-on-surface-variant font-medium">목회자 및 교회</span>
              </div>
            </button>
          </div>
        </section>

        {/* Ad Banner Carousel */}
        {ads.length > 0 && (
          <section className="relative mt-2 mb-2">
            <div 
              className="rounded-[20px] overflow-hidden relative transform transition-all duration-300 hover:-translate-y-1"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={{ 
                height: 140, 
                backgroundColor: '#ffffff',
                boxShadow: '0 20px 40px rgba(10,37,64,0.12), 0 8px 16px rgba(10,37,64,0.08), inset 0 2px 0 rgba(255,255,255,0.8)',
                border: '1px solid rgba(10,37,64,0.05)'
              }}
            >
              {ads.map((ad, i) => (
                <div
                  key={ad.id}
                  onClick={() => setSelectedAd(ad)}
                  className="absolute inset-0 transition-opacity duration-700 cursor-pointer"
                  style={{ opacity: i === adIdx ? 1 : 0, pointerEvents: i === adIdx ? 'auto' : 'none' }}
                >
                  {ad.thumbnail_url ? (
                    <img
                      src={ad.thumbnail_url}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                    />
                  ) : ad.image_url ? (() => {
                    const c = ad.image_crop;
                    return (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-full h-full object-cover"
                        style={{
                          objectPosition: c ? `${c.x}% ${c.y}%` : '50% 50%',
                          transform: c?.zoom > 1 ? `scale(${c.zoom})` : 'none',
                          transformOrigin: c ? `${c.x}% ${c.y}%` : 'center',
                        }}
                      />
                    );
                  })() : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #0058bc, #0070eb)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 20,
                    }}>
                      <span style={{ color: '#fff', fontSize: 18, fontWeight: 800, textAlign: 'center' }}>
                        {ad.title}
                      </span>
                    </div>
                  )}
                  {/* Title overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '24px 16px 12px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                  }}>
                    <span style={{
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}>
                      {ad.title}
                    </span>
                    {ad.advertiser && (
                      <span style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 11,
                        fontWeight: 500,
                        marginLeft: 8,
                      }}>
                        {ad.advertiser}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {/* Dots */}
              {ads.length > 1 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 p-1.5 px-2 bg-black/20 backdrop-blur-md rounded-full">
                  {ads.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setAdIdx(i); }}
                      className={`rounded-full transition-all duration-300 ${i === adIdx ? 'w-4 h-1.5 bg-white shadow-sm' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              )}
              {/* AD label */}
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                padding: '2px 8px',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                borderRadius: 8,
                zIndex: 5,
              }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>AD</span>
              </div>
            </div>
          </section>
        )}

        {/* Recent Notices - COMPACT */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-['Manrope',_'Pretendard'] text-lg font-bold text-primary">최신 공지</h3>
          </div>
          
          {loading ? (
             <div className="text-center py-6 text-on-surface-variant text-sm">불러오는 중...</div>
          ) : apiError ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 text-center shadow-sm">
              <span className="material-symbols-outlined text-3xl text-error mb-2">cloud_off</span>
              <p className="text-error font-medium text-sm">현재 서버 점검 중이거나 연결이 원활하지 않습니다.</p>
              <p className="text-on-surface-variant text-xs mt-1">주소록 검색은 캐시된 데이터로 이용 가능합니다.</p>
            </div>
          ) : notices.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 text-center shadow-sm">
              <span className="material-symbols-outlined text-3xl text-outline-variant mb-2">inbox</span>
              <p className="text-on-surface-variant font-medium text-sm">새로운 소식이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notices.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => setSelectedNotice(n)}
                  className="group rounded-xl px-4 py-3 bg-surface-container-lowest shadow-[0_4px_12px_rgba(10,37,64,0.04)] cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center gap-3"
                >
                  {/* Scope badge */}
                  <div 
                    className="w-1 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: scopeColor[n.scope] || '#74777e' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant">
                        {scopeLabel[n.scope] || n.scope}
                      </span>
                      <span className="text-[10px] text-outline font-medium">{n.category}</span>
                      {isNew(n.created_at) && (
                        <span className="text-[9px] font-bold text-white bg-error px-1.5 py-0.5 rounded-full">N</span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-primary truncate leading-snug font-['Manrope',_'Pretendard']">
                      {n.title}
                    </h4>
                  </div>
                  <span className="text-xs text-outline font-medium flex-shrink-0 hidden sm:block">
                    {n.created_at?.substring(5, 10)}
                  </span>
                  <span className="material-symbols-outlined text-sm text-outline-variant/50 flex-shrink-0">chevron_right</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default HomePage;
