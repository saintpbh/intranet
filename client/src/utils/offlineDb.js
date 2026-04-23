/**
 * Offline Database — IndexedDB 기반 주소록 캐싱
 * 
 * 전략:
 * - 검색 결과를 IndexedDB에 캐싱 (type+검색어 기준)
 * - 오프라인 시 캐시된 데이터에서 로컬 검색
 * - 전체 데이터 동기화가 아닌 "점진적 캐싱": 사용자가 검색할 때마다 결과 축적
 * - DB 크기가 작으므로 (~200 rows per query) 부담 없음
 */

const DB_NAME = 'prok_offline';
const DB_VERSION = 1;
const STORE_NAME = 'directory';

/** IndexedDB 열기 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 검색 결과를 캐시에 저장
 * @param {'ministers'|'elders'|'churches'|'addressbook'} type
 * @param {string} searchTerm
 * @param {Array} data
 */
export async function cacheSearchResult(type, searchTerm, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const cacheKey = `${type}:${searchTerm.toLowerCase().trim()}`;
    await new Promise((resolve, reject) => {
      const req = store.put({
        cacheKey,
        type,
        searchTerm: searchTerm.toLowerCase().trim(),
        data,
        timestamp: Date.now(),
      });
      req.onsuccess = resolve;
      req.onerror = reject;
    });
    
    db.close();
  } catch (err) {
    console.warn('[OfflineDB] Cache write failed:', err);
  }
}

/**
 * 캐시에서 검색 결과 조회
 * @param {'ministers'|'elders'|'churches'|'addressbook'} type
 * @param {string} searchTerm
 * @returns {Array|null} 캐시된 데이터 또는 null
 */
export async function getCachedSearch(type, searchTerm) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const cacheKey = `${type}:${searchTerm.toLowerCase().trim()}`;
    const result = await new Promise((resolve, reject) => {
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    
    if (result) {
      // 7일 이상 된 캐시는 무시 (온라인 시에만)
      const age = Date.now() - result.timestamp;
      if (navigator.onLine && age > 7 * 24 * 60 * 60 * 1000) {
        db.close();
        return null;
      }
      db.close();
      return result.data;
    }

    // Fallback: Check if we have __all__ cached for this type
    const allResult = await new Promise((resolve, reject) => {
      const req = store.get(`${type}:__all__`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });

    db.close();
    
    if (!allResult) return null;

    // Filter allResult.data based on searchTerm
    const term = searchTerm.toLowerCase().trim();
    if (!term) return allResult.data.slice(0, 100); // Return top 100 if no search term

    const filtered = allResult.data.filter(item => {
      const searchables = [
        item.MinisterName, item.MINISTERNAME, item.PriestName,
        item.CHRNAME, item.ChrName, item.chrname,
        item.NOHNAME, item.NohName, item.nohname,
      ].filter(Boolean).map((s) => s.toLowerCase());
      return searchables.some((s) => s.includes(term));
    });
    return filtered;

  } catch (err) {
    console.warn('[OfflineDB] Cache read failed:', err);
    return null;
  }
}

/**
 * 오프라인 시 로컬 전체 검색
 * 캐시된 모든 데이터에서 이름/교회/노회 검색
 * @param {string} searchTerm
 * @returns {Array} 매칭되는 결과
 */
export async function offlineLocalSearch(searchTerm) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const allRecords = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    
    db.close();
    
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];
    
    // 모든 캐시 데이터에서 검색
    const seen = new Set();
    const results = [];
    
    for (const record of allRecords) {
      for (const item of (record.data || [])) {
        // 중복 제거 키
        const key = item.MinisterCode || item.PriestCode || item.ChrCode || JSON.stringify(item);
        if (seen.has(key)) continue;
        
        // 이름, 교회명, 노회명으로 검색
        const searchables = [
          item.MinisterName, item.MINISTERNAME, item.PriestName,
          item.CHRNAME, item.ChrName, item.chrname,
          item.NOHNAME, item.NohName, item.nohname,
        ].filter(Boolean).map((s) => s.toLowerCase());
        
        if (searchables.some((s) => s.includes(term))) {
          seen.add(key);
          results.push({ ...item, _cachedType: record.type });
        }
      }
    }
    
    return results;
  } catch (err) {
    console.warn('[OfflineDB] Local search failed:', err);
    return [];
  }
}

/**
 * 캐시 통계
 * @returns {{ count: number, sizeEstimate: string }}
 */
export async function getCacheStats() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const count = await new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    
    db.close();
    return { count };
  } catch {
    return { count: 0 };
  }
}

/**
 * 전체 주소록 백그라운드 동기화
 * @param {string} apiBase 
 */
export async function syncFullDirectory(apiBase) {
  try {
    const res = await fetch(`${apiBase}/api/sync/directory`);
    if (!res.ok) throw new Error('Sync failed');
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);

    // Save to IndexedDB (as single __ALL__ entries)
    if (data.ministers) await cacheSearchResult('ministers', '__all__', data.ministers);
    if (data.churches) await cacheSearchResult('churches', '__all__', data.churches);
    if (data.elders) await cacheSearchResult('elders', '__all__', data.elders);
    if (data.addressbook) await cacheSearchResult('addressbook', '__all__', data.addressbook);
    
    // Update sync time
    localStorage.setItem('last_directory_sync', Date.now().toString());
    
    console.log('[OfflineDB] Full directory sync completed.');
    return true;
  } catch (err) {
    console.warn('[OfflineDB] Full directory sync failed:', err);
    return false;
  }
}
