/**
 * Supabase REST API 유틸리티 (기장지도 churches 테이블 연동)
 * - 로컬서버 없이 클라이언트에서 직접 Supabase REST API 호출
 * - anon key 사용 (RLS 정책에 따라 접근 제한)
 */

const SUPABASE_URL = 'https://wfpacsoyoalkdzksnmdg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OE__Egoq2JlJASb3QnqrbA_lnpaaTd6';

function headers(extra = {}) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extra,
  };
}

/**
 * 교회코드(chr_code)로 Supabase churches 테이블에서 교회 정보 조회
 * @param {string} chrCode - 교회코드 (예: "100432")
 * @returns {object|null} 교회 정보 객체 또는 null
 */
export async function getChurchByChrCode(chrCode) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/churches?chr_code=eq.${chrCode}&select=*`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
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
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/churches?chr_code=eq.${chrCode}`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(updates),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error('[SupabaseRest] updateChurch failed:', res.status, errText);
      return null;
    }
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
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
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/churches`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(churchData),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error('[SupabaseRest] insertChurch failed:', res.status, errText);
      return null;
    }
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('[SupabaseRest] insertChurch exception:', err);
    return null;
  }
}
