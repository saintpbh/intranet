import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const STATUS_LABELS = { draft: '작성 중', scheduled: '예약됨', sent: '발송됨', cancelled: '취소됨' };
const STATUS_COLORS = { draft: '#8E8E93', scheduled: '#FF9500', sent: '#34C759', cancelled: '#FF3B30' };

const PushManager = ({ scope = 'assembly', senderRole = '총회관리자' }) => {
  const [activeView, setActiveView] = useState('campaigns'); // campaigns, compose, groups, analytics
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [ministers, setMinisters] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Compose form
  const [form, setForm] = useState({ title: '', body: '', link_url: '', target_type: 'all', target_data: {} });
  const [selectedMinisters, setSelectedMinisters] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Group form
  const [groupForm, setGroupForm] = useState({ name: '', member_codes: [] });
  const [editingGroup, setEditingGroup] = useState(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  const fetchCampaigns = () => {
    fetch(`${API_BASE}/api/push/campaigns?scope=${scope}`)
      .then(r => r.json())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  const fetchGroups = () => {
    fetch(`${API_BASE}/api/push/groups?scope=${scope}`)
      .then(r => r.json())
      .then(data => setGroups(Array.isArray(data) ? data : []));
  };

  const fetchMinisters = () => {
    fetch(`${API_BASE}/api/push/subscribers?scope=${scope}`)
      .then(r => r.json())
      .then(data => setMinisters(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    fetchCampaigns(); fetchGroups(); fetchMinisters();
  }, [scope]);

  // --- Campaign Compose ---
  const handleCompose = () => {
    setForm({ title: '', body: '', link_url: '', target_type: 'all', target_data: {} });
    setSelectedMinisters([]);
    setSelectedGroup(null);
    setActiveView('compose');
  };

  const handleSend = async (sendType) => {
    if (!form.title.trim()) { alert('제목을 입력해 주세요.'); return; }
    
    let target_data = {};
    let target_type = form.target_type;
    if (target_type === 'individual') {
      target_data = { minister_codes: selectedMinisters.map(m => m.MinisterCode) };
    } else if (target_type === 'group' && selectedGroup) {
      target_data = { group_id: selectedGroup.id };
    }

    // Create campaign
    const createRes = await fetch(`${API_BASE}/api/push/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form, scope, target_type, target_data,
        sender_name: '관리자', sender_role: senderRole,
      }),
    });
    const createData = await createRes.json();
    if (!createData.success) { alert('캠페인 생성 실패'); return; }

    // Send
    const sendRes = await fetch(`${API_BASE}/api/push/campaigns/${createData.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ send_type: sendType, test_minister_code: '' }),
    });
    const sendData = await sendRes.json();
    if (sendData.success) {
      alert(sendData.message);
      fetchCampaigns();
      setActiveView('campaigns');
    }
  };

  // --- Analytics ---
  const viewAnalytics = async (campaign) => {
    setSelectedCampaign(campaign);
    const res = await fetch(`${API_BASE}/api/push/campaigns/${campaign.id}/analytics`);
    const data = await res.json();
    setAnalytics(data);
    setActiveView('analytics');
  };

  const handleDeleteCampaign = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/push/campaigns/${id}`, { method: 'DELETE' });
    fetchCampaigns();
  };

  // --- Group Management ---
  const openGroupNew = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', member_codes: [] });
    setShowGroupForm(true);
  };

  const openGroupEdit = (g) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, member_codes: [...g.member_codes] });
    setShowGroupForm(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) { alert('그룹 이름을 입력해 주세요.'); return; }
    const url = editingGroup ? `${API_BASE}/api/push/groups/${editingGroup.id}` : `${API_BASE}/api/push/groups`;
    const method = editingGroup ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...groupForm, scope }) });
    setShowGroupForm(false);
    fetchGroups();
  };

  const deleteGroup = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_BASE}/api/push/groups/${id}`, { method: 'DELETE' });
    fetchGroups();
  };

  const toggleGroupMember = (code) => {
    const codes = [...groupForm.member_codes];
    const idx = codes.indexOf(code);
    idx >= 0 ? codes.splice(idx, 1) : codes.push(code);
    setGroupForm({ ...groupForm, member_codes: codes });
  };

  const filteredMinisters = ministers.filter(m =>
    !searchQuery || m.MinisterName?.includes(searchQuery) || m.MinisterCode?.includes(searchQuery)
  );

  const groupFilteredMinisters = ministers.filter(m =>
    !groupSearch || m.MinisterName?.includes(groupSearch) || m.MinisterCode?.includes(groupSearch)
  );

  // --- Render ---
  const tabs = [
    { id: 'campaigns', label: '📨 캠페인', count: campaigns.length },
    { id: 'groups', label: '👥 그룹 관리', count: groups.length },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      {/* Sub tabs */}
      {activeView !== 'compose' && activeView !== 'analytics' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.id}
              className={`btn ${activeView === t.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => setActiveView(t.id)}>
              {t.label} ({t.count})
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={handleCompose}>
            ✉️ 새 알림 작성
          </button>
        </div>
      )}

      {/* Campaigns list */}
      {activeView === 'campaigns' && (
        loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>불러오는 중...</div> : (
          <div>
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>발송된 캠페인이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campaigns.map(c => (
                  <div key={c.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], fontWeight: 600 }}>
                            {STATUS_LABELS[c.status]}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--system-gray)' }}>
                            {c.target_type === 'all' ? '전체' : c.target_type === 'group' ? '그룹' : '개별'} · {c.total_targets}명
                          </span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{c.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--system-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 400 }}>{c.body}</div>
                        <div style={{ fontSize: 11, color: 'var(--system-gray2)', marginTop: 4 }}>
                          {c.sent_at ? `발송: ${c.sent_at.substring(0, 16)}` : c.created_at?.substring(0, 16)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {c.status === 'sent' && (
                          <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => viewAnalytics(c)}>📊 수신율</button>
                        )}
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                          onClick={() => handleDeleteCampaign(c.id)}>삭제</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Compose */}
      {activeView === 'compose' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, border: '1px solid var(--opaque-separator)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>✉️ 새 푸시 알림 작성</h4>
            <button onClick={() => setActiveView('campaigns')} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--system-gray)' }}>✕</button>
          </div>

          {/* Title & Body */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>제목 *</label>
            <input type="text" placeholder="알림 제목" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>본문</label>
            <textarea placeholder="알림 내용" value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--system-gray)', display: 'block', marginBottom: 4 }}>링크 URL (클릭 시 이동)</label>
            <input type="text" placeholder="/notices 또는 전체 URL" value={form.link_url} onChange={e => setForm({...form, link_url: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Target selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>대상 선택</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { value: 'all', label: '📣 전체' },
                { value: 'group', label: '👥 그룹' },
                { value: 'individual', label: '👤 개별 선택' },
              ].map(opt => (
                <button key={opt.value}
                  className={`btn ${form.target_type === opt.value ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => setForm({...form, target_type: opt.value})}>
                  {opt.label}
                </button>
              ))}
            </div>

            {form.target_type === 'group' && (
              <div className="grouped-list" style={{ maxHeight: 200, overflow: 'auto' }}>
                {groups.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--system-gray)' }}>그룹이 없습니다. 그룹 관리에서 먼저 생성해 주세요.</div>}
                {groups.map(g => (
                  <div key={g.id} className="result-row" onClick={() => setSelectedGroup(g)}
                    style={{ background: selectedGroup?.id === g.id ? 'rgba(0,122,255,0.06)' : undefined, cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div className="result-name">{g.name}</div>
                      <div className="result-subtitle">{g.member_codes.length}명</div>
                    </div>
                    {selectedGroup?.id === g.id && <span style={{ color: 'var(--system-blue)' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}

            {form.target_type === 'individual' && (
              <div>
                <input type="text" placeholder="이름 또는 코드로 검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                {selectedMinisters.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {selectedMinisters.map(m => (
                      <span key={m.MinisterCode} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'rgba(0,122,255,0.1)', color: 'var(--system-blue)', cursor: 'pointer' }}
                        onClick={() => setSelectedMinisters(selectedMinisters.filter(s => s.MinisterCode !== m.MinisterCode))}>
                        {m.MinisterName} ✕
                      </span>
                    ))}
                  </div>
                )}
                <div className="grouped-list" style={{ maxHeight: 200, overflow: 'auto' }}>
                  {filteredMinisters.slice(0, 50).map(m => {
                    const isSelected = selectedMinisters.some(s => s.MinisterCode === m.MinisterCode);
                    return (
                      <div key={m.MinisterCode} className="result-row"
                        onClick={() => isSelected
                          ? setSelectedMinisters(selectedMinisters.filter(s => s.MinisterCode !== m.MinisterCode))
                          : setSelectedMinisters([...selectedMinisters, m])}
                        style={{ cursor: 'pointer', background: isSelected ? 'rgba(0,122,255,0.06)' : undefined }}>
                        <div style={{ flex: 1 }}>
                          <div className="result-name" style={{ fontSize: 14 }}>{m.MinisterName}</div>
                          <div className="result-subtitle">{m.NOHNAME}</div>
                        </div>
                        {isSelected && <span style={{ color: 'var(--system-blue)' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Send buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--opaque-separator)', paddingTop: 16 }}>
            <button className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={() => setActiveView('campaigns')}>취소</button>
            <button className="btn btn-outline" style={{ padding: '10px 16px', color: '#FF9500', borderColor: '#FF9500' }}
              onClick={() => handleSend('test')}>🧪 테스트 (나에게)</button>
            <button className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={() => handleSend('now')}>
              📤 지금 보내기
            </button>
          </div>
        </div>
      )}

      {/* Groups */}
      {activeView === 'groups' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            {!showGroupForm && (
              <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={openGroupNew}>+ 그룹 만들기</button>
            )}
          </div>

          {showGroupForm && (
            <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--opaque-separator)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{editingGroup ? '✏️ 그룹 수정' : '👥 새 그룹 만들기'}</h4>
                <button onClick={() => setShowGroupForm(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--system-gray)' }}>✕</button>
              </div>
              <input type="text" placeholder="그룹 이름" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 14, marginBottom: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>멤버 ({groupForm.member_codes.length}명)</div>
              {groupForm.member_codes.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {groupForm.member_codes.map(code => {
                    const m = ministers.find(x => x.MinisterCode === code);
                    return (
                      <span key={code} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'rgba(0,122,255,0.1)', color: 'var(--system-blue)', cursor: 'pointer' }}
                        onClick={() => toggleGroupMember(code)}>
                        {m?.MinisterName || code} ✕
                      </span>
                    );
                  })}
                </div>
              )}
              <input type="text" placeholder="이름으로 검색" value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--opaque-separator)', borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <div className="grouped-list" style={{ maxHeight: 200, overflow: 'auto' }}>
                {groupFilteredMinisters.slice(0, 50).map(m => {
                  const isMember = groupForm.member_codes.includes(m.MinisterCode);
                  return (
                    <div key={m.MinisterCode} className="result-row" onClick={() => toggleGroupMember(m.MinisterCode)}
                      style={{ cursor: 'pointer', background: isMember ? 'rgba(0,122,255,0.06)' : undefined }}>
                      <div style={{ flex: 1 }}>
                        <div className="result-name" style={{ fontSize: 14 }}>{m.MinisterName}</div>
                        <div className="result-subtitle">{m.NOHNAME}</div>
                      </div>
                      {isMember && <span style={{ color: 'var(--system-blue)' }}>✓</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={() => setShowGroupForm(false)}>취소</button>
                <button className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={saveGroup}>
                  {editingGroup ? '수정' : '저장'}
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 && !showGroupForm ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--system-gray)' }}>등록된 그룹이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map(g => (
                <div key={g.id} style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--opaque-separator)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--system-gray)' }}>멤버 {g.member_codes.length}명</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openGroupEdit(g)}>수정</button>
                      <button className="btn" style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                        onClick={() => deleteGroup(g.id)}>삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics */}
      {activeView === 'analytics' && analytics && (
        <div>
          <button className="btn btn-outline" style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }}
            onClick={() => { setActiveView('campaigns'); setAnalytics(null); }}>
            ← 캠페인 목록
          </button>

          <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, border: '1px solid var(--opaque-separator)', marginBottom: 16 }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{analytics.campaign?.title}</h4>
            <p style={{ fontSize: 13, color: 'var(--system-gray)', margin: 0 }}>{analytics.campaign?.body}</p>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div className="admin-stat-card">
              <div className="admin-stat-number">{analytics.summary?.total || 0}</div>
              <div className="admin-stat-label">전체 대상</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-number" style={{ color: '#34C759' }}>{analytics.summary?.opened || 0}</div>
              <div className="admin-stat-label">열람</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-number" style={{ color: '#007AFF' }}>{analytics.summary?.open_rate || 0}%</div>
              <div className="admin-stat-label">열람률</div>
            </div>
          </div>

          {/* Noh stats */}
          {analytics.noh_stats?.length > 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>노회별 수신율</div>
              <table className="admin-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr><th>노회</th><th>대상</th><th>열람</th><th>열람률</th></tr>
                </thead>
                <tbody>
                  {analytics.noh_stats.map((s, i) => (
                    <tr key={i}>
                      <td>{s.noh_code || '미지정'}</td>
                      <td>{s.total}</td>
                      <td>{s.opened}</td>
                      <td>{s.total > 0 ? Math.round(s.opened / s.total * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PushManager;
