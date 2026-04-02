import { useState, useRef, useEffect } from 'react'
import { Search, Layers, Navigation, Star, X, Minus, Plus } from 'lucide-react'
import MapContainer from './components/MapContainer'
import ChurchDetailSheet from './components/ChurchDetailSheet'
import ContextMenu from './components/ContextMenu'
import DirectionsPanel from './components/DirectionsModal'
import SearchSidebar from './components/SearchSidebar'
import WelcomeScreen from './components/WelcomeScreen'
import { getFavorites } from './utils/favorites'

function App() {
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  
  // Map viewport info
  const [viewLevel, setViewLevel] = useState('PROVINCE');
  const [visibleCount, setVisibleCount] = useState(0);

  // Nearby mode
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(5);
  const [showRadiusSlider, setShowRadiusSlider] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);

  // Directions modal
  const [directionsChurch, setDirectionsChurch] = useState(null);
  const isDirectionsMode = !!directionsChurch;

  // Favorites
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Search results for sidebar  
  const [searchResults, setSearchResults] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);

  // Welcome Screen
  const [totalChurches, setTotalChurches] = useState(0);
  const [showWelcome, setShowWelcome] = useState(() => {
    return localStorage.getItem('PROK_MAP_WELCOME') !== 'true';
  });

  // Map ref
  const mapRef = useRef(null);

  // Media Hover Popup
  const [hoveredChurch, setHoveredChurch] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const popupTimeoutRef = useRef(null);

  const handleHoverChurch = (church, pos) => {
    if (church) {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      setHoveredChurch(church);
      if (pos) setHoverPos(pos);
    } else {
      popupTimeoutRef.current = setTimeout(() => {
        setHoveredChurch(null);
      }, 300);
    }
  };

  const keepPopupOpen = () => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
  };
  const closePopup = () => {
    setHoveredChurch(null);
  };

  // Load favorites on mount
  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  // Refresh favorites when detail sheet closes
  useEffect(() => {
    if (!selectedChurch) {
      setFavorites(getFavorites());
    }
  }, [selectedChurch]);

  const getLevelName = (level) => {
    switch(level) {
      case 'PROVINCE': return '전국(도/광역시)';
      case 'CITY': return '시/군/구 레벨';
      case 'TOWN': return '읍/면/동 레벨';
      case 'ALL': return '상세 보기';
      default: return '';
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setNearbyMode(false);
    if (searchInput.trim()) {
      setShowSidebar(true);
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setShowSidebar(false);
    setNearbyMode(false);
    setSearchResults([]);
    
    // Reset map viewport to default when search is cleared
    if (mapRef.current && window.naver?.maps) {
      mapRef.current.setZoom(7, true);
      mapRef.current.panTo(new window.naver.maps.LatLng(36.5, 127.8), { duration: 300 });
    }
  };

  const handleNearbyToggle = () => {
    if (nearbyMode) {
      setNearbyMode(false);
      setShowSidebar(false);
      setShowRadiusSlider(false);
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setNearbyMode(true);
        setShowSidebar(true);
        setSearchQuery(""); // clear text search
        setSearchInput("");
        setLocatingUser(false);
      },
      () => {
        alert("위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.");
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleContextMenu = (church, position) => {
    setContextMenu({ church, position });
  };

  const handleSearchResults = (results) => {
    setSearchResults(results);
  };

  const handleSelectFromSidebar = (church) => {
    setSelectedChurch(church);
    // Pan and Zoom map to this church
    if (mapRef.current && window.naver?.maps) {
      const pos = new window.naver.maps.LatLng(church.lat, church.lng);
      mapRef.current.morph(pos, 16, { duration: 400, easing: 'easeOutCubic' });
    }
  };

  const handleSelectFavorite = (fav) => {
    setShowFavorites(false);
    handleSelectFromSidebar(fav);
  };

  const handleOpenDirections = (church) => {
    setDirectionsChurch(church);
  };

  const handleCloseDetailSheet = () => {
    setSelectedChurch(null);
    if (searchResults.length > 0 && mapRef.current && window.naver?.maps) {
      setTimeout(() => { // slight delay ensures DOM unmounts cleanly
        let hasValidCoords = false;
        const bounds = new window.naver.maps.LatLngBounds();
        searchResults.forEach(c => {
          if (c.lat && c.lng) {
            bounds.extend(new window.naver.maps.LatLng(c.lat, c.lng));
            hasValidCoords = true;
          }
        });
        if (hasValidCoords) {
          mapRef.current.fitBounds(bounds, {
             margin: new window.naver.maps.Margin(40, 40, 40, showSidebar ? 380 : 40)
          });
        }
      }, 50);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans bg-[var(--color-eh-surface)] text-[var(--color-eh-on-surface)]">
      {/* Background Map */}
      <div className="absolute inset-0">
        <MapContainer 
          onSelectChurch={setSelectedChurch} 
          searchQuery={searchQuery}
          onViewportChange={(level, count) => {
            setViewLevel(level);
            setVisibleCount(count);
          }}
          nearbyMode={nearbyMode}
          nearbyRadius={nearbyRadius}
          userLocation={userLocation}
          onUserLocationFound={setUserLocation}
          onContextMenu={handleContextMenu}
          onSearchResults={handleSearchResults}
          onHoverChurch={handleHoverChurch}
          mapRef={mapRef}
          isDirectionsMode={isDirectionsMode}
          onDataLoaded={setTotalChurches}
        />
      </div>

      {/* Search Sidebar (Left panel / Bottom sheet) - hidden in directions mode */}
      {!isDirectionsMode && showSidebar && (searchQuery || nearbyMode) && searchResults.length > 0 && !selectedChurch && (
        <SearchSidebar
          results={searchResults}
          onSelectChurch={handleSelectFromSidebar}
          onClose={handleClearSearch}
          userLocation={userLocation}
          isNearbyMode={nearbyMode}
          searchQuery={searchQuery}
        />
      )}

      {/* Floating Header - hidden in directions mode */}
      {!isDirectionsMode && (
      <div className="absolute top-0 left-0 w-full p-4 z-40 flex flex-col gap-3 pointer-events-none" style={{ paddingLeft: showSidebar && searchResults.length > 0 && !selectedChurch ? 'max(340px, 26vw)' : '16px' }}>
        
        {/* Search Bar + Nearby Button + Favorites */}
        <div className="flex items-center gap-2 mx-auto w-full max-w-xl pointer-events-auto">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 8px 30px rgba(43, 57, 144, 0.08)', padding: '6px' }}>
            {searchInput && (
              <button type="button" onClick={handleClearSearch} className="ml-2 text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            )}
            <input 
              type="text" 
              placeholder="교회명, 지역, 노회 검색" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-gray-900 placeholder-gray-400 font-medium text-[15px] px-3"
            />
            <button type="submit" style={{ background: 'linear-gradient(135deg, #00A5D9, #0084a8)', borderRadius: '18px', padding: '10px', boxShadow: '0 4px 12px rgba(0, 165, 217, 0.25)' }} className="hover:scale-105 active:scale-95 transition-transform text-white">
              <Search size={20} />
            </button>
          </form>

          {/* Nearby Churches Button */}
          <button 
            onClick={handleNearbyToggle}
            disabled={locatingUser}
            style={{
              background: nearbyMode ? 'rgba(0, 165, 217, 0.1)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: nearbyMode ? '1.5px solid #00A5D9' : '1px solid rgba(226, 232, 240, 0.8)',
              borderRadius: '50%',
              padding: '12px',
              boxShadow: nearbyMode ? '0 0 16px rgba(0, 165, 217, 0.2)' : '0 4px 16px rgba(43, 57, 144, 0.05)',
            }}
            className="hover:scale-105 active:scale-95 transition-all shrink-0 pointer-events-auto relative"
            title="내 근처 교회 검색"
          >
            <Navigation size={20} style={{ color: nearbyMode ? '#00A5D9' : '#94a3b8' }} className={locatingUser ? 'animate-spin' : ''} />
            {nearbyMode && (
              <span style={{ background: '#00A5D9', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '8px', padding: '1px 5px', position: 'absolute', top: '-4px', right: '-4px', boxShadow: '0 2px 8px rgba(0, 165, 217, 0.3)' }}>
                {nearbyRadius}km
              </span>
            )}
          </button>

          {/* Favorites Button */}
          <button 
            onClick={() => setShowFavorites(!showFavorites)}
            style={{
              background: showFavorites ? 'rgba(102, 36, 131, 0.1)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: showFavorites ? '1.5px solid rgba(102, 36, 131, 0.4)' : '1px solid rgba(226, 232, 240, 0.8)',
              borderRadius: '50%',
              padding: '12px',
              boxShadow: showFavorites ? '0 0 16px rgba(102, 36, 131, 0.2)' : '0 4px 16px rgba(43, 57, 144, 0.05)',
            }}
            className="hover:scale-105 active:scale-95 transition-all shrink-0 pointer-events-auto relative"
            title="관심 교회"
          >
            <Star size={20} style={{ color: favorites.length > 0 ? '#662483' : '#94a3b8' }} fill={favorites.length > 0 ? '#662483' : 'none'} />
            {favorites.length > 0 && (
              <span style={{ background: '#662483', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '8px', padding: '1px 5px', position: 'absolute', top: '-4px', right: '-4px', boxShadow: '0 2px 8px rgba(102, 36, 131, 0.3)' }}>
                {favorites.length}
              </span>
            )}
          </button>
        </div>

        {/* Radius Slider (when nearby mode active) */}
        {nearbyMode && (
          <div className="mx-auto flex items-center gap-3 pointer-events-auto animate-in slide-in-from-top duration-300" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(0, 165, 217, 0.3)', padding: '8px 16px', boxShadow: '0 4px 16px rgba(0, 165, 217, 0.1)' }}>
            <button onClick={() => setNearbyRadius(r => Math.max(1, r - 1))} className="text-[#00A5D9] hover:text-[#0084a8] transition-colors p-1"><Minus size={16} /></button>
            <input 
              type="range" 
              min={1} max={50} 
              value={nearbyRadius} 
              onChange={e => setNearbyRadius(Number(e.target.value))}
              className="w-32 accent-[#00A5D9]"
            />
            <button onClick={() => setNearbyRadius(r => Math.min(50, r + 1))} className="text-[#00A5D9] hover:text-[#0084a8] transition-colors p-1"><Plus size={16} /></button>
            <span className="text-sm font-bold text-gray-900 min-w-[45px] text-center">{nearbyRadius}km</span>
          </div>
        )}

        {/* Favorites Dropdown */}
        {showFavorites && (
          <div className="mx-auto w-full max-w-md pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
            <div style={{ background: '#ffffff', border: '1px solid rgba(102, 36, 131, 0.2)', borderRadius: '20px', boxShadow: '0 16px 48px rgba(43, 57, 144, 0.15)', maxHeight: '300px', overflow: 'auto' }} className="custom-scrollbar">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: '#662483' }} fill="#662483" />
                  <span className="text-sm font-bold text-gray-900">관심 교회 ({favorites.length})</span>
                </div>
                <button onClick={() => setShowFavorites(false)} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>
              </div>
              {favorites.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">관심 교회가 없습니다</p>
              ) : (
                favorites.map(fav => (
                  <button key={fav.id} onClick={() => handleSelectFavorite(fav)} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 flex items-center gap-3">
                    <Star size={14} style={{ color: '#662483' }} fill="#662483" className="shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-gray-900 truncate block">{fav.name}</span>
                      <span className="text-xs text-gray-500">{fav.noh || ''} · {fav.pastor_name || ''}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Zoom Level Indicator */}
        {!selectedChurch && !nearbyMode && !searchQuery && (
          <div className="mx-auto flex flex-col items-center gap-1 opacity-90 animate-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2 pointer-events-auto" style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(20px)', padding: '6px 16px', borderRadius: '999px', border: '1px solid rgba(43, 57, 144, 0.15)', boxShadow: '0 4px 20px rgba(43, 57, 144, 0.08)' }}>
              <Layers size={14} style={{ color: '#2B3990' }} />
              <span className="text-xs font-extrabold tracking-wide" style={{ color: '#2B3990' }}>{getLevelName(viewLevel)}</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span className="text-xs font-bold" style={{ color: '#64748b' }}>현재 화면 <span className="font-extrabold" style={{ color: '#2B3990' }}>{visibleCount}</span>개 단위</span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Detail Panel (Right Side, No Blur, below search bar) - hidden in directions mode */}
      {!isDirectionsMode && selectedChurch && (
        <div className="absolute right-0 bottom-0 z-50 flex items-start justify-end p-4 pointer-events-none" style={{ maxWidth: '440px', width: '100%', top: '72px' }}>
          <div className="pointer-events-auto w-full">
            <ChurchDetailSheet 
              church={selectedChurch} 
              onClose={handleCloseDetailSheet}
              onOpenDirections={handleOpenDirections}
              userLocation={userLocation}
              onFavoritesChange={() => {
                import('./utils/favorites').then(({ getFavorites }) => {
                  setFavorites(getFavorites());
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu 
          church={contextMenu.church}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Church Info Hover Popup (Light Theme) */}
      {hoveredChurch && !selectedChurch && !isDirectionsMode && (() => {
        const churchName = hoveredChurch.name.endsWith('교회') ? hoveredChurch.name : `${hoveredChurch.name}교회`;
        const photos = hoveredChurch.photos || (hoveredChurch.main_photo_url ? [hoveredChurch.main_photo_url] : []);
        
        return (
          <div
             style={{
               position: 'absolute',
               top: hoverPos.y,
               left: hoverPos.x,
               transform: 'translate(-50%, -100%)',
               zIndex: 50,
               pointerEvents: 'none'
             }}
          >
            <div 
               className="animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200"
               onMouseEnter={keepPopupOpen}
               onMouseLeave={closePopup}
               style={{
                 background: '#ffffff',
                 borderRadius: '16px',
                 padding: '12px',
                 boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.2)',
                 pointerEvents: 'auto',
                 width: '260px',
                 display: 'flex',
                 flexDirection: 'column',
                 gap: '10px',
                 position: 'relative'
               }}
            >
            {/* Media Section: 16:9 Aspect Ratio Container */}
            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '10px', overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
              {hoveredChurch.youtube_video_id ? (
                 <iframe 
                   width="100%" 
                   height="100%" 
                   src={`https://www.youtube.com/embed/${hoveredChurch.youtube_video_id}?autoplay=1&mute=1&loop=1&playlist=${hoveredChurch.youtube_video_id}`} 
                   frameBorder="0" 
                   allow="autoplay; encrypted-media" 
                   style={{ position: 'absolute', top: 0, left: 0 }}
                 ></iframe>
              ) : photos.length > 0 ? (
                 <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '100%', scrollbarWidth: 'none' }}>
                   {photos.map((url, idx) => (
                     <img key={idx} src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start', flexShrink: 0 }} />
                   ))}
                 </div>
              ) : (
                 <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
                      <path d="M12 12v9"></path>
                      <path d="m8 17 4 4 4-4"></path>
                    </svg>
                 </div>
              )}
            </div>

            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                  {churchName}
                </h4>
                {hoveredChurch.pastor_name && (
                  <span className="text-[11px] font-medium text-gray-500 whitespace-nowrap">
                    담임목사: {hoveredChurch.pastor_name.replace(/목사\s*$/, '').trim()} 목사
                  </span>
                )}
              </div>
              
              {/* Introduction Text / Address fallback */}
              <p className="text-[12px] text-gray-600 mt-0.5 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                 기장 교역자 및 성도 여러분을 환영합니다.<br/>
                 <span className="text-gray-400 text-[11px]">{hoveredChurch.address || ''}</span>
              </p>
            </div>

            {/* Bubble Triangle Pointer */}
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: '14px', height: '14px', background: '#ffffff', boxShadow: '4px 4px 10px rgba(0,0,0,0.08)', zIndex: -1 }}></div>
          </div>
          </div>
        );
      })()}

      {/* Directions Panel (Full-screen mode) */}
      {directionsChurch && (
        <DirectionsPanel
          church={directionsChurch}
          userLocation={userLocation}
          onClose={() => { setDirectionsChurch(null); setSelectedChurch(null); }}
          mapInstance={mapRef.current}
        />
      )}
      
      {/* Scroll/Zoom Hint - hidden in directions mode */}
      {!isDirectionsMode && !selectedChurch && viewLevel !== 'ALL' && !searchQuery && !nearbyMode && (
        <div className="absolute bottom-[28px] left-0 w-full flex justify-center z-10 pointer-events-none">
          <div className="pointer-events-auto cursor-pointer animate-bounce" style={{ background: 'rgba(38,37,40,0.85)', backdropFilter: 'blur(20px)', padding: '12px 24px', borderRadius: '999px', border: '1px solid rgba(72,71,74,0.2)', boxShadow: '0 8px 40px rgba(149,170,255,0.1)' }}>
            <div className="flex items-center gap-2.5">
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(55,102,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={14} style={{ color: '#95aaff' }} />
              </div>
              <span className="text-sm font-bold text-white">터치하여 확대 (지도를 줌인하세요)</span>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Screen (Initial Load) */}
      {showWelcome && (
        <WelcomeScreen 
          totalChurches={totalChurches}
          onStart={() => {
            setShowWelcome(false);
            localStorage.setItem('PROK_MAP_WELCOME', 'true');
          }}
        />
      )}
    </div>
  )
}

export default App
