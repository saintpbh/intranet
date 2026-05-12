import { getSyncDate } from '../utils/offlineDb';

/**
 * 데이터 동기화 날짜 표시 컴포넌트
 * 아주 작은 회색 텍스트로 "25년05월12일자 데이터입니다." 형태로 출력
 */
const SyncDateLabel = () => {
  const syncDate = getSyncDate();
  if (!syncDate) return null;

  // "2026-05-12 15:00" → "26년05월12일자 데이터입니다."
  const parts = syncDate.split(/[-\s:]/);
  if (parts.length < 3) return null;
  const label = `${parts[0].slice(2)}년${parts[1]}월${parts[2]}일자 데이터입니다.`;

  return (
    <p className="text-[10px] text-gray-400 mb-3 text-right">{label}</p>
  );
};

export default SyncDateLabel;
