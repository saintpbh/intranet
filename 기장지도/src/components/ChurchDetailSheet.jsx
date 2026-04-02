import { useState, useEffect } from 'react';
import { X, MapPin, Phone, MessageSquare, Home, Video, ChevronRight, Navigation, Edit3, Image as ImageIcon, Link as LinkIcon, Clock, Plus, Trash2, Save, Star } from 'lucide-react';
import CommunicationBoard from './CommunicationBoard';
import { supabase } from '../supabaseClient';
import { isFavorite, toggleFavorite } from '../utils/favorites';

// Hope Light Theme color tokens
const W = {
  glass: 'var(--color-eh-surface-container-low)',
  glassBorder: 'var(--color-eh-outline-variant)',
  cardBg: 'var(--color-eh-surface-container)',
  cardBorder: 'rgba(43, 57, 144, 0.08)',
  text: 'var(--color-eh-on-surface)',
  textSub: 'var(--color-eh-on-surface-variant)',
  textMuted: '#94a3b8',
  accent: 'var(--color-eh-primary)',
  accentLight: 'rgba(43, 57, 144, 0.08)',
  accentBorder: 'rgba(43, 57, 144, 0.15)',
  green: '#10b981',
  cyan: 'var(--color-eh-secondary)',
  purple: 'var(--color-grace-purple)',
  shadow: '0 24px 64px rgba(43, 57, 144, 0.12), 0 0 0 1px rgba(43, 57, 144, 0.04)',
  inputBg: '#f8fafc',
  inputBorder: '#cbd5e1',
};

