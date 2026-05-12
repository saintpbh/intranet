import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';
import MobileHeader from './mobile/MobileHeader';
import SyncDateLabel from './SyncDateLabel';
import { getChurchByChrCode, updateChurchByChrCode, insertChurch } from '../utils/supabaseRest';

const ENV_MAP = { '1': '도시', '2': '읍', '3': '면', '4': '농어촌' };

function formatEstDate(raw) {
  if (!raw || raw.length < 8) return raw || '';
  return `${raw.slice(0, 4)}년 ${raw.slice(4, 6)}월 ${raw.slice(6, 8)}일`;
}

/* ── 편집 가능 필드 모달 ── */
const EditModal = ({ title, value, onSave, onClose, multiline = false }) => {
  const [v, setV] = useState(value || '');
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        {multiline ? (
          <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[120px] focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none" value={v} onChange={e => setV(e.target.value)} />
        ) : (
          <input className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none" value={v} onChange={e => setV(e.target.value)} />
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">취소</button>
          <button onClick={() => onSave(v)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-200">저장</button>
        </div>
      </div>
    </div>
  );
};

/* ── 예배시간 편집 모달 ── */
const WorshipEditModal = ({ times, onSave, onClose }) => {
  const [rows, setRows] = useState(times?.length ? times : [{ name: '', time: '' }]);
  const add = () => setRows([...rows, { name: '', time: '' }]);
  const remove = i => setRows(rows.filter((_, idx) => idx !== i));
  const update = (i, k, v) => { const n = [...rows]; n[i] = { ...n[i], [k]: v }; setRows(n); };
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800">예배시간 편집</h3>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input placeholder="예배명" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={r.name} onChange={e => update(i, 'name', e.target.value)} />
            <input placeholder="시간" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={r.time} onChange={e => update(i, 'time', e.target.value)} />
            <button onClick={() => remove(i)} className="text-red-400 text-xl font-bold px-1">×</button>
          </div>
        ))}
        <button onClick={add} className="text-blue-600 text-sm font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">add</span>추가</button>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">취소</button>
          <button onClick={() => onSave(rows.filter(r => r.name || r.time))} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-200">저장</button>
        </div>
      </div>
    </div>
  );
};

