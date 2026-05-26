import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import { RequestList, RequestDetail } from './SharedAdmin';
import ChurchReportForm from './ChurchReportForm';
import AdminDocumentBrowser from './AdminDocumentBrowser';
import SubmissionInbox from './SubmissionInbox';
import ChurchList from '../ChurchList';

/* ── Stitch design tokens ── */
const S = {
  card: { background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 20px 40px rgba(10,37,64,0.06)', border: 'none' },
  heading: { fontFamily: "'Manrope', 'Pretendard'", fontWeight: 800, color: '#0A2540', letterSpacing: '-0.02em' },
  subText: { fontSize: 13, color: '#43474d', fontWeight: 500 },
  gradientBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(0,112,235,0.25)' },
  ghostBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(196,198,206,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#43474d' },
  navPill: (active) => ({
    padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(0,112,235,0.08)' : 'transparent',
    color: active ? '#0070eb' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 13,
    fontFamily: "'Manrope', 'Pretendard'", transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 6,
  }),
};

const StatusBadge = ({ status }) => {
  const labels = { DRAFT: '임시저장', SUBMITTED: '제출됨', NOH_APPROVED: '노회 확인', ASSEMBLY_APPROVED: '총회 확정', REJECTED: '반려' };
  const colors = { DRAFT: '#8E8E93', SUBMITTED: '#FF9500', NOH_APPROVED: '#007AFF', ASSEMBLY_APPROVED: '#34C759', REJECTED: '#FF3B30' };
  const c = colors[status] || '#8e8e93';
  return <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${c}12`, color: c, fontWeight: 700 }}>{labels[status] || status}</span>;
};

/* ── 디지털 주보 관리 및 편집 모달 (SlideOver 스타일) ── */
const ChurchBulletinEditModal = ({ bulletin, onSave, onClose, churchName }) => {
  const [date, setDate] = useState(bulletin?.date || '');
  const [serviceType, setServiceType] = useState(bulletin?.serviceType || '주일대예배');
  const [bulletinTitle, setBulletinTitle] = useState(bulletin?.bulletinTitle || '');
  const [theme, setTheme] = useState(bulletin?.theme || '');
  const [bibleVerse, setBibleVerse] = useState(bulletin?.bibleVerse || '');
  const [bibleVerseRef, setBibleVerseRef] = useState(bulletin?.bibleVerseRef || '');
  
  const [orders, setOrders] = useState([]);
  const [churchNews, setChurchNews] = useState(['']);

  useEffect(() => {
    setDate(bulletin?.date || '');
    setServiceType(bulletin?.serviceType || '주일대예배');
    setBulletinTitle(bulletin?.bulletinTitle || '');
    setTheme(bulletin?.theme || '');
    setBibleVerse(bulletin?.bibleVerse || '');
    setBibleVerseRef(bulletin?.bibleVerseRef || '');
    setOrders(
      (bulletin?.orders || []).map((o, idx) => ({
        id: o.id || `order-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        sequence: o.sequence || idx + 1,
        title: o.title || '',
        type: o.type || 'TEXT',
        detail: o.detail || '',
        targetKey: o.targetKey || ''
      }))
    );
    setChurchNews(bulletin?.churchNews?.length ? bulletin.churchNews : ['']);
  }, [bulletin]);

  const addOrder = () => {
    setOrders([
      ...orders,
      {
        id: `order-${Date.now()}-${orders.length}-${Math.random().toString(36).substr(2, 4)}`,
        sequence: orders.length + 1,
        title: '',
        type: 'TEXT',
        detail: '',
        targetKey: ''
      }
    ]);
  };
  const removeOrder = (id) => {
    const filtered = orders.filter(o => o.id !== id);
    const reordered = filtered.map((o, idx) => ({ ...o, sequence: idx + 1 }));
    setOrders(reordered);
  };
  const updateOrder = (id, field, value) => {
    setOrders(orders.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const addNews = () => setChurchNews([...churchNews, '']);
  const removeNews = (idx) => setChurchNews(churchNews.filter((_, i) => i !== idx));
  const updateNews = (idx, value) => {
    const newNews = [...churchNews];
    newNews[idx] = value;
    setChurchNews(newNews);
  };

  const handleSave = () => {
    const filteredOrders = orders.filter(o => o.title.trim());
    const filteredNews = churchNews.filter(n => n.trim());

    onSave({
      date,
      serviceType,
      bulletinTitle,
      theme,
      bibleVerse,
      bibleVerseRef,
      orders: filteredOrders.map((o, idx) => ({ ...o, sequence: idx + 1 })),
      churchNews: filteredNews
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose} style={{ pointerEvents: 'auto' }}>
      <div 
        className="bg-white w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-20px_50px_rgba(10,37,64,0.15)] flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-transparent rounded-t-[2.5rem]">
          <div>
            <h3 className="text-[17px] font-extrabold text-slate-800 font-['Manrope','Pretendard']">디지털 주보(예배) 관리 및 편집</h3>
            <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">{churchName} — 기장성도앱 연동</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-95 border-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-[12px] text-indigo-700 leading-relaxed" style={{ borderRadius: 16, padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
            <p className="font-bold flex items-center gap-1.5 mb-1 text-[13px]" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              <span className="material-symbols-outlined text-[16px] text-indigo-500">cell_tower</span>
              성도앱 실시간 연동 안내
            </p>
            여기에서 주보 내용을 작성하고 [저장하기]를 누르면, 지교회 성도분들이 설치한 **기장성도앱의 디지털 주보 탭**에 내용이 실시간으로 동기화되어 배포됩니다.
          </div>

          {/* 주보 기본 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined text-[16px] text-indigo-400">text_snippet</span>
              주보 기본 정보
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>주보 제목</label>
                <input 
                  type="text" 
                  value={bulletinTitle} 
                  onChange={e => setBulletinTitle(e.target.value)}
                  placeholder="예: 성령강림주일 예배 주보" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>예배 일자</label>
                <input 
                  type="text" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  placeholder="예: 2026년 5월 31일" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>예배 구분</label>
                <input 
                  type="text" 
                  value={serviceType} 
                  onChange={e => setServiceType(e.target.value)}
                  placeholder="예: 주일대예배, 주일오후예배" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>금주의 표어</label>
                <input 
                  type="text" 
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  placeholder="예: 생명, 평화, 정의를 심고 일구는 공동체" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>금주의 요절 말씀 (본문)</label>
                <input 
                  type="text" 
                  value={bibleVerse} 
                  onChange={e => setBibleVerse(e.target.value)}
                  placeholder="예: 오직 정의를 물 같이, 공의를 마르지 않는 강 같이..." 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>요절 장절 정보</label>
                <input 
                  type="text" 
                  value={bibleVerseRef} 
                  onChange={e => setBibleVerseRef(e.target.value)}
                  placeholder="예: 아모스 5:24" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* 예배 순서 상세 설정 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined text-[16px] text-indigo-400">format_list_numbered</span>
                예배 순서 배열
              </span>
              <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>순서명 입력 시 성도앱에 노출됩니다</span>
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map((o, idx) => (
                <div key={o.id} style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 99, background: '#cbd5e1', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <input 
                      placeholder="순서명 (예: 개회선언, 신앙고백, 찬양)" 
                      value={o.title}
                      onChange={e => updateOrder(o.id, 'title', e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, fontWeight: 700, outline: 'none', background: '#fff' }}
                    />
                    <select 
                      value={o.type} 
                      onChange={e => updateOrder(o.id, 'type', e.target.value)}
                      style={{ width: 100, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, fontWeight: 600, outline: 'none', background: '#fff' }}
                    >
                      <option value="TEXT">텍스트</option>
                      <option value="HYMN">찬송가</option>
                      <option value="BIBLE">성경</option>
                      <option value="LITURGY">교독문</option>
                      <option value="PRAYER">대표기도</option>
                      <option value="SERMON">설교</option>
                    </select>
                    <button 
                      onClick={() => removeOrder(o.id)} 
                      style={{ width: 32, height: 32, borderRadius: 10, background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <input 
                      placeholder="상세 내용 (예: 다같이, 인도자, 맡은이 이름 등)" 
                      value={o.detail}
                      onChange={e => updateOrder(o.id, 'detail', e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, outline: 'none', background: '#fff' }}
                    />
                    <input 
                      placeholder="참조 키 (예: 찬송가 3장, 교독문 12번 등)" 
                      value={o.targetKey}
                      onChange={e => updateOrder(o.id, 'targetKey', e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, outline: 'none', background: '#fff' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button 
              type="button"
              onClick={addOrder} 
              style={{ width: '100%', padding: '10px 0', border: '2px dashed #bfdbfe', background: 'transparent', color: '#3b82f6', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              예배 순서 추가하기
            </button>
          </div>

          {/* 교회 소식 설정 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined text-[16px] text-indigo-400">notifications</span>
              교회 소식 / 알림판
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {churchNews.map((news, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 99, background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <input 
                    placeholder="소식 내용을 한 줄씩 입력해 주세요 (예: 다음주 대표기도는 홍길동 장로입니다)" 
                    value={news}
                    onChange={e => updateNews(idx, e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, outline: 'none' }}
                  />
                  <button 
                    onClick={() => removeNews(idx)} 
                    style={{ width: 32, height: 32, borderRadius: 10, background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              type="button"
              onClick={addNews} 
              style={{ width: '100%', padding: '10px 0', border: '2px dashed #bfdbfe', background: 'transparent', color: '#3b82f6', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              소식 입력란 추가하기
            </button>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, background: '#f8fafc', borderRadius: '0 0 40px 40px' }}>
          <button 
            type="button"
            onClick={onClose} 
            style={{ flex: 1, padding: '12px 0', border: '1px solid #e2e8f0', background: '#fff', borderRadius: 16, cursor: 'pointer', color: '#475569', fontWeight: 700, fontSize: 14 }}
          >
            취소
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            style={{ flex: 1, padding: '12px 0', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 16, cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(0,112,235,0.2)' }}
          >
            저장 및 실시간 배포하기
          </button>
        </div>
      </div>
    </div>
  );
};

const ChurchTab = ({ user }) => {
  const [activeMenu, setActiveMenu] = useState('bulletin');
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [creatingReport, setCreatingReport] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── 주보관리 state ──
  const [bulletinData, setBulletinData] = useState(null);
  const [showBulletinEdit, setShowBulletinEdit] = useState(false);
  const [bulletinLoading, setBulletinLoading] = useState(false);

  // ── 지도·교회관리 state ──
  const [church, setChurch] = useState(null);
  const [churchLoading, setChurchLoading] = useState(false);
  const [churchError, setChurchError] = useState(null);
  const [churchSaving, setChurchSaving] = useState(false);
  const [churchForm, setChurchForm] = useState({});
  const [inquiries, setInquiries] = useState([]);
  const [inqLoading, setInqLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [churchToast, setChurchToast] = useState('');
  
  // ── 관리자 검색 state ──
  const [adminSelectedChurch, setAdminSelectedChurch] = useState(null);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [debouncedAdminSearch, setDebouncedAdminSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedAdminSearch(adminSearchTerm); }, 500);
    return () => clearTimeout(handler);
  }, [adminSearchTerm]);

  const isAdmin = user?.role === 'assembly' || user?.id === 'admin';
  const targetCode = isAdmin ? adminSelectedChurch?.ChrCode : user?.chr_code;

  const showChurchToast = (msg) => { setChurchToast(msg); setTimeout(() => setChurchToast(''), 2500); };

  const fetchChurch = () => {
    if (!targetCode) { 
      if (!isAdmin) setChurchError('교회코드(chr_code)가 없습니다.'); 
      return; 
    }
    setChurchLoading(true);
    fetch(`${API_BASE}/api/church-manage/${targetCode}`)
      .then(r => r.ok ? r.json() : Promise.reject('not found'))
      .then(d => {
        setChurch(d);
        setChurchForm({
          youtube_video_id: d.youtube_video_id || '', youtube_channel_id: d.youtube_channel_id || '',
          main_photo_url: d.main_photo_url || '', photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls : [],
          homepage_url: d.homepage_url || '', intro_text: d.intro_text || '',
          worship_times: Array.isArray(d.worship_times) ? d.worship_times : [],
          address: d.address || '', phone: d.phone || '',
        });
        setChurchError(null);
      })
      .catch(() => setChurchError('기장지도에 등록되지 않은 교회입니다.'))
      .finally(() => setChurchLoading(false));
  };

  const fetchInquiries = () => {
    if (!targetCode) return;
    setInqLoading(true);
    fetch(`${API_BASE}/api/church-manage/${targetCode}/inquiries`)
      .then(r => r.ok ? r.json() : []).then(d => setInquiries(d)).finally(() => setInqLoading(false));
  };

  const fetchBulletinData = () => {
    if (!targetCode) return;
    setBulletinLoading(true);
    fetch(`${API_BASE}/api/churches/${targetCode}/bulletin`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.updated_at) {
          setBulletinData(data);
        } else {
          setBulletinData(null);
        }
      })
      .catch(err => console.warn('[ChurchTab] Bulletin fetch failed:', err))
      .finally(() => setBulletinLoading(false));
  };

  const saveBulletinData = (bulletinPayload) => {
    if (!targetCode) return;
    setChurchSaving(true);
    fetch(`${API_BASE}/api/churches/${targetCode}/bulletin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bulletinPayload)
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (data.success) {
          showChurchToast('✅ 주보 실시간 배포 완료');
          fetchBulletinData();
        } else {
          alert('주보 저장 실패');
        }
      })
      .catch(() => alert('주보 저장 통신 오류'))
      .finally(() => {
        setChurchSaving(false);
        setShowBulletinEdit(false);
      });
  };

  useEffect(() => { 
    if (activeMenu === 'map-church' && targetCode) { 
      fetchChurch(); 
      fetchInquiries(); 
    } 
    if (activeMenu === 'bulletin' && targetCode) {
      fetchBulletinData();
    }
  }, [activeMenu, targetCode]);

  const saveChurch = () => {
    if (!targetCode) return;
    setChurchSaving(true);
    fetch(`${API_BASE}/api/church-manage/${targetCode}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(churchForm),
    }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { setChurch(d); showChurchToast('✅ 저장 완료'); })
      .catch(() => alert('저장 실패')).finally(() => setChurchSaving(false));
  };

  const replyInquiry = (id) => {
    const text = replyTexts[id]; if (!text?.trim()) return;
    fetch(`${API_BASE}/api/church-manage/inquiries/${id}/reply`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: text }),
    }).then(r => { if (r.ok) { showChurchToast('✅ 답변 저장'); setReplyTexts(p => ({...p, [id]: ''})); fetchInquiries(); } });
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/admin/cert-requests`).then(r => r.json()),
      fetch(`${API_BASE}/api/church-reports?church_code=${user.chr_code || ''}`).then(r => r.json())
    ]).then(([certs, reps]) => {
      setRequests(Array.isArray(certs) ? certs : []);
      setReports(Array.isArray(reps) ? reps : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user.chr_code]);

  if (selectedCert) return <RequestDetail request={selectedCert} onBack={() => { setSelectedCert(null); fetchData(); }} actionRole="church" />;
  if (creatingReport || selectedReportId) return <ChurchReportForm user={user} reportId={selectedReportId} onBack={() => { setCreatingReport(false); setSelectedReportId(null); fetchData(); }} onSaved={() => { setCreatingReport(false); setSelectedReportId(null); fetchData(); }} />;

  const menus = [
    { id: 'bulletin', icon: 'menu_book', label: '주보관리' },
    { id: 'cert', icon: 'verified', label: '증명서 관리' },
    { id: 'admin-docs', icon: 'folder_open', label: '행정문서' },
    { id: 'submissions', icon: 'inbox', label: '제출문서' },
    { id: 'report', icon: 'assessment', label: '상황 통계 보고' },
    { id: 'map-church', icon: 'map', label: '지도·교회관리' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {menus.map(m => (
          <button key={m.id} onClick={() => setActiveMenu(m.id)} style={S.navPill(activeMenu === m.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {activeMenu === 'bulletin' && (
        <>
          {isAdmin && !targetCode ? (
            <div style={S.card}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>주보 관리할 교회 검색</h3>
                <p style={{ ...S.subText, marginBottom: 16 }}>주보를 열람하거나 편집할 교회를 선택해 주세요.</p>
                <input
                  type="text"
                  placeholder="관리할 교회명 또는 노회명 검색..."
                  value={adminSearchTerm}
                  onChange={(e) => setAdminSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 15, background: '#f8fafc' }}
                />
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 12, overflow: 'hidden' }}>
                <ChurchList searchTerm={debouncedAdminSearch} onSelect={setAdminSelectedChurch} />
              </div>
            </div>
          ) : (
            <>
              {churchToast && <div style={{ position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:99,padding:'8px 20px',background:'#059669',color:'#fff',borderRadius:12,fontWeight:700,fontSize:13,boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>{churchToast}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                  <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>디지털 주보(예배) 관리 — {isAdmin ? `${adminSelectedChurch?.CHRNAME || ''} 교회` : '내 교회 주보'}</h3>
                  <p style={S.subText}>기장성도앱에 실시간으로 연동되어 배포되는 모바일 주보를 관리합니다.</p>
                </div>
                {isAdmin && targetCode && (
                  <button style={{ ...S.ghostBtn, fontSize: 12, padding: '6px 12px' }} onClick={() => { setAdminSelectedChurch(null); setBulletinData(null); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>search</span>
                    다른 교회 검색
                  </button>
                )}
              </div>

              {bulletinLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {bulletinData ? (
                    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                        <div>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#d1fae5', color: '#059669', fontWeight: 700, marginRight: 8 }}>
                            ● 실시간 배포중
                          </span>
                          <strong style={{ fontSize: 16, color: '#0A2540' }}>{bulletinData.bulletinTitle || "주보 제목 미입력"}</strong>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {bulletinData.date || "일자 미입력"} | {bulletinData.serviceType || "주일대예배"}
                          </div>
                        </div>
                        <button style={S.gradientBtn} onClick={() => setShowBulletinEdit(true)}>📝 주보 편집하기</button>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0070eb', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_list_numbered</span>
                            예배 순서 ({bulletinData.orders?.length || 0}개)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(bulletinData.orders || []).slice(0, 5).map((o, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                                <span style={{ fontWeight: 600 }}>{idx + 1}. {o.title}</span>
                                <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{o.detail} {o.targetKey ? `(${o.targetKey})` : ''}</span>
                              </div>
                            ))}
                            {bulletinData.orders?.length > 5 && (
                              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>외 {bulletinData.orders.length - 5}개의 순서가 더 있습니다.</div>
                            )}
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0070eb', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications</span>
                            교회 소식 ({bulletinData.churchNews?.length || 0}개)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(bulletinData.churchNews || []).slice(0, 3).map((n, idx) => (
                              <div key={idx} style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                📢 {n}
                              </div>
                            ))}
                            {bulletinData.churchNews?.length > 3 && (
                              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>외 {bulletinData.churchNews.length - 3}개의 소식이 더 있습니다.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48, cursor: 'pointer' }} onClick={() => setShowBulletinEdit(true)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 12 }}>article</span>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 4 }}>등록된 모바일 디지털 주보가 없습니다.</h4>
                      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>새 주보를 작성하고 성도앱에 실시간 배포해 보세요.</p>
                      <button style={S.gradientBtn}>➕ 새 주보 작성하기</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeMenu === 'cert' && (
        <>
          <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 8 }}>교회 증명서 요청 목록</h3>
          <p style={{ ...S.subText, marginBottom: 20 }}>소속 교역자의 요청을 접수/확인하고, 시찰로 경유합니다.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> :
            <RequestList requests={requests} onSelect={setSelectedCert} />}
        </>
      )}

      {activeMenu === 'admin-docs' && <AdminDocumentBrowser user={user} scope="church" />}
      {activeMenu === 'submissions' && <SubmissionInbox user={user} role="church" />}

      {activeMenu === 'report' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>교회 보고서 제출</h3>
              <p style={S.subText}>매 연말 교회의 정보와 상황 통계를 노회로 보고합니다.</p>
            </div>
            <button style={S.gradientBtn} onClick={() => setCreatingReport(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>add_circle</span>
              새 보고서 작성
            </button>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>제출된 보고서가 없습니다.</div>
              ) : reports.map(r => (
                <div key={r.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>{r.report_year}년도 교회 상황 통계표</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>최종수정: {r.updated_at?.substring(0, 10)}</div>
                  </div>
                  <button style={S.ghostBtn} onClick={() => setSelectedReportId(r.id)}>열람 / 편집</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeMenu === 'map-church' && (
        <>
          {churchToast && <div style={{ position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:99,padding:'8px 20px',background:'#059669',color:'#fff',borderRadius:12,fontWeight:700,fontSize:13,boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>{churchToast}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <h3 style={{ ...S.heading, fontSize: 18, marginBottom: 4 }}>기장지도 — {isAdmin ? '교회 정보 관리 (총회 관리자)' : '내 교회 정보 관리'}</h3>
              <p style={S.subText}>기장지도 앱에 표시되는 교회 정보를 수정합니다.</p>
            </div>
            {isAdmin && targetCode && (
              <button style={{ ...S.ghostBtn, fontSize: 12, padding: '6px 12px' }} onClick={() => { setAdminSelectedChurch(null); setChurch(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>search</span>
                다른 교회 검색
              </button>
            )}
          </div>

          {isAdmin && !targetCode ? (
             <div style={S.card}>
                <div style={{ marginBottom: 16 }}>
                  <input
                    type="text"
                    placeholder="관리할 교회명 또는 노회명 검색..."
                    value={adminSearchTerm}
                    onChange={(e) => setAdminSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 15, background: '#f8fafc' }}
                  />
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 12, overflow: 'hidden' }}>
                  <ChurchList searchTerm={debouncedAdminSearch} onSelect={setAdminSelectedChurch} />
                </div>
             </div>
          ) : (
            churchLoading ? <div style={{ textAlign:'center',padding:40,color:'#94a3b8' }}>불러오는 중...</div>
            : churchError ? <div style={{ ...S.card, textAlign:'center',padding:40,color:'#ef4444' }}>{churchError}</div>
            : church && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              {/* 왼쪽: 기본정보 */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#0070eb'}}>chat</span> 인삿말</div>
                  <textarea value={churchForm.intro_text} onChange={e => setChurchForm(p=>({...p, intro_text:e.target.value}))} rows={3} style={{ width:'100%',padding:10,borderRadius:10,border:'1px solid #e2e8f0',fontSize:13,resize:'vertical' }} placeholder="교회 환영 인삿말" />
                </div>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#0070eb'}}>schedule</span> 예배시간</div>
                  {churchForm.worship_times?.map((wt,i) => (
                    <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                      <input value={wt.title} onChange={e => { const a=[...churchForm.worship_times]; a[i]={...a[i],title:e.target.value}; setChurchForm(p=>({...p,worship_times:a})); }} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="예배명" />
                      <input value={wt.time} onChange={e => { const a=[...churchForm.worship_times]; a[i]={...a[i],time:e.target.value}; setChurchForm(p=>({...p,worship_times:a})); }} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="시간" />
                      <input value={wt.location||''} onChange={e => { const a=[...churchForm.worship_times]; a[i]={...a[i],location:e.target.value}; setChurchForm(p=>({...p,worship_times:a})); }} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="장소" />
                      <button onClick={() => setChurchForm(p=>({...p,worship_times:p.worship_times.filter((_,j)=>j!==i)}))} style={{ padding:'4px 6px',background:'#fee2e2',color:'#ef4444',border:'none',borderRadius:6,cursor:'pointer',fontSize:11 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setChurchForm(p=>({...p,worship_times:[...p.worship_times,{title:'',time:'',location:''}]}))} style={{ ...S.ghostBtn, fontSize:11, padding:'4px 10px' }}>+ 예배 추가</button>
                </div>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#0070eb'}}>location_on</span> 연락처·위치</div>
                  {[['address','주소'],['phone','전화번호'],['homepage_url','홈페이지']].map(([k,l]) => (
                    <div key={k} style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:2 }}>{l}</div>
                      <input value={churchForm[k]||''} onChange={e => setChurchForm(p=>({...p,[k]:e.target.value}))} style={{ width:'100%',padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:13 }} />
                    </div>
                  ))}
                </div>
                <button onClick={saveChurch} disabled={churchSaving} style={{ ...S.gradientBtn, width:'100%', opacity: churchSaving?0.6:1 }}>{churchSaving ? '저장 중...' : '💾 변경사항 저장'}</button>
              </div>
              {/* 오른쪽: 미디어 + 문의 */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#ef4444'}}>play_circle</span> 유튜브 영상</div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:2 }}>영상 ID</div>
                    <input value={churchForm.youtube_video_id} onChange={e => setChurchForm(p=>({...p,youtube_video_id:e.target.value}))} style={{ width:'100%',padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:13 }} placeholder="dQw4w9WgXcQ" />
                  </div>
                  {churchForm.youtube_video_id && <div style={{ aspectRatio:'16/9',borderRadius:12,overflow:'hidden',marginTop:8 }}><iframe src={`https://www.youtube.com/embed/${churchForm.youtube_video_id}`} style={{ width:'100%',height:'100%',border:'none' }} title="YT" allowFullScreen /></div>}
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:2 }}>채널 ID</div>
                    <input value={churchForm.youtube_channel_id} onChange={e => setChurchForm(p=>({...p,youtube_channel_id:e.target.value}))} style={{ width:'100%',padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:13 }} placeholder="UCxxxxxx" />
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#8b5cf6'}}>collections</span> 사진 갤러리 ({churchForm.photo_urls?.length || 0}장)</div>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    <input value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} style={{ flex:1,padding:8,borderRadius:8,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="사진 URL" onKeyDown={e => { if(e.key==='Enter' && newPhotoUrl.trim()) { setChurchForm(p=>({...p,photo_urls:[...p.photo_urls,newPhotoUrl.trim()]})); setNewPhotoUrl(''); }}} />
                    <button onClick={() => { if(newPhotoUrl.trim()) { setChurchForm(p=>({...p,photo_urls:[...p.photo_urls,newPhotoUrl.trim()]})); setNewPhotoUrl(''); }}} style={{ ...S.ghostBtn, padding:'6px 12px', fontSize:12 }}>추가</button>
                  </div>
                  {churchForm.photo_urls?.length > 0 && <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>{churchForm.photo_urls.map((u,i) => (<div key={i} style={{ position:'relative',flexShrink:0,width:100,height:70,borderRadius:10,overflow:'hidden',background:'#f1f5f9' }}><img src={u} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} /><button onClick={() => setChurchForm(p=>({...p,photo_urls:p.photo_urls.filter((_,j)=>j!==i)}))} style={{ position:'absolute',top:2,right:2,width:18,height:18,borderRadius:9,background:'rgba(239,68,68,0.8)',color:'#fff',border:'none',fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button></div>))}</div>}
                </div>
                <div style={S.card}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#0A2540', display:'flex', alignItems:'center', gap:6 }}><span className="material-symbols-outlined" style={{fontSize:18,color:'#f59e0b'}}>mail</span> 비밀 문의 ({inquiries.length}건)</div>
                    <button onClick={fetchInquiries} style={{ ...S.ghostBtn, fontSize:11, padding:'4px 10px' }}>새로고침</button>
                  </div>
                  {inqLoading ? <div style={{ textAlign:'center',padding:20,color:'#94a3b8',fontSize:13 }}>로딩...</div>
                   : inquiries.length === 0 ? <div style={{ textAlign:'center',padding:20,color:'#94a3b8',fontSize:13 }}>접수된 문의가 없습니다.</div>
                   : <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>{inquiries.map(inq => (
                    <div key={inq.id} style={{ padding:10, background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:700 }}>{inq.name} <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>{inq.phone}</span></span>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background: inq.is_read?'#d1fae5':'#fef3c7', color: inq.is_read?'#059669':'#d97706', fontWeight:700 }}>{inq.is_read?'답변완료':'미확인'}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#475569', marginBottom:4, whiteSpace:'pre-wrap' }}>{inq.content}</div>
                      {inq.reply && <div style={{ fontSize:12, color:'#1d4ed8', background:'#eff6ff', padding:6, borderRadius:6, marginBottom:4 }}>↳ {inq.reply}</div>}
                      <div style={{ display:'flex', gap:4 }}>
                        <input value={replyTexts[inq.id]||''} onChange={e => setReplyTexts(p=>({...p,[inq.id]:e.target.value}))} style={{ flex:1,padding:6,borderRadius:6,border:'1px solid #e2e8f0',fontSize:12 }} placeholder="답변 작성..." onKeyDown={e => e.key==='Enter' && replyInquiry(inq.id)} />
                        <button onClick={() => replyInquiry(inq.id)} style={{ padding:'4px 10px',background:'#0070eb',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer' }}>전송</button>
                      </div>
                    </div>
                  ))}</div>}
                </div>
              </div>
            </div>
            )
          )}
        </>
      )}
      {/* ── 디지털 주보 관리 모달 ── */}
      {showBulletinEdit && (
        <ChurchBulletinEditModal
          bulletin={bulletinData}
          churchName={isAdmin ? (adminSelectedChurch?.CHRNAME || '') : (user?.church || '')}
          onClose={() => setShowBulletinEdit(false)}
          onSave={saveBulletinData}
        />
      )}
    </div>
  );
};

export default ChurchTab;
