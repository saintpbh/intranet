// Grid-based spatial clustering algorithm for Naver Map
export function clusterChurches(churches, dynamicLevel, currentZoom) {
  if (!churches || churches.length === 0) return [];
  
  // If we are at the detailed level (zoom >= 14) or explicitly forced (e.g. by search query)
  if (dynamicLevel === 'ALL' || currentZoom >= 14) {
    return churches.map(c => ({ type: 'INDIVIDUAL', ...c }));
  }

  // Calculate grid size dynamically based on zoom level.
  // 40 is a tunable parameter. Higher = larger clusters (more aggressively grouped).
  // At zoom 10, gridSize is ~0.039 degrees (approx 4.3km).
  // At zoom 7, gridSize is ~0.31 degrees (approx 34km).
  const gridSize = 40.0 / Math.pow(2, currentZoom); 

  const clusters = {};
  const individualsWithoutCoords = [];

  churches.forEach(church => {
    if (!church.lat || !church.lng) {
      individualsWithoutCoords.push({ type: 'INDIVIDUAL', ...church });
      return;
    }

    // Hash the coordinate into discrete grid boxes
    const gridX = Math.floor(parseFloat(church.lng) / gridSize);
    const gridY = Math.floor(parseFloat(church.lat) / gridSize);
    const gridKey = `${gridX}_${gridY}`;

    if (!clusters[gridKey]) {
      clusters[gridKey] = {
        type: 'CLUSTER',
        count: 0,
        latSum: 0,
        lngSum: 0,
        churches: []
      };
    }

    clusters[gridKey].count += 1;
    clusters[gridKey].latSum += parseFloat(church.lat);
    clusters[gridKey].lngSum += parseFloat(church.lng);
    clusters[gridKey].churches.push(church);
  });

  const clusteredMarkers = Object.values(clusters).map(cluster => ({
    ...cluster,
    // Provide a geographic center-of-mass for the bubble placement
    lat: cluster.latSum / cluster.count,
    lng: cluster.lngSum / cluster.count,
    // Name is no longer strictly used in UI but kept for compatibility
    name: `Group: ${cluster.count}` 
  }));

  // If there are churches missing coords, we can't grid them, so append them loosely if needed
  return [...clusteredMarkers, ...individualsWithoutCoords];
}