const ChurchManagePage = () => {
  const { user, isLoggedIn } = useAuth();
  const [church, setChurch] = useState(null);       // TB_Chr100 (IndexedDB)
  const [mapData, setMapData] = useState(null);      // 기장지도 Supabase
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editField, setEditField] = useState(null);  // { key, title, multiline }
  const [editWorship, setEditWorship] = useState(false);
  const [toast, setToast] = useState('');

  const chrCode = church?.ChrCode?.trim?.() || user?.chrCode?.trim?.() || '';

  const getChurchDisplayName = () => {
    if (church?.CHRNAME) return (church.CHRNAME || '').trim();
    if (!user) return '';
    const name = user.church || '';
    if (!name || name.includes('총회')) return '총회본부';
    return name.endsWith('교회') ? name : name + '교회';
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // ── TB_Chr100 데이터 로드 (IndexedDB 캐시) ──
  const fetchChurch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { getCachedSearch } = await import('../utils/offlineDb');
      let found = null;
      if (user?.chrCode) {
        const res = await getCachedSearch('churches', user.chrCode);
        if (res?.length) found = res[0];
      }
      if (!found && user?.church) {
        const res = await getCachedSearch('churches', user.church);
        if (res?.length) {
          found = res.find(c => {
            const n = (c.CHRNAME || '').trim();
            return n === user.church || n === user.church + '교회' || user.church === n + '교회';
          }) || res[0];
        }
      }
      if (found) setChurch(found);
      else setError('교회 데이터를 찾을 수 없습니다. 데이터 동기화 후 다시 시도해 주세요.');
    } catch (e) { setError('교회 정보를 불러올 수 없습니다: ' + e.message); }
    finally { setLoading(false); }
  }, [user]);

  // ── 기장지도 Supabase 데이터 로드 ──
  const fetchMapData = useCallback(async (code) => {
    if (!code) return;
    setMapLoading(true);
    try {
      const data = await getChurchByChrCode(code);
      setMapData(data); // null if not registered
    } catch (e) { console.warn('[ChurchManage] Supabase fetch failed:', e); }
    finally { setMapLoading(false); }
  }, []);

  useEffect(() => { if (isLoggedIn) fetchChurch(); }, [isLoggedIn, fetchChurch]);
  useEffect(() => { if (chrCode) fetchMapData(chrCode); }, [chrCode, fetchMapData]);

  // ── 기장지도 필드 저장 ──
  const saveField = async (key, value) => {
    if (!chrCode) return;
    setSaving(true);
    try {
      let result;
      if (mapData) {
        result = await updateChurchByChrCode(chrCode, { [key]: value });
      } else {
        // 기장지도에 아직 없으면 신규 등록
        result = await insertChurch({
          chr_code: chrCode,
          name: getChurchDisplayName(),
          [key]: value,
        });
      }
      if (result) {
        setMapData(result);
        showToast('저장되었습니다');
      } else {
        showToast('저장 실패 — 다시 시도해 주세요');
      }
    } catch (e) { showToast('저장 오류: ' + e.message); }
    finally { setSaving(false); setEditField(null); setEditWorship(false); }
  };

  if (!isLoggedIn) return <SimpleLogin />;

  // ── Style tokens ──
  const S = {
    card: 'bg-white rounded-2xl shadow-[0_4px_24px_rgba(10,37,64,0.06)] border border-slate-100 overflow-hidden',
    title: "font-['Manrope','Pretendard'] text-[15px] font-bold text-slate-800 flex items-center gap-2 mb-4",
    label: 'text-[11px] font-bold text-slate-400 uppercase tracking-wider',
    value: 'text-[14px] font-semibold text-slate-800 mt-0.5',
    row: 'flex justify-between items-start py-3 border-b border-slate-50 last:border-b-0',
  };

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

  /* 편집 가능 행 */
  const EditableRow = ({ icon, label, value, fieldKey, multiline = false, color = 'text-blue-400' }) => (
    <div className={S.row + ' cursor-pointer group'} onClick={() => setEditField({ key: fieldKey, title: label, multiline, currentValue: value || '' })}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`material-symbols-outlined text-[16px] ${color} flex-shrink-0`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className={S.label}>{label}</p>
          {value ? (
            <p className={S.value + ' break-all whitespace-pre-wrap'}>{value}</p>
          ) : (
            <p className="text-[13px] text-slate-300 italic mt-0.5">미입력 — 탭하여 입력</p>
          )}
        </div>
      </div>
      <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-blue-500 transition-colors self-center ml-2">edit</span>
    </div>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans','Pretendard']">
      <MobileHeader title="교회" />
      <main className="pt-24 px-5 max-w-2xl mx-auto space-y-5">

        {/* ── Header Card ── */}
        <div className="rounded-[2rem] text-white shadow-[0_20px_40px_rgba(10,37,64,0.15)] relative overflow-hidden">
          {mapData?.main_photo_url ? (
            <img src={mapData.main_photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          <div className={`absolute inset-0 ${mapData?.main_photo_url ? 'bg-gradient-to-t from-black/80 via-black/40 to-black/20' : 'bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-500'}`}></div>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 p-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md mx-auto mb-3 flex items-center justify-center border border-white/30">
              <span className="material-symbols-outlined text-3xl">church</span>
            </div>
            <h2 className="text-2xl font-extrabold font-['Manrope','Pretendard'] mb-1 drop-shadow-lg">{getChurchDisplayName()}</h2>
            {(church?.NOHNAME || user?.presbytery) && (
              <p className="text-white/80 text-sm font-medium bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full inline-block mt-1">{(church?.NOHNAME || user?.presbytery || '').trim()}</p>
            )}
            {church?.MOCKNAME && <p className="text-white/60 text-[12px] mt-2">담임목사: {church.MOCKNAME.trim()}</p>}
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
            <SyncDateLabel />

            {/* ── 기장지도 정보 (편집 가능) ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}>
                <span className="material-symbols-outlined text-indigo-500">map</span>
                기장지도 교회정보
                {mapLoading && <span className="material-symbols-outlined animate-spin text-[14px] text-slate-400 ml-1">progress_activity</span>}
                {!mapData && !mapLoading && <span className="text-[11px] text-orange-500 font-medium ml-2">(미등록)</span>}
              </h3>
              <div className="divide-y divide-slate-50">
                <EditableRow icon="waving_hand" label="인삿말" value={mapData?.intro_text} fieldKey="intro_text" multiline color="text-indigo-400" />

                {/* 예배시간 */}
                <div className={S.row + ' cursor-pointer group'} onClick={() => setEditWorship(true)}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="material-symbols-outlined text-[16px] text-indigo-400 flex-shrink-0">schedule</span>
                    <div className="min-w-0 flex-1">
                      <p className={S.label}>예배시간</p>
                      {mapData?.worship_times?.length ? (
                        <div className="mt-1 space-y-1">
                          {mapData.worship_times.map((w, i) => (
                            <p key={i} className="text-[13px] text-slate-700"><span className="font-semibold">{w.name}</span> <span className="text-slate-400">|</span> {w.time}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13px] text-slate-300 italic mt-0.5">미입력 — 탭하여 입력</p>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-blue-500 transition-colors self-center ml-2">edit</span>
                </div>

                <EditableRow icon="smart_display" label="유튜브 영상 ID" value={mapData?.youtube_video_id} fieldKey="youtube_video_id" color="text-red-400" />
                <EditableRow icon="subscriptions" label="유튜브 채널 ID" value={mapData?.youtube_channel_id} fieldKey="youtube_channel_id" color="text-red-400" />
                <EditableRow icon="language" label="홈페이지 URL" value={mapData?.homepage_url} fieldKey="homepage_url" color="text-green-400" />
                <EditableRow icon="local_parking" label="주차 안내" value={mapData?.parking_info} fieldKey="parking_info" multiline color="text-teal-400" />
                <EditableRow icon="directions_bus" label="대중교통 안내" value={mapData?.transport_info} fieldKey="transport_info" multiline color="text-teal-400" />
              </div>

              {/* 유튜브 미리보기 */}
              {mapData?.youtube_video_id && (
                <div className="mt-4 rounded-xl overflow-hidden">
                  <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${mapData.youtube_video_id}`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="교회 영상"></iframe>
                </div>
              )}
            </div>

            {/* ── 기본 정보 (TB_Chr100 — 읽기전용) ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}>
                <span className="material-symbols-outlined text-blue-500">info</span>
                총회 DB 기본정보
                <span className="text-[10px] text-slate-400 font-normal ml-auto">읽기전용</span>
              </h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="tag" label="교회코드" value={chrCode} />
                <DataRow icon="church" label="교회명" value={(church.CHRNAME || '').trim()} highlight />
                <DataRow icon="groups" label="노회" value={(church.NOHNAME || '').trim()} />
                <DataRow icon="map" label="시찰" value={(church.SICHALNAME || '').trim()} />
                <DataRow icon="person" label="담임목사" value={(church.MOCKNAME || '').trim()} highlight />
                <DataRow icon="calendar_month" label="설립일" value={formatEstDate((church.EstDate || '').trim())} />
                <DataRow icon="landscape" label="환경" value={ENV_MAP[(church.Environment || '').trim()] || (church.Environment || '').trim()} />
                <DataRow icon="verified" label="조직유무" value={(church.OrgYN || '').trim() === '1' ? '조직교회' : (church.OrgYN || '').trim() === '0' ? '미조직' : ''} />
              </div>
            </div>

            {/* ── 연락처 ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}><span className="material-symbols-outlined text-green-500">call</span>연락처</h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="phone" label="교회 전화" value={(church.Tel_Church || '').trim()} />
                <DataRow icon="phone_android" label="핸드폰" value={(church.Tel_Mobile || '').trim()} />
                <DataRow icon="phone_in_talk" label="자택 전화" value={(church.Tel_Home || '').trim()} />
                <DataRow icon="fax" label="팩스" value={(church.Tel_Fax || '').trim()} />
                <DataRow icon="mail" label="이메일" value={(church.Email || '').trim()} />
                <DataRow icon="language" label="홈페이지" value={(church.HomePage || '').trim()} />
              </div>
            </div>

            {/* ── 주소 ── */}
            <div className={S.card + ' p-5'}>
              <h3 className={S.title}><span className="material-symbols-outlined text-orange-500">location_on</span>주소 정보</h3>
              <div className="divide-y divide-slate-50">
                <DataRow icon="markunread_mailbox" label="우편번호" value={(church.PostNo || '').trim()} />
                <DataRow icon="home" label="주소 (구주소)" value={(church.ADDRESS || '').trim()} />
                <DataRow icon="edit_location" label="주소 (도로명)" value={(church.JUSO || '').trim()} />
              </div>
            </div>

            {/* ── 비고 ── */}
            {(church.Remark || '').trim() && (
              <div className={S.card + ' p-5'}>
                <h3 className={S.title}><span className="material-symbols-outlined text-purple-500">sticky_note_2</span>비고 / 메모</h3>
                <div className="bg-slate-50 rounded-xl p-4 text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap break-all">{(church.Remark || '').trim()}</div>
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* ── Edit Modals ── */}
      {editField && (
        <EditModal
          title={editField.title}
          value={editField.currentValue}
          multiline={editField.multiline}
          onClose={() => setEditField(null)}
          onSave={v => saveField(editField.key, v)}
        />
      )}
      {editWorship && (
        <WorshipEditModal
          times={mapData?.worship_times || []}
          onClose={() => setEditWorship(false)}
          onSave={v => saveField('worship_times', v)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-800 text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl animate-fade-in">{toast}</div>
      )}
      {saving && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin text-blue-500">progress_activity</span>
            <span className="text-sm font-semibold text-slate-700">저장 중...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChurchManagePage;
