import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API_BASE from '../api';
import { useBackButton } from '../useBackButton';
import MobileHeader from './mobile/MobileHeader';
import { useAuth } from '../AuthContext';
import ApiImage from './ApiImage';
import { LinkifyText } from '../utils/linkify';
import { requestNotificationPermission, isTokenRegistered, onForegroundMessage } from '../firebase';

const isNew = (dateStr) => {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 3 * 24 * 60 * 60 * 1000;
};

const scopeOrder = { assembly: 0, presbytery: 1, sichal: 2 };
const scopeLabel = { assembly: '총회', presbytery: '노회', sichal: '시찰' };
const scopeColor = { assembly: '#0a2540', presbytery: '#0058bc', sichal: '#34C759' };

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notices, setNotices] = useState([]);
  const [ads, setAds] = useState([]);
  const [adIdx, setAdIdx] = useState(0);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fgToast, setFgToast] = useState(null);
  const fcmInitRef = useRef(false);

  useEffect(() => {
    const nohName = user?.NOHNAME || user?.noh_name || '';
    const sichalName = user?.SICHALNAME || user?.sichal_name || '';
    
    Promise.all([
      fetch(`${API_BASE}/api/notices?target_noh=${encodeURIComponent(nohName)}&target_sichal=${encodeURIComponent(sichalName)}`).then(r => r.json()),
      fetch(`${API_BASE}/api/ads?active_only=true`).then(r => r.json())
    ]).then(([noticeData, adData]) => {
      const sorted = (Array.isArray(noticeData) ? noticeData : [])
        .sort((a, b) => (scopeOrder[a.scope] ?? 99) - (scopeOrder[b.scope] ?? 99));
      setNotices(sorted);
      setAds(Array.isArray(adData) ? adData : []);
    }).finally(() => setLoading(false));
  }, [user]);

  // FCM 푸시 알림 토큰 등록 (최초 1회)
  useEffect(() => {
    if (fcmInitRef.current || !user) return;
    fcmInitRef.current = true;

    // 이미 토큰이 등록되어 있으면 skip
    if (isTokenRegistered()) {
      console.log('[FCM] Token already registered');
    } else {
      // 3초 후 알림 권한 요청 (UX: 페이지 로딩 후 자연스럽게)
      const timer = setTimeout(() => {
        requestNotificationPermission(API_BASE);
      }, 3000);
      return () => clearTimeout(timer);
    }
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
  useBackButton(!!selectedNotice, clearNotice);

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
              <span className="material-symbols-outlined text-2xl opacity-90" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>auto_awesome</span>
              <div className="text-left">
                <span className="font-bold text-sm font-['Manrope',_'Pretendard'] block">증명서 신청</span>
                <span className="text-[11px] opacity-80 font-medium">행정문서 발급</span>
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
              style={{ 
                height: 130, 
                backgroundColor: '#ffffff',
                boxShadow: '0 20px 40px rgba(10,37,64,0.12), 0 8px 16px rgba(10,37,64,0.08), inset 0 2px 0 rgba(255,255,255,0.8)',
                border: '1px solid rgba(10,37,64,0.05)'
              }}
            >
              {ads.map((ad, i) => (
                <a
                  key={ad.id}
                  href={ad.link_url || '#'}
                  target={ad.link_url ? '_blank' : '_self'}
                  rel="noreferrer"
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: i === adIdx ? 1 : 0, pointerEvents: i === adIdx ? 'auto' : 'none' }}
                >
                  <ApiImage
                    src={`${API_BASE}${ad.image_url}`}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
              {/* Dots */}
              {ads.length > 1 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 p-1.5 px-2 bg-black/20 backdrop-blur-md rounded-full">
                  {ads.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.preventDefault(); setAdIdx(i); }}
                      className={`rounded-full transition-all duration-300 ${i === adIdx ? 'w-4 h-1.5 bg-white shadow-sm' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              )}
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
