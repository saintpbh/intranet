import { useState, useEffect, useCallback, useRef } from 'react';
import API_BASE from '../../api';

// ── Styles ──
const card = {
  background: '#fff', borderRadius: 16, padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid rgba(226,226,231,0.6)',
};
const sectionTitle = {
  fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
};
const statBox = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #f0f4ff 0%, #f8faff 100%)', borderRadius: 14,
  padding: '20px 16px', minWidth: 120, gap: 4,
};
const badge = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
  borderRadius: 20, fontSize: 11, fontWeight: 600,
  background: color === 'green' ? '#ecfdf5' : color === 'red' ? '#fef2f2' : '#fefce8',
  color: color === 'green' ? '#059669' : color === 'red' ? '#ef4444' : '#ca8a04',
});

const TABLE_LABELS = {
  notices: '공지사항',
  push_subscriptions: '푸시 구독',
  cert_requests: '증명서 요청',
  push_campaigns: '푸시 캠페인',
  admin_roles: '관리자 권한',
  official_documents: '공문',
  user_profiles: '프로필',
  ads: '광고',
  form_templates: '양식 템플릿',
  form_documents: '양식 문서',
  form_responses: '양식 응답',
  staff_accounts: '총회직원',
};

// Staff management styles
const inputStyle = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const inputStyleSm = { ...inputStyle, padding: '4px 8px', fontSize: 12 };
const tdStyle = { padding: '8px 6px', verticalAlign: 'middle' };
const addBtnStyle = {
  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff',
  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
};
const saveBtnStyle = {
  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: '#059669', color: '#fff', fontSize: 11, fontWeight: 600,
};
const cancelBtnStyle = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer',
  background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600,
};
const editBtnStyle = {
  padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer',
  background: '#fff', fontSize: 12,
};
const delBtnStyle = {
  padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', cursor: 'pointer',
  background: '#fff', fontSize: 12,
};

