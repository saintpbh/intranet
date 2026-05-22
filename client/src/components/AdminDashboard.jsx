import API_BASE from '../api';
import { useState, useEffect } from 'react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'phone'
  
  // Tab 1: 수정 요청 상태
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Tab 2: 전화번호 변경 상태
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [overrides, setOverrides] = useState([]);
  const [sqlText, setSqlText] = useState('');
  const [showSql, setShowSql] = useState(false);
  
  // 전화번호 수정 다이얼로그(모달) 상태
  const [editingMember, setEditingMember] = useState(null); // { code, name, member_type, original_phone }
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/requests`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setRequests(data);
      setIsOffline(false);
    } catch (err) {
      console.error(err);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverrides = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/override-phones`);
      if (response.ok) {
        const data = await response.json();
        setOverrides(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSqlText = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/override-sql`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSqlText(data.sql);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchOverrides();
  }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message || '처리되었습니다.');
        fetchRequests();
      } else {
        alert(data.error || '처리 실패');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
  };

  // 전화번호 자동 포맷팅 (010-XXXX-XXXX)
  const formatPhoneNumber = (value) => {
    const rawValue = value.replace(/[^0-9]/g, ''); // 숫자만
    let formatted = rawValue;
    if (rawValue.length > 3 && rawValue.length <= 7) {
      formatted = `${rawValue.slice(0, 3)}-${rawValue.slice(3)}`;
    } else if (rawValue.length > 7) {
      formatted = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 7)}-${rawValue.slice(7, 11)}`;
    }
    return formatted;
  };

  const handleNewPhoneChange = (e) => {
    setNewPhoneNumber(formatPhoneNumber(e.target.value));
  };

  // 이름 검색 실행
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchName.trim()) {
      alert('검색할 이름을 입력해 주세요.');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/search-member?name=${encodeURIComponent(searchName)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        alert('검색 도중 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  // 변경하기 버튼 클릭 -> 모달 오픈
  const startEditPhone = (member) => {
    setEditingMember(member);
    setNewPhoneNumber(member.override_phone || member.original_phone || '');
  };

  // 변경 등록 전송
  const submitPhoneOverride = async (e) => {
    e.preventDefault();
    const cleanPhone = newPhoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      alert('올바른 휴대폰 번호(10~11자리)를 입력해주세요.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/override-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editingMember.code,
          name: editingMember.name,
          member_type: editingMember.member_type,
          original_phone: editingMember.original_phone,
          new_phone: newPhoneNumber
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setEditingMember(null);
        // 검색 결과 새로고침
        if (searchName) handleSearch();
        // 현황판 새로고침
        fetchOverrides();
        // SQL 새로고침
        fetchSqlText();
      } else {
        alert(data.error || '변경 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 복구(원복) 삭제 처리
  const handleDeleteOverride = async (code, name) => {
    if (!confirm(`[원상 복구] ${name}님의 전화번호 변경을 취소하고 원래 번호로 복구하시겠습니까?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/override-phone/${code}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        if (searchName) handleSearch();
        fetchOverrides();
        fetchSqlText();
      } else {
        alert(data.error || '실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  // 통합 완료 처리
  const handleMarkIntegrated = async (code, name) => {
    if (!confirm(`[통합 완료] ${name}님의 변경된 번호가 MS SQL DB 원본에 반영되었음을 마킹하고 오버라이드를 마감 처리하시겠습니까?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/override-integrate/${code}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        if (searchName) handleSearch();
        fetchOverrides();
        fetchSqlText();
      } else {
        alert(data.error || '실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  // SQL 복사 기능
  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlText);
    alert('MS SQL 업데이트 쿼리가 클립보드에 복사되었습니다!\nSQL Server Management Studio(SSMS) 등에서 실행해 원데이터와 병합하세요.');
  };

  if (loading) return <div className="loading">불러오는 중...</div>;
  if (isOffline) return (
    <div style={{padding: '40px', textAlign: 'center'}}>
      <span className="material-symbols-outlined" style={{fontSize: 48, color: '#ef4444', marginBottom: 16}}>cloud_off</span>
      <h2 style={{color: '#ef4444', margin: '0 0 8px 0'}}>관리자 서버가 오프라인 상태입니다</h2>
      <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
        관리자 기능은 실시간 데이터베이스 연동이 필요합니다.<br/>
        <strong>목사님 PC에서 서버(start_prok_api.ps1)를 켜주세요.</strong><br/>
        <button onClick={() => fetchRequests()} style={{marginTop: 16, padding: '8px 16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer'}}>다시 시도</button>
      </p>
    </div>
  );

  return (
    <div style={{padding: '16px', maxWidth: '1000px', margin: '0 auto'}}>
      
      {/* 탭 헤더 */}
      <div style={{display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', marginBottom: '20px', paddingBottom: '2px'}}>
        <button onClick={() => setActiveTab('requests')} style={{
          padding: '10px 16px', border: 'none', background: 'none', fontSize: '15px', fontWeight: activeTab === 'requests' ? '600' : '400',
          color: activeTab === 'requests' ? '#007AFF' : '#6b7280', borderBottom: activeTab === 'requests' ? '2px solid #007AFF' : 'none', cursor: 'pointer',
          outline: 'none', transition: 'all 0.2s'
        }}>
          수정 요청 목록 ({requests.filter(r => r.status === 'PENDING').length})
        </button>
        <button onClick={() => { setActiveTab('phone'); fetchOverrides(); fetchSqlText(); }} style={{
          padding: '10px 16px', border: 'none', background: 'none', fontSize: '15px', fontWeight: activeTab === 'phone' ? '600' : '400',
          color: activeTab === 'phone' ? '#007AFF' : '#6b7280', borderBottom: activeTab === 'phone' ? '2px solid #007AFF' : 'none', cursor: 'pointer',
          outline: 'none', transition: 'all 0.2s'
        }}>
          로그인 전화번호 변경 ({overrides.filter(o => o.status === 'ACTIVE').length})
        </button>
      </div>

      {/* 탭 1: 수정 요청 목록 */}
      {activeTab === 'requests' && (
        <div>
          <h2 style={{margin: '0 0 16px', color: 'var(--text-primary)', fontSize: '18px'}}>목회자 정보 수정 요청</h2>
          {requests.length === 0 ? (
            <p style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0'}}>접수된 수정 요청이 없습니다.</p>
          ) : (
            requests.map(req => (
              <div key={req.id} className="card" style={{marginBottom: '12px', padding: '16px'}}>
                <div style={{marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <strong>{req.minister_name} 목사님</strong>
                  <span className="badge" style={{
                    fontSize: '11px',
                    backgroundColor: req.status === 'PENDING' ? '#FF9500' : req.status === 'APPROVED' ? '#34C759' : '#FF3B30',
                    color: 'white', padding: '3px 10px', borderRadius: '12px', fontWeight: '500'
                  }}>
                    {req.status === 'PENDING' ? '대기 중' : req.status === 'APPROVED' ? '승인됨' : req.status === 'REJECTED' ? '반려됨' : req.status}
                  </span>
                </div>
                <div style={{fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6'}}>
                  <div><span style={{color: 'var(--text-tertiary)'}}>대상 필드:</span> <strong style={{color: 'var(--text-primary)'}}>{req.field}</strong></div>
                  <div style={{background: '#f8f9fa', padding: '8px 12px', borderRadius: '6px', margin: '6px 0'}}>
                    <span style={{color: '#FF3B30', textDecoration: 'line-through'}}>{req.old_value || '(비어있음)'}</span>
                    <span style={{margin: '0 10px', color: 'var(--text-tertiary)'}}>→</span>
                    <span style={{color: '#34C759', fontWeight: 'bold'}}>{req.new_value}</span>
                  </div>
                  {req.memo && <div><span style={{color: 'var(--text-tertiary)'}}>신청인 메모:</span> {req.memo}</div>}
                  <div style={{fontSize: '12px', marginTop: '6px', color: 'var(--text-tertiary)'}}>요청 시각: {req.created_at}</div>
                </div>
                {req.status === 'PENDING' && (
                  <div style={{marginTop: '12px', display: 'flex', gap: '8px'}}>
                    <button onClick={() => handleAction(req.id, 'approve')}
                      style={{padding: '8px 20px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'}}>
                      수동 승인 완료
                    </button>
                    <button onClick={() => handleAction(req.id, 'reject')}
                      style={{padding: '8px 20px', backgroundColor: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'}}>
                      반려
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 탭 2: 로그인 전화번호 변경 */}
      {activeTab === 'phone' && (
        <div>
          {/* 변경 안내 상자 */}
          <div style={{backgroundColor: '#E5F1FF', border: '1px solid #B3D7FF', borderRadius: '8px', padding: '16px', marginBottom: '20px'}}>
            <h3 style={{margin: '0 0 8px 0', color: '#0056B3', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <span className="material-symbols-outlined" style={{fontSize: '20px'}}>info</span>
              로그인 전화번호 변경 (긴급 로그인 불가 해소 도구)
            </h3>
            <p style={{margin: 0, fontSize: '13.5px', color: '#333', lineHeight: '1.6'}}>
              휴대폰 번호가 변경되어 본인인증이 불가능한 사용자(목회자, 장로, 총회 직원)를 대상으로 합니다. <br/>
              검색 후 변경하면 <strong>즉각 해당 휴대폰으로 SMS 인증번호를 받아 로그인할 수 있게 적용</strong>됩니다. <br/>
              나중에 하단의 **"원데이터(MS SQL) 통합 도구"**를 통해 MS SQL 원본 데이터를 안전하게 최신 정보로 병합할 수 있습니다.
            </p>
          </div>

          {/* 1. 멤버 검색 */}
          <div className="card" style={{padding: '16px', marginBottom: '20px'}}>
            <h3 style={{margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-primary)'}}>1. 대상자 검색 (이름 입력)</h3>
            <form onSubmit={handleSearch} style={{display: 'flex', gap: '8px'}}>
              <input 
                type="text" 
                placeholder="검색할 이름 입력 (예: 홍길동)" 
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                style={{flex: 1, padding: '10px 14px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px'}}
              />
              <button 
                type="submit" 
                disabled={searchLoading}
                style={{padding: '10px 24px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'}}
              >
                {searchLoading ? '검색 중...' : '검색'}
              </button>
            </form>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div style={{marginTop: '16px', overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left'}}>
                  <thead>
                    <tr style={{borderBottom: '2px solid #eaeaea', color: 'var(--text-secondary)'}}>
                      <th style={{padding: '10px 8px'}}>이름</th>
                      <th style={{padding: '10px 8px'}}>구분</th>
                      <th style={{padding: '10px 8px'}}>소속교회/노회</th>
                      <th style={{padding: '10px 8px'}}>직분</th>
                      <th style={{padding: '10px 8px'}}>현재 번호</th>
                      <th style={{padding: '10px 8px'}}>상태</th>
                      <th style={{padding: '10px 8px', textAlign: 'right'}}>동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((m) => (
                      <tr key={m.code} style={{borderBottom: '1px solid #f0f0f0'}}>
                        <td style={{padding: '12px 8px', fontWeight: '600'}}>{m.name}</td>
                        <td style={{padding: '12px 8px'}}>{m.member_type}</td>
                        <td style={{padding: '12px 8px'}}>{m.church} ({m.noh})</td>
                        <td style={{padding: '12px 8px'}}>{m.duty}</td>
                        <td style={{padding: '12px 8px'}}>
                          {m.override_phone ? (
                            <div>
                              <span style={{textDecoration: 'line-through', color: '#888', marginRight: '6px'}}>{m.original_phone || '미등록'}</span>
                              <span style={{color: '#007AFF', fontWeight: '600'}}>{m.override_phone}</span>
                            </div>
                          ) : (
                            m.original_phone || <span style={{color: '#888', fontStyle: 'italic'}}>미등록</span>
                          )}
                        </td>
                        <td style={{padding: '12px 8px'}}>
                          {m.override_phone ? (
                            <span style={{
                              fontSize: '11px',
                              backgroundColor: m.override_status === 'ACTIVE' ? '#007AFF' : '#34C759',
                              color: 'white', padding: '2px 8px', borderRadius: '10px'
                            }}>
                              {m.override_status === 'ACTIVE' ? '변경중' : '반영완료'}
                            </span>
                          ) : (
                            <span style={{color: '#888'}}>일치</span>
                          )}
                        </td>
                        <td style={{padding: '12px 8px', textAlign: 'right'}}>
                          <div style={{display: 'flex', gap: '4px', justifyContent: 'flex-end'}}>
                            <button 
                              onClick={() => startEditPhone(m)}
                              style={{padding: '5px 10px', backgroundColor: '#e5f1ff', color: '#007AFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'}}
                            >
                              전화번호 변경
                            </button>
                            {m.override_phone && (
                              <button 
                                onClick={() => handleDeleteOverride(m.code, m.name)}
                                style={{padding: '5px 10px', backgroundColor: '#ffe5e5', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer'}}
                              >
                                복구
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {searchResults.length === 0 && searchName && !searchLoading && (
              <p style={{color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '16px', textAlign: 'center'}}>
                검색 조건과 일치하는 사용자를 찾을 수 없습니다.
              </p>
            )}
          </div>

          {/* 2. 현재 오버라이드 변경 이력 명단 */}
          <div className="card" style={{padding: '16px', marginBottom: '20px'}}>
            <h3 style={{margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-primary)'}}>2. 현재 임시 변경 적용 중인 명단 ({overrides.filter(o => o.status === 'ACTIVE').length}명)</h3>
            {overrides.length === 0 ? (
              <p style={{color: 'var(--text-secondary)', fontSize: '13.5px', textAlign: 'center', padding: '20px 0'}}>현재 임시 변경 적용된 명단이 없습니다.</p>
            ) : (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left'}}>
                  <thead>
                    <tr style={{borderBottom: '2px solid #eaeaea', color: 'var(--text-secondary)'}}>
                      <th style={{padding: '8px'}}>이름</th>
                      <th style={{padding: '8px'}}>구분</th>
                      <th style={{padding: '8px'}}>원래 번호</th>
                      <th style={{padding: '8px'}}>변경된 번호</th>
                      <th style={{padding: '8px'}}>상태</th>
                      <th style={{padding: '8px'}}>등록시각</th>
                      <th style={{padding: '8px', textAlign: 'right'}}>동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrides.map((row) => (
                      <tr key={row.minister_code} style={{borderBottom: '1px solid #f0f0f0', backgroundColor: row.status === 'INTEGRATED' ? '#fcfcfc' : 'white'}}>
                        <td style={{padding: '10px 8px', fontWeight: '600'}}>{row.minister_name}</td>
                        <td style={{padding: '10px 8px'}}>{row.member_type}</td>
                        <td style={{padding: '10px 8px', color: '#888'}}>{row.original_phone || '-'}</td>
                        <td style={{padding: '10px 8px', color: '#007AFF', fontWeight: '600'}}>{row.new_phone}</td>
                        <td style={{padding: '10px 8px'}}>
                          <span style={{
                            fontSize: '11px',
                            backgroundColor: row.status === 'ACTIVE' ? '#FF9500' : '#8E8E93',
                            color: 'white', padding: '2px 8px', borderRadius: '10px'
                          }}>
                            {row.status === 'ACTIVE' ? '로그인중' : '반영완료(종료)'}
                          </span>
                        </td>
                        <td style={{padding: '10px 8px', color: '#888', fontSize: '12px'}}>{row.updated_at}</td>
                        <td style={{padding: '10px 8px', textAlign: 'right'}}>
                          <div style={{display: 'flex', gap: '4px', justifyContent: 'flex-end'}}>
                            {row.status === 'ACTIVE' && (
                              <button 
                                onClick={() => handleMarkIntegrated(row.minister_code, row.minister_name)}
                                style={{padding: '4px 8px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'}}
                              >
                                통합완료
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteOverride(row.minister_code, row.minister_name)}
                              style={{padding: '4px 8px', backgroundColor: '#f3f4f6', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'}}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. 원데이터(MS SQL) 통합 도구 섹션 */}
          <div className="card" style={{padding: '16px', border: '1px dashed #007AFF'}}>
            <h3 style={{margin: '0 0 8px 0', fontSize: '15px', color: '#007AFF', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <span className="material-symbols-outlined" style={{fontSize: '20px'}}>merge</span>
              3. 원데이터(MS SQL) 사후 통합 도구
            </h3>
            <p style={{margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6'}}>
              이 도구는 현재 임시 변경된 최신 전화번호들을 **MS SQL Server 원본 테이블에 일괄 업데이트**하기 위한 쿼리를 자동으로 생성합니다. <br/>
              DBA가 아래의 SQL 쿼리를 복사하여 MS SQL Server에서 한 번 실행하기만 하면 원데이터가 온전히 최신화됩니다. <br/>
              반영 후 위 리스트에서 **"통합완료"**를 눌러 오버라이드를 마무리하세요!
            </p>

            <button 
              onClick={() => { setShowSql(!showSql); fetchSqlText(); }}
              style={{padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13.5px'}}
            >
              {showSql ? '통합 SQL 숨기기' : '통합 SQL 쿼리 생성 및 보기'}
            </button>

            {showSql && (
              <div style={{marginTop: '12px'}}>
                <textarea 
                  readOnly 
                  value={sqlText}
                  style={{width: '100%', height: '180px', fontFamily: 'monospace', fontSize: '12.5px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fafafa', color: '#333'}}
                />
                <button 
                  onClick={handleCopySql}
                  style={{marginTop: '8px', padding: '8px 20px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px'}}
                >
                  <span className="material-symbols-outlined" style={{fontSize: '18px'}}>content_copy</span>
                  SQL 쿼리 클립보드 복사
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 전화번호 변경 모달 팝업 */}
      {editingMember && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', width: '90%', maxWidth: '460px', borderRadius: '12px', padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{margin: '0 0 16px 0', fontSize: '17px', borderBottom: '1px solid #eaeaea', paddingBottom: '12px', color: 'var(--text-primary)'}}>
              로그인 전화번호 변경 등록
            </h3>
            
            <div style={{fontSize: '14px', marginBottom: '20px', lineHeight: '1.7', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px'}}>
              <div><strong>대상 성명:</strong> {editingMember.name} ({editingMember.member_type})</div>
              <div><strong>소속 부서/교회:</strong> {editingMember.church}</div>
              <div><strong>원래 휴대폰:</strong> {editingMember.original_phone || '미등록'}</div>
            </div>

            <form onSubmit={submitPhoneOverride}>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500'}}>
                  새로 사용할 변경된 휴대폰 번호
                </label>
                <input 
                  type="text" 
                  placeholder="예: 010-6242-9687"
                  value={newPhoneNumber}
                  onChange={handleNewPhoneChange}
                  style={{width: '100%', padding: '12px 14px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '15px', fontWeight: '600', color: '#007AFF'}}
                  required
                />
              </div>

              <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                <button 
                  type="button" 
                  onClick={() => setEditingMember(null)}
                  style={{padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'}}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  disabled={submitLoading}
                  style={{padding: '10px 24px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'}}
                >
                  {submitLoading ? '변경 중...' : '변경 적용'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
