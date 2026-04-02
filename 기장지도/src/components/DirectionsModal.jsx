import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Car, Train, Bike, Footprints, Navigation, Loader2, Clock, Fuel, Banknote, AlertCircle, MapPin, Search, Share2, Copy, Check, ExternalLink, Info } from 'lucide-react';

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ROUTE_OPTIONS = [
  { key: 'trafast', label: '빠른 길', color: '#2B3990' }, // Faith Blue
  { key: 'tracomfort', label: '편한 길', color: '#00A5D9' }, // Hope Cyan
  { key: 'traoptimal', label: '최적 경로', color: '#662483' }, // Grace Purple
];

const TRANSPORT_MODES = [
  { key: 'car',     label: '자가용',   icon: Car,        color: '#2B3990', speed: null,  strokeStyle: 'solid',     strokeWeight: 7 },
  { key: 'transit', label: '대중교통', icon: Train,      color: '#00A5D9', speed: 25,    strokeStyle: 'shortdot',  strokeWeight: 5 },
  { key: 'bike',    label: '자전거',   icon: Bike,       color: '#662483', speed: 15,    strokeStyle: 'shortdash', strokeWeight: 5 },
  { key: 'walk',    label: '걸어서',   icon: Footprints, color: '#10b981', speed: 4.5,   strokeStyle: 'dot',       strokeWeight: 4 },
];

