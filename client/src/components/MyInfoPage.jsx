import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';
import MyProfile from './MyProfile';
import MyHistory from './MyHistory';
import CertRequest from './CertRequest';
import { useState, useCallback, useEffect } from 'react';
import { useBackButton } from '../useBackButton';
import MobileHeader from './mobile/MobileHeader';
import API_BASE from '../api';
import ApiImage from './ApiImage';

const MyInfoPage = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const [view, setView] = useState('main');
  const [profileData, setProfileData] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.code) return;
    try {
      const res = await fetch(`${API_BASE}/api/user-profiles/${user.code}`);
      if (res.ok) setProfileData(await res.json());
    } catch (err) { console.error(err); }
  }, [user]);

  useEffect(() => { if (isLoggedIn) fetchProfile(); }, [isLoggedIn, fetchProfile]);

  const goBack = useCallback(() => { setView('main'); fetchProfile(); }, [fetchProfile]);
  useBackButton(view !== 'main' && isLoggedIn, goBack);

  if (!isLoggedIn) return <SimpleLogin />;

  const profileImageUrl = profileData?.profile_image_url
    ? `${API_BASE}${profileData.profile_image_url}`
    : '';
  const bgImageUrl = profileData?.background_image_url
    ? `${API_BASE}${profileData.background_image_url}`
    : '';

  // Inner views
  if (view === 'profile') return (
    <div className="bg-surface text-on-surface min-h-screen font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader showBack={true} onBack={goBack} title="현재 정보" />
      <div className="pt-24"><MyProfile user={user} onBack={goBack} /></div>
    </div>
  );
  if (view === 'history') return (
    <div className="bg-surface text-on-surface min-h-screen font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader showBack={true} onBack={goBack} title="사역 이력" />
      <div className="pt-24"><MyHistory user={user} onBack={goBack} /></div>
    </div>
  );
  if (view === 'cert') return (
    <div className="bg-surface text-on-surface min-h-screen font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader showBack={true} onBack={goBack} title="증명서 요청 (구버전)" />
      <div className="pt-24"><CertRequest user={user} onBack={goBack} /></div>
    </div>
  );

  const menuItems = [
    { id: 'profile', label: '현재 정보', icon: 'person', desc: '내 등록 정보 확인 및 수정 요청' },
    { id: 'history', label: '사역 이력', icon: 'history', desc: '교회 배정 이력 조회' },
  ];

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader title="내 정보" />
      
      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-8">
        {/* Profile Card */}
        <div className="rounded-[2rem] text-white shadow-[0_20px_40px_rgba(10,37,64,0.15)] relative overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container">
            {bgImageUrl && <ApiImage src={bgImageUrl} alt="배경" className="w-full h-full object-cover" />}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div className="relative z-10 p-8 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 border border-white/30 shadow-inner overflow-hidden">
              {profileImageUrl ? (
                <ApiImage src={profileImageUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold">{user.name?.charAt(0)}</span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold font-['Manrope',_'Pretendard'] mb-1 drop-shadow-lg">{user.name}</h2>
            <p className="text-white/90 text-sm font-medium bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full mt-2">
              {[user.duty, user.church, user.presbytery].filter(Boolean).join(' · ')}
            </p>
            {profileData?.status_message && (
              <p className="mt-3 text-white/70 text-sm italic">"{profileData.status_message}"</p>
            )}
          </div>
        </div>

        {/* Action Menu */}
        <section>
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="font-['Manrope',_'Pretendard'] text-lg font-bold text-primary">메뉴</h3>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(10,37,64,0.04)] overflow-hidden">
            {menuItems.map((item, idx) => (
              <div 
                key={item.id} 
                className={`flex items-center p-5 cursor-pointer hover:bg-surface-container-low active:bg-surface-container-high transition-colors ${
                  idx !== menuItems.length - 1 ? 'border-b border-surface-variant/50' : ''
                }`}
                onClick={() => setView(item.id)}
              >
                <div className="w-10 h-10 rounded-full bg-primary-container/5 text-primary-container flex items-center justify-center mr-4">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-['Manrope',_'Pretendard'] font-bold text-base text-primary">{item.label}</div>
                  <div className="text-sm text-on-surface-variant truncate mt-0.5">{item.desc}</div>
                </div>
                <span className="material-symbols-outlined text-outline-variant">arrow_forward_ios</span>
              </div>
            ))}
          </div>
        </section>

        {/* Logout Button */}
        <button 
          onClick={logout}
          className="w-full py-4 rounded-2xl border-2 border-error-container text-error font-bold tracking-wide active:bg-error-container/20 transition-colors bg-transparent"
        >
          로그아웃 (Sign Out)
        </button>
      </main>
    </div>
  );
};

export default MyInfoPage;
