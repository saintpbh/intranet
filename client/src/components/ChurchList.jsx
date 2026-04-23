import API_BASE from '../api';
import { useState, useEffect, useRef } from 'react';

/**
 * 주소 → 좌표 변환 캐시 (세션 내 중복 요청 방지)
 * Nominatim rate limit: 1 req/sec — 캐시 + 딜레이로 준수
 */
const geocodeCache = {};

async function geocodeAddress(address) {
  if (!address) return null;
  // 캐시 히트
  const key = address.trim();
  if (geocodeCache[key] !== undefined) return geocodeCache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(key)}&countrycodes=kr&limit=1`,
      { headers: { 'Accept-Language': 'ko' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache[key] = coords;
      return coords;
    }
  } catch (err) {
    console.warn('Geocode failed:', err);
  }
  geocodeCache[key] = null;
  return null;
}

/**
 * OpenStreetMap 정적 지도 이미지 컴포넌트
 * 주소를 기반으로 geocoding → OSM 타일로 배경 지도 렌더링
 */
const StaticMapBackground = ({ address, className }) => {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!address) { setFailed(true); return; }
    let cancelled = false;

    const renderMap = async () => {
      const coords = await geocodeAddress(address);
      if (cancelled) return;
      if (!coords) { setFailed(true); return; }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      // OSM tile 계산 (zoom level 15)
      const zoom = 15;
      const n = Math.pow(2, zoom);
      const xTile = Math.floor((coords.lng + 180) / 360 * n);
      const latRad = coords.lat * Math.PI / 180;
      const yTile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

      // 3x2 타일 그리드 (가로 3, 세로 2)
      const tileSize = 256;
      canvas.width = tileSize * 3;
      canvas.height = tileSize * 2;

      let tilesLoaded = 0;
      const totalTiles = 6;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
          const tx = xTile + dx;
          const ty = yTile + dy;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          // OSM 타일 서버 (a/b/c 라운드 로빈)
          const server = ['a', 'b', 'c'][(dx + 1 + dy * 3) % 3];
          img.src = `https://${server}.tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
          img.onload = () => {
            if (cancelled) return;
            ctx.drawImage(img, (dx + 1) * tileSize, dy * tileSize, tileSize, tileSize);
            tilesLoaded++;
            if (tilesLoaded === totalTiles) {
              // 중앙에 마커 표시
              const cx = canvas.width / 2;
              const cy = canvas.height / 2;
              
              // 마커 핀 그림자
              ctx.save();
              ctx.beginPath();
              ctx.ellipse(cx, cy + 18, 8, 4, 0, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.fill();
              
              // 마커 핀 본체
              ctx.beginPath();
              ctx.arc(cx, cy - 8, 12, Math.PI, 0, false);
              ctx.quadraticCurveTo(cx + 12, cy + 4, cx, cy + 18);
              ctx.quadraticCurveTo(cx - 12, cy + 4, cx - 12, cy - 8);
              ctx.fillStyle = '#E53935';
              ctx.fill();
              ctx.strokeStyle = '#B71C1C';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              
              // 마커 내부 원
              ctx.beginPath();
              ctx.arc(cx, cy - 6, 5, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.restore();
              
              setLoaded(true);
            }
          };
          img.onerror = () => {
            tilesLoaded++;
            if (tilesLoaded === totalTiles && !loaded) {
              setFailed(true);
            }
          };
        }
      }
    };

    // Rate-limit 준수: 약간의 랜덤 딜레이
    const delay = Math.random() * 500;
    const timer = setTimeout(renderMap, delay);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [address]);

  if (failed || !address) {
    return (
      <div className={`${className} bg-gradient-to-br from-surface-container-low to-surface-container flex items-center justify-center`}>
        <span className="material-symbols-outlined text-5xl text-outline-variant/30">account_balance</span>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden bg-surface-container-low`}>
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectFit: 'cover' }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-outline-variant/30 border-t-secondary rounded-full animate-spin" />
        </div>
      )}
      {/* 하단 그라데이션 페이드 */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-60" />
    </div>
  );
};

const ChurchList = ({ searchTerm, onSelect }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') { setData([]); return; }
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/churches?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          if (errData.error === 'db_connection_failed') {
            setError('DB연결 오류! 데이터베이스 서버에 접속할 수 없습니다. 다른 기능은 계속 사용 가능합니다.');
          } else {
            setError(errData.message || '서버 오류가 발생했습니다.');
          }
          return;
        }
        const json = await response.json();
        if (json.error) {
          setError(json.error === 'db_connection_failed' ? 'DB연결 오류! 데이터베이스에 접속할 수 없습니다.' : json.error);
          return;
        }
        setData(json);
      } catch (err) { setError('네트워크 오류 — 서버에 연결할 수 없습니다.'); } finally { setLoading(false); }
    };
    fetchData();
  }, [searchTerm]);

  if (!searchTerm || searchTerm.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>church</span>
        <p className="text-on-surface-variant font-medium">이름, 노회명, 교회명으로 검색해 주세요.</p>
      </div>
    );
  }
  
  if (loading) return <div className="text-center py-12 text-on-surface-variant font-medium">검색 중...</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="material-symbols-outlined text-5xl text-amber-500 mb-3" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>cloud_off</span>
      <p className="text-error font-bold text-base mb-1">연결 오류</p>
      <p className="text-on-surface-variant text-sm max-w-xs">{error}</p>
    </div>
  );
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>search_off</span>
      <p className="text-on-surface-variant font-medium">검색 결과가 없습니다.</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-surface-container-lowest">
      <div className="flex items-end justify-between mb-6">
        <div>
          <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">소속 교회</span>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-2xl text-primary">교회 목록 <span className="text-sm font-medium text-outline ml-2">{data.length}개</span></h3>
        </div>
      </div>
      
      <div className="space-y-4">
        {data.map((item, idx) => {
          const address = item.ADDRESS || '';
          return (
            <div 
              key={idx} 
              onClick={() => onSelect(item)}
              className="bg-white border border-surface-variant/50 rounded-2xl flex flex-col overflow-hidden shadow-[0_10px_20px_rgba(10,37,64,0.03)] hover:shadow-[0_20px_40px_rgba(10,37,64,0.06)] hover:border-secondary/30 transition-all cursor-pointer active:scale-[0.98] group"
            >
              {/* 지도 배경 영역 */}
              <StaticMapBackground 
                address={address} 
                className="h-28 sm:h-32 w-full flex-shrink-0"
              />
              <div className="p-5 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[11px] font-bold tracking-wide">{item.NOHNAME}</span>
                  <h4 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary truncate leading-tight">{item.CHRNAME?.trim()}</h4>
                </div>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mb-1 font-medium truncate">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  담임: {item.MOCKNAME || '미배정'}
                </p>
                <p className="text-xs text-outline flex items-center gap-1 font-medium truncate">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {address ? address.split(' ').slice(0, 3).join(' ') : '주소 미등록'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChurchList;
