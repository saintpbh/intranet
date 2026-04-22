import API_BASE from '../api';
import { useState, useEffect } from 'react';

const ElderDetail = ({ priestCode, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/elders/${priestCode}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [priestCode]);

  if (loading) return <div className="text-center py-12 text-on-surface-variant font-medium">데이터를 불러오는 중입니다...</div>;
  if (error) return <div className="text-center py-12 text-error font-medium">{error}</div>;
  if (!data) return null;

  const fullAddress = [data.Address, data.Juso].filter(Boolean).join(' ') || '-';

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Hero Profile Section */}
      <section className="relative group mx-[-16px] sm:mx-0 mt-[-16px] sm:mt-0">
        <div className="w-full h-[280px] sm:h-[340px] rounded-b-[2.5rem] sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#102711] to-[#2c4a2e] relative">
           <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
           <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-9xl font-bold text-white/10">{data.PriestName?.trim()?.charAt(0)}</span>
           </div>
        </div>
        <div className="absolute -bottom-8 sm:-bottom-6 left-6 right-6 bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl shadow-[0_20px_40px_rgba(10,37,64,0.08)] border border-white/50">
          <p className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-secondary font-bold uppercase tracking-widest text-[11px] mb-1.5">{data.PriestDuty || '장로'}</p>
          <h2 className="font-['Manrope',_'Pretendard'] font-extrabold text-3xl text-primary-container leading-tight mb-2">{data.PriestName?.trim()}</h2>
          <div className="flex items-center gap-2 mt-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">church</span>
            <span className="text-sm font-medium">{data.ChrName || data.NohName}</span>
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="flex flex-col gap-3 pt-12">
        {data.Tel_Mobile && (
          <a href={`tel:${data.Tel_Mobile}`} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-surface-variant/50 transition-all active:scale-[0.98] group hover:border-secondary/30">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-primary-container/5 text-primary group-hover:bg-secondary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[22px]">call</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[11px] font-bold text-outline uppercase tracking-wider mb-0.5">휴대폰</span>
              <span className="text-on-surface font-medium text-[15px] truncate">{data.Tel_Mobile}</span>
            </div>
          </a>
        )}
        
        {data.Tel_Home && (
          <a href={`tel:${data.Tel_Home}`} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-surface-variant/50 transition-all active:scale-[0.98] group hover:border-secondary/30">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-primary-container/5 text-primary group-hover:bg-secondary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[22px]">home</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[11px] font-bold text-outline uppercase tracking-wider mb-0.5">자택전화</span>
              <span className="text-on-surface font-medium text-[15px] truncate">{data.Tel_Home}</span>
            </div>
          </a>
        )}
        
        {data.Email && (
          <a href={`mailto:${data.Email}`} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-surface-variant/50 transition-all active:scale-[0.98] group hover:border-secondary/30">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-primary-container/5 text-primary group-hover:bg-secondary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[22px]">mail</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-[11px] font-bold text-outline uppercase tracking-wider mb-0.5">이메일</span>
              <span className="text-on-surface font-medium text-[15px] truncate">{data.Email}</span>
            </div>
          </a>
        )}

        {(!data.Tel_Mobile && !data.Tel_Home && !data.Email) && (
          <div className="flex items-center justify-center p-6 bg-surface-container-lowest rounded-2xl border border-dashed border-surface-variant/60">
            <span className="text-sm font-medium text-outline">등록된 연락처가 없습니다</span>
          </div>
        )}
      </section>

      {/* Bento Grid: Info */}
      <section className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-surface-variant/50">
        <h3 className="font-['Manrope',_'Pretendard'] font-bold text-xl text-primary mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">assignment_ind</span>
          상세 정보
        </h3>
        <div className="space-y-5">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-outline uppercase tracking-wider mb-1">소속 노회</span>
            <span className="text-on-surface font-medium text-base">{data.NohName || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-outline uppercase tracking-wider mb-1">시무 교회</span>
            <span className="text-on-surface font-medium text-base">{data.ChrName || '-'}</span>
          </div>
          {data.Occupation && (
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider mb-1">직업</span>
              <span className="text-on-surface font-medium text-base">{data.Occupation}</span>
            </div>
          )}
          {fullAddress !== '-' && (
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider mb-1">소재지</span>
              <span className="text-on-surface font-medium text-sm leading-relaxed">
                {fullAddress} {data.PostNo ? `[${data.PostNo.trim()}]` : ''}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ElderDetail;
