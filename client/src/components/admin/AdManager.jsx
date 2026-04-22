import { useState, useEffect } from 'react';
import API_BASE from '../../api';
import ApiImage from '../ApiImage';

const AdManager = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', link_url: '', start_date: '', end_date: '', display_order: 0, image_url: '' });
  const [uploading, setUploading] = useState(false);

  const getInitialForm = () => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return {
      title: '', link_url: '',
      start_date: today.toISOString().split('T')[0],
      end_date: nextMonth.toISOString().split('T')[0],
      display_order: 0, image_url: ''
    };
  };

  const fetchAds = () => {
    fetch(`${API_BASE}/api/ads`)
      .then(r => r.json())
      .then(data => setAds(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAds(); }, []);

  const getStatus = (ad) => {
    const today = new Date().toISOString().split('T')[0];
    if (ad.start_date > today) return { label: '대기', color: '#FF9500', bg: '#FFF3E0' };
    if (ad.end_date < today) return { label: '만료', color: '#8E8E93', bg: '#F2F2F7' };
    return { label: '게재중', color: '#34C759', bg: '#E8F5E9' };
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('2MB 이하의 이미지만 업로드 가능합니다.'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/upload-ad`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) setForm(prev => ({ ...prev, image_url: data.url }));
    } catch { alert('업로드 실패'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.start_date || !form.end_date) { alert('제목, 시작일, 종료일은 필수입니다.'); return; }
    if (!form.image_url) { alert('광고 이미지를 업로드해주세요.'); return; }
    const isNew = editing === 'new';
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? `${API_BASE}/api/ads` : `${API_BASE}/api/ads/${editing}`;
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success || data.id) {
        alert(isNew ? '광고가 등록되었습니다.' : '광고가 수정되었습니다.');
        setEditing(null);
        setForm(getInitialForm());
        fetchAds();
      }
    } catch { alert('오류 발생'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 광고를 삭제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/ads/${id}`, { method: 'DELETE' });
    fetchAds();
  };

  const startEdit = (ad) => {
    setEditing(ad.id);
    setForm({ title: ad.title, link_url: ad.link_url || '', start_date: ad.start_date, end_date: ad.end_date, display_order: ad.display_order, image_url: ad.image_url });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>불러오는 중...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0a2540', marginBottom: 4, fontFamily: "'Manrope', 'Pretendard'" }}>📢 광고 배너 관리</h3>
          <p style={{ fontSize: 13, color: '#74777e', margin: 0 }}>모바일 앱 홈 화면에 표시되는 광고 배너를 관리합니다.</p>
        </div>
        {!editing && (
          <button onClick={() => { setEditing('new'); setForm(getInitialForm()); }}
            style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 12px rgba(0,112,235,0.25)' }}>
            + 새 광고 등록
          </button>
        )}
      </div>

      {/* Editor Form */}
      {editing && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 20px 40px rgba(10,37,64,0.06)' }}>
          <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0a2540', marginBottom: 16, fontFamily: "'Manrope', 'Pretendard'" }}>
            {editing === 'new' ? '새 광고 등록' : '광고 수정'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#43474d', display: 'block', marginBottom: 6 }}>광고 제목 *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: '#f3f3f8', border: 'none', borderRadius: 12, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} placeholder="광고 제목 입력" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#43474d', display: 'block', marginBottom: 6 }}>링크 URL</label>
              <input value={form.link_url} onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: '#f3f3f8', border: 'none', borderRadius: 12, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} placeholder="https://..." />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#43474d', display: 'block', marginBottom: 6 }}>시작일 *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: '#f3f3f8', border: 'none', borderRadius: 12, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#43474d', display: 'block', marginBottom: 6 }}>종료일 *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: '#f3f3f8', border: 'none', borderRadius: 12, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#43474d', display: 'block', marginBottom: 6 }}>표시 순서</label>
              <input type="number" value={form.display_order} onChange={e => setForm(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '10px 14px', background: '#f3f3f8', border: 'none', borderRadius: 12, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#43474d', display: 'block', marginBottom: 6 }}>
                광고 이미지 * <span style={{color: '#0070eb', fontWeight: 700}}>(권장: 가로 1200px × 세로 400px, 비율 3:1)</span>
              </label>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                style={{ width: '100%', padding: '8px 14px', background: '#f3f3f8', border: 'none', borderRadius: 12, fontSize: 13, boxSizing: 'border-box' }} />
              {uploading && <span style={{ fontSize: 12, color: '#007AFF' }}>업로드 중...</span>}
            </div>
          </div>
          {form.image_url && (
            <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', maxWidth: 400 }}>
              <ApiImage src={`${API_BASE}${form.image_url}`} alt="미리보기" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, maxHeight: 200, objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => { setEditing(null); setForm(getInitialForm()); }}
              style={{ padding: '10px 24px', background: 'transparent', color: '#43474d', border: '1px solid rgba(196,198,206,0.3)', borderRadius: 24, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              취소
            </button>
            <button onClick={handleSave}
              style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #0058bc, #0070eb)', color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 12px rgba(0,112,235,0.25)' }}>
              {editing === 'new' ? '등록' : '수정'}
            </button>
          </div>
        </div>
      )}

      {/* Ad List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 10px 20px rgba(10,37,64,0.03)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
            <p style={{ color: '#74777e', fontSize: 14 }}>등록된 광고가 없습니다.</p>
          </div>
        ) : ads.map(ad => {
          const status = getStatus(ad);
          return (
            <div key={ad.id} style={{ background: '#fff', borderRadius: 16, padding: 16, display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 10px 20px rgba(10,37,64,0.03)', transition: 'all 0.2s' }}>
              {/* Thumbnail */}
              <div style={{ width: 80, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f3f3f8' }}>
                {ad.image_url && <ApiImage src={`${API_BASE}${ad.image_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#0a2540', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: status.bg, color: status.color, flexShrink: 0 }}>{status.label}</span>
                </div>
                <div style={{ fontSize: 12, color: '#74777e' }}>
                  {ad.start_date} ~ {ad.end_date} {ad.link_url && <span> · <a href={ad.link_url} target="_blank" rel="noreferrer" style={{ color: '#007AFF' }}>링크</a></span>}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => startEdit(ad)}
                  style={{ padding: '6px 14px', background: '#f3f3f8', color: '#0a2540', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>수정</button>
                <button onClick={() => handleDelete(ad.id)}
                  style={{ padding: '6px 14px', background: '#FFF5F5', color: '#FF3B30', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>삭제</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdManager;
