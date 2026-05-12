/**
 * 광고 배너 서비스 (Firestore + Firebase Storage)
 * - 로컬 서버 없이 온라인에서 직접 CRUD
 * - 이미지는 Firebase Storage에 업로드
 * - 광고 데이터는 Firestore 'ads' 컬렉션에 저장
 */
import { firestore, storage } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

const ADS_COLLECTION = 'ads';

/**
 * 활성 광고 목록 조회 (오늘 날짜 기준 필터)
 * 복합 인덱스 불필요하도록 전체 조회 후 클라이언트 필터링
 * @returns {Array} 활성 광고 배열
 */
export async function getActiveAds() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await getDocs(collection(firestore, ADS_COLLECTION));
    const ads = [];
    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.is_active && data.start_date <= today && data.end_date >= today) {
        ads.push(data);
      }
    });
    // 클라이언트 정렬
    ads.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    return ads;
  } catch (err) {
    console.error('[AdService] getActiveAds failed:', err);
    return [];
  }
}

/**
 * 전체 광고 목록 조회 (관리자용)
 * @returns {Array}
 */
export async function getAllAds() {
  try {
    const snapshot = await getDocs(collection(firestore, ADS_COLLECTION));
    const ads = [];
    snapshot.forEach((docSnap) => {
      ads.push({ id: docSnap.id, ...docSnap.data() });
    });
    ads.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    return ads;
  } catch (err) {
    console.error('[AdService] getAllAds failed:', err);
    return [];
  }
}

/**
 * 단일 광고 조회
 * @param {string} adId - Firestore document ID
 * @returns {object|null}
 */
export async function getAdById(adId) {
  try {
    const docSnap = await getDoc(doc(firestore, ADS_COLLECTION, adId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.error('[AdService] getAdById failed:', err);
    return null;
  }
}

/**
 * 광고 이미지 업로드 (Firebase Storage)
 * @param {File} file - 이미지 파일
 * @returns {string} 다운로드 URL
 */
export async function uploadAdImage(file) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `ads/${timestamp}_${safeName}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}

/**
 * 광고 생성
 * @param {object} adData
 * @returns {string} 새 문서 ID
 */
export async function createAd(adData) {
  const docRef = await addDoc(collection(firestore, ADS_COLLECTION), {
    title: adData.title || '',
    image_url: adData.image_url || '',
    content: adData.content || '',
    link_url: adData.link_url || '',
    advertiser: adData.advertiser || '',
    contact: adData.contact || '',
    display_order: adData.display_order || 0,
    start_date: adData.start_date || '',
    end_date: adData.end_date || '',
    is_active: true,
    created_by: adData.created_by || '',
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * 광고 수정
 * @param {string} adId - Firestore document ID
 * @param {object} updates
 */
export async function updateAd(adId, updates) {
  const docRef = doc(firestore, ADS_COLLECTION, adId);
  await updateDoc(docRef, {
    ...updates,
    updated_at: Timestamp.now(),
  });
}

/**
 * 광고 삭제 (이미지도 함께 삭제)
 * @param {string} adId
 * @param {string} imageUrl - Storage URL (optional)
 */
export async function deleteAd(adId, imageUrl) {
  // Storage에서 이미지 삭제 시도
  if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
    try {
      const storageRef = ref(storage, imageUrl);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn('[AdService] Image delete failed (may not exist):', err.message);
    }
  }
  // Firestore 문서 삭제
  await deleteDoc(doc(firestore, ADS_COLLECTION, adId));
}
