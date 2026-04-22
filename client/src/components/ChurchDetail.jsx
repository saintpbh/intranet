import API_BASE from '../api';
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import ChurchPhotoUpload from './ChurchPhotoUpload';
import ApiImage from './ApiImage';

const ChurchDetail = ({ church, onBack }) => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormer, setShowFormer] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);

  const isMyChurch = user && user.chrCode === church.ChrCode;

  const churchName = (church.CHRNAME || church.ChrName)?.trim();
  const churchAddress = [church.ADDRESS || church.Address, church.JUSO || church.Juso].filter(Boolean).join(' ');
  const naverMapSearchUrl = `nmap://search?query=${encodeURIComponent(churchAddress + ' ' + churchName)}&appname=com.prok.intranet`;

  const handleShareLocation = async () => {
    const text = `[${churchName}]\n📍 ${churchAddress}\n📞 ${church.Tel_Church || '전화번호 없음'}\n\n[네이버 지도에서 보기]\nhttps://map.naver.com/v5/search/${encodeURIComponent(churchAddress + ' ' + churchName)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: churchName, text });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopiedLocation(true);
      setTimeout(() => setCopiedLocation(false), 2000);
    }
  };

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
                   <ApiImage src={photo.photo_url} alt={`Church slide ${idx + 1}`} className="w-full h-full object-cover" fallback={<div className="w-full h-full bg-[#1a283b] flex items-center justify-center text-white/50">로딩중...</div>} />
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

        {/* Bento Grid: Info & Map Actions */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-surface-variant/50">
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">location_on</span>
            소재지
          </h3>
          <p className="text-on-surface font-medium text-[15px] leading-relaxed">
            {churchAddress || '주소 정보가 없습니다.'}
            {church.PostNo ? <span className="text-outline-variant font-mono text-sm ml-2">[{church.PostNo.trim()}]</span> : ''}
          </p>
          
          {/* Map & Share Action Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowMap(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-[13px] transition-all active:scale-95 border border-blue-200"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              지도에서 보기
            </button>
            <button
              onClick={handleShareLocation}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all active:scale-95 border ${copiedLocation ? 'bg-green-50 text-green-700 border-green-300' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {copiedLocation ? 'check_circle' : 'share'}
              </span>
              {copiedLocation ? '복사 완료!' : '위치 공유'}
            </button>
          </div>

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

      {/* ====== Google Map Modal ====== */}
      {showMap && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-white" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          {/* Map Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0 shadow-sm relative z-10">
            <button
              onClick={() => setShowMap(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <span className="material-symbols-outlined text-gray-700">arrow_back</span>
            </button>
            <div className="flex-1 text-center px-2">
              <h3 className="font-bold text-[15px] text-gray-900 truncate">{churchName}</h3>
              <p className="text-[11px] text-gray-500 truncate">{churchAddress || '주소 없음'}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleShareLocation}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${copiedLocation ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 text-gray-600'}`}
                title="위치 공유"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {copiedLocation ? 'check' : 'share'}
                </span>
              </button>
              <a
                href={naverMapSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-green-50 text-green-700 transition-colors"
                title="네이버 지도 앱에서 열기"
              >
                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
              </a>
            </div>
          </div>

          {/* Map Container (Google Maps iframe) */}
          <div className="flex-1 w-full bg-surface-container-low relative">
            {churchAddress ? (
              <iframe
                title={`${churchName} map`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(churchAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-outline-variant">
                주소 정보가 없습니다
              </div>
            )}
          </div>

          {/* Bottom Info Bar */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0 relative z-10 shadow-[0_-4px_6px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">church</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[14px] text-gray-900 truncate">{churchName}</p>
                <p className="text-[12px] text-gray-500 truncate">{churchAddress || '주소 정보 없음'}</p>
              </div>
              <a
                href={naverMapSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors active:scale-95"
              >
                길찾기
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChurchDetail;
