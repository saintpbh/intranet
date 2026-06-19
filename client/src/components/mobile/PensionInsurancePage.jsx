import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../AuthContext';
import MobileHeader from './MobileHeader';
import API_BASE from '../../api';

/* ──── Helpers ──── */
const fmt = (v) => v ? v.toLocaleString('ko-KR') : '0';
const numOpts = (max) => Array.from({ length: max + 1 }, (_, i) => i);
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

/* ──── Animated Count-Up ──── */
const AnimatedNumber = ({ value, duration = 800 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) { setDisplay(0); return; }
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{fmt(display)}</>;
};

/* ──── Monthly Grid Component ──── */
const MonthlyGrid = ({ monthly, formatAmt, color = 'emerald' }) => {
  const isEmerald = color === 'emerald';
  return (
    <div className="grid grid-cols-4 gap-2">
      {monthly.map((m, idx) => (
        <div
          key={m.month}
          className={`relative rounded-xl p-2.5 text-center transition-all duration-300 ${
            m.paid
              ? isEmerald
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 border border-emerald-200/60 shadow-sm'
                : 'bg-gradient-to-br from-blue-50 to-blue-100/80 border border-blue-200/60 shadow-sm'
              : 'bg-surface-container-low/50 border border-surface-variant/20'
          }`}
        >
          <p className={`text-[10px] font-bold mb-1 ${m.paid ? (isEmerald ? 'text-emerald-600' : 'text-blue-600') : 'text-outline/60'}`}>
            {MONTHS[idx]}
          </p>
          {m.paid ? (
            <>
              <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center mb-1 ${isEmerald ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                <span className="material-symbols-outlined text-white text-xs">check</span>
              </div>
              <p className={`text-[9px] font-bold tabular-nums ${isEmerald ? 'text-emerald-700' : 'text-blue-700'}`}>{formatAmt(m.amt)}</p>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-full bg-surface-variant/30 mx-auto flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-outline/30 text-xs">remove</span>
              </div>
              <p className="text-[9px] text-outline/40">-</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

/* ──── Year Navigator Component ──── */
const YearNavigator = ({ selectedYear, yearList, onNavigate, detail, formatAmt, color = 'emerald' }) => {
  const idx = yearList.indexOf(selectedYear);
  const isEmerald = color === 'emerald';
  const textColor = isEmerald ? 'text-emerald-700' : 'text-blue-700';
  const btnHoverColor = isEmerald ? 'hover:bg-emerald-50' : 'hover:bg-blue-50';

  return (
    <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl px-3 py-2.5 shadow-sm border border-surface-variant/20">
      <button
        onClick={() => onNavigate('prev')}
        disabled={idx >= yearList.length - 1}
        className={`w-9 h-9 rounded-full ${btnHoverColor} active:scale-90 transition-all disabled:opacity-20 flex items-center justify-center`}
      >
        <span className={`material-symbols-outlined ${textColor} text-lg`}>chevron_left</span>
      </button>
      <div className="text-center">
        <p className={`font-['Manrope','Pretendard'] font-extrabold text-lg ${textColor}`}>{selectedYear}년</p>
        {detail && (
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {detail.months_paid}개월 · {formatAmt(detail.year_total)}원
          </p>
        )}
      </div>
      <button
        onClick={() => onNavigate('next')}
        disabled={idx <= 0}
        className={`w-9 h-9 rounded-full ${btnHoverColor} active:scale-90 transition-all disabled:opacity-20 flex items-center justify-center`}
      >
        <span className={`material-symbols-outlined ${textColor} text-lg`}>chevron_right</span>
      </button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
/* ═══  MAIN: PensionInsurancePage  ═══ */
/* ════════════════════════════════════════════════════════════════════ */
const PensionInsurancePage = () => {
  const { user } = useAuth();

  /* ── Pension state ── */
  const [penSummary, setPenSummary] = useState(null);
  const [penDetail, setPenDetail] = useState(null);
  const [penYear, setPenYear] = useState(null);
  const [penLoading, setPenLoading] = useState(true);
  const [penDetailLoading, setPenDetailLoading] = useState(false);
  const [penError, setPenError] = useState(null);
  const [lastEstimate, setLastEstimate] = useState(null);

  /* ── Insurance state ── */
  const [insSummary, setInsSummary] = useState(null);
  const [insDetail, setInsDetail] = useState(null);
  const [insYear, setInsYear] = useState(null);
  const [insLoading, setInsLoading] = useState(true);
  const [insDetailLoading, setInsDetailLoading] = useState(false);
  const [insError, setInsError] = useState(null);

  /* ── Calculator state ── */
  const [calcData, setCalcData] = useState(null);
  const [lev, setLev] = useState({ l1y:0,l1m:0,l2y:0,l2m:0,l3y:0,l3m:0,l4y:0,l4m:0 });
  const [retireAge, setRetireAge] = useState(65);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  /* ── UI state ── */
  const [expandedSection, setExpandedSection] = useState(null); // 'pension' | 'insurance' | 'calculator'

  /* ── Reset view event ── */
  useEffect(() => {
    const handleReset = () => {
      setExpandedSection(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('reset-documents-view', handleReset);
    return () => window.removeEventListener('reset-documents-view', handleReset);
  }, []);

  /* ──────── Fetch Pension Dashboard ──────── */
  useEffect(() => {
    if (!user?.code) return;
    setPenLoading(true);
    setPenError(null);
    fetch(`${API_BASE}/api/pension/${user.code}/dashboard`)
      .then(r => r.ok ? r.json() : Promise.reject('연금 데이터를 불러올 수 없습니다.'))
      .then(data => {
        if (data.error) throw new Error(data.error);
        setPenSummary(data);
        if (data.detail) { setPenDetail(data.detail); setPenYear(data.detail.year); }
        if (data.last_estimate?.found) {
          setLastEstimate(data.last_estimate);
          if (data.last_estimate.retire_age) setRetireAge(data.last_estimate.retire_age);
        }
        if (data.calc_data) {
          setCalcData(data.calc_data);
          const toYM = (cnt) => ({ y: Math.floor(cnt/12), m: cnt%12 });
          const l1=toYM(data.calc_data.lev1_cnt), l2=toYM(data.calc_data.lev2_cnt);
          const l3=toYM(data.calc_data.lev3_cnt), l4=toYM(data.calc_data.lev4_cnt);
          setLev({ l1y:l1.y,l1m:l1.m,l2y:l2.y,l2m:l2.m,l3y:l3.y,l3m:l3.m,l4y:l4.y,l4m:l4.m });
          if (data.calc_data.retirement_age && !data.last_estimate?.found) {
            setRetireAge(data.calc_data.retirement_age);
          }
        }
      })
      .catch(err => setPenError(typeof err === 'string' ? err : err.message))
      .finally(() => setPenLoading(false));
  }, [user]);

  /* ──────── Fetch Insurance Summary ──────── */
  useEffect(() => {
    if (!user?.code) return;
    setInsLoading(true);
    setInsError(null);
    fetch(`${API_BASE}/api/insurance/${user.code}/summary`)
      .then(r => r.ok ? r.json() : Promise.reject('생보 데이터를 불러올 수 없습니다.'))
      .then(data => {
        if (data.error) throw new Error(data.error);
        setInsSummary(data);
        if (data.summary?.length > 0) setInsYear(data.summary[0].year);
      })
      .catch(err => setInsError(typeof err === 'string' ? err : err.message))
      .finally(() => setInsLoading(false));
  }, [user]);

  /* ── Pension detail on year change ── */
  useEffect(() => {
    if (!user?.code || !penYear) return;
    if (penDetail && penDetail.year === penYear) return;
    setPenDetailLoading(true);
    fetch(`${API_BASE}/api/pension/${user.code}/detail?year=${penYear}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => { if (!data.error) setPenDetail(data); })
      .catch(() => setPenDetail(null))
      .finally(() => setPenDetailLoading(false));
  }, [user, penYear]);

  /* ── Insurance detail on year change ── */
  useEffect(() => {
    if (!user?.code || !insYear) return;
    setInsDetailLoading(true);
    fetch(`${API_BASE}/api/insurance/${user.code}/detail?year=${insYear}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => { if (!data.error) setInsDetail(data); })
      .catch(() => setInsDetail(null))
      .finally(() => setInsDetailLoading(false));
  }, [user, insYear]);

  /* ── Calculator ── */
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

  /* ── Navigation helpers ── */
  const penYearList = penSummary?.summary?.map(s => s.year) || [];
  const insYearList = insSummary?.summary?.map(s => s.year) || [];
  const navPenYear = (dir) => {
    const idx = penYearList.indexOf(penYear);
    if (dir === 'prev' && idx < penYearList.length-1) setPenYear(penYearList[idx+1]);
    if (dir === 'next' && idx > 0) setPenYear(penYearList[idx-1]);
  };
  const navInsYear = (dir) => {
    const idx = insYearList.indexOf(insYear);
    if (dir === 'prev' && idx < insYearList.length-1) setInsYear(insYearList[idx+1]);
    if (dir === 'next' && idx > 0) setInsYear(insYearList[idx-1]);
  };

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const isAllLoading = penLoading && insLoading;

  const selStyle = "w-full bg-surface-container-low rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50";

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader title="연금/생보" />

      <main className="pt-24 px-4 max-w-2xl mx-auto">
        {isAllLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <span className="material-symbols-outlined text-4xl text-outline animate-spin">progress_activity</span>
            <p className="mt-4 text-sm text-on-surface-variant">데이터를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ═══════════════ DASHBOARD HERO CARDS ═══════════════ */}
            <div className="grid grid-cols-2 gap-3">
              {/* Pension Summary Card */}
              <button
                onClick={() => toggleSection('pension')}
                className={`text-left rounded-[1.5rem] relative overflow-hidden shadow-lg transition-all duration-300 active:scale-[0.97] ${
                  expandedSection === 'pension' ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#1b4332] to-[#40916c]" />
                <div className="absolute inset-0 opacity-[0.08]" style={{backgroundImage:'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.5) 0%, transparent 50%)'}} />
                <div className="relative z-10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        {/* Ferrule (top tip) */}
                        <path d="M12 2v1" />
                        {/* Canopy */}
                        <path d="M3 12c0-5 4-9 9-9s9 4 9 9" />
                        {/* Scalloped bottom edge */}
                        <path d="M3 12c1.5 1 4.5 1 6 0 1.5 1 4.5 1 6 0 1.5 1 4.5 1 6 0" />
                        {/* Ribs inside canopy */}
                        <path d="M12 3c-1.5 3-2.5 6-3 9" />
                        <path d="M12 3c1.5 3 2.5 6 3 9" />
                        {/* Shaft & Hook handle */}
                        <path d="M12 12v7a2 2 0 0 1-2 2h-1" />
                      </svg>
                    </div>
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">연금</span>
                  </div>
                  {penError ? (
                    <p className="text-white/60 text-xs">조회 불가</p>
                  ) : penSummary && penSummary.total_years > 0 ? (
                    <>
                      <p className="text-white font-extrabold text-xl font-['Manrope','Pretendard'] tracking-tight leading-tight">
                        <AnimatedNumber value={penSummary.total_amount} />
                        <span className="text-xs font-bold ml-0.5 text-white/70">원</span>
                      </p>
                      <p className="text-white/50 text-[10px] mt-1.5">{penSummary.total_years}년 납입</p>
                    </>
                  ) : (
                    <p className="text-white/50 text-xs mt-2">납입 이력 없음</p>
                  )}
                  <div className="flex items-center gap-1 mt-3 text-white/40 text-[10px]">
                    <span className="material-symbols-outlined text-xs">{expandedSection === 'pension' ? 'expand_less' : 'expand_more'}</span>
                    상세보기
                  </div>
                </div>
              </button>

              {/* Insurance Summary Card */}
              <button
                onClick={() => toggleSection('insurance')}
                className={`text-left rounded-[1.5rem] relative overflow-hidden shadow-lg transition-all duration-300 active:scale-[0.97] ${
                  expandedSection === 'insurance' ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a5276] to-[#2e86c1]" />
                <div className="absolute inset-0 opacity-[0.08]" style={{backgroundImage:'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.5) 0%, transparent 50%)'}} />
                <div className="relative z-10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-base">account_balance</span>
                    </div>
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">생보</span>
                  </div>
                  {insError ? (
                    <p className="text-white/60 text-xs">조회 불가</p>
                  ) : insSummary && insSummary.total_years > 0 ? (
                    <>
                      <p className="text-white font-extrabold text-xl font-['Manrope','Pretendard'] tracking-tight leading-tight">
                        <AnimatedNumber value={insSummary.total_amount} />
                        <span className="text-xs font-bold ml-0.5 text-white/70">원</span>
                      </p>
                      <p className="text-white/50 text-[10px] mt-1.5">{insSummary.total_years}년 납입</p>
                    </>
                  ) : (
                    <p className="text-white/50 text-xs mt-2">납입 이력 없음</p>
                  )}
                  <div className="flex items-center gap-1 mt-3 text-white/40 text-[10px]">
                    <span className="material-symbols-outlined text-xs">{expandedSection === 'insurance' ? 'expand_less' : 'expand_more'}</span>
                    상세보기
                  </div>
                </div>
              </button>
            </div>

            {/* ═══ Estimated Pension Quick Card ═══ */}
            {lastEstimate && (
              <button
                onClick={() => toggleSection('calculator')}
                className={`w-full text-left bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-100/40 rounded-2xl p-4 border border-emerald-200 shadow-sm transition-all duration-300 active:scale-[0.98] ${
                  expandedSection === 'calculator' ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600 text-xl animate-pulse">calculate</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-emerald-800 font-extrabold tracking-wider uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                          연금계산기
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium mt-1">예상 연금 월 수령액</p>
                      <p className="text-lg font-extrabold text-emerald-900 font-['Manrope','Pretendard'] mt-0.5">
                        {fmt(lastEstimate.estimated_monthly)}<span className="text-xs font-bold ml-0.5">원</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[11px] font-bold">
                      만 {lastEstimate.retire_age}세
                    </span>
                    <div className="flex items-center gap-0.5 mt-2.5 text-emerald-600 text-[10px] font-bold justify-end">
                      <span>{expandedSection === 'calculator' ? '접기' : '모의 계산하기'}</span>
                      <span className="material-symbols-outlined text-xs">{expandedSection === 'calculator' ? 'expand_less' : 'expand_more'}</span>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* ═══ Calculator shortcut if no previous estimate ═══ */}
            {!lastEstimate && calcData && (
              <button
                onClick={() => toggleSection('calculator')}
                className={`w-full text-left bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-100/40 rounded-2xl p-4 border border-emerald-200 shadow-sm transition-all duration-300 active:scale-[0.98] ${
                  expandedSection === 'calculator' ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 text-xl animate-pulse">calculate</span>
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-800 font-extrabold tracking-wider uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                        연금계산기
                      </span>
                    </div>
                    <p className="text-sm font-bold text-emerald-950 mt-1">예상 연금 모의 계산기</p>
                    <p className="text-[10px] text-emerald-700/80 mt-0.5 font-medium">은퇴 나이별 예상 연금 월 수령액을 지금 확인해보세요</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <div className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-bold">
                      <span>{expandedSection === 'calculator' ? '접기' : '시작하기'}</span>
                      <span className="material-symbols-outlined text-xs">{expandedSection === 'calculator' ? 'expand_less' : 'arrow_forward_ios'}</span>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* ═══════════════ EXPANDED: PENSION DETAIL ═══════════════ */}
            {expandedSection === 'pension' && penSummary && penSummary.total_years > 0 && (
              <div className="space-y-3 animate-fade-in">
                {/* User info pill */}
                <div className="flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-emerald-600 text-base">person</span>
                  <p className="text-xs text-on-surface-variant">
                    {penSummary.minister_name} <span className="text-outline/60">({penSummary.pen_no})</span>
                  </p>
                </div>

                {/* Year Navigator */}
                <YearNavigator
                  selectedYear={penYear}
                  yearList={penYearList}
                  onNavigate={navPenYear}
                  detail={penDetail}
                  formatAmt={fmt}
                  color="emerald"
                />

                {/* Monthly Grid */}
                {penDetailLoading ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-2xl text-outline animate-spin">progress_activity</span>
                  </div>
                ) : penDetail?.monthly ? (
                  <MonthlyGrid monthly={penDetail.monthly} formatAmt={fmt} color="emerald" />
                ) : null}

                {/* Year History — Compact */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-surface-variant/20">
                  <div className="px-4 py-2.5 bg-surface-container-low/30 border-b border-surface-variant/20">
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-xs">calendar_month</span>
                      연도별 납입
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {penSummary.summary.map(yr => (
                      <div
                        key={yr.year}
                        onClick={() => setPenYear(yr.year)}
                        className={`flex items-center justify-between px-4 py-2.5 border-b border-surface-variant/10 cursor-pointer transition-colors active:bg-surface-container-high ${
                          yr.year === penYear ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <span className={`text-sm font-bold ${yr.year === penYear ? 'text-emerald-700' : 'text-on-surface'}`}>{yr.year}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            yr.months_paid >= 12 ? 'bg-emerald-100 text-emerald-700'
                            : yr.months_paid >= 6 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>{yr.months_paid}/12</span>
                          <span className="text-sm font-bold text-on-surface tabular-nums">{fmt(yr.total_amt)}원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ EXPANDED: INSURANCE DETAIL ═══════════════ */}
            {expandedSection === 'insurance' && insSummary && insSummary.total_years > 0 && (
              <div className="space-y-3 animate-fade-in">
                {/* User info */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-base">person</span>
                    <p className="text-xs text-on-surface-variant">
                      {insSummary.minister_name} <span className="text-outline/60">({insSummary.minister_code})</span>
                    </p>
                  </div>
                  {insSummary.monthly_charge > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      <span className="material-symbols-outlined text-xs">payments</span>
                      월 {fmt(insSummary.monthly_charge)}원
                    </span>
                  )}
                </div>

                {/* Year Navigator */}
                <YearNavigator
                  selectedYear={insYear}
                  yearList={insYearList}
                  onNavigate={navInsYear}
                  detail={insDetail}
                  formatAmt={fmt}
                  color="blue"
                />

                {/* Monthly Grid */}
                {insDetailLoading ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-2xl text-outline animate-spin">progress_activity</span>
                  </div>
                ) : insDetail?.monthly ? (
                  <MonthlyGrid monthly={insDetail.monthly} formatAmt={fmt} color="blue" />
                ) : null}

                {/* Year History */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-surface-variant/20">
                  <div className="px-4 py-2.5 bg-surface-container-low/30 border-b border-surface-variant/20">
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-xs">calendar_month</span>
                      연도별 납입
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {insSummary.summary.map(yr => (
                      <div
                        key={yr.year}
                        onClick={() => setInsYear(yr.year)}
                        className={`flex items-center justify-between px-4 py-2.5 border-b border-surface-variant/10 cursor-pointer transition-colors active:bg-surface-container-high ${
                          yr.year === insYear ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <span className={`text-sm font-bold ${yr.year === insYear ? 'text-blue-700' : 'text-on-surface'}`}>{yr.year}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            yr.months_paid >= 12 ? 'bg-blue-100 text-blue-700'
                            : yr.months_paid >= 6 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>{yr.months_paid}/12</span>
                          <span className="text-sm font-bold text-on-surface tabular-nums">{fmt(yr.total_amt)}원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info note */}
                <div className="bg-surface-container-low rounded-xl px-3 py-2.5 border border-surface-variant/40 flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-sm shrink-0 mt-0.5">info</span>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">
                    총회 생활보장제 납입 기록입니다. 문의: 총회 사무국
                  </p>
                </div>
              </div>
            )}

            {/* ═══════════════ EXPANDED: CALCULATOR ═══════════════ */}
            {expandedSection === 'calculator' && calcData && (
              <div className="space-y-3 animate-fade-in">
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-4 py-3 border border-blue-200/50">
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    <strong>📌</strong> 은퇴 시점에 따른 예상 연금 지급액을 조회할 수 있습니다. 불입개월을 조정하여 추가 납입 시 예상 금액도 확인하세요.
                  </p>
                </div>

                {/* 납입 정보 */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3 border border-surface-variant/20">
                  <h3 className="font-['Manrope','Pretendard'] font-bold text-primary text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">edit_note</span>
                    불입 개월 수
                  </h3>

                  {/* 연금불입 */}
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">연금불입</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-outline font-semibold block mb-1">1단계</label>
                      <div className="flex gap-1">
                        <select value={lev.l1y} onChange={e => setLev({...lev, l1y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l1m} onChange={e => setLev({...lev, l1m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-outline font-semibold block mb-1">2단계</label>
                      <div className="flex gap-1">
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
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-2">특약불입</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-outline font-semibold block mb-1">3단계</label>
                      <div className="flex gap-1">
                        <select value={lev.l3y} onChange={e => setLev({...lev, l3y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l3m} onChange={e => setLev({...lev, l3m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-outline font-semibold block mb-1">4단계</label>
                      <div className="flex gap-1">
                        <select value={lev.l4y} onChange={e => setLev({...lev, l4y:+e.target.value})} className={selStyle}>
                          {numOpts(50).map(i => <option key={i} value={i}>{i}년</option>)}
                        </select>
                        <select value={lev.l4m} onChange={e => setLev({...lev, l4m:+e.target.value})} className={selStyle}>
                          {numOpts(11).map(i => <option key={i} value={i}>{i}월</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 지급개시 나이 */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3 border border-surface-variant/20">
                  <h3 className="font-['Manrope','Pretendard'] font-bold text-primary text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">elderly</span>
                    지급개시 나이
                  </h3>
                  <select value={retireAge} onChange={e => setRetireAge(+e.target.value)} className={selStyle}>
                    {Array.from({length:21},(_,i) => 60+i).map(a => (
                      <option key={a} value={a} style={(a===65||a===70)?{fontWeight:'bold'}:{}}>만 {a}세</option>
                    ))}
                  </select>
                  {calcData.birth_year > 0 && (
                    <div className="space-y-0.5 text-[10px] text-on-surface-variant">
                      <p>생년월: {calcData.birth_year}년 {calcData.birth_month}월 · 기준봉급: {fmt(calcData.amt)}원</p>
                      <p>→ 만 {retireAge}세 = {calcData.birth_year + retireAge}년 지급개시</p>
                    </div>
                  )}
                </div>

                {/* 계산 버튼 */}
                <button
                  onClick={doEstimate}
                  disabled={estimateLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#1b4332] to-[#40916c] text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {estimateLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      계산 중...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">calculate</span>
                      예상 지급액 계산하기
                    </>
                  )}
                </button>

                {/* 결과 */}
                {estimate && (
                  <>
                    <div className="rounded-2xl text-white shadow-xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b2a] to-[#1b4332]" />
                      <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)'}} />
                      <div className="relative z-10 p-6 text-center">
                        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1">예상 연금 월 수령액</p>
                        <p className="text-3xl font-black font-['Manrope','Pretendard'] tracking-tight">
                          {fmt(estimate.estimated_monthly)}<span className="text-base font-bold ml-1 text-white/80">원</span>
                        </p>
                        <p className="text-white/40 text-[10px] mt-2">매월 지급 예상 (1,000원 미만 절사)</p>
                      </div>
                    </div>

                    {/* 계산 상세 */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 border border-surface-variant/20">
                      <h4 className="font-bold text-primary text-xs mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-sm">info</span>
                        계산 상세
                      </h4>
                      <div className="space-y-2">
                        {[
                          {label:'연금 인정개월', value:`${estimate.pension_months_recognized}개월`},
                          {label:'특약 인정개월', value:`${estimate.special_months_recognized}개월`},
                          {label:'연금 납입비율', value:`${estimate.pension_rate}%`},
                          {label:'특약 납입비율', value:`${estimate.special_rate}%`},
                          {label:'총 납입비율', value:`${estimate.contribution_rate}%`, bold:true},
                          {label:'퇴직 만 나이', value:`${estimate.retirement_age}세`},
                          {label:'퇴직적용율', value:`${estimate.retirement_rate}%`},
                          {label:'기준 봉급액', value:`${fmt(estimate.base_salary)}원`},
                        ].map((item, i) => (
                          <div key={i} className={`flex justify-between items-center py-1.5 ${i < 7 ? 'border-b border-surface-variant/20' : ''}`}>
                            <span className="text-xs text-on-surface-variant">{item.label}</span>
                            <span className={`text-xs tabular-nums ${item.bold ? 'font-extrabold text-primary' : 'font-bold text-on-surface'}`}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 안내 */}
                <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-200/50 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-sm shrink-0 mt-0.5">warning</span>
                  <div className="text-[10px] text-amber-800 leading-relaxed space-y-0.5">
                    <p>현재 기준 봉급액({fmt(calcData?.amt)}원) 기준 <strong>예상치</strong>입니다.</p>
                    <p><strong>📞 총회 연금 담당 02-3499-7608</strong></p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Contact Info Footer ═══ */}
            <div className="mt-2 px-1">
              <p className="text-[10px] text-center text-outline/50">
                ※ 연금·생보 관련 문의: 총회 사무국 (02-3499-7608)
              </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default PensionInsurancePage;
