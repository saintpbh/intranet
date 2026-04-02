import { Copy, ExternalLink, Share2, MapPin, X } from 'lucide-react';

export default function ContextMenu({ church, position, onClose }) {
  if (!church || !position) return null;

  const naverMapUrl = `https://map.naver.com/p/search/${encodeURIComponent(church.name)}?c=${church.lng},${church.lat},15,0,0,0,dh`;
  const kakaoMapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(church.name)},${church.lat},${church.lng}`;
  const shareText = `📍 ${church.name}\n${church.address || ''}\n${church.pastor_name ? '담임: ' + church.pastor_name + ' 목사' : ''}\n\n네이버지도: ${naverMapUrl}`;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(church.address || church.name);
      alert('주소가 복사되었습니다.');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = church.address || church.name;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('주소가 복사되었습니다.');
    }
    onClose();
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: church.name,
          text: shareText,
          url: naverMapUrl,
        });
      } catch (e) {
        if (e.name !== 'AbortError') {
          handleCopyAddress();
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        alert('공유 정보가 클립보드에 복사되었습니다.');
      } catch {
        alert('이 브라우저에서는 공유 기능을 사용할 수 없습니다.');
      }
    }
    onClose();
  };

  const menuItems = [
    {
      icon: <ExternalLink size={16} />,
      label: '네이버 지도로 보기',
      color: '#00c73c',
      onClick: () => { window.open(naverMapUrl, '_blank'); onClose(); }
    },
    {
      icon: <MapPin size={16} />,
      label: '카카오맵으로 보기',
      color: '#fee500',
      onClick: () => { window.open(kakaoMapUrl, '_blank'); onClose(); }
    },
    { divider: true },
    {
      icon: <Copy size={16} />,
      label: '주소 복사',
      color: '#95aaff',
      onClick: handleCopyAddress
    },
    {
      icon: <Share2 size={16} />,
      label: '위치 공유하기',
      color: '#00eefc',
      onClick: handleWebShare
    },
  ];

  // Clamp menu position so it stays visible
  const menuStyle = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 220),
    top: Math.min(position.y, window.innerHeight - 280),
    zIndex: 9999,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />

      {/* Menu */}
      <div style={menuStyle} className="animate-in fade-in zoom-in-95 duration-200 origin-top-left">
        <div style={{ background: 'rgba(20,20,25,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(149,170,255,0.2)', boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 24px rgba(55,102,255,0.1)' }}
          className="rounded-2xl overflow-hidden min-w-[200px]"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm truncate max-w-[160px]">{church.name}</span>
              <span className="text-[11px] text-gray-400 truncate max-w-[160px]">{church.address?.slice(0, 30)}</span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
              <X size={14} />
            </button>
          </div>

          {/* Items */}
          <div className="py-1">
            {menuItems.map((item, i) => 
              item.divider ? (
                <div key={i} className="h-px bg-white/5 mx-3 my-1" />
              ) : (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                >
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <span className="text-sm font-medium text-gray-200">{item.label}</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
