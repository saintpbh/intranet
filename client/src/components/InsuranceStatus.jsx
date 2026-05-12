import { useState, useEffect } from 'react';
import API_BASE from '../api';
import MobileHeader from './mobile/MobileHeader';

const InsuranceStatus = ({ user, onBack }) => {
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch summary on mount
  useEffect(() => {
    if (!user?.code) return;
    setLoading(true);
    fetch(`${API_BASE}/api/insurance/${user.code}/summary`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSummary(data);
        // Default to most recent year
        if (data.summary?.length > 0) {
          setSelectedYear(data.summary[0].year);
        }
      })
      .catch(err => setError(typeof err === 'string' ? err : err.message))
      .finally(() => setLoading(false));
  }, [user]);

  // Fetch detail when year changes
  useEffect(() => {
    if (!user?.code || !selectedYear) return;
    setDetailLoading(true);
    fetch(`${API_BASE}/api/insurance/${user.code}/detail?year=${selectedYear}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDetail(data);
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [user, selectedYear]);

  const formatAmt = (amt) => {
    if (!amt) return '0';
    return amt.toLocaleString('ko-KR');
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length < 8) return '';
    return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  };

  const yearList = summary?.summary?.map(s => s.year) || [];

  const navigateYear = (dir) => {
    const idx = yearList.indexOf(selectedYear);
    if (dir === 'prev' && idx < yearList.length - 1) setSelectedYear(yearList[idx + 1]);
    if (dir === 'next' && idx > 0) setSelectedYear(yearList[idx - 1]);
  };

  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  return (
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased pb-20">
      <MobileHeader showBack={true} onBack={onBack} title="생보납입 현황" />

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
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
            <p className="text-on-surface-variant text-sm">생보납입 이력이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* ─── Total Summary Card ─── */}
            <section className="rounded-3xl text-white shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a5276] to-[#2e86c1]"></div>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)'
              }}></div>
              <div className="relative z-10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">account_balance</span>
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">생보납입</p>
                    <p className="text-white/60 text-[11px]">{summary.minister_name} ({summary.minister_code})</p>
                  </div>
                </div>
                <p className="text-3xl font-extrabold font-['Manrope',_'Pretendard'] tracking-tight">
                  {formatAmt(summary.total_amount)}<span className="text-lg font-bold ml-1 text-white/80">원</span>
                </p>
                <p className="text-white/60 text-xs mt-2">
                  {summary.total_years}년간 납입 이력
                </p>
              </div>
            </section>

            {/* ─── Monthly Charge Banner ─── */}
            {summary.monthly_charge > 0 && (
              <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl px-5 py-4 shadow-sm border border-amber-200/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600 text-lg">payments</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-amber-700/70 font-semibold">매월 부담금</p>
                    <p className="text-lg font-extrabold text-amber-800 font-['Manrope',_'Pretendard'] tracking-tight">
                      {formatAmt(summary.monthly_charge)}<span className="text-xs font-bold ml-0.5 text-amber-600/70">원</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-amber-600/60">납입방법</p>
                  <p className="text-xs font-bold text-amber-700">{summary.monthly_charge > 0 ? '지로/계좌' : '-'}</p>
                </div>
              </section>
            )}

            {/* ─── Year Navigator ─── */}
            <section className="flex items-center justify-between bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-sm">
              <button
                onClick={() => navigateYear('prev')}
                disabled={yearList.indexOf(selectedYear) >= yearList.length - 1}
                className="p-2 rounded-full hover:bg-surface-container-high active:scale-90 transition-all disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-primary">chevron_left</span>
              </button>
              <div className="text-center">
                <p className="font-['Manrope',_'Pretendard'] font-extrabold text-xl text-primary">{selectedYear}년</p>
                {detail && (
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {detail.months_paid}개월 납입 · 총 {formatAmt(detail.year_total)}원
                  </p>
                )}
              </div>
              <button
                onClick={() => navigateYear('next')}
                disabled={yearList.indexOf(selectedYear) <= 0}
                className="p-2 rounded-full hover:bg-surface-container-high active:scale-90 transition-all disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-primary">chevron_right</span>
              </button>
            </section>

            {/* ─── Monthly Grid ─── */}
            {detailLoading ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-2xl text-outline animate-spin">progress_activity</span>
              </div>
            ) : detail ? (
              <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-3 gap-px bg-surface-variant/30">
                  {detail.monthly.map((m, idx) => (
                    <div
                      key={m.month}
                      className={`p-4 text-center transition-colors ${
                        m.paid
                          ? 'bg-emerald-50'
                          : 'bg-white'
                      }`}
                    >
                      <p className={`text-xs font-bold mb-1.5 ${m.paid ? 'text-emerald-600' : 'text-outline'}`}>
                        {monthNames[idx]}
                      </p>
                      {m.paid ? (
                        <>
                          <div className="w-8 h-8 rounded-full bg-emerald-500 mx-auto flex items-center justify-center mb-1.5">
                            <span className="material-symbols-outlined text-white text-base">check</span>
                          </div>
                          <p className="text-[11px] font-bold text-emerald-700">{formatAmt(m.amt)}원</p>
                          <p className="text-[9px] text-emerald-600/60 mt-0.5">{m.method}</p>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-surface-variant/40 mx-auto flex items-center justify-center mb-1.5">
                            <span className="material-symbols-outlined text-outline/50 text-base">remove</span>
                          </div>
                          <p className="text-[11px] text-outline/50">미납</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ─── Year Summary Table ─── */}
            <section>
              <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-3 px-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">calendar_month</span>
                연도별 납입 이력
              </h3>
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                      <th className="text-left px-4 py-3">연도</th>
                      <th className="text-center px-2 py-3">납입월</th>
                      <th className="text-right px-4 py-3">납입총액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.summary.map((yr, idx) => (
                      <tr
                        key={yr.year}
                        onClick={() => setSelectedYear(yr.year)}
                        className={`border-t border-surface-variant/30 cursor-pointer transition-colors active:bg-surface-container-high ${
                          yr.year === selectedYear ? 'bg-primary/5' : 'hover:bg-surface-container-low/30'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className={`font-bold ${yr.year === selectedYear ? 'text-primary' : 'text-on-surface'}`}>
                            {yr.year}년
                          </span>
                        </td>
                        <td className="text-center px-2 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            yr.months_paid >= 12
                              ? 'bg-emerald-100 text-emerald-700'
                              : yr.months_paid >= 6
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {yr.months_paid}/12
                          </span>
                        </td>
                        <td className="text-right px-4 py-3 font-bold text-on-surface tabular-nums">
                          {formatAmt(yr.total_amt)}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Info note */}
            <div className="bg-surface-container-low rounded-xl p-4 border border-surface-variant/50 flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary text-lg shrink-0 mt-0.5">info</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                본 화면은 총회 생활보장제 납입 기록입니다. 문의사항은 총회 사무국으로 연락해 주세요.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default InsuranceStatus;
