import { firestore } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

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
        // 코드 필드도 검색 대상에 포함 (chrCode로 검색 시 매칭 필요)
        item.ChrCode, item.MinisterCode, item.MINISTERCODE,
        item.PriestCode, item.chr_code,
      ].filter(Boolean).map((s) => String(s).toLowerCase().trim());
      return searchables.some((s) => s.includes(term));
    });

    if (term.includes('노회')) {
      if (type === 'ministers') {
        filtered.sort((a, b) => {
          const nameA = (a.MinisterName || a.MINISTERNAME || '').trim();
          const nameB = (b.MinisterName || b.MINISTERNAME || '').trim();
          return nameA.localeCompare(nameB, 'ko');
        });
      } else if (type === 'elders') {
        filtered.sort((a, b) => {
          const nameA = (a.PriestName || '').trim();
          const nameB = (b.PriestName || '').trim();
          return nameA.localeCompare(nameB, 'ko');
        });
      } else if (type === 'churches') {
        filtered.sort((a, b) => {
          const nameA = (a.CHRNAME || a.ChrName || '').trim();
          const nameB = (b.CHRNAME || b.ChrName || '').trim();
          return nameA.localeCompare(nameB, 'ko');
        });
      } else if (type === 'addressbook') {
        filtered.sort((a, b) => {
          const nameA = (a.MINISTERNAME || '').trim();
          const nameB = (b.MINISTERNAME || '').trim();
          return nameA.localeCompare(nameB, 'ko');
        });
      }
    }

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
          item.ChrCode, item.MinisterCode, item.MINISTERCODE,
          item.PriestCode, item.chr_code,
        ].filter(Boolean).map((s) => String(s).toLowerCase().trim());
        
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
 * 전체 주소록 백그라운드 동기화 (오직 Firebase Storage 에서만 가져옴)
 */
export async function syncFullDirectory() {
  try {
    if (!navigator.onLine) {
      console.log('[OfflineDB] Offline, skipping directory sync.');
      return false;
    }
    
    // Fetch the latest directory.json from Firebase Storage via SDK (CORS-safe)
    console.log('[OfflineDB] Fetching directory.json from Firebase Storage...');
    
    let res;
    // 1차 시도: 로컬 FastAPI의 directory-fast 초고속 SQLite 덤프 API 호출 (가상계좌 포함 최신 데이터)
    try {
      const API_BASE = (await import('../api')).default;
      console.log('[OfflineDB] Fetching directory from local FastAPI server...');
      res = await fetch(`${API_BASE}/api/sync/directory-fast`);
    } catch (apiErr) {
      console.warn('[OfflineDB] FastAPI fetch failed, trying Firebase Storage fallback:', apiErr);
    }

    // 2차 시도 (폴백): Firebase Storage에서 directory.json 직접 가져오기
    if (!res || !res.ok) {
      try {
        console.log('[OfflineDB] Trying Firebase Storage fallback...');
        const { ref, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('../firebase');
        const fileRef = ref(storage, 'directory.json');
        const downloadUrl = await getDownloadURL(fileRef);
        res = await fetch(downloadUrl);
      } catch (sdkErr) {
        console.warn('[OfflineDB] Firebase SDK download failed, trying direct URL:', sdkErr);
        const fbStorageUrl = 'https://storage.googleapis.com/prok-ga.firebasestorage.app/directory.json';
        res = await fetch(`${fbStorageUrl}?t=${Date.now()}`);
      }
    }

    if (!res || !res.ok) throw new Error('Failed to fetch directory from all sources');
    
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);

    // Save synced_at date (서버에서 DB 동기화한 시점)
    if (data.synced_at) {
      localStorage.setItem('directory_synced_at', data.synced_at);
    }

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

/**
 * 동기화 날짜 조회
 * @returns {string|null} "2026-05-12 15:00" 형식 또는 null
 */
export function getSyncDate() {
  return localStorage.getItem('directory_synced_at');
}
