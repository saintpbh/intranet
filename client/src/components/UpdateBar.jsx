import { useState, useEffect } from 'react';
import { subscribe, dismissNotifGuide } from '../utils/swManager';
import { requestNotificationPermission } from '../firebase';
import API_BASE from '../api';

/**
 * UpdateBar — 타이틀바 바로 아래에 렌더링
 * 
 * Features:
 * 1. 앏은 프로그레스바: 업데이트 진행 중 표시 (shimmer 효과)
 * 2. 오프라인 인디케이터: 작은 바 형태
 * 3. 푸시 알림 설정 안내 모달
 * 
 * ⚠ 다른 UI를 절대 건드리지 않음 — fixed 위치에서 overlay
 */

const UpdateBar = () => {
  const [sw, setSw] = useState({
    phase: 'idle',
    progress: 0,
    isOnline: navigator.onLine,
    showNotifGuide: false,
  });

  useEffect(() => {
    return subscribe(setSw);
  }, []);

  const showBar = sw.phase === 'downloading' || sw.phase === 'activating' || sw.phase === 'done';
  const showOffline = !sw.isOnline;

  return (
    <>
      {/* ── Progress Bar ── (타이틀바 바로 아래, 높이 3px) */}
      <div
        style={{
          position: 'fixed',
          top: 64,       // MobileHeader 높이 바로 아래
          left: 0,
          right: 0,
          zIndex: 9999,
          height: showBar ? 3 : 0,
          overflow: 'hidden',
          transition: 'height 0.3s ease',
          pointerEvents: 'none',
        }}
      >
        {/* Track */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 37, 64, 0.06)',
        }} />
        {/* Fill */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${sw.progress}%`,
          background: sw.phase === 'done'
            ? 'linear-gradient(90deg, #34C759, #30D158)'
            : 'linear-gradient(90deg, #0070EB, #00BFFF, #0070EB)',
          backgroundSize: '200% 100%',
          animation: sw.phase !== 'done'
            ? 'shimmer 1.5s ease-in-out infinite'
            : 'none',
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* ── Offline Indicator ── (프로그레스바 바로 아래, 아주 작게) */}
      <div
        style={{
          position: 'fixed',
          top: showBar ? 67 : 64,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9998,
          transition: 'all 0.3s ease, opacity 0.3s ease, top 0.3s ease',
          opacity: showOffline ? 1 : 0,
          pointerEvents: showOffline ? 'auto' : 'none',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 10px',
          borderRadius: '0 0 8px 8px',
          background: 'rgba(200, 60, 60, 0.9)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif",
          letterSpacing: '0.02em',
          boxShadow: '0 2px 8px rgba(200, 60, 60, 0.25)',
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#ff6b6b',
            animation: 'pulse 2s ease-in-out infinite',
            flexShrink: 0,
          }} />
          오프라인
        </div>
      </div>

      {/* ── 푸시 알림 안내 모달 ── (최초 방문/미설정 사용자) */}
      {sw.showNotifGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            padding: '0 16px 80px',
            animation: 'fadeIn 0.3s ease',
          }}
          onClick={dismissNotifGuide}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 380,
              background: '#fff',
              borderRadius: 20,
              padding: '28px 24px 20px',
              boxShadow: '0 20px 60px rgba(10,37,64,0.2), 0 8px 24px rgba(10,37,64,0.1)',
              animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0070EB, #00BFFF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 20px rgba(0, 112, 235, 0.25)',
            }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 24 }}>
                notifications_active
              </span>
            </div>
            
            <h3 style={{
              textAlign: 'center',
              fontFamily: "'Manrope', 'Pretendard', sans-serif",
              fontWeight: 800,
              fontSize: 18,
              color: '#0A2540',
              marginBottom: 8,
            }}>
              총회 소식을 놓치지 마세요
            </h3>
            
            <p style={{
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif",
              fontSize: 13,
              color: '#6B7280',
              lineHeight: 1.6,
              marginBottom: 24,
            }}>
              알림을 허용하면 새 공지사항이 등록될 때<br/>
              휴대폰으로 바로 알려드립니다.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={dismissNotifGuide}
                style={{
                  flex: 1,
                  padding: '13px 0',
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  background: 'transparent',
                  color: '#6B7280',
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif",
                  cursor: 'pointer',
                }}
              >
                나중에
              </button>
              <button
                onClick={() => {
                  requestNotificationPermission(API_BASE);
                  dismissNotifGuide();
                }}
                style={{
                  flex: 1.4,
                  padding: '13px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0070EB, #0058BC)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif",
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 112, 235, 0.3)',
                }}
              >
                알림 허용하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default UpdateBar;
