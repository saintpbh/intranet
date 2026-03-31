import { useState, useEffect } from 'react';
import API_BASE from '../api';
import ProfileEdit from './ProfileEdit';

const MyProfile = ({ user, onBack }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(null);

  const fetchProfileData = async () => {
    if (!user?.code) return;
    try {
      const res = await fetch(`${API_BASE}/api/user-profiles/${user.code}`);
      if (res.ok) setProfileData(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchProfileData(); }, [user]);

  if (isEditing) {
    return <ProfileEdit user={user} onBack={() => { setIsEditing(false); fetchProfileData(); }} />;
  }

  const profileImageUrl = profileData?.profile_image_url
    ? `${API_BASE}${profileData.profile_image_url}`
    : '';
  const bgImageUrl = profileData?.background_image_url
    ? `${API_BASE}${profileData.background_image_url}`
    : '';

  const fields = [
    { label: '이름', value: user.name },
    { label: '직분', value: user.duty },
    { label: '교회', value: user.church },
    { label: '노회', value: user.presbytery },
    { label: '연락처', value: profileData?.phone || user.phone, type: 'tel' },
    { label: '이메일', value: profileData?.email || user.email, type: 'email' },
    { label: '생년월일', value: user.birthday ? `${user.birthday.substring(0, 4)}.${user.birthday.substring(4, 6)}.${user.birthday.substring(6, 8)}` : '' },
  ];

  return (
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface antialiased pb-20">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-variant flex items-center justify-between px-6 py-4">
        <button className="flex items-center justify-center p-2 -ml-2 text-on-surface-variant hover:text-primary transition-colors active:scale-90" onClick={onBack}>
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg text-primary tracking-tight">현재 정보</h1>
        <button 
          onClick={() => setIsEditing(true)}
          className="font-['Manrope',_'Pretendard'] font-bold text-sm tracking-tight text-secondary active:scale-95 transition-transform duration-200"
        >
          편집
        </button>
      </header>

      <main className="pt-24 px-6 max-w-md mx-auto space-y-8 animate-fade-in">
        {/* Profile Header Card */}
        <section className="rounded-3xl shadow-lg text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container">
            {bgImageUrl && <img src={bgImageUrl} alt="배경" className="w-full h-full object-cover" />}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          
          <div className="relative z-10 p-8">
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/30 backdrop-blur-md mx-auto flex items-center justify-center text-3xl font-bold text-white shadow-inner mb-4 overflow-hidden">
               {profileImageUrl ? (
                 <img src={profileImageUrl} alt={user.name} className="w-full h-full object-cover" />
               ) : (
                 user.name?.charAt(0)
               )}
            </div>
            <h2 className="font-['Manrope',_'Pretendard'] font-extrabold text-white text-2xl mb-1">{user.name}</h2>
            <div className="inline-block px-3 py-1 bg-white/10 rounded-full text-white/90 text-sm font-medium mt-1">
               {user.duty}
            </div>
            {profileData?.status_message && (
              <p className="mt-3 text-white/70 text-sm italic">"{profileData.status_message}"</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="font-['Manrope',_'Pretendard'] font-bold text-primary mb-4 px-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">demography</span>
            등록 정보
          </h3>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-variant/50 space-y-4">
            {fields.map((f, idx) => (
              <div key={idx} className="flex flex-col border-b border-surface-variant/30 last:border-0 pb-3 last:pb-0">
                <span className="text-[11px] font-bold text-outline uppercase tracking-wider mb-1">{f.label}</span>
                {f.type === 'tel' && f.value ? (
                  <a href={`tel:${f.value}`} className="text-secondary font-medium text-[15px] hover:underline">{f.value}</a>
                ) : f.type === 'email' && f.value ? (
                  <a href={`mailto:${f.value}`} className="text-secondary font-medium text-[15px] hover:underline">{f.value}</a>
                ) : (
                  <span className="text-on-surface font-medium text-[15px]">{f.value || '—'}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="bg-surface-container-low rounded-xl p-4 border border-surface-variant/50 flex items-start gap-3 mt-8">
           <span className="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5">info</span>
           <p className="text-[12px] text-on-surface-variant leading-relaxed">
             연락처(전화번호/이메일)는 <strong>편집</strong>을 눌러 직접 수정할 수 있습니다. 이름, 교회, 직분 등은 <strong>정보 수정 요청</strong>을 제출해 주세요.
           </p>
        </div>
      </main>
    </div>
  );
};

export default MyProfile;
