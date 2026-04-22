import React, { useState, useRef, useEffect } from 'react';
import API_BASE from '../api';
import ApiImage from './ApiImage';

const ProfileEdit = ({ user, onBack, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [bgImage, setBgImage] = useState(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [editForm, setEditForm] = useState({ changes: [], reason: '' });
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user-profiles/${user.code}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewUrl(data.profile_image_url ? `${API_BASE}${data.profile_image_url}` : '');
          setBgPreviewUrl(data.background_image_url ? `${API_BASE}${data.background_image_url}` : '');
          setStatusMessage(data.status_message || '');
          if (data.phone) setPhone(data.phone);
          if (data.email) setEmail(data.email);
        }
      } catch (err) { console.error(err); }
    };
    const fetchEditRequests = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/info-edit-requests?minister_code=${user.code}`);
        if (res.ok) setEditRequests(await res.json());
      } catch (err) { console.error(err); }
    };
    if (user?.code) { fetchProfile(); fetchEditRequests(); }
  }, [user]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setProfileImage(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const handleBgFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setBgImage(file); setBgPreviewUrl(URL.createObjectURL(file)); }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload-profile`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('이미지 업로드에 실패했습니다.');
    const data = await res.json();
    return data.url;
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      let uploadedUrl = previewUrl ? previewUrl.replace(API_BASE, '') : '';
      if (profileImage) uploadedUrl = await uploadFile(profileImage);

      let bgUrl = bgPreviewUrl ? bgPreviewUrl.replace(API_BASE, '') : '';
      if (bgImage) bgUrl = await uploadFile(bgImage);

      // Save profile (image + status + background)
      await fetch(`${API_BASE}/api/user-profiles/${user.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_image_url: uploadedUrl, status_message: statusMessage, background_image_url: bgUrl }),
      });
      // Save contact info (phone/email)
      await fetch(`${API_BASE}/api/user-profiles/${user.code}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      });
      alert('저장되었습니다.');
      if (onSaved) onSaved();
      onBack();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const EDITABLE_FIELDS = [
    { key: 'name', label: '이름' },
    { key: 'church', label: '교회' },
    { key: 'duty', label: '직분' },
    { key: 'presbytery', label: '노회' },
    { key: 'birthday', label: '생년월일' },
    { key: 'address', label: '주소' },
  ];

  const handleAddChange = () => {
    setEditForm(prev => ({ ...prev, changes: [...prev.changes, { field: '', old_value: '', new_value: '' }] }));
  };

  const handleSubmitEditRequest = async () => {
    const validChanges = editForm.changes.filter(c => c.field && c.new_value);
    if (validChanges.length === 0) { alert('변경할 항목을 하나 이상 입력해주세요.'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/info-edit-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minister_code: user.code,
          minister_name: user.name,
          noh_code: user.noh_code || '',
          noh_name: user.presbytery || '',
          changes: validChanges,
          reason: editForm.reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('정보 수정 요청이 제출되었습니다.\n노회 서기 확인 후 총회에서 수정됩니다.');
        setShowEditRequest(false);
        setEditForm({ changes: [], reason: '' });
        // Refresh requests
        const r2 = await fetch(`${API_BASE}/api/info-edit-requests?minister_code=${user.code}`);
        if (r2.ok) setEditRequests(await r2.json());
      }
    } catch { alert('요청 실패'); }
  };

  const statusLabels = {
    SUBMITTED: { text: '접수됨', color: '#FF9500', bg: '#FFF3E0' },
    NOH_CONFIRMED: { text: '노회 확인', color: '#007AFF', bg: '#E3F2FD' },
    NOH_REJECTED: { text: '노회 반려', color: '#FF3B30', bg: '#FFEBEE' },
    COMPLETED: { text: '수정 완료', color: '#34C759', bg: '#E8F5E9' },
  };

  return (
    <div className="min-h-screen bg-surface font-['Plus_Jakarta_Sans',_'Pretendard'] text-on-surface pb-32">
      <header className="fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 w-full max-w-screen-xl mx-auto">
          <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100/50 transition-colors active:scale-95">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-['Manrope',_'Pretendard'] font-bold text-lg tracking-tight">내 정보 수정</h1>
          <button onClick={handleSave} disabled={loading}
            className="font-['Manrope',_'Pretendard'] font-bold text-lg tracking-tight text-secondary active:scale-95 transition-transform disabled:opacity-50">
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-8 animate-fade-in">
        {error && <div className="p-4 bg-error-container text-error rounded-xl text-sm font-medium">{error}</div>}

        {/* Profile & Background Photo */}
        <section className="space-y-3">
          {/* Background Preview Card */}
          <div className="relative rounded-3xl overflow-hidden shadow-lg h-48 bg-gradient-to-br from-primary to-primary-container group">
            {bgPreviewUrl ? (
              <ApiImage src={bgPreviewUrl} alt="배경" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            )}
            {/* Background change button */}
            <button onClick={() => bgInputRef.current?.click()}
              className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 transition-all hover:bg-black/60 z-10">
              <span className="material-symbols-outlined text-sm">wallpaper</span>
              배경변경
            </button>
            <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgFileChange} />
            
            {/* Profile photo - centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative group/profile cursor-pointer pointer-events-auto" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white shadow-lg bg-surface-variant flex items-center justify-center">
                  {previewUrl ? (
                    <ApiImage src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-outline">{user?.name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <button className="absolute bottom-0 right-0 bg-secondary-container text-on-primary w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-3 border-white">
                  <span className="material-symbols-outlined text-base">camera_alt</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>
          </div>
          <div className="pt-2 text-center">
            <p className="text-on-surface font-bold text-lg">{user?.name}</p>
            <p className="text-on-surface-variant text-sm">{user?.duty} · {user?.church}</p>
          </div>
        </section>

        {/* Status Message */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-secondary text-xl">chat_bubble</span>
            <h2 className="font-['Manrope',_'Pretendard'] text-base font-bold text-primary">상태 메시지</h2>
            <span className="text-xs text-on-surface-variant ml-auto bg-surface-container-high px-2 py-0.5 rounded-full">주소록 검색 시 표시됨</span>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-variant/40">
            <input type="text" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="본인을 잘 나타내는 짧은 문구를 입력하세요"
              className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium" />
          </div>
        </section>

        {/* Contact Info - Self Editable */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-secondary text-xl">call</span>
            <h2 className="font-['Manrope',_'Pretendard'] text-base font-bold text-primary">연락처</h2>
            <span className="text-xs text-[#34C759] font-bold ml-auto">✎ 직접 수정 가능</span>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-variant/40 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">전화번호</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={user?.phone || '전화번호 입력'}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">이메일</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={user?.email || '이메일 입력'}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium" />
            </div>
          </div>
        </section>

        {/* Read-Only Info */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-secondary text-xl">badge</span>
            <h2 className="font-['Manrope',_'Pretendard'] text-base font-bold text-primary">기본 정보</h2>
            <span className="text-xs text-on-surface-variant ml-auto">🔒 수정 요청 필요</span>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-variant/40 space-y-4 opacity-70">
            {[
              { label: '이름', value: user?.name },
              { label: '교회', value: user?.church },
              { label: '직분', value: user?.duty },
              { label: '노회', value: user?.presbytery },
            ].map((f, idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">{f.label}</label>
                <input type="text" value={f.value || ''} readOnly
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-on-surface font-medium cursor-not-allowed" />
              </div>
            ))}
          </div>
        </section>

        {/* Edit Request Button */}
        <section>
          <button onClick={() => { setShowEditRequest(true); if (editForm.changes.length === 0) handleAddChange(); }}
            className="w-full py-4 rounded-2xl bg-gradient-to-br from-[#FF9500] to-[#FF6B00] text-white font-bold text-base shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">edit_document</span>
            정보 수정 요청 (노회 서기 확인 → 총회 수정)
          </button>
        </section>

        {/* Edit Request Form Modal */}
        {showEditRequest && (
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-lg border border-[#FF9500]/30 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-['Manrope',_'Pretendard'] font-bold text-base text-[#FF9500] flex items-center gap-2">
                <span className="material-symbols-outlined">edit_note</span>정보 수정 요청서
              </h3>
              <button onClick={() => setShowEditRequest(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>

            {/* Workflow description */}
            <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-high rounded-xl p-3">
              <span className="bg-[#FF9500] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
              <span>본인 제출</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
              <span className="bg-[#007AFF] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
              <span>노회 서기 확인</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
              <span className="bg-[#34C759] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
              <span>총회 수정 완료</span>
            </div>

            {editForm.changes.map((change, idx) => (
              <div key={idx} className="bg-surface-container-high rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant">변경 항목 #{idx + 1}</span>
                  {editForm.changes.length > 1 && (
                    <button onClick={() => setEditForm(prev => ({ ...prev, changes: prev.changes.filter((_, i) => i !== idx) }))}
                      className="text-error text-xs font-bold">삭제</button>
                  )}
                </div>
                <select value={change.field}
                  onChange={(e) => {
                    const newChanges = [...editForm.changes];
                    const field = EDITABLE_FIELDS.find(f => f.key === e.target.value);
                    newChanges[idx] = { ...newChanges[idx], field: e.target.value, label: field?.label || '', old_value: user?.[e.target.value] || '' };
                    setEditForm(prev => ({ ...prev, changes: newChanges }));
                  }}
                  className="w-full bg-white rounded-xl px-4 py-3 border-none text-sm font-medium">
                  <option value="">변경할 항목 선택</option>
                  {EDITABLE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                {change.field && (
                  <>
                    <div className="text-xs text-on-surface-variant">현재값: <strong>{change.old_value || '(없음)'}</strong></div>
                    <input type="text" value={change.new_value || ''}
                      onChange={(e) => {
                        const newChanges = [...editForm.changes];
                        newChanges[idx] = { ...newChanges[idx], new_value: e.target.value };
                        setEditForm(prev => ({ ...prev, changes: newChanges }));
                      }}
                      placeholder="변경할 값 입력"
                      className="w-full bg-white rounded-xl px-4 py-3 border-none text-sm font-medium focus:ring-2 focus:ring-[#FF9500]/20" />
                  </>
                )}
              </div>
            ))}

            <button onClick={handleAddChange}
              className="w-full py-3 rounded-xl border-2 border-dashed border-surface-variant text-on-surface-variant text-sm font-bold active:bg-surface-container-high transition-colors">
              + 변경 항목 추가
            </button>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface-variant ml-1">변경 사유 (선택)</label>
              <textarea value={editForm.reason} onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="변경 사유를 입력해 주세요"
                rows={2}
                className="w-full bg-surface-container-high rounded-xl px-4 py-3 border-none text-sm font-medium focus:ring-2 focus:ring-[#FF9500]/20 resize-none" />
            </div>

            <button onClick={handleSubmitEditRequest}
              className="w-full py-4 rounded-xl bg-gradient-to-br from-[#FF9500] to-[#FF6B00] text-white font-bold text-base shadow-lg active:scale-95 transition-all">
              수정 요청 제출
            </button>
          </section>
        )}

        {/* Edit Request History */}
        {editRequests.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-secondary text-xl">history</span>
              <h2 className="font-['Manrope',_'Pretendard'] text-base font-bold text-primary">수정 요청 이력</h2>
            </div>
            <div className="space-y-3">
              {editRequests.map(req => {
                const st = statusLabels[req.status] || { text: req.status, color: '#8E8E93', bg: '#F2F2F7' };
                return (
                  <div key={req.id} className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-variant/40">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-on-surface-variant">{req.created_at?.split('T')[0] || req.created_at?.substring(0, 10)}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.text}</span>
                    </div>
                    {(req.changes || []).map((c, i) => (
                      <div key={i} className="text-sm mb-1">
                        <span className="font-bold text-on-surface">{c.label || c.field}</span>:
                        <span className="text-on-surface-variant line-through ml-1">{c.old_value || '(없음)'}</span>
                        <span className="material-symbols-outlined text-sm mx-1 text-[#FF9500]">arrow_forward</span>
                        <span className="text-secondary font-bold">{c.new_value}</span>
                      </div>
                    ))}
                    {req.reason && <p className="text-xs text-on-surface-variant mt-2 italic">사유: {req.reason}</p>}
                    {req.noh_memo && <p className="text-xs text-[#007AFF] mt-1">노회 메모: {req.noh_memo}</p>}
                    {req.assembly_memo && <p className="text-xs text-[#34C759] mt-1">총회 메모: {req.assembly_memo}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Save Button (bottom) */}
        <section className="pt-2 pb-8">
          <button onClick={handleSave} disabled={loading}
            className="w-full bg-gradient-to-br from-secondary to-secondary-container text-white py-4 rounded-full font-['Manrope',_'Pretendard'] font-bold text-[17px] shadow-lg active:scale-95 transition-all disabled:opacity-50">
            {loading ? '저장 중...' : '수정 완료'}
          </button>
        </section>
      </main>
    </div>
  );
};

export default ProfileEdit;
