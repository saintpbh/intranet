import { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(isPWA);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isItIOS = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isItIOS);

    // Android/Chrome: Capture the install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isPWA) setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, if not installed, show after 3 seconds
    if (isItIOS && !isPWA) {
      const timer = setTimeout(() => {
        const hasDismissed = localStorage.getItem('pwa-prompt-dismissed');
        if (!hasDismissed) setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-28 left-4 right-4 z-50 animate-fade-in-up">
      <div className="bg-white backdrop-blur-xl rounded-2xl shadow-[0_12px_45px_-5px_rgba(0,0,0,0.25)] border-2 border-blue-500/30 p-6 relative overflow-hidden">
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 p-2 active:scale-95 transition-transform"
          aria-label="닫기"
        >
          <span className="material-symbols-outlined text-[28px] font-bold">close</span>
        </button>
        
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-white text-[36px]">church</span>
          </div>
          <div className="flex-1 pt-1">
            <h3 className="font-['Pretendard'] font-extrabold text-[#0f172a] text-[20px] leading-snug tracking-tight">
              기장 주소록 앱 설치 안내
            </h3>
            <p className="text-[15px] text-slate-700 mt-2 font-semibold leading-relaxed">
              {isIOS 
                ? <>바탕화면에 추가하여 더 편리하게 이용해보세요. <br/><span className="inline-flex flex-wrap items-center gap-1 font-bold text-blue-600 mt-2 bg-blue-50 p-2.5 rounded-lg border border-blue-100"><span className="material-symbols-outlined text-[18px]">ios_share</span> 하단의 공유 버튼을 누르고 <strong>'홈 화면에 추가'</strong>를 누르세요.</span></>
                : '스마트폰 바탕화면(홈 화면)에 설치하여 더욱 크고 편리하게 이용하세요.'}
            </p>
            
            {!isIOS && deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[18px] py-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.97] transition-transform text-center"
              >
                앱 설치하기 (여기를 누르세요)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
