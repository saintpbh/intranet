import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';
import MobileHeader from './mobile/MobileHeader';
import SyncDateLabel from './SyncDateLabel';
import API_BASE from '../api';

/**
 * 환경 코드 → 한글 매핑
 */
const ENV_MAP = {
  '1': '도시',
  '2': '읍',
  '3': '면',
  '4': '농어촌',
};

/**
 * 설립일 포맷팅: "19561104" → "1956년 11월 04일"
 */
function formatEstDate(raw) {
  if (!raw || raw.length < 8) return raw || '';
  return `${raw.slice(0, 4)}년 ${raw.slice(4, 6)}월 ${raw.slice(6, 8)}일`;
}

const ChurchManagePage = () => {
  const { user, isLoggedIn } = useAuth();
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ministers, setMinisters] = useState([]); // 소속 교역자 목록

  // 교회명 표시
  const getChurchDisplayName = () => {
    if (!user) return '';
    const name = user.church || '';
    if (!name || name === '총회' || name.includes('총회')) return '총회본부';
    return name.endsWith('교회') ? name : name + '교회';
  };

  // IndexedDB 캐시에서 교회 검색
  const findChurchInCache = useCallback(async () => {
    try {
      const { getCachedSearch } = await import('../utils/offlineDb');
      
      // ChrCode가 있으면 그걸로 찾기
      if (user?.chrCode) {
        const churches = await getCachedSearch('churches', user.chrCode);
        if (churches && churches.length > 0) {
          return churches[0];
        }
      }
      
      // 교회명으로 찾기
      const churchName = user?.church;
      if (churchName) {
        const churches = await getCachedSearch('churches', churchName);
        if (churches && churches.length > 0) {
          // 정확한 이름 매칭 우선
          const exact = churches.find(c => {
            const name = (c.CHRNAME || '').trim();
            return name === churchName || name === churchName + '교회' || churchName === name + '교회';
          });
          return exact || churches[0];
        }
      }
      
      return null;
    } catch (err) {
      console.warn('[ChurchManage] Cache search failed:', err);
      return null;
    }
  }, [user]);

  // 소속 교역자 검색
  const findMinistersInCache = useCallback(async (chrCode) => {
    if (!chrCode) return [];
    try {
      const { getCachedSearch } = await import('../utils/offlineDb');
      // ministers 캐시에서 교회코드로 검색
      const allMinisters = await getCachedSearch('ministers', '');
      if (allMinisters && allMinisters.length > 0) {
        // Note: ministers in the cache don't have ChrCode directly, 
        // but they have CHRNAME. We can match by church name.
        return [];
      }
    } catch (err) {
      console.warn('[ChurchManage] Minister search failed:', err);
    }
    return [];
  }, []);

  // 교회 정보 로드
  const fetchChurch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. IndexedDB 캐시에서 먼저 찾기
      const cached = await findChurchInCache();
      if (cached) {
        setChurch(cached);
        setLoading(false);
        return;
      }

      // 2. 로컬 API 폴백 — chrCode가 있는 경우
      if (user?.chrCode) {
        try {
          const res = await fetch(`${API_BASE}/api/churches/${user.chrCode}`);
          if (res.ok) {
            const data = await res.json();
            setChurch(data);
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          console.warn('[ChurchManage] API fallback failed:', apiErr);
        }
      }

      // 3. 교회명으로 API 검색 폴백
      if (user?.church) {
        try {
          const res = await fetch(`${API_BASE}/api/churches?search=${encodeURIComponent(user.church)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const exact = data.find(c => (c.CHRNAME || '').trim() === user.church);
              setChurch(exact || data[0]);
              setLoading(false);
              return;
            }
          }
        } catch (apiErr) {
          console.warn('[ChurchManage] Church name search failed:', apiErr);
        }
      }

      setError('교회 데이터를 찾을 수 없습니다. 데이터 동기화 후 다시 시도해 주세요.');
    } catch (e) {
      setError('교회 정보를 불러올 수 없습니다: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, findChurchInCache]);

  useEffect(() => {
    if (isLoggedIn) fetchChurch();
  }, [isLoggedIn, fetchChurch]);

  if (!isLoggedIn) return <SimpleLogin />;

  // 스타일 토큰
  const S = {
    card: 'bg-white rounded-2xl shadow-[0_4px_24px_rgba(10,37,64,0.06)] border border-slate-100 overflow-hidden',
    sectionTitle: "font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2 mb-4",
    label: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider',
    value: 'text-[14px] font-semibold text-slate-800 mt-0.5',
    row: 'flex justify-between items-start py-3 border-b border-slate-50 last:border-b-0',
  };

  // 데이터 행 렌더링 헬퍼
  const DataRow = ({ icon, label, value, highlight = false }) => {
    if (!value || (typeof value === 'string' && !value.trim())) return null;
    return (
      <div className={S.row}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-[16px] text-blue-400 flex-shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className={S.label}>{label}</p>
            <p className={`${S.value} ${highlight ? 'text-blue-600' : ''} break-all`}>{value}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans','Pretendard']">
      <MobileHeader title="교회" />

      <main className="pt-24 px-5 max-w-2xl mx-auto space-y-5">
        {/* Church Header Card */}
        <div className="rounded-[2rem] text-white shadow-[0_20px_40px_rgba(10,37,64,0.15)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-500"></div>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 p-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md mx-auto mb-3 flex items-center justify-center border border-white/30">
              <span className="material-symbols-outlined text-3xl">church</span>
            </div>
            <h2 className="text-2xl font-extrabold font-['Manrope','Pretendard'] mb-1 drop-shadow-lg">
              {getChurchDisplayName()}
            </h2>
            {user?.presbytery && (
              <p className="text-white/80 text-sm font-medium bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full inline-block mt-1">
                {user.presbytery}
              </p>
            )}
            <p className="text-white/60 text-[12px] mt-2">
              {user?.name} {user?.duty}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-3xl text-blue-500">progress_activity</span>
          </div>
        ) : error ? (
          <div className={S.card + ' p-6 text-center'}>
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">warning</span>
            <p className="text-slate-600 text-sm font-medium">{error}</p>
          </div>
        ) : church ? (
          <>
            {/* 동기화 날짜 */}
            <SyncDateLabel />

            {/* ─── 기본 정보 ─── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.sectionTitle}>
                <span className="material-symbols-outlined text-blue-500">info</span>
                기본 정보
              </h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="tag" label="교회코드" value={(church.ChrCode || '').trim()} />
                <DataRow icon="church" label="교회명" value={(church.CHRNAME || '').trim()} highlight />
                <DataRow icon="groups" label="노회" value={(church.NOHNAME || '').trim()} />
                <DataRow icon="account_tree" label="노회코드" value={(church.NohCode || '').trim()} />
                <DataRow icon="map" label="시찰" value={(church.SICHALNAME || '').trim()} />
                <DataRow icon="pin" label="시찰코드" value={(church.SichalCode || '').trim()} />
                <DataRow icon="person" label="담임목사" value={(church.MOCKNAME || '').trim()} highlight />
                <DataRow icon="calendar_month" label="설립일" value={formatEstDate((church.EstDate || '').trim())} />
                {(church.EndDate || '').trim() && (
                  <DataRow icon="event_busy" label="폐지일" value={formatEstDate((church.EndDate || '').trim())} />
                )}
                <DataRow icon="landscape" label="환경" value={ENV_MAP[(church.Environment || '').trim()] || (church.Environment || '').trim()} />
                <DataRow icon="verified" label="조직유무" value={(church.OrgYN || '').trim() === '1' ? '조직교회' : (church.OrgYN || '').trim() === '0' ? '미조직' : (church.OrgYN || '').trim()} />
                <DataRow icon="numbers" label="일련번호(Cnt)" value={(church.Cnt || '').toString().trim()} />
                <DataRow icon="fingerprint" label="HJ코드" value={(church.HJcode || '').toString().trim()} />
              </div>
            </div>

            {/* ─── 연락처 ─── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.sectionTitle}>
                <span className="material-symbols-outlined text-green-500">call</span>
                연락처
              </h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="phone" label="교회 전화" value={(church.Tel_Church || '').trim()} />
                <DataRow icon="phone_android" label="핸드폰" value={(church.Tel_Mobile || '').trim()} />
                <DataRow icon="phone_in_talk" label="자택 전화" value={(church.Tel_Home || '').trim()} />
                <DataRow icon="fax" label="팩스" value={(church.Tel_Fax || '').trim()} />
                <DataRow icon="mail" label="이메일" value={(church.Email || '').trim()} />
                <DataRow icon="language" label="홈페이지" value={(church.HomePage || '').trim()} />
              </div>
            </div>

            {/* ─── 주소 ─── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.sectionTitle}>
                <span className="material-symbols-outlined text-orange-500">location_on</span>
                주소 정보
              </h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="markunread_mailbox" label="우편번호" value={(church.PostNo || '').trim()} />
                <DataRow icon="home" label="주소 (구주소)" value={(church.ADDRESS || '').trim()} />
                <DataRow icon="edit_location" label="주소 (도로명)" value={(church.JUSO || '').trim()} />
              </div>
            </div>

            {/* ─── 비고(메모) ─── */}
            {(church.Remark || '').trim() && (
              <div className={S.card + ' p-5'}>
                <h3 className={S.sectionTitle}>
                  <span className="material-symbols-outlined text-purple-500">sticky_note_2</span>
                  비고 / 메모
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap break-all">
                  {(church.Remark || '').trim()}
                </div>
              </div>
            )}

            {/* ─── 전체 Raw 데이터 (디버그용) ─── */}
            <details className={S.card + ' overflow-hidden'}>
              <summary className="p-5 cursor-pointer flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[18px]">data_object</span>
                <span className="text-[13px] font-bold">전체 데이터 (Raw JSON)</span>
              </summary>
              <div className="px-5 pb-5">
                <pre className="bg-slate-50 rounded-xl p-4 text-[11px] text-slate-600 overflow-x-auto whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                  {JSON.stringify(church, null, 2)}
                </pre>
              </div>
            </details>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default ChurchManagePage;
