import { MapPin, ChevronDown, ChevronUp, X, Navigation } from 'lucide-react';

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SearchSidebar({ results = [], onSelectChurch, onClose, userLocation, isNearbyMode, searchQuery }) {
  if (results.length === 0) return null;

  // Sort by distance if in nearby mode and user location is available
  let sortedResults = [...results];
  if (isNearbyMode && userLocation) {
    sortedResults.sort((a, b) => {
      const da = haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const db = haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return da - db;
    });
  }

  const title = isNearbyMode ? `내 근처 교회 (${results.length})` : `검색 결과 (${results.length})`;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col absolute left-0 top-0 bottom-0 z-30 animate-in slide-in-from-left duration-300" style={{ width: 'min(320px, 25vw)' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(24px)', borderRight: '1px solid rgba(43, 57, 144, 0.1)' }} className="h-full flex flex-col shadow-2xl shadow-blue-900/5">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {isNearbyMode ? <Navigation size={16} className="text-[#00A5D9]" /> : <MapPin size={16} className="text-[#2B3990]" />}
              <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Search query display */}
          {searchQuery && (
            <div className="px-4 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">검색어: </span>
              <span className="text-xs text-[#2B3990] font-bold">{searchQuery}</span>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {sortedResults.map((church, i) => {
              const dist = userLocation ? haversineKm(userLocation.lat, userLocation.lng, church.lat, church.lng) : null;
              return (
                <button
                  key={church.id || i}
                  onClick={() => onSelectChurch(church)}
                  className="w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5" style={{ background: 'rgba(43, 57, 144, 0.08)', border: '1px solid rgba(43, 57, 144, 0.15)' }}>
                      <MapPin size={14} className="text-[#2B3990]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm truncate">{church.name.endsWith('교회') ? church.name : church.name + '교회'}</span>
                        {dist !== null && (
                          <span className="text-[11px] font-bold text-[#00A5D9] shrink-0">{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}</span>
                        )}
                      </div>
                      {church.pastor_name && (
                        <p className="text-xs text-gray-500 mt-0.5">담임목사: {church.pastor_name.replace(/목사\s*$/, '').trim()} 목사</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{church.address || ''}</p>
                      {church.noh && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-[#2B3990]/80 bg-[#2B3990]/10 px-1.5 py-0.5 rounded">{church.noh}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <MobileBottomSheet
        results={sortedResults}
        onSelectChurch={onSelectChurch}
        onClose={onClose}
        userLocation={userLocation}
        title={title}
      />
    </>
  );
}

function MobileBottomSheet({ results, onSelectChurch, onClose, userLocation, title }) {
  const [expanded, setExpanded] = [true, () => {}]; // simplified - always show

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 animate-in slide-in-from-bottom duration-300">
      <div style={{ background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(43, 57, 144, 0.1)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 32px rgba(43, 57, 144, 0.08)' }} className="flex flex-col max-h-[40vh]">

        {/* Drag handle + Header */}
        <div className="flex flex-col items-center pt-2 pb-1 shrink-0 bg-white shadow-sm rounded-t-[20px]">
          <div className="w-10 h-1 rounded-full bg-gray-200 mb-2" />
          <div className="w-full px-4 flex items-center justify-between pb-1">
            <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pt-1 pb-[env(safe-area-inset-bottom,8px)] custom-scrollbar">
          {results.map((church, i) => {
            const dist = userLocation ? haversineKm(userLocation.lat, userLocation.lng, church.lat, church.lng) : null;
            return (
              <button
                key={church.id || i}
                onClick={() => onSelectChurch(church)}
                className="w-full text-left px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(43, 57, 144, 0.08)' }}>
                    <MapPin size={13} className="text-[#2B3990]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-[13px] truncate">{church.name.endsWith('교회') ? church.name : church.name + '교회'}</span>
                      {dist !== null && (
                        <span className="text-[10px] font-bold text-[#00A5D9] shrink-0">{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{church.pastor_name ? `담임목사: ${church.pastor_name.replace(/목사\s*$/, '').trim()} 목사 · ` : ''}{church.noh || ''}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