export default function ChurchDetailSheet({ church: initialChurch, onClose, onOpenDirections, userLocation, onFavoritesChange }) {
  const [activeTab, setActiveTab] = useState('home');
  const [church, setChurch] = useState(initialChurch);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isFav, setIsFav] = useState(false);
  
  const [editForm, setEditForm] = useState({
    youtube_video_id: '',
    main_photo_url: '',
    homepage_url: '',
    worship_times: []
  });

  useEffect(() => {
    if (initialChurch) {
      setChurch(initialChurch);
      setIsFav(isFavorite(initialChurch.id));
      setEditForm({
        youtube_video_id: initialChurch.youtube_video_id || '',
        main_photo_url: initialChurch.main_photo_url || '',
        homepage_url: initialChurch.homepage_url || '',
        worship_times: Array.isArray(initialChurch.worship_times) ? initialChurch.worship_times : []
      });
    }
  }, [initialChurch]);

  if (!church) return null;

  const handleToggleFavorite = () => {
    const result = toggleFavorite(church);
    setIsFav(result.added);
    if (result.added) {
      alert('관심교회로 등록되었습니다.\n(안내: 현재 브라우저에만 저장되며, 다른 컴퓨터/기기에서는 표시되지 않습니다.)');
    }
    if (onFavoritesChange) {
      onFavoritesChange();
    }
  };

  const handleDirections = () => {
    if (onOpenDirections) {
      onOpenDirections(church);
    }
  };

  const handleEditClick = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      setShowPasswordPrompt(true);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === '0000' || passwordInput === '1234') { // 기본 비밀번호 처리
      setIsEditing(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleCall = () => {
    if (church.phone) {
      window.location.href = `tel:${church.phone}`;
    } else {
      alert("등록된 전화번호가 없습니다.");
    }
  };

  const handleSave = async () => {
    try {
      const { data, error } = await supabase
        .from('churches')
        .update({
          youtube_video_id: editForm.youtube_video_id,
          main_photo_url: editForm.main_photo_url,
          homepage_url: editForm.homepage_url,
          worship_times: editForm.worship_times
        })
        .eq('id', church.id)
        .select()
        .single();
      if (error) throw error;
      alert('정보가 저장되었습니다.');
      setChurch(data);
      setIsEditing(false);
    } catch (e) {
      alert('저장 중 오류가 발생했습니다: ' + e.message);
    }
  };

  const handleAddWorship = () => {
    setEditForm(prev => ({
      ...prev,
      worship_times: [...prev.worship_times, { title: '주일예배 1부', time: '11:00 AM', location: '본당' }]
    }));
  };

  const handleUpdateWorship = (index, field, value) => {
    const newTimes = [...editForm.worship_times];
    newTimes[index][field] = value;
    setEditForm({ ...editForm, worship_times: newTimes });
  };

  const handleRemoveWorship = (index) => {
    const newTimes = editForm.worship_times.filter((_, i) => i !== index);
    setEditForm({ ...editForm, worship_times: newTimes });
  };

  return (
    <div className="relative w-full max-w-[400px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 pointer-events-auto" style={{ background: W.glass, backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: '24px', boxShadow: W.shadow, border: `1px solid ${W.glassBorder}` }}>
      
      {/* Header */}
      <div className="relative pt-5 pb-4 px-5 shrink-0 overflow-hidden" style={{ borderBottom: `1px solid ${W.cardBorder}` }}>
        <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: W.accent, opacity: 0.06 }}></div>

        {/* Top buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-[50]">
          <button 
            onClick={handleToggleFavorite}
            className="rounded-full transition-all flex items-center justify-center"
            style={{ 
              background: isFav ? 'rgba(255,196,0,0.12)' : 'rgba(0,0,0,0.04)',
              border: isFav ? '1px solid rgba(255,196,0,0.3)' : `1px solid ${W.inputBorder}`,
              width: '44px', height: '44px',
            }}
          >
            <Star size={20} style={{ color: isFav ? '#e5a800' : '#bbb' }} fill={isFav ? '#ffc400' : 'none'} />
          </button>
          <button 
            onClick={onClose} 
            className="rounded-full transition-all flex items-center justify-center hover:bg-black/5"
            style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${W.inputBorder}`, width: '44px', height: '44px' }}
          >
            <X size={22} style={{ color: '#666' }} />
          </button>
        </div>
        
        <div className="flex flex-col gap-0.5 mt-1 relative z-10 pr-24">
          <p className="font-bold text-[12px] tracking-wider uppercase" style={{ color: W.accent }}>{church.noh_name || church.noh}</p>
          <div className="flex items-end gap-2.5 flex-wrap">
            <h2 className="text-[24px] font-extrabold tracking-tight leading-tight" style={{ color: W.text }}>{church.name}</h2>
            {church.pastor_name && (
              <span className="text-[14px] font-bold mb-[3px]" style={{ color: W.textSub }}>
                담임목사: {church.pastor_name.replace(/목사\s*$/, '').trim()} 목사
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 py-2.5 shrink-0 flex justify-between items-center gap-2" style={{ borderBottom: `1px solid ${W.cardBorder}` }}>
        <div className="flex p-1 rounded-2xl flex-1" style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${W.inputBorder}` }}>
          {[
            { key: 'home', icon: Home, label: '교회 정보' },
            { key: 'inquiry', icon: MessageSquare, label: '비밀 문의' },
          ].map(tab => (
            <button 
              key={tab.key}
              onClick={() => setActiveTab(tab.key)} 
              className="flex-1 py-1.5 text-[12px] font-bold flex items-center justify-center gap-1.5 rounded-xl transition-all duration-200"
              style={activeTab === tab.key ? { background: 'white', color: W.accent, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } : { color: W.textMuted }}
            >
              <tab.icon size={14}/> {tab.label}
            </button>
          ))}
        </div>
        <button onClick={handleEditClick} className="p-2.5 rounded-xl transition-colors" style={{ background: isEditing ? W.accentLight : 'rgba(0,0,0,0.03)', border: `1px solid ${isEditing ? W.accentBorder : W.inputBorder}`, color: isEditing ? W.accent : W.textMuted }}>
          <Edit3 size={16} />
        </button>
      </div>

      {showPasswordPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center fade-in" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="p-5 rounded-2xl flex flex-col gap-3 shadow-2xl" style={{ background: 'white', border: `1px solid ${W.cardBorder}`, width: '85%' }}>
            <h3 className="font-bold text-[16px]" style={{ color: W.text }}>관리자 권한 확인</h3>
            <p className="text-[12px] leading-relaxed" style={{ color: W.textSub }}>
              교회 정보 수정을 위해 비밀번호를 입력해주세요.<br/>
              <span style={{ color: W.textMuted }}>(테스트용: 0000)</span>
            </p>
            <form onSubmit={handlePasswordSubmit} className="flex gap-2 mt-1">
              <input 
                type="password" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
                className="flex-1 px-3 py-2 border rounded-lg outline-none font-bold tracking-widest text-center" 
                style={{ background: W.inputBg, borderColor: W.inputBorder, color: W.text }}
                placeholder="****" 
                autoFocus
              />
              <button type="submit" className="px-4 py-2 rounded-lg font-bold text-white transition-transform active:scale-95" style={{ background: W.accent }}>
                확인
              </button>
            </form>
            <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput(''); }} className="text-[12px] font-bold mt-1" style={{ color: W.textMuted }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        
        {isEditing ? (
          <div className="p-5 flex flex-col gap-5 fade-in">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: W.accentLight, color: W.accent }}>
                <Edit3 size={16} />
              </div>
              <h3 className="font-extrabold text-[16px]" style={{ color: W.text }}>교회 정보 관리</h3>
            </div>

            <div className="p-4 rounded-2xl flex flex-col gap-4" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
              {[
                { icon: Video, label: '대표 유튜브 영상 ID', key: 'youtube_video_id', placeholder: '예: aBcDeFgHiJk' },
                { icon: ImageIcon, label: '대표 사진 URL', key: 'main_photo_url', placeholder: 'https://...' },
                { icon: LinkIcon, label: '교회 홈페이지 주소', key: 'homepage_url', placeholder: 'https://...' },
                { icon: Home, label: '주차 안내', key: 'parking_info', placeholder: '예: 50대 주차 가능 (무료)' },
                { icon: MapPin, label: '대중교통 안내', key: 'transport_info', placeholder: '예: 지하철 2호선 3번 출구' },
              ].map(f => (
                <label key={f.key} className="flex flex-col gap-1.5 text-[13px] font-bold" style={{ color: W.text }}>
                  <span className="flex items-center gap-1.5"><f.icon size={14} style={{ color: W.accent }}/> {f.label}</span>
                  <input type="text" value={editForm[f.key]} onChange={(e) => setEditForm({...editForm, [f.key]: e.target.value})} placeholder={f.placeholder} className="px-3 py-2 rounded-lg font-medium text-sm" style={{ background: W.inputBg, border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                </label>
              ))}
            </div>

            <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
               <div className="flex items-center justify-between">
                 <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: W.text }}><Clock size={14} style={{ color: W.accent }}/> 예배 시간 안내</span>
                 <button onClick={handleAddWorship} className="text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1" style={{ background: W.accentLight, color: W.accent }}><Plus size={12}/> 추가</button>
               </div>
               <div className="flex flex-col gap-2">
                 {editForm.worship_times.map((wt, i) => (
                   <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl relative group" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${W.inputBorder}` }}>
                     <input type="text" value={wt.title} onChange={(e) => handleUpdateWorship(i, 'title', e.target.value)} placeholder="예배명" className="text-sm font-bold rounded px-2 py-1" style={{ background: 'white', border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                     <div className="flex gap-2">
                       <input type="text" value={wt.time} onChange={(e) => handleUpdateWorship(i, 'time', e.target.value)} placeholder="시간" className="text-xs flex-1 rounded px-2 py-1" style={{ background: 'white', border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                       <input type="text" value={wt.location} onChange={(e) => handleUpdateWorship(i, 'location', e.target.value)} placeholder="장소" className="text-xs flex-1 rounded px-2 py-1" style={{ background: 'white', border: `1px solid ${W.inputBorder}`, color: W.text, outline: 'none' }}/>
                     </div>
                     <button onClick={() => handleRemoveWorship(i)} className="absolute -top-2 -right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' }}><Trash2 size={12}/></button>
                   </div>
                 ))}
                 {editForm.worship_times.length === 0 && <p className="text-center text-xs py-2" style={{ color: W.textMuted }}>등록된 예배가 없습니다.</p>}
               </div>
            </div>

            <button onClick={handleSave} className="w-full font-extrabold py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all text-white" style={{ background: `linear-gradient(135deg, ${W.accent}, #6b8cff)`, boxShadow: '0 4px 16px rgba(55,102,255,0.25)' }}>
              <Save size={18} /> 변경사항 저장하기
            </button>
          </div>
        ) : (
          <>
            {/* HOME TAB */}
            {activeTab === 'home' && (
              <div className="p-5 flex flex-col gap-5 fade-in">
                <div className="flex flex-col gap-3">
                  <h3 className="font-extrabold flex items-center gap-2 text-[16px]" style={{ color: W.text }}>
                    <Video size={18} style={{ color: W.accent }} /> 환영합니다
                  </h3>
                  <div className="w-full aspect-video rounded-2xl overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${W.cardBorder}` }}>
                    {church.youtube_video_id ? (
                      <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${church.youtube_video_id}`} title="YouTube" allowFullScreen />
                    ) : church.main_photo_url ? (
                      <img src={church.main_photo_url} alt={church.name} className="absolute top-0 left-0 w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full gap-2" style={{ color: W.textMuted }}>
                        <ImageIcon size={32} style={{ color: '#ddd' }}/>
                        <span className="text-sm font-medium">등록된 영상이나 사진이 없습니다</span>
                      </div>
                    )}
                  </div>
                  
                  {(church.homepage_url || church.youtube_video_id || church.youtube_channel_id) && (
                    <div className="flex gap-2 w-full mt-1">
                      {(church.youtube_channel_id || church.youtube_video_id) && (
                        <a href={church.youtube_channel_id ? `https://youtube.com/channel/${church.youtube_channel_id}` : `https://youtube.com/watch?v=${church.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: 'rgba(255,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(255,68,68,0.12)' }}>
                          <Video size={14}/> 유튜브 채널
                        </a>
                      )}
                      {church.homepage_url && (
                        <a href={church.homepage_url} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: 'rgba(8,145,178,0.06)', color: W.cyan, border: '1px solid rgba(8,145,178,0.12)' }}>
                          <LinkIcon size={14}/> 홈페이지 방문
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl leading-relaxed whitespace-pre-wrap text-[14px]" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}`, color: W.textSub }}>
                  {church.intro_text || <span className="italic">{"한국기독교장로회 " + church.name + "에 오신 것을 환영합니다. 함께 예배드리며 은혜 나누기를 소망합니다."}</span>}
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <h3 className="font-extrabold flex items-center gap-2 text-[16px]" style={{ color: W.text }}>
                    <Clock size={18} style={{ color: W.accent }} /> 예배 안내
                  </h3>
                  
                  {Array.isArray(church.worship_times) && church.worship_times.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                      {church.worship_times.map((wt, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between" style={{ borderBottom: i < church.worship_times.length - 1 ? `1px solid ${W.cardBorder}` : 'none' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: W.accent }}></div>
                            <span className="font-bold text-[13px]" style={{ color: W.text }}>{wt.title}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-bold text-[13px]" style={{ color: W.accent }}>{wt.time}</span>
                            {wt.location && <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: W.textMuted }}><MapPin size={9}/>{wt.location}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(0,0,0,0.02)', border: `1px dashed ${W.inputBorder}` }}>
                      <p className="text-[13px] font-medium" style={{ color: W.textMuted }}>등록된 예배 시간이 없습니다.</p>
                      <button onClick={handleEditClick} className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border" style={{ borderColor: W.accentBorder, color: W.accent, background: W.accentLight }}>
                        교회 관계자이신가요? 정보 등록하기
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full h-px mt-2" style={{ background: W.cardBorder }}></div>
                
                <div className="flex flex-col gap-3">
                   <h3 className="font-extrabold flex items-center gap-2 text-[16px]" style={{ color: W.text }}>
                    <MapPin size={18} style={{ color: W.cyan }} /> 오시는 길 / 주차
                   </h3>
                   
                   <div className="grid grid-cols-2 gap-2.5 mb-1">
                     <button onClick={handleCall} className="py-3 justify-center rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                       <Phone size={16} style={{ color: W.green }} />
                       <span className="font-bold text-[13px]" style={{ color: W.text }}>전화 연결</span>
                     </button>
                     
                     <button onClick={handleDirections} className="py-3 justify-center rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all" style={{ background: W.accentLight, border: `1px solid ${W.accentBorder}` }}>
                       <Navigation size={16} style={{ color: W.accent }} />
                       <span className="font-bold text-[13px]" style={{ color: W.accent }}>길 찾기</span>
                     </button>
                   </div>

                   <div className="rounded-2xl flex flex-col" style={{ background: W.cardBg, border: `1px solid ${W.cardBorder}` }}>
                     <div className="p-3.5 flex flex-col gap-1" style={{ borderBottom: `1px solid ${W.cardBorder}` }}>
                       <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>주소</span>
                       <span className="font-medium leading-relaxed text-[13px]" style={{ color: W.text }}>{church.address || '주소 정보 없음'}</span>
                     </div>
                     {church.parking_info && (
                       <div className="p-3.5 flex flex-col gap-1" style={{ borderBottom: `1px solid ${W.cardBorder}` }}>
                         <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>주차 안내</span>
                         <span className="font-medium text-[13px]" style={{ color: W.text }}>{church.parking_info}</span>
                       </div>
                     )}
                     {church.transport_info && (
                       <div className="p-3.5 flex flex-col gap-1" style={{ borderBottom: church.phone ? `1px solid ${W.cardBorder}` : 'none' }}>
                         <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>대중교통</span>
                         <span className="font-medium text-[13px]" style={{ color: W.text }}>{church.transport_info}</span>
                       </div>
                     )}
                     {church.phone && (
                       <div className="p-3.5 flex flex-col gap-1">
                         <span className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: W.cyan }}>전화번호</span>
                         <span className="font-medium text-[13px]" style={{ color: W.text }}>{church.phone}</span>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            )}

            {/* INQUIRY TAB */}
            {activeTab === 'inquiry' && (
              <div className="bg-white h-full overflow-hidden text-black min-h-[400px]">
                 <CommunicationBoard churchId={church.id} onClose={() => setActiveTab('home')} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
