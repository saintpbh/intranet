import API_BASE from '../api';
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import ChurchPhotoUpload from './ChurchPhotoUpload';

const ChurchDetail = ({ church, onBack }) => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormer, setShowFormer] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const isMyChurch = user && user.chrCode === church.ChrCode;

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/churches/${church.ChrCode}/staff`);
        const data = await response.json();
        setStaff(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchPhotos = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/churches/${church.ChrCode}/photos`);
        const data = await response.json();
        setPhotos(data);
      } catch (err) {
        console.error("Photos fetch error:", err);
      }
    };

    fetchStaff();
    fetchPhotos();
  }, [church.ChrCode]);

  useEffect(() => {
    if (photos.length > 1) {
      const timer = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % photos.length);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [photos]);

  const handleUploadSuccess = (newPhotos) => {
    setPhotos(newPhotos);
    setShowUpload(false);
    setCurrentSlide(0);
  };

  const currentStaff = staff.filter(s => s.is_current);
  const formerStaff = staff.filter(s => !s.is_current);
  const seniorPastor = currentStaff.find(s => s.DUTYNAME && s.DUTYNAME.includes('담임'));
  const otherCurrentStaff = currentStaff.filter(s => s !== seniorPastor);

  const StaffRow = ({ person, showYears }) => (
    <div className="flex items-center justify-between p-4 bg-white border border-surface-variant/50 rounded-xl shadow-sm mb-3">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold overflow-hidden">
          {person.MinisterName?.trim()?.charAt(0) || 'M'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-primary text-[15px]">{person.MinisterName?.trim()}</h4>
            {person.DUTYNAME && <span className="bg-primary/5 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{person.DUTYNAME}</span>}
          </div>
          {showYears ? (
             <span className="text-[11px] text-outline-variant font-mono mt-0.5 block">
               {person.start_year}{person.end_year ? `–${person.end_year}` : '–'}
             </span>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              {person.TEL_MOBILE && <a href={`tel:${person.TEL_MOBILE}`} className="text-[11px] text-secondary hover:underline">📱 {person.TEL_MOBILE}</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Hero Profile Section */}
      <section className="relative group mx-[-16px] sm:mx-0 mt-[-16px] sm:mt-0">
        <div className="w-full h-[280px] sm:h-[340px] rounded-b-[2.5rem] sm:rounded-3xl overflow-hidden bg-[#0A2540] relative">
          
           {photos.length > 0 ? (
             <>
               {photos.map((photo, idx) => (
                 <div 
                   key={idx}
                   className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                 >
                   <img src={`${API_BASE}${photo.photo_url}`} alt={`Church slide ${idx + 1}`} className="w-full h-full object-cover" />
                 </div>
               ))}
               {/* Deep gradient overlay to ensure text readability */}
               <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540] via-[#0A2540]/60 to-transparent"></div>
               
               {/* Dot Indicators */}
               {photos.length > 1 && (
                 <div className="absolute bottom-[96px] left-0 right-0 flex justify-center gap-2 z-10">
                   {photos.map((_, idx) => (
                     <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide ? 'bg-secondary w-4' : 'bg-white/50 backdrop-blur-sm'}`} />
                   ))}
                 </div>
               )}
             </>
           ) : (
             <>
               <div className="absolute inset-0 bg-gradient-to-br from-[#1a283b] to-[#3a4f6d] mix-blend-multiply"></div>
               <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <span className="material-symbols-outlined text-9xl text-white/10" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
               </div>
             </>
           )}

           {isMyChurch && (
             <button 
               onClick={() => setShowUpload(true)}
               className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/50 transition-colors shadow-lg"
               aria-label="사진 편집"
             >
               <span className="material-symbols-outlined text-[20px]">photo_camera</span>
             </button>
           )}
        </div>

        <div className="absolute -bottom-8 sm:-bottom-6 left-6 right-6 bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl shadow-[0_20px_40px_rgba(10,37,64,0.08)] border border-white/50">
          <p className="font-['Plus_Jakarta_Sans',_'Pretendard'] text-secondary font-bold uppercase tracking-widest text-[11px] mb-1.5">{church.SICHALNAME || church.SichalName || '시찰없음'}</p>
          <h2 className="font-['Manrope',_'Pretendard'] font-extrabold text-3xl text-primary-container leading-tight mb-2">{(church.CHRNAME || church.ChrName)?.trim()}</h2>
          <div className="flex items-center gap-2 mt-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">map</span>
            <span className="text-sm font-medium">{church.NOHNAME || church.NohName}</span>
          </div>
        </div>
      </section>

      {/* Quick Contact Actions */}
      <section className="grid grid-cols-2 gap-3 pt-12">
        <a href={church.Tel_Church ? `tel:${church.Tel_Church}` : '#'} className={`flex items-center justify-center gap-2 py-4 px-2 bg-white rounded-2xl shadow-sm border border-surface-variant/50 transition-all ${church.Tel_Church ? 'active:scale-95 group hover:border-secondary/30' : 'opacity-40 cursor-not-allowed'}`}>
          <span className="material-symbols-outlined text-primary">deskphone</span>
          <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] font-bold text-[13px] tracking-wide text-on-surface">교회 전화</span>
        </a>
        <a href={church.Email ? `mailto:${church.Email}` : '#'} className={`flex items-center justify-center gap-2 py-4 px-2 bg-white rounded-2xl shadow-sm border border-surface-variant/50 transition-all ${church.Email ? 'active:scale-95 group hover:border-secondary/30' : 'opacity-40 cursor-not-allowed'}`}>
          <span className="material-symbols-outlined text-primary">mail</span>
          <span className="font-['Plus_Jakarta_Sans',_'Pretendard'] font-bold text-[13px] tracking-wide text-on-surface">이메일</span>
        </a>
      </section>

      <section className="space-y-4">
        {/* Senior Pastor Card */}
        {seniorPastor && (
          <div className="bg-gradient-to-r from-primary-container to-primary text-white rounded-[2rem] p-6 shadow-md relative overflow-hidden">
             <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
             <p className="font-bold text-[11px] tracking-widest text-primary-fixed mb-2">담임 목회자</p>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-xl font-bold">
                    {seniorPastor.MinisterName?.trim()?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{seniorPastor.MinisterName?.trim()}</h4>
                    {seniorPastor.TEL_MOBILE && <a href={`tel:${seniorPastor.TEL_MOBILE}`} className="text-primary-fixed text-sm font-medium hover:underline block">{seniorPastor.TEL_MOBILE}</a>}
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* Bento Grid: Info */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-surface-variant/50">
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">location_on</span>
            소재지
          </h3>
          <p className="text-on-surface font-medium text-[15px] leading-relaxed">
            {[church.ADDRESS || church.Address, church.JUSO || church.Juso].filter(Boolean).join(' ') || '주소 정보가 없습니다.'}
            {church.PostNo ? <span className="text-outline-variant font-mono text-sm ml-2">[{church.PostNo.trim()}]</span> : ''}
          </p>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-surface-variant/50">
            <span className="text-[12px] font-bold text-outline uppercase tracking-wider">팩스 번호</span>
            <span className="text-on-surface-variant font-medium text-[13px]">{church.Tel_Fax || '없음'}</span>
          </div>
        </div>

        {/* Other Staff */}
        {loading && <div className="text-center py-8 text-on-surface-variant text-sm">교역자 정보 불러오는 중...</div>}
        
        {otherCurrentStaff.length > 0 && (
          <div className="pt-4">
            <h3 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary mb-3 px-2">현재 교역자 <span className="text-sm text-outline ml-1">{otherCurrentStaff.length}명</span></h3>
            <div>
              {otherCurrentStaff.map((person, idx) => (
                <StaffRow key={idx} person={person} showYears={false} />
              ))}
            </div>
          </div>
        )}

        {/* Former Staff */}
        {formerStaff.length > 0 && (
          <div className="pt-2">
            {!showFormer ? (
               <button onClick={() => setShowFormer(true)} className="w-full py-4 bg-surface-container-lowest border border-surface-variant/50 rounded-xl text-primary font-bold text-sm shadow-sm hover:bg-surface-container-low transition-colors">
                 이전 교역자 보기 ({formerStaff.length}명)
               </button>
            ) : (
              <div className="bg-surface-container-lowest rounded-[2rem] p-5 shadow-inner border border-surface-variant/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary">이전 교역자</h3>
                  <button onClick={() => setShowFormer(false)} className="text-secondary text-sm font-bold">접기</button>
                </div>
                <div className="space-y-2 opacity-80">
                  {formerStaff.map((person, idx) => (
                    <StaffRow key={idx} person={person} showYears={true} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Upload Modal */}
      {showUpload && (
        <ChurchPhotoUpload 
          church={church} 
          onClose={() => setShowUpload(false)} 
          onSuccess={handleUploadSuccess} 
        />
      )}
    </div>
  );
};

export default ChurchDetail;
