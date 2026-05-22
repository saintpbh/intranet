import { useState, useEffect, useCallback } from 'react';
import API_BASE from '../api';
import MobileHeader from './mobile/MobileHeader';

const PensionStatus = ({ user, onBack }) => {
  const [tab, setTab] = useState('history'); // 'history' | 'calculator'
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calculator state
  const [calcData, setCalcData] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [lev, setLev] = useState({ l1y:0,l1m:0,l2y:0,l2m:0,l3y:0,l3m:0,l4y:0,l4m:0 });
  const [retireAge, setRetireAge] = useState(65);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [lastEstimate, setLastEstimate] = useState(null);

  // Fetch summary
  useEffect(() => {
    if (!user?.code) return;
    setLoading(true);
    fetch(`${API_BASE}/api/pension/${user.code}/summary`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSummary(data);
        if (data.summary?.length > 0) setSelectedYear(data.summary[0].year);
      })
      .catch(err => setError(typeof err === 'string' ? err : err.message))
      .finally(() => setLoading(false));
  }, [user]);

  // Fetch last estimate
  useEffect(() => {
    if (!user?.code) return;
    fetch(`${API_BASE}/api/pension/${user.code}/last-estimate`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.found) setLastEstimate(data); })
      .catch(() => {});
  }, [user]);

  // Fetch detail
  useEffect(() => {
    if (!user?.code || !selectedYear) return;
    setDetailLoading(true);
    fetch(`${API_BASE}/api/pension/${user.code}/detail?year=${selectedYear}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => { if (!data.error) setDetail(data); })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [user, selectedYear]);

  // Fetch calc data
  const loadCalcData = useCallback(() => {
    if (!user?.code) return;
    setCalcLoading(true);
    fetch(`${API_BASE}/api/pension/${user.code}/calc-data`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => {
        if (data.error) { setCalcData(null); return; }
        setCalcData(data);
        const toYM = (cnt) => ({ y: Math.floor(cnt/12), m: cnt%12 });
        const l1 = toYM(data.lev1_cnt), l2 = toYM(data.lev2_cnt);
        const l3 = toYM(data.lev3_cnt), l4 = toYM(data.lev4_cnt);
        setLev({ l1y:l1.y, l1m:l1.m, l2y:l2.y, l2m:l2.m, l3y:l3.y, l3m:l3.m, l4y:l4.y, l4m:l4.m });
      })
      .catch(() => setCalcData(null))
      .finally(() => setCalcLoading(false));
  }, [user]);

  useEffect(() => { if (tab === 'calculator') loadCalcData(); }, [tab, loadCalcData]);

  // Calculate estimate
  const doEstimate = useCallback(async () => {
    if (!user?.code || !calcData) return;
    setEstimateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pension/${user.code}/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retire_age: retireAge,
          lev1_y: lev.l1y, lev1_m: lev.l1m, lev2_y: lev.l2y, lev2_m: lev.l2m,
          lev3_y: lev.l3y, lev3_m: lev.l3m, lev4_y: lev.l4y, lev4_m: lev.l4m,
          birth_year: calcData.birth_year, birth_month: calcData.birth_month,
          amt: calcData.amt,
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setEstimate(data);
        setLastEstimate({ found:true, retire_age:data.retirement_age, estimated_monthly:data.estimated_monthly,
          contribution_rate:data.contribution_rate, retirement_rate:data.retirement_rate });
      }
    } catch (e) { console.error(e); }
    finally { setEstimateLoading(false); }
  }, [user, calcData, retireAge, lev]);

  const fmt = (v) => v ? v.toLocaleString('ko-KR') : '0';
  const yearList = summary?.summary?.map(s => s.year) || [];
  const navYear = (dir) => {
    const idx = yearList.indexOf(selectedYear);
    if (dir === 'prev' && idx < yearList.length-1) setSelectedYear(yearList[idx+1]);
    if (dir === 'next' && idx > 0) setSelectedYear(yearList[idx-1]);
  };
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const selStyle = "w-full bg-surface-container-low rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50";
  const numOpts = (max) => Array.from({length:max+1},(_,i)=>i);

  return (
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans','Pretendard'] text-on-surface antialiased pb-20">
      <MobileHeader showBack={true} onBack={onBack} title="연금납입 현황" />
      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-6">
        {/* Tab Switcher */}
        <div className="flex bg-surface-container-lowest rounded-2xl p-1 shadow-sm">
          {[{id:'history',label:'납입 현황',icon:'receipt_long'},{id:'calculator',label:'예상 연금 계산',icon:'calculate'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                tab===t.id ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}>
              <span className="material-symbols-outlined text-lg">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB 1: 납입 현황 ═══ */}
        {tab === 'history' && (
          <>
            {loading ? (
              <div className="flex flex-col items-center py-20">
                <span className="material-symbols-outlined text-4xl text-outline animate-spin">progress_activity</span>
                <p className="mt-4 text-sm text-on-surface-variant">납입 현황을 불러오는 중...</p>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-5xl text-outline mb-4 block">error_outline</span>
                <p className="text-on-surface-variant text-sm">{error}</p>
              </div>
            ) : !summary || summary.total_years === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-5xl text-outline mb-4 block">info</span>
                <p className="text-on-surface-variant text-sm">{summary?.message || '연금납입 이력이 없습니다.'}</p>
              </div>
            ) : (
              <>
                {/* Total Card */}
                <section className="rounded-3xl text-white shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1b4332] to-[#40916c]"></div>
                  <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%)'}}></div>
                  <div className="relative z-10 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">savings</span>
                      </div>
                      <div>
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">연금납입</p>
                        <p className="text-white/60 text-[11px]">{summary.minister_name} ({summary.pen_no})</p>
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold font-['Manrope','Pretendard'] tracking-tight">
                      {fmt(summary.total_amount)}<span className="text-lg font-bold ml-1 text-white/80">원</span>
                    </p>
                    <p className="text-white/60 text-xs mt-2">
                      {summary.total_years}년간 ({summary.total_months || (summary.summary ? summary.summary.reduce((acc, cur) => acc + cur.months_paid, 0) : 0)}개월) 납입 이력
                    </p>
                  </div>
                </section>

                {/* 예상 연금 카드 (이전 계산 결과) */}
                {lastEstimate && (
                  <section className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-5 border border-indigo-200/60 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-indigo-600 text-xl">payments</span>
                        </div>
                        <div>
                          <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider">예상 월 수령액</p>
                          <p className="text-xl font-extrabold text-indigo-900 font-['Manrope','Pretendard']">{fmt(lastEstimate.estimated_monthly)}<span className="text-sm font-bold ml-0.5">원</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 text-xs font-bold">만 {lastEstimate.retire_age}세</span>
                        <p className="text-[10px] text-indigo-400 mt-1">지급개시 예정 나이</p>
                      </div>
                    </div>
                    {lastEstimate.base_salary && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-indigo-200/50 text-[11px] text-indigo-500/80 font-medium">
                        <span className="material-symbols-outlined text-xs">function</span>
                        <span>기준봉급 {fmt(lastEstimate.base_salary)}원 × 총납입비율 {lastEstimate.contribution_rate}% × 퇴직적용율 {lastEstimate.retirement_rate}%</span>
                      </div>
                    )}
                    <p className="text-[10px] text-indigo-400 mt-2">※ 예상치이며, 정확한 정보는 총회 연금 담당자(02-3499-7608)에 문의하세요.</p>
                  </section>
                )}

                {/* Year Navigator */}
                <section className="flex items-center justify-between bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-sm">
                  <button onClick={() => navYear('prev')} disabled={yearList.indexOf(selectedYear) >= yearList.length-1}
                    className="p-2 rounded-full hover:bg-surface-container-high active:scale-90 transition-all disabled:opacity-30">
                    <span className="material-symbols-outlined text-primary">chevron_left</span>
                  </button>
                  <div className="text-center">
                    <p className="font-['Manrope','Pretendard'] font-extrabold text-xl text-primary">{selectedYear}년</p>
                    {detail && <p className="text-xs text-on-surface-variant mt-0.5">{detail.months_paid}개월 납입 · 총 {fmt(detail.year_total)}원</p>}
                  </div>
                  <button onClick={() => navYear('next')} disabled={yearList.indexOf(selectedYear) <= 0}
                    className="p-2 rounded-full hover:bg-surface-container-high active:scale-90 transition-all disabled:opacity-30">
                    <span className="material-symbols-outlined text-primary">chevron_right</span>
                  </button>
                </section>

                {/* Monthly Grid */}
                {detailLoading ? (
                  <div className="text-center py-10"><span className="material-symbols-outlined text-2xl text-outline animate-spin">progress_activity</span></div>
                ) : detail ? (
                  <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
                    <div className="grid grid-cols-3 gap-px bg-surface-variant/30">
                      {detail.monthly.map((m, idx) => (
                        <div key={m.month} className={`p-4 text-center transition-colors ${m.paid ? 'bg-emerald-50' : 'bg-white'}`}>
                          <p className={`text-xs font-bold mb-1.5 ${m.paid ? 'text-emerald-600' : 'text-outline'}`}>{months[idx]}</p>
                          {m.paid ? (<>
                            <div className="w-8 h-8 rounded-full bg-emerald-500 mx-auto flex items-center justify-center mb-1.5">
                              <span className="material-symbols-outlined text-white text-base">check</span>
                            </div>
                            <p className="text-[11px] font-bold text-emerald-700">{fmt(m.amt)}원</p>
                          </>) : (<>
                            <div className="w-8 h-8 rounded-full bg-surface-variant/40 mx-auto flex items-center justify-center mb-1.5">
                              <span className="material-symbols-outlined text-outline/50 text-base">remove</span>
                            </div>
                            <p className="text-[11px] text-outline/50">미납</p>
                          </>)}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* Year Table */}
                <section>
                  <h3 className="font-['Manrope','Pretendard'] font-bold text-primary mb-3 px-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-lg">calendar_month</span>연도별 납입 이력
                  </h3>
                  <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-surface-container-low/50 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                        <th className="text-left px-4 py-3">연도</th><th className="text-center px-2 py-3">납입월</th><th className="text-right px-4 py-3">납입총액</th>
                      </tr></thead>
                      <tbody>{summary.summary.map(yr => (
                        <tr key={yr.year} onClick={() => setSelectedYear(yr.year)}
                          className={`border-t border-surface-variant/30 cursor-pointer transition-colors active:bg-surface-container-high ${yr.year===selectedYear ? 'bg-primary/5' : 'hover:bg-surface-container-low/30'}`}>
                          <td className="px-4 py-3"><span className={`font-bold ${yr.year===selectedYear ? 'text-primary' : 'text-on-surface'}`}>{yr.year}년</span></td>
                          <td className="text-center px-2 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${yr.months_paid>=12?'bg-emerald-100 text-emerald-700':yr.months_paid>=6?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{yr.months_paid}/12</span>
                          </td>
                          <td className="text-right px-4 py-3 font-bold text-on-surface tabular-nums">{fmt(yr.total_amt)}원</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ═══ TAB 2: 예상 연금 계산기 ═══ */}
        {tab === 'calculator' && (
          <>
            {calcLoading ? (
              <div className="flex flex-col items-center py-20">
                <span className="material-symbols-outlined text-4xl text-outline animate-spin">progress_activity</span>
                <p className="mt-4 text-sm text-on-surface-variant">기초 데이터를 불러오는 중...</p>
              </div>
            ) : !calcData ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-5xl text-outline mb-4 block">info</span>
                <p className="text-on-surface-variant text-sm">연금 계산 데이터가 없습니다.</p>
              </div>
            ) : (
              <>
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl px-5 py-4 border border-blue-200/60">
                  <p className="text-[12px] text-blue-800 leading-relaxed">
                    <strong>📌 안내:</strong> 은퇴 시점에 따른 예상 연금 지급액을 조회할 수 있습니다. 불입개월을 조정하여 추가 납입 시 예상 금액도 확인 가능합니다.
                  </p>
                </div>

                {/* 기본 납입 정보 */}
                <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-4">
                  <h3 className="font-['Manrope','Pretendard'] font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-lg">edit_note</span>기본 납입 정보
                  </h3>
                  {/* 연금불입 */}
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mt-2">연금불입</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-outline font-semibold block mb-1">1단계 불입</label>
                      <div className="flex gap-1 items-center">
                        <select value={lev.l1y} onChange={e => setLev({...lev, l1y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l1m} onChange={e => setLev({...lev, l1m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-outline font-semibold block mb-1">2단계 불입</label>
                      <div className="flex gap-1 items-center">
                        <select value={lev.l2y} onChange={e => setLev({...lev, l2y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l2m} onChange={e => setLev({...lev, l2m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* 특약불입 */}
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mt-3">특약불입</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-outline font-semibold block mb-1">3단계 불입</label>
                      <div className="flex gap-1 items-center">
                        <select value={lev.l3y} onChange={e => setLev({...lev, l3y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l3m} onChange={e => setLev({...lev, l3m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-outline font-semibold block mb-1">4단계 불입</label>
                      <div className="flex gap-1 items-center">
                        <select value={lev.l4y} onChange={e => setLev({...lev, l4y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l4m} onChange={e => setLev({...lev, l4m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 지급개시 나이 선택 */}
                <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-4">
                  <h3 className="font-['Manrope','Pretendard'] font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-lg">elderly</span>지급개시 나이 (만 나이)
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[11px] text-outline font-semibold block mb-1">은퇴 시 만 나이</label>
                      <select value={retireAge} onChange={e => setRetireAge(+e.target.value)} className={selStyle}>
                        {Array.from({length:21},(_,i) => 60+i).map(a => <option key={a} value={a} style={(a===65||a===70)?{fontWeight:'bold'}:{}}>만 {a}세</option>)}
                      </select>
                    </div>
                  </div>
                  {calcData.birth_year > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-on-surface-variant">생년월일: {calcData.birth_year}년 {calcData.birth_month}월 · 기준봉급액: {fmt(calcData.amt)}원</p>
                      <p className="text-[11px] text-on-surface-variant">→ 만 {retireAge}세 = {calcData.birth_year + retireAge}년 지급개시 예정</p>
                    </div>
                  )}
                </section>

                {/* 계산 버튼 */}
                <button onClick={doEstimate} disabled={estimateLoading}
                  className="w-full py-4 bg-gradient-to-r from-[#1b4332] to-[#40916c] text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base">
                  {estimateLoading ? (<>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>계산 중...
                  </>) : (<>
                    <span className="material-symbols-outlined text-lg">calculate</span>예상 지급액 계산하기
                  </>)}
                </button>

                {/* 결과 표시 */}
                {estimate && (
                  <>
                    {/* 예상 지급액 Hero */}
                    <section className="rounded-3xl text-white shadow-xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b2a] to-[#1b4332]"></div>
                      <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)'}}></div>
                      <div className="relative z-10 p-7 text-center">
                        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">예상 월 지급액</p>
                        <p className="text-4xl font-black font-['Manrope','Pretendard'] tracking-tight animate-fade-in">
                          {fmt(estimate.estimated_monthly)}<span className="text-xl font-bold ml-1 text-white/80">원</span>
                        </p>
                        <p className="text-white/50 text-[11px] mt-3">매월 지급 예상 금액 (1,000원 미만 절사)</p>
                      </div>
                    </section>

                    {/* 상세 정보 */}
                    <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
                      <h3 className="font-['Manrope','Pretendard'] font-bold text-primary mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-lg">info</span>계산 상세
                      </h3>
                      <div className="space-y-3">
                        {[
                          {label:'연금 인정개월', value:`${estimate.pension_months_recognized}개월`},
                          {label:'특약 인정개월', value:`${estimate.special_months_recognized}개월`},
                          {label:'연금 납입비율', value:`${estimate.pension_rate}%`},
                          {label:'특약 납입비율', value:`${estimate.special_rate}%`},
                          {label:'총 납입비율', value:`${estimate.contribution_rate}%`, bold:true},
                          {label:'퇴직 만 나이', value:`${estimate.retirement_age}세`},
                          {label:'퇴직적용율', value:`${estimate.retirement_rate}%`},
                          {label:'기준 봉급액', value:`${fmt(estimate.base_salary)}원`},
                        ].map((item,i) => (
                          <div key={i} className={`flex justify-between items-center py-2 ${i<7?'border-b border-surface-variant/30':''}`}>
                            <span className="text-sm text-on-surface-variant">{item.label}</span>
                            <span className={`text-sm tabular-nums ${item.bold?'font-extrabold text-primary':'font-bold text-on-surface'}`}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* 안내 */}
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200/60 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">warning</span>
                  <div className="text-[11px] text-amber-800 leading-relaxed space-y-1">
                    <p>본 계산은 현재 기준 봉급액({fmt(calcData?.amt)}원)을 기준으로 한 <strong>예상치</strong>이며, 실제 지급액과 차이가 있을 수 있습니다.</p>
                    <p><strong>📞 정확한 정보는 총회 연금 담당자(02-3499-7608)에 문의하세요.</strong></p>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PensionStatus;