const SystemTab = ({ user }) => {
  const [sysInfo, setSysInfo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef(null);

  // Staff management state
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [newStaff, setNewStaff] = useState({ staff_code: '', name: '', department: '총회', position: '직원', phone: '', email: '' });
  const [editingCode, setEditingCode] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [staffMsg, setStaffMsg] = useState('');

  // Sync management state
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [logsLoading, setLogsLoading] = useState(true);

  // Map Sync Config State
  const [mapConfig, setMapConfig] = useState({ db_server: '', supabase_url: '' });
  const [mapSyncMsg, setMapSyncMsg] = useState('');
  const [mapSyncing, setMapSyncing] = useState(false);
  const [mapSyncLogs, setMapSyncLogs] = useState('');

  const fetchStaff = useCallback(async () => {
    try {
      setStaffLoading(true);
      const res = await fetch(`${API_BASE}/api/staff`);
      const data = await res.json();
      setStaffList(data.staff || []);
    } catch (e) {
      console.error('[SystemTab] staff fetch error:', e);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const handleAddStaff = async () => {
    if (!newStaff.staff_code || !newStaff.name) {
      setStaffMsg('코드와 이름은 필수입니다.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      });
      const data = await res.json();
      if (data.error) {
        setStaffMsg(`❌ ${data.error}`);
      } else {
        setStaffMsg(`✅ ${data.message}`);
        setNewStaff({ staff_code: '', name: '', department: '총회', position: '직원', phone: '', email: '' });
        fetchStaff();
      }
    } catch (e) {
      setStaffMsg(`❌ ${e.message}`);
    }
  };

  const handleUpdateStaff = async (code) => {
    try {
      const res = await fetch(`${API_BASE}/api/staff/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingCode(null);
        fetchStaff();
        setStaffMsg('✅ 수정 완료');
      } else {
        setStaffMsg(`❌ ${data.error}`);
      }
    } catch (e) {
      setStaffMsg(`❌ ${e.message}`);
    }
  };

  const handleDeleteStaff = async (code, name) => {
    if (!confirm(`${name}(${code}) 직원을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/staff/${code}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
        setStaffMsg('✅ 삭제 완료');
      }
    } catch (e) {
      setStaffMsg(`❌ ${e.message}`);
    }
  };

  const handleToggleActive = async (s) => {
    try {
      await fetch(`${API_BASE}/api/staff/${s.staff_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, is_active: s.is_active ? 0 : 1 }),
      });
      fetchStaff();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSyncLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/sync-logs`);
      const data = await res.json();
      if (data.success) {
        setSyncLogs(data.logs || []);
      }
    } catch (e) {
      console.error('[SystemTab] sync-logs fetch error:', e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [infoRes, sessRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/api/system/info`).catch(e => { console.error(e); return null; }),
        fetch(`${API_BASE}/api/system/sessions`).catch(e => { console.error(e); return null; }),
        fetch(`${API_BASE}/api/system/health`).catch(e => { console.error(e); return null; }),
      ]);
      
      const [info, sess, hlth] = await Promise.all([
        infoRes ? infoRes.json().catch(() => null) : null,
        sessRes ? sessRes.json().catch(() => ({ sessions: [], count: 0 })) : { sessions: [], count: 0 },
        healthRes ? healthRes.json().catch(() => ({ status: 'degraded' })) : { status: 'degraded' },
      ]);
      
      if (info) setSysInfo(info);
      setSessions(sess?.sessions || []);
      if (hlth) setHealth(hlth);
    } catch (e) {
      console.error('[SystemTab] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleManualSync = async () => {
    if (!confirm('MSSQL 원격지 데이터 → 로컬 고성능 복제 마트(SQLite) 동기화를 실행하시겠습니까?\n(로컬 복제는 1~2초 내에 즉시 반영되며, PWA 오프라인용 파일은 백그라운드에서 자동 업로드됩니다.)')) return;
    try {
      setSyncing(true);
      setSyncMsg('하이브리드 복제 엔진 가동 중 (MSSQL 벌크 복사 및 SQLite 벌크 적재)...');
      const res = await fetch(`${API_BASE}/api/admin/sync-to-firebase`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncMsg('✅ 하이브리드 동기화 성공! 로컬 복제 마트가 최신 상태로 갱신되었습니다.');
        fetchSyncLogs(); // Refresh logs
      } else {
        setSyncMsg(`❌ 동기화 실패: ${data.error}`);
      }
    } catch (e) {
      setSyncMsg(`❌ 동기화 중 오류: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const fetchMapConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/map-sync-config`);
      const data = await res.json();
      setMapConfig(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchMapLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/map-sync-logs`);
      const data = await res.json();
      setMapSyncLogs(data.logs || '');
    } catch (e) {
      // ignore
    }
  }, []);

  const handleSaveMapConfig = async () => {
    try {
      setMapSyncMsg('저장 중...');
      const res = await fetch(`${API_BASE}/api/admin/map-sync-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapConfig),
      });
      const data = await res.json();
      setMapSyncMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (e) {
      setMapSyncMsg(`❌ ${e.message}`);
    }
  };

  const handleStartMapSync = async () => {
    if (!confirm('기장지도 데이터 동기화를 백그라운드에서 실행하시겠습니까? (20~30분 소요될 수 있습니다)')) return;
    try {
      setMapSyncMsg('시작 중...');
      const res = await fetch(`${API_BASE}/api/admin/sync-map-data`, { method: 'POST' });
      const data = await res.json();
      setMapSyncMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
      if (data.success) {
        setMapSyncing(true);
      }
    } catch (e) {
      setMapSyncMsg(`❌ ${e.message}`);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchStaff();
    fetchMapConfig();
    fetchMapLogs();
    fetchSyncLogs();
  }, [fetchAll, fetchStaff, fetchMapConfig, fetchMapLogs, fetchSyncLogs]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        fetchAll();
        fetchMapLogs();
        fetchSyncLogs();
      }, 10000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchAll, fetchMapLogs, fetchSyncLogs]);

  // ── Uptime calculation ──
  const getUptime = () => {
    if (!sysInfo?.server_start_time) return '—';
    const start = new Date(sysInfo.server_start_time);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (d > 0) return `${d}일 ${h}시간 ${m}분`;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, animation: 'spin 1s linear infinite', color: '#0070eb' }}>progress_activity</span>
        <span style={{ color: '#64748b', fontSize: 15 }}>시스템 정보 로딩 중...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── Header Bar ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: health?.status === 'healthy' ? '#22c55e' : '#f97316',
            boxShadow: health?.status === 'healthy' ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(249,115,22,0.5)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: health?.status === 'healthy' ? '#059669' : '#ea580c' }}>
            {health?.status === 'healthy' ? '시스템 정상 운영 중' : '시스템 주의 필요'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: '#0070eb' }} />
            자동 새로고침 (10초)
          </label>
          <button onClick={fetchAll} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
            border: '1px solid #e2e2e7', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: '#0070eb', transition: 'all 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            새로고침
          </button>
        </div>
      </div>

      {/* ─── Quick Stats ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        <div style={statBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#0070eb' }}>groups</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#0A2540' }}>{sessions.length}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>접속 중</span>
        </div>
        <div style={statBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#8b5cf6' }}>timer</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0A2540' }}>{getUptime()}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>서버 가동시간</span>
        </div>
        <div style={statBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#f59e0b' }}>notifications_active</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#0A2540' }}>{sysInfo?.push_subscriber_count || 0}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>푸시 구독</span>
        </div>
        <div style={statBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#06b6d4' }}>person</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#0A2540' }}>{sysInfo?.mssql_minister_count || 0}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>목회자</span>
        </div>
        <div style={statBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#ec4899' }}>church</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#0A2540' }}>{sysInfo?.mssql_church_count || 0}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>교회</span>
        </div>
        <div style={statBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#10b981' }}>storage</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0A2540' }}>{sysInfo?.sqlite_size_mb || 0} MB</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>SQLite DB</span>
        </div>
      </div>

      {/* ─── Active Sessions (Tag Style) ─── */}
      <div style={card}>
        <div style={{ ...sectionTitle, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0070eb' }}>monitor_heart</span>
            실시간 접속 현황
          </span>
          <span style={badge(sessions.length > 0 ? 'green' : 'yellow')}>
            {sessions.length}명 접속 중
          </span>
        </div>

        {sessions.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 0', color: '#94a3b8',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4 }}>wifi_off</span>
            <p style={{ fontSize: 14 }}>현재 접속 중인 사용자가 없습니다</p>
            <p style={{ fontSize: 11, opacity: 0.7 }}>사용자가 앱에 접속하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...sessions]
              .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
              .slice(0, 50)
              .map((s, i) => (
                <div
                  key={s.session_id || i}
                  title={`${s.minister_code || '—'} · ${s.page || '/'} · ${s.device_info || '—'} · ${formatTime(s.last_seen)}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 20,
                    background: i === 0 ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                      : i < 3 ? '#f0fdf4' : '#f8faff',
                    border: i === 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
                    cursor: 'default', transition: 'all 0.2s',
                    fontSize: 13, fontWeight: i < 3 ? 600 : 500,
                    color: '#0A2540',
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
                    boxShadow: i < 3 ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
                    animation: i < 3 ? 'pulse 2s ease-in-out infinite' : 'none',
                  }} />
                  {s.minister_name || '익명'}
                </div>
              ))}
            {sessions.length > 50 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', padding: '6px 14px',
                borderRadius: 20, background: '#fefce8', border: '1px solid #fde68a',
                fontSize: 12, fontWeight: 600, color: '#ca8a04',
              }}>
                +{sessions.length - 50}명 더
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Database Health ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* MSSQL */}
        <div style={card}>
          <div style={sectionTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8b5cf6' }}>database</span>
            MSSQL 데이터베이스
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>연결 상태</span>
              <span style={badge(health?.mssql === 'ok' ? 'green' : 'red')}>
                {health?.mssql === 'ok' ? '✓ 정상' : '✕ 오류'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>목회자 수</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>
                {(sysInfo?.mssql_minister_count || 0).toLocaleString()}명
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>교회 수</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>
                {(sysInfo?.mssql_church_count || 0).toLocaleString()}개
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
              서버: 192.168.0.145 · DB: KJ_CHURCH
            </div>
          </div>
        </div>

        {/* SQLite */}
        <div style={card}>
          <div style={sectionTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#06b6d4' }}>storage</span>
            SQLite 데이터베이스
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>연결 상태</span>
              <span style={badge(health?.sqlite === 'ok' ? 'green' : 'red')}>
                {health?.sqlite === 'ok' ? '✓ 정상' : '✕ 오류'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>DB 크기</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>
                {sysInfo?.sqlite_size_mb || 0} MB
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>업로드 스토리지</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>
                {sysInfo?.uploads_size_mb || 0} MB
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
              파일: requests.db
            </div>
          </div>
        </div>
      </div>

      {/* ─── SQLite Table Stats ─── */}
      <div style={card}>
        <div style={sectionTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>table_chart</span>
          테이블별 레코드 수
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {sysInfo?.sqlite_tables && Object.entries(sysInfo.sqlite_tables).map(([tbl, cnt]) => (
            <div key={tbl} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: '#f8faff', borderRadius: 10, fontSize: 13,
            }}>
              <span style={{ color: '#475569', fontWeight: 500 }}>{TABLE_LABELS[tbl] || tbl}</span>
              <span style={{ fontWeight: 700, color: '#0A2540', fontFamily: 'monospace' }}>
                {cnt >= 0 ? cnt.toLocaleString() : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Sync Management ─── */}
      <div style={card}>
        <div style={{ ...sectionTitle, justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#3b82f6' }}>sync_alt</span>
            하이브리드 주소록 복제 관리
          </span>
          <button 
            onClick={handleManualSync} 
            disabled={syncing}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
              background: syncing ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6, #2563eb)', 
              color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, animation: syncing ? 'spin 1s linear infinite' : 'none' }}>sync</span>
            고속 동기화 실행
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>check_circle</span>
            1,2단계 하이브리드 고성능 아키텍처 구동 중
          </div>
          원격 MSSQL 서버의 네트워크 병목을 회피하고 조회 속도를 <strong>0.01초(10ms) 대</strong>로 극대화하기 위해 로컬 SQLite 복제 마트 캐시를 활용하는 고성능 구조입니다.
          <div style={{ marginTop: 8, fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#3b82f6' }}>schedule</span>
            <span>정기 백그라운드 스케줄러: <strong>매주 월요일 새벽 04:00 AM 자동 복제 실행</strong></span>
          </div>
        </div>

        {syncMsg && (
          <div style={{
            padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
            background: syncMsg.startsWith('✅') ? '#ecfdf5' : syncMsg.startsWith('❌') ? '#fef2f2' : '#f0f9ff',
            color: syncMsg.startsWith('✅') ? '#059669' : syncMsg.startsWith('❌') ? '#ef4444' : '#0284c7',
          }}>
            {syncMsg}
          </div>
        )}

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>시간</th>
                <th style={{ padding: '10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>상태</th>
                <th style={{ padding: '10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>메시지</th>
                <th style={{ padding: '10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>링크</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading && syncLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: 18 }}>progress_activity</span>
                      기록을 불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : syncLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>동기화 기록이 없습니다.</td>
                </tr>
              ) : (
                syncLogs.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#475569' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={badge(log.status === 'SUCCESS' ? 'green' : 'red')}>
                        {log.status === 'SUCCESS' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#0f172a' }}>{log.message}</td>
                    <td style={{ padding: '10px' }}>
                      {log.url && (
                        <a href={log.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500, fontSize: 12 }}>
                          다운로드
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Server Info ─── */}
      <div style={card}>
        <div style={sectionTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>info</span>
          서버 정보
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>서버 시작 시각</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>
              {sysInfo?.server_start_time ? new Date(sysInfo.server_start_time).toLocaleString('ko-KR') : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>현재 서버 시각</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>
              {sysInfo?.current_time ? new Date(sysInfo.current_time).toLocaleString('ko-KR') : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>푸시 구독자 (고유)</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>
              {sysInfo?.push_unique_users || 0}명
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>가동 시간</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>
              {getUptime()}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 총회직원 관리 ─── */}
      <div style={card}>
        <div style={sectionTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>badge</span>
          총회직원 관리 (7600~7699)
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
            {staffList.length}명 등록
          </span>
        </div>

        {staffMsg && (
          <div style={{
            padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 500,
            background: staffMsg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
            color: staffMsg.startsWith('✅') ? '#059669' : '#ef4444',
          }}>
            {staffMsg}
          </div>
        )}

        {/* Add new staff */}
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 100px 1fr 1fr 1fr 1fr auto', gap: 6,
          marginBottom: 16, alignItems: 'center',
        }}>
          <input
            placeholder="코드"
            value={newStaff.staff_code}
            onChange={e => setNewStaff({ ...newStaff, staff_code: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="이름"
            value={newStaff.name}
            onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="부서"
            value={newStaff.department}
            onChange={e => setNewStaff({ ...newStaff, department: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="직위"
            value={newStaff.position}
            onChange={e => setNewStaff({ ...newStaff, position: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="전화번호"
            value={newStaff.phone}
            onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="이메일"
            value={newStaff.email}
            onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
            style={inputStyle}
          />
          <button onClick={handleAddStaff} style={addBtnStyle}>+ 추가</button>
        </div>

        {/* Staff list */}
        {staffLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>로딩 중...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['코드', '이름', '부서', '직위', '전화번호', '이메일', '상태', ''].map(h => (
                    <th key={h} style={{ padding: '8px 6px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffList.map(s => (
                  <tr key={s.staff_code} style={{ borderBottom: '1px solid #f1f5f9', opacity: s.is_active ? 1 : 0.5 }}>
                    {editingCode === s.staff_code ? (
                      <>
                        <td style={tdStyle}>{s.staff_code}</td>
                        <td style={tdStyle}><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyleSm} /></td>
                        <td style={tdStyle}><input value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} style={inputStyleSm} /></td>
                        <td style={tdStyle}><input value={editForm.position} onChange={e => setEditForm({ ...editForm, position: e.target.value })} style={inputStyleSm} /></td>
                        <td style={tdStyle}><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={inputStyleSm} /></td>
                        <td style={tdStyle}><input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={inputStyleSm} /></td>
                        <td style={tdStyle}>—</td>
                        <td style={{ ...tdStyle, display: 'flex', gap: 4 }}>
                          <button onClick={() => handleUpdateStaff(s.staff_code)} style={saveBtnStyle}>저장</button>
                          <button onClick={() => setEditingCode(null)} style={cancelBtnStyle}>취소</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{s.staff_code}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                        <td style={tdStyle}>{s.department}</td>
                        <td style={tdStyle}>{s.position}</td>
                        <td style={tdStyle}>{s.phone || '—'}</td>
                        <td style={tdStyle}>{s.email || '—'}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => handleToggleActive(s)}
                            style={{
                              ...badge(s.is_active ? 'green' : 'red'),
                              border: 'none', cursor: 'pointer', fontSize: 11,
                            }}
                          >
                            {s.is_active ? '활성' : '비활성'}
                          </button>
                        </td>
                        <td style={{ ...tdStyle, display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditingCode(s.staff_code); setEditForm({ name: s.name, department: s.department, position: s.position, phone: s.phone, email: s.email, is_active: s.is_active }); }} style={editBtnStyle}>✏️</button>
                          <button onClick={() => handleDeleteStaff(s.staff_code, s.name)} style={delBtnStyle}>🗑</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 기장지도 동기화 설정 ─── */}
      <div style={card}>
        <div style={sectionTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>map</span>
          기장지도 동기화 설정
        </div>
        <div style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
          총회 서버 DB의 교회 정보를 변환하여 클라우드(Supabase) 지도로 전송합니다. 변환에 20~30분 정도 소요될 수 있습니다.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>DB 서버 IP (가져오는 주소)</div>
            <input 
              value={mapConfig.db_server || ''}
              onChange={e => setMapConfig({...mapConfig, db_server: e.target.value})}
              style={{...inputStyle, width: '100%'}}
              placeholder="192.168.0.145"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Supabase URL (저장하는 주소)</div>
            <input 
              value={mapConfig.supabase_url || ''}
              onChange={e => setMapConfig({...mapConfig, supabase_url: e.target.value})}
              style={{...inputStyle, width: '100%'}}
              placeholder="https://xxx.supabase.co"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={handleSaveMapConfig} style={{...saveBtnStyle, padding: '8px 16px', fontSize: 13}}>설정 저장</button>
          <button 
            onClick={handleStartMapSync} 
            disabled={mapSyncing}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: mapSyncing ? 'not-allowed' : 'pointer',
              color: '#fff', fontSize: 13, fontWeight: 600,
              background: mapSyncing ? '#94a3b8' : '#0070eb',
              opacity: mapSyncing ? 0.7 : 1,
            }}
          >
            {mapSyncing ? '동기화 진행 중...' : '지도 동기화 시작'}
          </button>
        </div>

        {mapSyncMsg && (
          <div style={{
            padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
            background: mapSyncMsg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
            color: mapSyncMsg.startsWith('✅') ? '#059669' : '#ef4444',
          }}>
            {mapSyncMsg}
          </div>
        )}

        {/* Real-time Log Viewer */}
        <div style={{ background: '#0f172a', color: '#10b981', padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'monospace', height: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {mapSyncLogs || '동기화 대기 중...'}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SystemTab;
