/**
 * Supabase REST API 유틸리티 (기장지도 churches 테이블 연동)
 * - FastAPI 서버 프록시를 통해 Supabase 접근 (service_role key로 RLS 우회)
 * - API_BASE: ngrok 또는 IDC 서버 URL
 */

import API_BASE from '../api';

const REQUEST_TIMEOUT_MS = 10000; // 10초 타임아웃

/** 타임아웃 적용 fetch wrapper */
function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/**
 * 교회코드(chr_code)로 교회 정보 조회
 * @param {string} chrCode - 교회코드 (예: "100432")
 * @returns {object|null} 교회 정보 객체 또는 null
 */
export async function getChurchByChrCode(chrCode) {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/church-manage/${chrCode}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[SupabaseRest] getChurchByChrCode failed:', err);
    return null;
  }
}

/**
 * 교회 정보 업데이트 (기장지도 Supabase)
 * @param {string} chrCode - 교회코드
 * @param {object} updates - 업데이트할 필드 (intro_text, worship_times, etc.)
 * @returns {object|null} 업데이트된 교회 정보 또는 null
 */
export async function updateChurchByChrCode(chrCode, updates) {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/church-manage/${chrCode}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error('[SupabaseRest] updateChurch failed:', res.status, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[SupabaseRest] updateChurch exception:', err);
    return null;
  }
}

/**
 * 교회 정보 신규 등록 (기장지도에 아직 없는 교회)
 * @param {object} churchData - 교회 데이터
 * @returns {object|null}
 */
export async function insertChurch(churchData) {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/church-manage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(churchData),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error('[SupabaseRest] insertChurch failed:', res.status, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[SupabaseRest] insertChurch exception:', err);
    return null;
  }
}
