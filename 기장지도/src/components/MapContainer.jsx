import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { clusterChurches } from '../utils/clustering';

export default function MapContainer({ 
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
      const checkNaver = setInterval(() => {
        if (window.naver?.maps) {
          clearInterval(checkNaver);
          initMap();
        }
      }, 500);
      return () => clearInterval(checkNaver);
    }
  }, []);

  // Fetch all churches once
  useEffect(() => {
    const fetchChurches = async () => {
      let allFetchedData = [];
      let start = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
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

      setAllChurches(allFetchedData);
      if (onDataLoaded) onDataLoaded(allFetchedData.length);
    };
    fetchChurches();
  }, [onDataLoaded]);

  // Haversine distance
  const haversineKm = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Smooth animated zoom to position
  const smoothZoomTo = useCallback((mapInst, targetPos, targetZoom) => {
    const currentZoomVal = mapInst.getZoom();
    // First pan, then zoom step by step
    mapInst.panTo(targetPos, { duration: 300, easing: 'easeOutCubic' });
    
    if (targetZoom > currentZoomVal) {
      let step = currentZoomVal;
      const interval = setInterval(() => {
        step = Math.min(step + 1, targetZoom);
        mapInst.setZoom(step, true);
        if (step >= targetZoom) clearInterval(interval);
      }, 200);
    } else if (targetZoom < currentZoomVal) {
      setTimeout(() => mapInst.setZoom(targetZoom, true), 350);
    }
  }, []);

  // Main filter/cluster/render effect
  useEffect(() => {
    if (!map || allChurches.length === 0) return;

    // Clean up existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const query = searchQuery.toLowerCase().trim();
    let filtered = allChurches;

    // --- Enhanced Search Logic ---
    if (query) {
      // Normalize query: remove all spaces, remove trailing "교회"
      const normalizedQuery = query.replace(/\s+/g, '').replace(/교회$/, '');
      const isNohSearch = query.includes('노회') || query.includes('시찰');

      filtered = allChurches.filter(church => {
        const name = (church.name || '').toLowerCase();
        const address = (church.address || '').toLowerCase();
        const noh = (church.noh || '').toLowerCase();

        // Normalize church name: remove all spaces, remove trailing "교회"
        const normalizedName = name.replace(/\s+/g, '').replace(/교회$/, '');
        // Search inside address and noh ignoring spaces
        const normalizedAddress = address.replace(/\s+/g, '');
        const normalizedNoh = noh.replace(/\s+/g, '');

        if (isNohSearch) {
          // For 노회/시찰 search: match noh field primarily
          const cleanNohQuery = normalizedQuery.replace('노회', '').replace('시찰', '');
          return normalizedNoh.includes(cleanNohQuery) || normalizedNoh.includes(normalizedQuery);
        }

        // General search: name, address (region), noh
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
          const pastorStr = item.pastor_name ? ` · ${item.pastor_name}` : '';
          contentHtml = `
            <div style="cursor:pointer;z-index:20;position:relative;" class="church-marker-tag">
              <div style="background:rgba(255, 255, 255, 0.95);backdrop-filter:blur(20px);border:1.5px solid rgba(43, 57, 144, 0.2);box-shadow:0 6px 16px rgba(43, 57, 144, 0.1);border-radius:14px;display:flex;align-items:center;gap:7px;padding:5px 12px;transition:transform 0.2s,border-color 0.2s;" onmouseover="this.style.transform='scale(1.06)';this.style.borderColor='rgba(0,165,217,0.8)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='rgba(43, 57, 144, 0.2)'">
                <div style="width:9px;height:9px;background:#00A5D9;box-shadow:0 0 10px rgba(0, 165, 217, 0.6);border-radius:50%;flex-shrink:0;"></div>
                <span style="color:#0f172a;font-size:12px;font-weight:700;white-space:nowrap;letter-spacing:0.3px;">${item.name}<span style="color:#64748b;font-weight:500;">${pastorStr}</span></span>
              </div>
            </div>
          `;
        }

        const zIdx = item.type === 'CLUSTER' ? (100 + item.count) : 500;

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
            smoothZoomTo(map, pos, map.getZoom() + 2);
          } else {
            const pos = marker.getPosition();
            map.panTo(pos, { duration: 300, easing: 'easeOutCubic' });
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
        smoothZoomTo(map, pos, 15);
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
      myLocationMarkerRef.current = new window.naver.maps.Marker({
        position: userPos,
        map: map,
        icon: {
          content: `<div style="width:20px;height:20px;background:#00A5D9;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 20px rgba(0, 165, 217, 0.6);animation:pulse 2s infinite;"></div>`,
          anchor: new window.naver.maps.Point(10, 10)
        },
        zIndex: 200
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
  }, [map, allChurches, searchQuery, currentZoom, currentBounds, nearbyMode, nearbyRadius, userLocation, haversineKm, smoothZoomTo]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapElRef} className="w-full h-full" id="map" />
    </div>
  );
}