export default function DirectionsPanel({ church, userLocation, onClose, mapInstance }) {
  // Departure
  const [departureLocation, setDepartureLocation] = useState(userLocation || null);
  const [addressInput, setAddressInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [departureName, setDepartureName] = useState(userLocation ? '현재 위치' : '');

  // Transport & Route
  const [transportMode, setTransportMode] = useState('car');
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState(null); // cached API response (Naver Car)
  const [transitData, setTransitData] = useState(null); // cached ODsay transit response
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState('trafast');

  // Share
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Map overlays
  const polylineRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  const distKm = departureLocation ? haversineKm(departureLocation.lat, departureLocation.lng, church.lat, church.lng) : null;
  const currentTransport = TRANSPORT_MODES.find(m => m.key === transportMode);

  // The currently active route info from the API
  const currentRoute = routeData?.[selectedOption]?.[0];
  // Real road distance from API (in meters)
  const roadDistanceM = currentRoute?.summary?.distance;
  const roadDistanceKm = roadDistanceM ? roadDistanceM / 1000 : null;

  useEffect(() => { return () => clearMapOverlays(); }, []);

  const clearMapOverlays = () => {
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (startMarkerRef.current) { startMarkerRef.current.setMap(null); startMarkerRef.current = null; }
    if (endMarkerRef.current) { endMarkerRef.current.setMap(null); endMarkerRef.current = null; }
  };

  // === Departure ===
  const handleUseCurrentLocation = () => {
    if (userLocation) {
      setDepartureLocation(userLocation);
      setDepartureName('현재 위치');
      setAddressInput('');
      setGeocodeError('');
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDepartureLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setDepartureName('현재 위치');
        },
        () => setGeocodeError('위치 정보를 가져올 수 없습니다.'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleGeocodeAddress = async () => {
    if (!addressInput.trim()) return;
    setGeocoding(true);
    setGeocodeError('');
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(addressInput.trim())}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.addresses?.length > 0) {
        const addr = data.addresses[0];
        setDepartureLocation({ lat: parseFloat(addr.y), lng: parseFloat(addr.x) });
        setDepartureName(addr.roadAddress || addr.jibunAddress || addressInput.trim());
        setGeocodeError('');
      } else {
        setGeocodeError('주소를 찾을 수 없습니다.');
      }
    } catch {
      setGeocodeError('주소 검색 중 오류가 발생했습니다.');
    } finally {
      setGeocoding(false);
    }
  };

  const resetDeparture = () => {
    setDepartureLocation(null);
    setRouteData(null);
    setTransitData(null);
    setDepartureName('');
    setError(null);
    clearMapOverlays();
  };

  // === Fetch Directions ===
  const fetchDirections = useCallback(async () => {
    if (!departureLocation) return;
    setLoading(true);
    setError(null);
    try {
      const start = `${departureLocation.lng},${departureLocation.lat}`;
      const goal = `${church.lng},${church.lat}`;
      const option = ROUTE_OPTIONS.map(o => o.key).join(':');

      const carPromise = fetch(`/api/directions?start=${start}&goal=${goal}&option=${option}`).then(async res => {
        if (!res.ok) throw new Error(`API 응답 오류 (${res.status})`);
        const data = await res.json();
        if (data.code !== 0) throw new Error(data.message || '경로를 찾을 수 없습니다.');
        return data.route;
      });

      const transitPromise = fetch(`/api/odsay/searchPubTransPathT?apiKey=${encodeURIComponent('eYawE4okt4BXYtz+Y/DeZA')}&SX=${departureLocation.lng}&SY=${departureLocation.lat}&EX=${church.lng}&EY=${church.lat}`).then(r => r.json()).then(async data => {
        if (data.result?.path?.length > 0) {
          const mainPath = data.result.path[0];
          const mapObj = mainPath.info.mapObj;
          if (mapObj) {
            try {
              const graphRes = await fetch(`/api/odsay/loadLane?apiKey=${encodeURIComponent('eYawE4okt4BXYtz+Y/DeZA')}&mapObject=0:0@${mapObj}`);
              const graphData = await graphRes.json();
              if (graphData.result?.lane) {
                mainPath.graphicData = graphData.result.lane;
              }
            } catch (e) {
              console.warn('Failed to fetch ODsay graphic data', e);
            }
          }
          return mainPath;
        }
        return null;
      }).catch(e => {
        console.warn('ODsay fetch error', e);
        return null;
      });

      const [loadedCarData, loadedTransitData] = await Promise.all([carPromise, transitPromise]);
      
      setRouteData(loadedCarData);
      setTransitData(loadedTransitData);
      
      drawRouteOnMap(transportMode, loadedCarData, loadedTransitData, selectedOption);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [departureLocation, church, transportMode, selectedOption]);

  // Fetch on departure change (once, then reuse for all modes)
  useEffect(() => {
    if (departureLocation) {
      setRouteData(null);
      fetchDirections();
    }
  }, [departureLocation]);

  // Redraw when transport mode changes (reuse cached route data)
  useEffect(() => {
    if (routeData) {
      drawRouteOnMap(transportMode, routeData, transitData, selectedOption);
    }
  }, [transportMode]);

  // === Draw Route ===
  const drawRouteOnMap = (mode, carRouteData, transitRouteData, optionKey) => {
    if (!mapInstance || !window.naver?.maps) return;
    clearMapOverlays();
    
    let naverPath = [];
    let startLoc = departureLocation;
    let endLoc = church;

    if (mode === 'transit' && transitRouteData) {
      // Draw ODsay transit route
      if (transitRouteData.graphicData) {
        transitRouteData.graphicData.forEach(lane => {
          lane.section.forEach(sec => {
            sec.graphPos.forEach(pos => {
              naverPath.push(new window.naver.maps.LatLng(pos.y, pos.x));
            });
          });
        });
      }
    } else {
      // Car, Walk, Bike uses Naver Path
      const routeOption = carRouteData?.[optionKey];
      if (routeOption?.[0]?.path) {
        naverPath = routeOption[0].path.map(([lng, lat]) => new window.naver.maps.LatLng(lat, lng));
      }
    }

    // Only fallback to straight line if absolutely no path
    if (naverPath.length === 0) {
      naverPath = [
        new window.naver.maps.LatLng(startLoc.lat, startLoc.lng),
        new window.naver.maps.LatLng(endLoc.lat, endLoc.lng)
      ];
    }
    const transport = TRANSPORT_MODES.find(m => m.key === mode);

    polylineRef.current = new window.naver.maps.Polyline({
      map: mapInstance, path: naverPath,
      strokeColor: transport.color,
      strokeWeight: transport.strokeWeight,
      strokeOpacity: mode === 'car' ? 0.9 : 0.7,
      strokeLineCap: 'round', strokeLineJoin: 'round',
      strokeStyle: transport.strokeStyle,
    });

    // Start marker
    startMarkerRef.current = new window.naver.maps.Marker({
      position: naverPath[0], map: mapInstance, zIndex: 300,
      icon: {
        content: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:20px;height:20px;background:#00c73c;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(0,199,60,0.5);"></div>
          <div style="background:#00c73c;color:white;font-size:10px;font-weight:900;padding:2px 8px;border-radius:8px;margin-top:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);">출발</div>
        </div>`,
        anchor: new window.naver.maps.Point(10, 10),
      },
    });

    // End marker
    endMarkerRef.current = new window.naver.maps.Marker({
      position: naverPath[naverPath.length - 1], map: mapInstance, zIndex: 300,
      icon: {
        content: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:20px;height:20px;background:#ff4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(255,68,68,0.5);"></div>
          <div style="background:#ff4444;color:white;font-size:10px;font-weight:900;padding:2px 8px;border-radius:8px;margin-top:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);">도착</div>
        </div>`,
        anchor: new window.naver.maps.Point(10, 10),
      },
    });

    const bounds = new window.naver.maps.LatLngBounds();
    naverPath.forEach(p => bounds.extend(p));
    mapInstance.fitBounds(bounds, { top: 80, bottom: 60, left: 420, right: 40 });
  };

  const handleOptionChange = (optionKey) => {
    setSelectedOption(optionKey);
    if (routeData) drawRouteOnMap(transportMode, routeData, transitData, optionKey);
  };

  const handleTransportChange = (modeKey) => {
    setTransportMode(modeKey);
    setSelectedOption('trafast');
  };

  const handleClose = () => { clearMapOverlays(); onClose(); };

  // === Computed values for non-car modes ===
  const getEstimatedTime = (mode) => {
    // Use real road distance from API for better estimate
    const dist = roadDistanceKm || (distKm ? distKm * 1.3 : null); // fallback: straight * 1.3
    if (!dist || !mode.speed) return null;
    return Math.round((dist / mode.speed) * 60); // minutes
  };

  const getCaloriesBurned = (mode, distanceKm) => {
    // Rough calorie estimates per km
    const calPerKm = { walk: 65, bike: 30, transit: 0 };
    const cal = calPerKm[mode.key];
    if (!cal || !distanceKm) return null;
    return Math.round(cal * distanceKm);
  };

  // === Share ===
  const getShareText = () => {
    let text = `📍 ${church.name} 길 찾기\n`;
    if (departureName) text += `출발: ${departureName}\n`;
    if (transportMode === 'car' && currentRoute) {
      text += `🚗 자가용: ${formatDuration(currentRoute.summary.duration)}, ${formatDistance(currentRoute.summary.distance)}\n`;
    } else if (transportMode === 'transit' && transitData) {
      text += `🚌 대중교통: 약 ${transitData.info.totalTime}분, ${formatWon(transitData.info.payment)}\n`;
    } else if (roadDistanceKm && currentTransport.speed) {
      const min = getEstimatedTime(currentTransport);
      text += `${currentTransport.label}: ${formatMinutes(min)}, ${roadDistanceKm.toFixed(1)}km (도로거리)\n`;
    }
    text += `주소: ${church.address || ''}`;
    return text;
  };

  const getNaverMapUrl = () => {
    const modeMap = { car: 'car', transit: 'transit', bike: 'bicycle', walk: 'walk' };
    const mode = modeMap[transportMode] || 'car';
    if (departureLocation) {
      return `https://map.naver.com/p/directions/${departureLocation.lng},${departureLocation.lat},${encodeURIComponent(departureName || '출발지')},,,/${church.lng},${church.lat},${encodeURIComponent(church.name)},,,/${mode}`;
    }
    return `https://map.naver.com/p/search/${encodeURIComponent(church.name)}`;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `${church.name} 길 찾기`, text: getShareText(), url: getNaverMapUrl() }); } catch {}
    } else {
      setShowShareMenu(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareText() + '\n' + getNaverMapUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // === Formatters ===
  const formatDuration = (ms) => {
    const m = Math.round(ms / 1000 / 60);
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    return (m % 60) > 0 ? `${h}시간 ${m % 60}분` : `${h}시간`;
  };
  const formatMinutes = (min) => {
    if (!min) return '-';
    if (min < 60) return `약 ${min}분`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`;
  };
  const formatDistance = (m) => m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
  const formatWon = (n) => !n ? '0원' : n.toLocaleString() + '원';

  return (
    <div className="absolute top-0 left-0 bottom-0 z-[200] flex animate-in slide-in-from-left duration-300" style={{ width: '400px', maxWidth: '90vw' }}>
      <div className="w-full h-full flex flex-col overflow-hidden" style={{
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        borderRight: '1px solid rgba(0,0,0,0.08)', boxShadow: '4px 0 32px rgba(0,0,0,0.1)',
      }}>

        {/* ===== HEADER ===== */}
        <div className="shrink-0 p-4 pb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(55,102,255,0.08)' }}>
                <Navigation size={16} style={{ color: '#3766ff' }} />
              </div>
              <h3 className="font-extrabold text-[17px]" style={{ color: '#1a1a1a' }}>길 찾기</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <button onClick={handleShare} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
                  style={{ background: 'rgba(55,102,255,0.06)', border: '1px solid rgba(55,102,255,0.12)' }} title="공유하기">
                  <Share2 size={15} style={{ color: '#3766ff' }} />
                </button>
                {showShareMenu && (
                  <div className="absolute top-11 right-0 z-50 w-52 py-1.5 rounded-2xl animate-in fade-in zoom-in-95 duration-200"
                    style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
                    <button onClick={() => { handleCopyLink(); setShowShareMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium hover:bg-black/3 transition-colors" style={{ color: '#1a1a1a' }}>
                      {copied ? <Check size={15} style={{ color: '#00c73c' }} /> : <Copy size={15} style={{ color: '#888' }} />}
                      {copied ? '복사 완료!' : '경로 정보 복사'}
                    </button>
                    <button onClick={() => { window.open(getNaverMapUrl(), '_blank'); setShowShareMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium hover:bg-black/3 transition-colors" style={{ color: '#1a1a1a' }}>
                      <ExternalLink size={15} style={{ color: '#00c73c' }} /> 네이버 지도로 열기
                    </button>
                    <button onClick={() => { window.open(`https://map.kakao.com/link/to/${encodeURIComponent(church.name)},${church.lat},${church.lng}`, '_blank'); setShowShareMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium hover:bg-black/3 transition-colors" style={{ color: '#1a1a1a' }}>
                      <ExternalLink size={15} style={{ color: '#fee500' }} /> 카카오맵으로 열기
                    </button>
                    <div className="border-t border-black/5 mt-1 pt-1">
                      <button onClick={() => setShowShareMenu(false)} className="w-full text-center text-[12px] font-medium py-1.5 hover:bg-black/3 transition-colors" style={{ color: '#999' }}>닫기</button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={handleClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <X size={16} style={{ color: '#666' }} />
              </button>
            </div>
          </div>

          {/* Transport Mode Tabs */}
          <div className="flex gap-1 p-1 rounded-2xl mb-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
            {TRANSPORT_MODES.map(mode => {
              const Icon = mode.icon;
              const active = transportMode === mode.key;
              return (
                <button key={mode.key} onClick={() => handleTransportChange(mode.key)}
                  className="flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-200"
                  style={active ? { background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1.5px solid ${mode.color}30` } : { border: '1.5px solid transparent' }}>
                  <Icon size={16} style={{ color: active ? mode.color : '#aaa' }} />
                  <span className="text-[10px] font-bold" style={{ color: active ? mode.color : '#999' }}>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Departure / Destination */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#00c73c', boxShadow: '0 0 6px rgba(0,199,60,0.4)' }}></div>
              <div className="flex-1 min-w-0">
                {departureLocation ? (
                  <button onClick={resetDeparture} className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium truncate hover:bg-black/3 transition-colors"
                    style={{ background: 'rgba(0,199,60,0.05)', border: '1px solid rgba(0,199,60,0.15)', color: '#1a1a1a' }}>
                    {departureName || '출발지 설정됨'}
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button onClick={handleUseCurrentLocation} className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold hover:opacity-80 transition-opacity shrink-0"
                      style={{ background: 'rgba(55,102,255,0.06)', border: '1px solid rgba(55,102,255,0.15)', color: '#3766ff' }}>
                      <Navigation size={11} /> 현재 위치
                    </button>
                    <div className="flex-1 flex">
                      <input type="text" placeholder="출발지 주소 입력" value={addressInput}
                        onChange={(e) => setAddressInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGeocodeAddress()}
                        className="flex-1 min-w-0 px-2.5 py-2 rounded-l-xl text-[11px] font-medium"
                        style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', borderRight: 'none', color: '#1a1a1a', outline: 'none' }} />
                      <button onClick={handleGeocodeAddress} disabled={geocoding} className="px-2 rounded-r-xl flex items-center justify-center"
                        style={{ background: '#3766ff', color: 'white' }}>
                        {geocoding ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {geocodeError && <p className="text-[11px] font-medium pl-5" style={{ color: '#dc2626' }}>{geocodeError}</p>}
            <div className="pl-[5px] ml-[5px] h-3 w-[2px] rounded-full" style={{ background: 'rgba(0,0,0,0.1)' }}></div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#ff4444', boxShadow: '0 0 6px rgba(255,68,68,0.4)' }}></div>
              <div className="flex-1 px-3 py-2 rounded-xl text-[13px] font-bold truncate"
                style={{ background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.12)', color: '#1a1a1a' }}>
                {church.name}
                {distKm !== null && <span className="ml-1.5 text-xs font-bold" style={{ color: '#3766ff' }}>({distKm.toFixed(1)}km)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ===== CONTENT ===== */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {loading && (
            <div className="flex items-center justify-center gap-3 py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: '#3766ff' }} />
              <span className="text-sm font-medium" style={{ color: '#666' }}>경로를 검색 중...</span>
            </div>
          )}

          {error && !loading && (
            <div className="m-4 p-4 rounded-2xl flex items-center gap-3" style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.1)' }}>
              <AlertCircle size={18} style={{ color: '#dc2626' }} />
              <p className="text-sm font-medium" style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {!departureLocation && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(55,102,255,0.06)' }}>
                <MapPin size={24} style={{ color: '#3766ff' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>출발지를 선택해주세요</p>
              <p className="text-xs" style={{ color: '#999' }}>현재 위치 버튼을 누르거나<br/>주소를 직접 입력하세요</p>
            </div>
          )}

          {/* ===== CAR MODE ===== */}
          {transportMode === 'car' && currentRoute && !loading && (
            <div className="p-4 flex flex-col gap-3">
              <div className="flex gap-2">
                {ROUTE_OPTIONS.map(opt => {
                  const optRoute = routeData?.[opt.key]?.[0];
                  return (
                    <button key={opt.key} onClick={() => handleOptionChange(opt.key)}
                      className="flex-1 py-2.5 rounded-xl text-center transition-all"
                      style={selectedOption === opt.key ? {
                        background: opt.color + '10', color: opt.color,
                        border: `2px solid ${opt.color}50`, boxShadow: `0 2px 12px ${opt.color}20`,
                      } : { background: 'rgba(0,0,0,0.02)', color: '#888', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <span className="text-xs font-bold">{opt.label}</span>
                      {optRoute && <p className="text-[10px] font-medium mt-0.5" style={{ opacity: 0.8 }}>{formatDuration(optRoute.summary.duration)}</p>}
                    </button>
                  );
                })}
              </div>

              <div className="p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(55,102,255,0.04), rgba(107,140,255,0.06))', border: '1px solid rgba(55,102,255,0.1)' }}>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <Clock size={16} className="mx-auto mb-1" style={{ color: '#3766ff' }} />
                    <p className="text-2xl font-black" style={{ color: '#1a1a1a' }}>{formatDuration(currentRoute.summary.duration)}</p>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: '#888' }}>예상 소요시간</p>
                  </div>
                  <div className="w-px h-10" style={{ background: 'rgba(0,0,0,0.06)' }}></div>
                  <div className="text-center">
                    <Car size={16} className="mx-auto mb-1" style={{ color: '#666' }} />
                    <p className="text-2xl font-black" style={{ color: '#1a1a1a' }}>{formatDistance(currentRoute.summary.distance)}</p>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: '#888' }}>총 거리</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Banknote, color: '#ff9500', val: formatWon(currentRoute.summary.tollFare), label: '통행료' },
                  { icon: Fuel, color: '#00c73c', val: formatWon(currentRoute.summary.fuelPrice), label: '유류비' },
                  { icon: Car, color: '#888', val: formatWon(currentRoute.summary.taxiFare), label: '택시요금' },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl text-center" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <item.icon size={14} className="mx-auto mb-1" style={{ color: item.color }} />
                    <p className="text-xs font-bold" style={{ color: '#1a1a1a' }}>{item.val}</p>
                    <p className="text-[10px]" style={{ color: '#999' }}>{item.label}</p>
                  </div>
                ))}
              </div>

              {currentRoute.guide?.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs font-extrabold mb-2 uppercase tracking-wider" style={{ color: '#3766ff' }}>주행 안내</p>
                  <div className="flex flex-col gap-0.5 rounded-2xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    {currentRoute.guide.map((g, i) => (
                      <div key={i} className="flex items-center gap-2.5 py-2.5 px-3"
                        style={{ borderBottom: i < currentRoute.guide.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', background: i === 0 ? 'rgba(55,102,255,0.03)' : 'transparent' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-extrabold"
                          style={{ background: i === 0 ? '#3766ff' : 'rgba(0,0,0,0.06)', color: i === 0 ? 'white' : '#666' }}>{i + 1}</div>
                        <span className="text-[12px] font-medium flex-1 leading-snug" style={{ color: '#333' }}>{g.instructions}</span>
                        <span className="text-[10px] font-bold shrink-0 tabular-nums" style={{ color: '#999' }}>{formatDistance(g.distance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== NON-CAR MODES (transit/bike/walk) ===== */}
          {transportMode !== 'car' && (transportMode === 'transit' ? transitData : currentRoute) && !loading && (() => {
            const hasTransit = transportMode === 'transit' && transitData;
            
            const estMinutes = hasTransit ? transitData.info.totalTime : getEstimatedTime(currentTransport);
            const usedDistKm = hasTransit ? (transitData.info.totalDistance / 1000) : (roadDistanceKm || (distKm ? distKm * 1.3 : null));
            const calories = hasTransit ? null : getCaloriesBurned(currentTransport, usedDistKm);
            const Icon = currentTransport.icon;

            return (
              <div className="p-4 flex flex-col gap-3">
                {/* Main summary */}
                <div className="p-5 rounded-2xl" style={{ background: `${currentTransport.color}08`, border: `1px solid ${currentTransport.color}15` }}>
                  <div className="flex items-center justify-around">
                    <div className="text-center">
                      <Clock size={16} className="mx-auto mb-1" style={{ color: currentTransport.color }} />
                      <p className="text-2xl font-black" style={{ color: '#1a1a1a' }}>{formatMinutes(estMinutes)}</p>
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: '#888' }}>예상 소요시간</p>
                    </div>
                    <div className="w-px h-10" style={{ background: 'rgba(0,0,0,0.06)' }}></div>
                    <div className="text-center">
                      <Icon size={16} className="mx-auto mb-1" style={{ color: '#666' }} />
                      <p className="text-2xl font-black" style={{ color: '#1a1a1a' }}>{usedDistKm ? `${usedDistKm.toFixed(1)}km` : '-'}</p>
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: '#888' }}>총 거리</p>
                    </div>
                  </div>
                </div>

                {/* Extra info cards */}
                <div className="grid grid-cols-2 gap-2">
                  {hasTransit ? (
                    <>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: '#999' }}>대중교통 요금</p>
                        <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{formatWon(transitData.info.payment)}</p>
                      </div>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: '#999' }}>환승 및 도보</p>
                        <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{transitData.info.totalWalkTime}분 (도보)</p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Distance comparison */}
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: '#999' }}>직선 거리</p>
                        <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{distKm ? `${distKm.toFixed(1)}km` : '-'}</p>
                      </div>

                      {/* Calories (walk/bike only) */}
                      {calories ? (
                        <div className="p-3 rounded-xl" style={{ background: `${currentTransport.color}06`, border: `1px solid ${currentTransport.color}12` }}>
                          <p className="text-[10px] font-bold mb-1" style={{ color: '#999' }}>예상 소모 칼로리</p>
                          <p className="text-sm font-bold" style={{ color: currentTransport.color }}>{calories.toLocaleString()} kcal 🔥</p>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <p className="text-[10px] font-bold mb-1" style={{ color: '#999' }}>이동 속도</p>
                          <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>평균 {currentTransport.speed}km/h</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Info Text */}
                <div className="p-3 rounded-2xl flex items-start gap-2.5" style={{ background: hasTransit ? 'rgba(0,199,60,0.03)' : 'rgba(55,102,255,0.03)', border: hasTransit ? '1px solid rgba(0,199,60,0.08)' : '1px solid rgba(55,102,255,0.08)' }}>
                  <Info size={14} className="shrink-0 mt-0.5" style={{ color: hasTransit ? '#00c73c' : '#3766ff' }} />
                  <div className="text-[11px] leading-relaxed" style={{ color: '#666' }}>
                    {hasTransit ? (
                      <>
                        <span className="font-bold" style={{ color: '#00c73c' }}>실시간 대중교통 정보 (ODsay)</span>
                        <br/>
                        현재 시각을 기준으로 가장 빠른 대중교통 경로를 안내합니다. 교통 상황에 따라 오차가 있을 수 있습니다.
                      </>
                    ) : (
                      <>
                        <span className="font-bold" style={{ color: '#3766ff' }}>도로 경로 기반 추정</span>
                        <br/>
                        실제 자동차 도로 거리({usedDistKm?.toFixed(1)}km)를 기준으로
                        {currentTransport.label} 평균속도 {currentTransport.speed}km/h를 적용하여 계산한 시간입니다.
                      </>
                    )}
                  </div>
                </div>

                {/* Route guide */}
                <div className="mt-1">
                  <p className="text-xs font-extrabold mb-2 uppercase tracking-wider" style={{ color: currentTransport.color }}>경로 안내 {hasTransit ? '(대중교통)' : '(도로 기준)'}</p>
                  <div className="flex flex-col gap-0.5 rounded-2xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    
                    {/* Transit Guide */}
                    {hasTransit && transitData.subPath.filter(s => s.trafficType !== 3 || s.distance > 0).map((path, i) => {
                      let desc = '';
                      let label = '';
                      let color = '#888';
                      
                      if (path.trafficType === 3) {
                        label = '도보';
                        desc = `도보 이동 (${path.sectionTime}분)`;
                      } else if (path.trafficType === 1) {
                        label = '지하철';
                        color = '#3766ff';
                        desc = `[${path.lane?.[0]?.name}] ${path.startName} 승차 -> ${path.endName} 하차 (${path.stationCount}개 역)`;
                      } else if (path.trafficType === 2) {
                        label = '버스';
                        color = '#00c73c';
                        desc = `[${path.lane?.[0]?.busNo}] ${path.startName} 승차 -> ${path.endName} 하차 (${path.stationCount}개 정류장)`;
                      }

                      return (
                        <div key={i} className="flex items-center gap-2.5 py-2.5 px-3"
                          style={{ borderBottom: i < transitData.subPath.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                          <div className="px-2 py-0.5 rounded flex items-center justify-center shrink-0 text-[10px] font-extrabold"
                            style={{ background: color, color: 'white' }}>{label}</div>
                          <span className="text-[11px] font-medium flex-1 leading-snug" style={{ color: '#444' }}>{desc}</span>
                          <span className="text-[10px] font-bold shrink-0 tabular-nums" style={{ color: '#bbb' }}>{formatDistance(path.distance)}</span>
                        </div>
                      );
                    })}

                    {/* Non-Transit Guide (Car fallback) */}
                    {!hasTransit && currentRoute.guide?.length > 0 && currentRoute.guide.slice(0, 10).map((g, i) => (
                      <div key={i} className="flex items-center gap-2.5 py-2.5 px-3"
                        style={{ borderBottom: i < Math.min(currentRoute.guide.length, 10) - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-extrabold"
                          style={{ background: i === 0 ? currentTransport.color : 'rgba(0,0,0,0.06)', color: i === 0 ? 'white' : '#666' }}>{i + 1}</div>
                        <span className="text-[11px] font-medium flex-1 leading-snug" style={{ color: '#444' }}>{g.instructions}</span>
                        <span className="text-[10px] font-bold shrink-0 tabular-nums" style={{ color: '#bbb' }}>{formatDistance(g.distance)}</span>
                      </div>
                    ))}
                    
                    {!hasTransit && currentRoute.guide?.length > 10 && (
                      <div className="text-center py-2 text-[10px] font-medium" style={{ color: '#bbb' }}>
                        +{currentRoute.guide.length - 10}개 안내 더 있음
                      </div>
                    )}

                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      </div>
      {showShareMenu && <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />}
    </div>
  );
}
