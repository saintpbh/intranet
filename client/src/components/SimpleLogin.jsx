import { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import API_BASE from '../api';
import { useAuth } from '../AuthContext';

const SimpleLogin = () => {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  
  const [timer, setTimer] = useState(180); // 3분
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unregistered, setUnregistered] = useState(false); // DB 미등록 상태

  const timerRef = useRef(null);

  // 3분 카운트다운 타이머 관리
  useEffect(() => {
    if (isCodeSent && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      clearInterval(timerRef.current);
      setError('인증 시간이 만료되었습니다. 인증번호를 재요청해 주세요.');
    }

    return () => clearInterval(timerRef.current);
  }, [isCodeSent, timer]);

  // 전화번호 자동 포맷팅 (010-XXXX-XXXX)
  const handlePhoneChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 남김
    let formatted = rawValue;
    if (rawValue.length > 3 && rawValue.length <= 7) {
      formatted = `${rawValue.slice(0, 3)}-${rawValue.slice(3)}`;
    } else if (rawValue.length > 7) {
      formatted = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 7)}-${rawValue.slice(7, 11)}`;
    }
    setPhoneNumber(formatted);
  };

  // reCAPTCHA 초기화
  const initRecaptcha = () => {
    if (window.recaptchaVerifier) {
      return;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA 해결 완료
      },
      'expired-callback': () => {
        setError('reCAPTCHA 보안 인증이 만료되었습니다. 다시 시도해 주세요.');
        window.recaptchaVerifier = null;
      }
    });
  };

  // 1단계: 인증번호 발송 요청
  const handleSendCode = async (e) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setError('올바른 휴대폰 번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setUnregistered(false);

    try {
      initRecaptcha();
      const appVerifier = window.recaptchaVerifier;

      // 파이어베이스 전화번호 규격 변경: +821012345678
      const internationalNumber = `+82${cleanPhone.slice(1)}`;
      
      const confirmation = await signInWithPhoneNumber(auth, internationalNumber, appVerifier);
      setConfirmationResult(confirmation);
      setIsCodeSent(true);
      setTimer(180); // 타이머 재시작
      setVerificationCode('');
    } catch (err) {
      console.error('[Phone Auth] Failed to send SMS:', err);
      if (err.code === 'auth/too-many-requests') {
        setError('단기간에 너무 많은 인증 시도가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('인증번호 발송 실패! 번호를 확인하거나 네트워크를 확인해 주세요.');
      }
      window.recaptchaVerifier = null;
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 인증코드 검증 및 백엔드 연동 로그인
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      setError('6자리 인증번호를 정확히 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Firebase Auth 코드 인증
      const userCredential = await confirmationResult.confirm(verificationCode);
      const idToken = await userCredential.user.getIdToken();

      // 2. 백엔드 (FastAPI) 전송 및 총회 DB 일치 여부 대조
      const res = await fetch(`${API_BASE}/api/auth/firebase-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 404) {
          // DB 미등록 번호
          setUnregistered(true);
          setError('총회 데이터베이스에 등록되지 않은 휴대폰 번호입니다.');
        } else {
          setError(errData.detail || '백엔드 인증 세션 발급에 실패했습니다.');
        }
        return;
      }

      const sessionData = await res.json();
      if (sessionData.success && sessionData.user) {
        // 기존 주소록 컨텍스트와 호환되는 형태로 세션 정보 바인딩
        login({
          code: sessionData.user.MinisterCode,
          name: sessionData.user.MinisterName,
          church: sessionData.user.CHRNAME,
          presbytery: sessionData.user.NOHNAME,
          duty: sessionData.user.DUTYNAME,
          phone: sessionData.user.TEL_MOBILE,
          email: sessionData.user.EMAIL,
          birthday: sessionData.user.BIRTHDAY,
          nohCode: sessionData.user.nohCode || '',
          chrCode: sessionData.user.chrCode || '',
        });
      }
    } catch (err) {
      console.error('[Phone Auth] Verification failed:', err);
      setError('잘못되었거나 만료된 인증코드입니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 타이머 표시 포맷 (mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-slate-900 font-['Plus_Jakarta_Sans',_'Pretendard'] text-slate-100 antialiased flex flex-col justify-between p-6">
        <header className="w-full flex items-center justify-end max-w-4xl mx-auto py-4 border-b border-slate-800">
          <span className="text-[11px] bg-slate-800 text-slate-300 font-semibold px-3 py-1 rounded-full border border-slate-700">
            스마트폰 전용
          </span>
        </header>

        <main className="max-w-md mx-auto w-full flex-grow flex flex-col justify-center py-12">
          <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 rounded-[2.5rem] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.4)] text-center space-y-6">
            <div className="mx-auto flex items-center justify-center py-2">
              <img src="/assets/logo.png" alt="한국기독교장로회 로고" className="h-16 object-contain" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">스마트폰 전용 PWA 서비스</h2>
              <p className="text-indigo-400 text-sm font-extrabold leading-relaxed">
                한국기독교장로회 목회자를 위한 주소록앱 입니다.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                본 서비스는 스마트폰 화면(Android / iOS)에 최적화된 **스마트폰 전용 디지털 서비스**입니다. 
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-5 flex flex-col items-center gap-3">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://my.prok.or.kr" 
                alt="QR Code" 
                className="w-40 h-40 rounded-2xl bg-white p-2 shadow-md border border-slate-800" 
              />
              <span className="text-[14px] text-indigo-400 font-extrabold tracking-wide uppercase select-all">
                my.prok.or.kr
              </span>
              <span className="text-[11px] text-slate-400 font-bold">
                위 QR 코드를 카메라로 스캔하여<br/>스마트폰에서 바로 접속해 주세요.
              </span>
            </div>

            <div className="pt-4 border-t border-slate-900/60 flex flex-col gap-3">
              <div className="text-[12px] text-slate-500 leading-normal">
                교회 코드 인증 및 주보 관리는 스마트폰 PWA 설치 후 간편하게 사용할 수 있습니다.
              </div>
              
              <a 
                href="/admin" 
                className="inline-flex items-center justify-center gap-1.5 w-full py-4 bg-slate-900 text-slate-300 font-bold rounded-2xl border border-slate-800 hover:bg-slate-850 hover:text-white transition-all text-[14px]"
              >
                <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                관리자이신가요? 관리자 모드 바로가기
              </a>
            </div>
          </div>
        </main>

        <footer className="w-full text-center py-4 border-t border-slate-900/40">
          <p className="text-[11px] text-slate-600 font-medium">
            &copy; 2026 한국기독교장로회 총회유지재단. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased flex flex-col justify-between">
      {/* Invisible reCAPTCHA Container */}
      <div id="recaptcha-container"></div>

      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-variant flex items-center justify-center px-6 py-4">
        <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary tracking-tight">본인인증 로그인</h1>
      </header>

      <main className="pt-24 px-6 pb-12 max-w-md mx-auto w-full space-y-8 animate-fade-in flex-grow flex flex-col justify-center">
        <div className="text-center pb-4">
          <div className="mx-auto mb-6 flex items-center justify-center">
            <img src="/assets/logo.png" alt="한국기독교장로회 로고" className="h-14 object-contain" />
          </div>
          <h2 className="font-['Manrope',_'Pretendard'] text-2xl font-bold text-primary mb-2">실명 본인인증</h2>
          <p className="text-sm font-extrabold text-indigo-600 mb-2 leading-relaxed">
            한국기독교장로회 목회자를 위한 주소록앱 입니다.
          </p>
          <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
            안전한 기장주소록 이용을 위해<br />
            총회 데이터베이스에 등록된 본인 휴대폰 번호로 인증하세요.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.08)] border border-slate-150 space-y-7">
          {/* 1단계: 전화번호 입력창 */}
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="flex flex-col gap-3">
              <label htmlFor="login-phone-input" className="text-[14px] font-bold text-slate-600 uppercase tracking-wider pl-1">
                휴대폰 번호 입력
              </label>
              <input
                id="login-phone-input"
                type="tel"
                placeholder="예: 010-1234-5678"
                value={phoneNumber}
                onChange={handlePhoneChange}
                disabled={isCodeSent || loading}
                className="w-full bg-surface-container-low rounded-2xl px-5 py-5 text-[18px] text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-3 focus:ring-secondary/50 focus:bg-white transition-all disabled:opacity-60 font-bold border-2 border-slate-200"
              />
              {!isCodeSent && (
                <button
                  type="submit"
                  disabled={loading || phoneNumber.replace(/[^0-9]/g, '').length < 10}
                  className="w-full bg-secondary text-white py-4.5 font-extrabold rounded-2xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 text-[18px] shadow-md shadow-secondary/20 text-center"
                >
                  {loading ? '인증요청 전송 중...' : '여기를 눌러서 인증요청 하기'}
                </button>
              )}
            </div>
          </form>

          {/* 2단계: 인증코드 입력창 (인증번호 전송 시 활성화) */}
          {isCodeSent && (
            <form onSubmit={handleVerifyCode} className="space-y-6 animate-slide-up">
              <div className="flex flex-col gap-3 relative">
                <div className="flex justify-between items-center pl-1">
                  <label htmlFor="verification-code-input" className="text-[14px] font-bold text-slate-600 uppercase tracking-wider">
                    인증번호 6자리 입력
                  </label>
                  <span className={`text-[14px] font-extrabold px-3 py-1 bg-slate-100 rounded-lg ${timer < 60 ? 'text-error bg-red-50 border border-red-100 animate-pulse' : 'text-secondary'}`}>
                    남은시간 {formatTime(timer)}
                  </span>
                </div>
                <input
                  id="verification-code-input"
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="인증번호 6자리를 입력하세요"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={loading || timer === 0}
                  className="w-full bg-surface-container-low rounded-2xl px-5 py-5 text-[22px] text-on-surface tracking-[0.4em] text-center font-black placeholder:tracking-normal placeholder:font-normal placeholder:text-outline-variant focus:outline-none focus:ring-3 focus:ring-secondary/50 focus:bg-white transition-all disabled:opacity-60 border-2 border-secondary/30"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6 || timer === 0}
                  className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 text-[19px] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-xl font-bold">progress_activity</span>
                      확인 중... 잠시만 기다려주세요
                    </>
                  ) : (
                    '인증 및 로그인 완료하기'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl active:scale-95 transition-all text-[15px] border border-slate-200 text-center"
                >
                  인증번호가 안 오나요? (인증번호 재전송)
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 에러 피드백 영역 */}
        {error && (
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-error-container text-on-error-container rounded-2xl text-sm font-medium animate-shake text-center leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[18px]">error</span>
              인증 안내
            </div>
            <span>{error}</span>
            {unregistered && (
              <a
                href="tel:02-708-4000"
                className="mt-2 inline-flex items-center gap-1 bg-white text-error px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                총회 본부 정보수정 요청 (02-708-4000)
              </a>
            )}
          </div>
        )}
      </main>

      <footer className="w-full py-6 text-center border-t border-surface-variant/30 bg-white/50">
        <p className="text-[12px] text-outline leading-relaxed px-6">
          기장주소록의 본인인증은 개인정보보호법에 의거하여<br />
          목회자/장로 데이터 대조 용도로만 엄격히 검증 처리됩니다.
        </p>
      </footer>
    </div>
  );
};

export default SimpleLogin;

