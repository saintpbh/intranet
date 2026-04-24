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
};

const SystemTab = ({ user }) => {
  const [sysInfo, setSysInfo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [infoRes, sessRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/api/system/info`),
        fetch(`${API_BASE}/api/system/sessions`),
        fetch(`${API_BASE}/api/system/health`),
      ]);
      const [info, sess, hlth] = await Promise.all([
        infoRes.json(), sessRes.json(), healthRes.json(),
      ]);
      setSysInfo(info);
      setSessions(sess.sessions || []);
      setHealth(hlth);
    } catch (e) {
      console.error('[SystemTab] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchAll, 10000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchAll]);

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
