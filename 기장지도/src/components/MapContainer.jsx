import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { clusterChurches } from '../utils/clustering';

const escapeHtml = (unsafe) => {
  return (unsafe || '').replace(/[&<"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
};

export default function MapContainer({ 
  selectedChurch,
  onSelectChurch, 
  searchQuery = "", 
  onViewportChange, 
  onSearchResults,
  nearbyMode,
  nearbyRadius = 5,
  userLocation,
  onUserLocationFound,
  onContextMenu,
  mapRef: externalMapRef,
  isDirectionsMode,
  onHoverChurch,
  onDataLoaded 
}) {
  const mapElRef = useRef(null);
  const [map, setMap] = useState(null);
  const [allChurches, setAllChurches] = useState([]);
  const markersRef = useRef([]);
  const myLocationMarkerRef = useRef(null);

  // Stable callback refs to avoid infinite re-renders
  const onSelectChurchRef = useRef(onSelectChurch);
  const onViewportChangeRef = useRef(onViewportChange);
  const onSearchResultsRef = useRef(onSearchResults);
  const onContextMenuRef = useRef(onContextMenu);
  const onHoverChurchRef = useRef(onHoverChurch);
  useEffect(() => {
    onSelectChurchRef.current = onSelectChurch;
    onViewportChangeRef.current = onViewportChange;
    onSearchResultsRef.current = onSearchResults;
    onContextMenuRef.current = onContextMenu;
    onHoverChurchRef.current = onHoverChurch;
  });

  const [currentZoom, setCurrentZoom] = useState(7);
  const [currentBounds, setCurrentBounds] = useState(null);

  // Track previous search/nearby state to only auto-fit on change
  const prevSearchQueryRef = useRef('');
  const prevNearbyModeRef = useRef(false);
  const prevNearbyRadiusRef = useRef(5);

  // Track active hover for realtime positioning during drag/zoom
  const activeHoverMarkerRef = useRef(null);
  const activeHoverItemRef = useRef(null);

  // Expose map to parent
  useEffect(() => {
    if (externalMapRef) externalMapRef.current = map;
  }, [map, externalMapRef]);

  // Init Naver Map
  useEffect(() => {
    const initMap = () => {
      const mapOptions = {
        center: new window.naver.maps.LatLng(36.5, 127.8),
        zoom: 7,
        mapTypeControl: true,
        zoomControl: false, // We'll use our own or let pinch work
        minZoom: 6,
        maxZoom: 19,
        tileTransition: true,
        logoControlOptions: { position: window.naver.maps.Position.BOTTOM_LEFT },
        background: '#f2f0ea' // 네이버 지도 기본 배경색과 유사하게 설정하여 줌아웃 시 빈 공간의 위화감 감소
      };

      const newMap = new window.naver.maps.Map(mapElRef.current, mapOptions);
      setMap(newMap);

      window.naver.maps.Event.addListener(newMap, 'idle', () => {
        const bounds = newMap.getBounds();
        setCurrentZoom(newMap.getZoom());
        setCurrentBounds({
          minLat: bounds.minY(),
          maxLat: bounds.maxY(),
          minLng: bounds.minX(),
          maxLng: bounds.maxX()
        });
      });

      const initialBounds = newMap.getBounds();
      setCurrentBounds({
        minLat: initialBounds.minY(),
        maxLat: initialBounds.maxY(),
        minLng: initialBounds.minX(),
        maxLng: initialBounds.maxX()
      });

      const updateHoverPos = () => {
        if (activeHoverMarkerRef.current && activeHoverItemRef.current && onHoverChurchRef.current && mapElRef.current) {
          try {
            const proj = newMap.getProjection();
            const markerOffset = proj.fromCoordToOffset(activeHoverMarkerRef.current.getPosition());
            const centerOffset = proj.fromCoordToOffset(newMap.getCenter());
            const mapContainer = mapElRef.current.getBoundingClientRect();
            
            const dx = markerOffset.x - centerOffset.x;
            const dy = markerOffset.y - centerOffset.y;

            onHoverChurchRef.current(activeHoverItemRef.current, {
              x: mapContainer.left + (mapContainer.width / 2) + dx,
              y: mapContainer.top + (mapContainer.height / 2) + dy - 10
            });
          } catch(e) {}
        }
      };

      window.naver.maps.Event.addListener(newMap, 'panning', updateHoverPos);
      window.naver.maps.Event.addListener(newMap, 'zoom_changed', updateHoverPos);
    };

    if (window.naver?.maps) {
      initMap();
    } else {
      let attempts = 0;
      const checkNaver = setInterval(() => {
        attempts++;
        if (window.naver?.maps) {
          clearInterval(checkNaver);
          initMap();
        } else if (attempts > 20) {
          clearInterval(checkNaver);
          console.error("Naver Maps SDK 로드 시간 초과");
        }
      }, 500);
      return () => clearInterval(checkNaver);
    }
  }, []);

  // Fetch all churches once
  useEffect(() => {
    let isMounted = true;
    const fetchChurches = async () => {
      let allFetchedData = [];
      let start = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore && isMounted) {
        const { data, error } = await supabase
          .from('churches')
          .select('*')
          .range(start, start + step - 1);

        if (error) {
          console.error('Error fetching churches:', error.message);
          break;
        }

        if (data && data.length > 0) {
          allFetchedData = [...allFetchedData, ...data];
          if (data.length < step) {
            hasMore = false; // reached the end
          } else {
            start += step; // next page
          }
        } else {
          hasMore = false;
        }
      }

      if (!isMounted) return;
      setAllChurches(allFetchedData);
      if (onDataLoaded) onDataLoaded(allFetchedData.length);
    };
    fetchChurches();
    
    return () => { isMounted = false; };
  }, [onDataLoaded]);

  // Haversine distance
  const haversineKm = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Use useMemo to cache the search and nearby filtered array to avoid heavy filtering loop on every pan/zoom
  const queryFilteredChurches = useMemo(() => {
    if (allChurches.length === 0) return [];
    const query = searchQuery.toLowerCase().trim();
    let filtered = allChurches;

    // --- Enhanced Search Logic ---
    if (query) {
      const normalizedQuery = query.replace(/\s+/g, '').replace(/교회$/, '');
      const isNohSearch = query.includes('노회') || query.includes('시찰');

      filtered = allChurches.filter(church => {
        const name = (church.name || '').toLowerCase();
        const address = (church.address || '').toLowerCase();
        const noh = (church.noh || '').toLowerCase();

        const normalizedName = name.replace(/\s+/g, '').replace(/교회$/, '');
        const normalizedAddress = address.replace(/\s+/g, '');
        const normalizedNoh = noh.replace(/\s+/g, '');

        if (isNohSearch) {
          const cleanNohQuery = normalizedQuery.replace('노회', '').replace('시찰', '');
          return normalizedNoh.includes(cleanNohQuery) || normalizedNoh.includes(normalizedQuery);
        }

        return normalizedName.includes(normalizedQuery) || normalizedAddress.includes(normalizedQuery) || normalizedNoh.includes(normalizedQuery);
      });
    }

    // --- Nearby Mode Filtering ---
    if (nearbyMode && userLocation) {
      filtered = filtered.filter(church => {
        if (!church.lat || !church.lng) return false;
        const dist = haversineKm(userLocation.lat, userLocation.lng, church.lat, church.lng);
        return dist <= nearbyRadius;
      });
    }
    
    return filtered;
  }, [allChurches, searchQuery, nearbyMode, nearbyRadius, userLocation, haversineKm]);

  // Main filter/cluster/render effect
  useEffect(() => {
    if (!map || allChurches.length === 0) return;

    // Clean up existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const query = searchQuery.toLowerCase().trim();
    const filtered = queryFilteredChurches;

    if (!window.naver?.maps?.Marker) return;

    if (isDirectionsMode) {
      return; // Skip rendering markers in directions mode
    }

    // Pass filtered results to parent (for sidebar)
    if (onSearchResultsRef.current) {
      onSearchResultsRef.current(filtered.filter(c => c.lat && c.lng));
    }

    // Determine clustering level
    let dynamicLevel = 'PROVINCE';
    if (query || nearbyMode) {
      dynamicLevel = 'ALL';
    } else {
      if (currentZoom >= 14) dynamicLevel = 'ALL';
      else if (currentZoom >= 11) dynamicLevel = 'TOWN';
      else if (currentZoom >= 9) dynamicLevel = 'CITY';
      else dynamicLevel = 'PROVINCE';
    }

    // Viewport culling
    let viewportChurches = filtered;
    if (currentBounds && !query && !nearbyMode && dynamicLevel !== 'PROVINCE') {
      const latBuffer = (currentBounds.maxLat - currentBounds.minLat) * 0.1;
      const lngBuffer = (currentBounds.maxLng - currentBounds.minLng) * 0.1;

      viewportChurches = filtered.filter(c => {
        if (!c.lat || !c.lng) return false;
        return (
          c.lat >= currentBounds.minLat - latBuffer &&
          c.lat <= currentBounds.maxLat + latBuffer &&
          c.lng >= currentBounds.minLng - lngBuffer &&
          c.lng <= currentBounds.maxLng + lngBuffer
        );
      });
    }

    if (onViewportChangeRef.current) {
      onViewportChangeRef.current(dynamicLevel, viewportChurches.length);
    }

    const markersToRender = clusterChurches(viewportChurches, dynamicLevel, currentZoom);

    // Create markers
    const newMarkers = markersToRender.filter(m => m.lat && m.lng).map(item => {
      try {
        let contentHtml = '';
        let anchorPoint = new window.naver.maps.Point(20, 15);

        if (item.type === 'CLUSTER') {
          const size = item.count >= 100 ? 60 : (item.count >= 20 ? 48 : 40);
          anchorPoint = new window.naver.maps.Point(size / 2, size / 2);
          
          // Vivid cluster design
          const bgColor = item.count >= 100 ? 'linear-gradient(135deg, #662483, #e53935)' 
                        : item.count >= 20 ? 'linear-gradient(135deg, #2B3990, #662483)' 
                        : 'linear-gradient(135deg, #00A5D9, #2B3990)';
          const glowColor = item.count >= 100 ? 'rgba(102, 36, 131, 0.5)' 
                          : 'rgba(43, 57, 144, 0.5)';
          const borderColor = item.count >= 100 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.7)';

          contentHtml = `
            <div style="cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;">
              <div style="width:${size}px;height:${size}px;background:${bgColor};box-shadow:0 0 22px ${glowColor},0 4px 14px rgba(0,0,0,0.4);border-radius:50%;border:2.5px solid ${borderColor};display:flex;align-items:center;justify-content:center;transition:transform 0.2s;">
                <span style="color:#fff;font-size:${item.count >= 100 ? 16 : 14}px;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,0.6);letter-spacing:-0.5px;">${item.count}</span>
              </div>
            </div>
          `;
        } else {
          const displayName = item.name.endsWith('교회') ? item.name : item.name + '교회';
          const safeName = escapeHtml(displayName);
          const safePastorStr = item.pastor_name ? escapeHtml(` · ${item.pastor_name}`) : '';
          const isOnlyOne = markersToRender.length === 1;
          const isSelected = selectedChurch && selectedChurch.id === item.id;
          const shouldHighlight = isOnlyOne || isSelected;

          if (shouldHighlight) {
            contentHtml = `
              <div style="cursor:pointer;z-index:20;position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-12px);transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-16px) scale(1.05)'" onmouseout="this.style.transform='translateY(-12px) scale(1)'">
                <img src="https://cdn.jsdelivr.net/gh/iamcal/emoji-data@master/img-apple-64/26ea.png" alt="Church" style="width:44px;height:44px;filter:drop-shadow(0px 8px 12px rgba(0,0,0,0.3));margin-bottom:-6px;position:relative;z-index:2;" />
                <div style="background:rgba(255, 255, 255, 0.95);backdrop-filter:blur(20px);border:1.5px solid rgba(0, 165, 217, 0.4);box-shadow:0 6px 16px rgba(0, 165, 217, 0.15);border-radius:14px;display:flex;align-items:center;gap:7px;padding:5px 12px;position:relative;z-index:1;">
                  <span style="color:#0f172a;font-size:13px;font-weight:800;white-space:nowrap;letter-spacing:0.3px;">${safeName}<span style="color:#64748b;font-weight:600;">${safePastorStr}</span></span>
                </div>
              </div>
            `;
          } else {
            contentHtml = `
              <div style="cursor:pointer;z-index:20;position:relative;" class="church-marker-tag">
                <div style="background:rgba(255, 255, 255, 0.95);backdrop-filter:blur(20px);border:1.5px solid rgba(43, 57, 144, 0.2);box-shadow:0 6px 16px rgba(43, 57, 144, 0.1);border-radius:14px;display:flex;align-items:center;gap:7px;padding:5px 12px;transition:transform 0.2s,border-color 0.2s;" onmouseover="this.style.transform='scale(1.06)';this.style.borderColor='rgba(0,165,217,0.8)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='rgba(43, 57, 144, 0.2)'">
                  <div style="width:9px;height:9px;background:#00A5D9;box-shadow:0 0 10px rgba(0, 165, 217, 0.6);border-radius:50%;flex-shrink:0;"></div>
                  <span style="color:#0f172a;font-size:12px;font-weight:700;white-space:nowrap;letter-spacing:0.3px;">${safeName}<span style="color:#64748b;font-weight:500;">${safePastorStr}</span></span>
                </div>
              </div>
            `;
          }
        }

        const zIdx = item.type === 'CLUSTER' ? (100 + item.count) : ((markersToRender.length === 1 || (selectedChurch && selectedChurch.id === item.id)) ? 1000 : 500);

        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(item.lat, item.lng),
          map: map,
          icon: {
            content: contentHtml,
            anchor: anchorPoint,
          },
          zIndex: zIdx
        });

        // Left click
        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (item.type === 'CLUSTER') {
            const pos = marker.getPosition();
            map.morph(pos, map.getZoom() + 2, { duration: 300, easing: 'easeOutCubic' });
          } else {
            const pos = marker.getPosition();
            map.morph(pos, map.getZoom(), { duration: 300, easing: 'easeOutCubic' });
            onSelectChurchRef.current(item);
          }
        });

        // Right click (context menu)
        window.naver.maps.Event.addListener(marker, 'rightclick', (e) => {
          if (item.type !== 'CLUSTER' && onContextMenuRef.current) {
            const proj = map.getProjection();
            const markerOffset = proj.fromCoordToOffset(marker.getPosition());
            const centerOffset = proj.fromCoordToOffset(map.getCenter());
            const mapContainer = mapElRef.current.getBoundingClientRect();
            
            const dx = markerOffset.x - centerOffset.x;
            const dy = markerOffset.y - centerOffset.y;

            onContextMenuRef.current(item, {
              x: mapContainer.left + (mapContainer.width / 2) + dx,
              y: mapContainer.top + (mapContainer.height / 2) + dy
            });
          }
        });

        // Hover events for Media Popup
        window.naver.maps.Event.addListener(marker, 'mouseover', () => {
          if (item.type !== 'CLUSTER' && onHoverChurchRef.current) {
             activeHoverMarkerRef.current = marker;
             activeHoverItemRef.current = item;
             
             const proj = map.getProjection();
             const markerOffset = proj.fromCoordToOffset(marker.getPosition());
             const centerOffset = proj.fromCoordToOffset(map.getCenter());
             const mapContainer = mapElRef.current.getBoundingClientRect();
            
             const dx = markerOffset.x - centerOffset.x;
             const dy = markerOffset.y - centerOffset.y;

             onHoverChurchRef.current(item, {
               x: mapContainer.left + (mapContainer.width / 2) + dx,
               y: mapContainer.top + (mapContainer.height / 2) + dy - 10 // offset dynamically depending on marker height
             });
          }
        });

        window.naver.maps.Event.addListener(marker, 'mouseout', () => {
          if (item.type !== 'CLUSTER' && onHoverChurchRef.current) {
             activeHoverMarkerRef.current = null;
             activeHoverItemRef.current = null;
             onHoverChurchRef.current(null);
          }
        });

        return marker;
      } catch (err) {
        return null;
      }
    });

    markersRef.current = newMarkers.filter(Boolean);

    // Auto-fit search results — ONLY when the query actually changes
    const queryChanged = query !== prevSearchQueryRef.current;
    if (queryChanged && query && filtered.length > 0) {
      if (filtered.length === 1) {
        const pos = new window.naver.maps.LatLng(filtered[0].lat, filtered[0].lng);
        map.morph(pos, 15, { duration: 300, easing: 'easeOutCubic' });
      } else if (filtered.length < allChurches.length) { // Don't fitBounds if query matches literally everything
        const bounds = new window.naver.maps.LatLngBounds();
        filtered.forEach(c => {
          if (c.lat && c.lng) {
            bounds.extend(new window.naver.maps.LatLng(c.lat, c.lng));
          }
        });
        map.fitBounds(bounds, { duration: 400, margin: 50 });
      }
    }

    // Nearby mode: manage user location marker + auto-fit
    const nearbyChanged = nearbyMode !== prevNearbyModeRef.current || (nearbyMode && nearbyRadius !== prevNearbyRadiusRef.current);
    
    if (nearbyMode && userLocation) {
      const userPos = new window.naver.maps.LatLng(userLocation.lat, userLocation.lng);
      
      // Always keep user location marker visible in nearby mode
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.setMap(null);
      }
      const cuteUserMarkerContent = `
        <style>
          @keyframes cuteBounce {
            0%, 100% { transform: translateY(-3%); animation-timing-function: cubic-bezier(0.8,0,1,1); }
            50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); }
          }
          @keyframes cutePing {
            75%, 100% { transform: scale(2.5); opacity: 0; }
          }
        </style>
        <div style="position:relative; width:64px; height:64px; display:flex; justify-content:center; align-items:center; cursor:pointer; pointer-events:none;">
          <div style="position:absolute; width:36px; height:36px; background:rgba(16, 185, 129, 0.4); border-radius:50%; animation: cutePing 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index:0;"></div>
          <div style="position:absolute; bottom:8px; width:22px; height:6px; background:rgba(0,0,0,0.2); border-radius:50%; filter:blur(1px); z-index:1;"></div>
          
          <svg style="position:relative; z-index:10; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); animation: cuteBounce 2s infinite;" width="42" height="48" viewBox="0 0 40 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 0C8.954 0 0 8.954 0 20C0 29.239 6.251 37.011 14.844 39.246C16.412 39.654 18.148 42.937 20 46C21.852 42.937 23.588 39.654 25.156 39.246C33.749 37.011 40 29.239 40 20C40 8.954 31.046 0 20 0Z" fill="#10B981"/>
            <circle cx="20" cy="18" r="13" fill="#FFFFFF"/>
            
            <!-- Eyes (Smiling curves) -->
            <path d="M14 16Q15.5 13.5 17 16" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M23 16Q24.5 13.5 26 16" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            
            <!-- Mouth (Big happy curve) -->
            <path d="M16 20.5Q20 24.5 24 20.5" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            
            <!-- Blushing cheeks -->
            <ellipse cx="12.5" cy="19.5" rx="2.5" ry="1.5" fill="#FCA5A5" opacity="0.9"/>
            <ellipse cx="27.5" cy="19.5" rx="2.5" ry="1.5" fill="#FCA5A5" opacity="0.9"/>
          </svg>
          
          <div style="position:absolute; bottom:-12px; font-weight:900; font-size:13px; color:#047857; text-shadow: -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff; white-space:nowrap; letter-spacing:-0.5px; z-index:20;">내 위치</div>
        </div>
      `;

      myLocationMarkerRef.current = new window.naver.maps.Marker({
        position: userPos,
        map: map,
        icon: {
          content: cuteUserMarkerContent,
          anchor: new window.naver.maps.Point(32, 54)
        },
        zIndex: 1000 // Always on top of other markers
      });

      // Auto-fit ONLY when mode/radius changes (not on every viewport change)
      if (nearbyChanged) {
        if (markersRef.current.length > 0) {
          const bounds = new window.naver.maps.LatLngBounds();
          bounds.extend(userPos);
          markersRef.current.forEach(m => bounds.extend(m.getPosition()));
          map.fitBounds(bounds, { duration: 400, top: 100, bottom: 40, left: 40, right: 40 });
        } else {
          map.setCenter(userPos);
          map.setZoom(14, true);
        }
      }
    } else if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.setMap(null);
      myLocationMarkerRef.current = null;
    }

    // Update prev refs after processing
    prevSearchQueryRef.current = query;
    prevNearbyModeRef.current = nearbyMode;
    prevNearbyRadiusRef.current = nearbyRadius;

    return () => {};
  }, [map, allChurches, queryFilteredChurches, searchQuery, currentZoom, currentBounds, nearbyMode, nearbyRadius, userLocation, selectedChurch]);

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: '#f2f0ea' }}>
      <div ref={mapElRef} className="w-full h-full" id="map" />
    </div>
  );
}
