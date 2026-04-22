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
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-white/50 p-5 relative overflow-hidden">
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-white text-[24px]">church</span>
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="font-['Pretendard'] font-bold text-[#1a2340] text-[15px] leading-snug tracking-tight">기장 주소록 앱 설치</h3>
            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
              {isIOS 
                ? <>바탕화면에 추가하여 더 빠르고 편리하게 이용해보세요. <br/><span className="inline-flex items-center gap-1 font-medium text-slate-600 mt-1"><span className="material-symbols-outlined text-[16px]">ios_share</span> 공유 버튼을 누르고 <strong>'홈 화면에 추가'</strong>를 선택하세요.</span></>
                : '스마트폰 바탕화면에 설치하여 더욱 편리하게 이용하세요.'}
            </p>
            
            {!isIOS && deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="mt-3 w-full bg-[#0070eb] text-white font-medium text-[14px] py-2.5 rounded-xl shadow-sm active:scale-[0.98] transition-transform"
              >
                앱 설치하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
