import { useState, useEffect } from 'react';
import API_BASE from '../../api';

const defaultStats = {
  churchName: '', address: '',
  pastor: { male: 0, female: 0, type: '목사' },
  contact: { churchPhone: '', churchEmail: '', pastorPhone: '', homepage: '' },
  dates: { founded: '', established: '' },
  regionType: '대도시',
  sessionOrg: '조직',
  sundaySchool: '유',
  departments: { baby: false, kinder: false, elem: false, mid: false, high: false, college: false, youth: false, combinedBaby: false, combinedChild: false, combinedYouth: false, combinedAll: false },
  
  staff: {
    pastor: { m: 0, f: 0 }, junmok: { m: 0, f: 0 }, jeondosa: { m: 0, f: 0 }, candidate: { m: 0, f: 0 },
    elderActive: { m: 0, f: 0 }, elderRetired: { m: 0, f: 0 },
    kwonsaActive: { m: 0, f: 0 }, kwonsaRetired: { m: 0, f: 0 },
    deaconOrdained: { m: 0, f: 0 }, deaconActive: { m: 0, f: 0 },
  },
  
  members: { baptized: { m: 0, f: 0 }, unbaptized: { m: 0, f: 0 } },
  age: { senior: { m: 0, f: 0 }, adult: { m: 0, f: 0 }, youngAdult: { m: 0, f: 0 }, youth: { m: 0, f: 0 }, child: { m: 0, f: 0 }, infant: { m: 0, f: 0 } },
  
  finance: { generalIncome: 0, specialIncome: 0, generalExpense: 0, specialExpense: 0 },
  property: { ownedLand: 0, ownedBuilding: 0, rentedArea: 0, rentedDeposit: 0, rentedMonthly: 0, ownerName: '', facilities: '' }
};

const defaultElders = Array.from({length: 20}, (_, i) => ({ id: i + 1, name: '', birth: '', address: '', phone: '' }));

const ChurchReportForm = ({ user, reportId, onBack, onSaved }) => {
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' or 'elders'
  const [stats, setStats] = useState(defaultStats);
  const [elders, setElders] = useState(defaultElders);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState('DRAFT');
  
  // To get minister's church details if creating new
  useEffect(() => {
    if (reportId) {
      fetch(`${API_BASE}/api/church-reports/${reportId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            setReportYear(data.report_year);
            setStatus(data.status);
            if (data.statistics_data) setStats(JSON.parse(data.statistics_data));
            if (data.elders_data) setElders(JSON.parse(data.elders_data));
          }
        }).finally(() => setLoading(false));
    } else {
      // Auto-fill minister info (mocking API fetch here but keeping it simple)
      setStats(prev => ({ ...prev, churchName: user.chr_name || '' }));
      setLoading(false);
    }
  }, [reportId, user]);

  const updateStat = (section, key, subkey, val) => {
    setStats(prev => {
      const next = { ...prev };
      if (subkey) next[section][key][subkey] = val;
      else if (section) next[section][key] = val;
      else next[key] = val;
      return next;
    });
  };

  const updateElder = (idx, field, val) => {
    const newElders = [...elders];
    newElders[idx][field] = val;
    setElders(newElders);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        church_code: user.chr_code || 'TEMP',
        church_name: stats.churchName || user.chr_name || '미지정',
        noh_code: user.noh_code || 'TEMP',
        noh_name: user.noh_name || '미지정',
        report_year: reportYear,
        submitted_by: user.code,
        statistics_data: JSON.stringify(stats),
        elders_data: JSON.stringify(elders.filter(e => e.name.trim() !== ''))
      };
      
      const res = await fetch(`${API_BASE}/api/church-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        alert('성공적으로 제출되었습니다.');
        if (onSaved) onSaved();
      } else {
        alert(data.error || '제출 실패');
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>불러오는 중...</div>;
  const isReadonly = status === 'NOH_APPROVED' || status === 'ASSEMBLY_APPROVED';

  // Helper logic for Staff / Members sums
  const sumObj = (obj) => (parseInt(obj.m) || 0) + (parseInt(obj.f) || 0);

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#007AFF', cursor: 'pointer', fontSize: 14 }}>← 뒤로</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={reportYear} onChange={e => setReportYear(parseInt(e.target.value))} disabled={isReadonly}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #C6C6C8', fontSize: 13 }}>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년도 보고서</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleSave} disabled={isReadonly || saving} style={{ padding: '6px 16px', fontSize: 13 }}>
            {saving ? '제출 중...' : (isReadonly ? '승인완료(수정불가)' : '제출 (저장)')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#E5E5EA', padding: 3, borderRadius: 10 }}>
        {['stats', 'elders'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, background: activeTab === t ? '#fff' : 'transparent', fontWeight: activeTab === t ? 600 : 400, fontSize: 14, cursor: 'pointer', boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t === 'stats' ? '교회 상황 통계표' : '시무장로 현황'}
          </button>
        ))}
      </div>

      <div className="print-container">
        {activeTab === 'stats' && (
          <div>
            <div className="report-title">교회 상황 통계표</div>
            <table className="report-table">
              <tbody>
                <tr>
                  <th rowSpan="6" style={{ width: '40px' }}>교<br/>회</th>
                  <th style={{ width: '80px' }}>교회명</th>
                  <td colSpan="4"><input type="text" value={stats.churchName} onChange={e => updateStat(null, 'churchName', null, e.target.value)} disabled={isReadonly} className="text-left" /></td>
                </tr>
                <tr>
                  <th>주소</th>
                  <td colSpan="4"><input type="text" value={stats.address} onChange={e => updateStat(null, 'address', null, e.target.value)} disabled={isReadonly} className="text-left" /></td>
                </tr>
                <tr>
                  <th>담임교역자</th>
                  <td colSpan="4">
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      <label><input type="radio" checked={stats.pastor.male === 1} onChange={() => updateStat('pastor', null, 'male', 1)} disabled={isReadonly}/> 남</label>
                      <label><input type="radio" checked={stats.pastor.female === 1} onChange={() => updateStat('pastor', null, 'female', 1)} disabled={isReadonly}/> 여</label>
                      <span>|</span>
                      <label><input type="radio" checked={stats.pastor.type === '목사'} onChange={() => updateStat('pastor', null, 'type', '목사')} disabled={isReadonly}/> 목사</label>
                      <label><input type="radio" checked={stats.pastor.type === '준목'} onChange={() => updateStat('pastor', null, 'type', '준목')} disabled={isReadonly}/> 준목</label>
                      <label><input type="radio" checked={stats.pastor.type === '전도사'} onChange={() => updateStat('pastor', null, 'type', '전도사')} disabled={isReadonly}/> 전도사</label>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th rowSpan="2">전화/이메일</th>
                  <td colSpan="2"><div style={{ display: 'flex' }}><span style={{ width: 40 }}>교회:</span><input type="text" value={stats.contact.churchPhone} onChange={e => updateStat('contact', 'churchPhone', null, e.target.value)} disabled={isReadonly} /></div></td>
                  <td colSpan="2"><div style={{ display: 'flex' }}><span style={{ width: 60 }}>홈페이지:</span><input type="text" value={stats.contact.homepage} onChange={e => updateStat('contact', 'homepage', null, e.target.value)} disabled={isReadonly} /></div></td>
                </tr>
                <tr>
                  <td colSpan="2"><div style={{ display: 'flex' }}><span style={{ width: 40 }}>목사:</span><input type="text" value={stats.contact.pastorPhone} onChange={e => updateStat('contact', 'pastorPhone', null, e.target.value)} disabled={isReadonly} /></div></td>
                  <td colSpan="2"><div style={{ display: 'flex' }}><span style={{ width: 60 }}>이메일:</span><input type="text" value={stats.contact.pastorEmail} onChange={e => updateStat('contact', 'pastorEmail', null, e.target.value)} disabled={isReadonly} /></div></td>
                </tr>
                <tr>
                  <th>창립/설립일</th>
                  <td colSpan="4" className="text-left">
                    창립: <input type="date" value={stats.dates.founded} onChange={e => updateStat('dates', 'founded', null, e.target.value)} disabled={isReadonly} style={{ width: 120, display: 'inline' }} /> /   
                    설립공인: <input type="date" value={stats.dates.established} onChange={e => updateStat('dates', 'established', null, e.target.value)} disabled={isReadonly} style={{ width: 120, display: 'inline' }} />
                  </td>
                </tr>
                {/* 직원 현황 */}
                <tr>
                  <th rowSpan="9">직<br/><br/>원</th>
                  <th colSpan="2">구분</th>
                  <th>남</th>
                  <th>여</th>
                  <th>계</th>
                </tr>
                {Object.entries({
                  pastor: '목사 (부목사 포함)',
                  junmok: '준목',
                  jeondosa: '전도사',
                  candidate: '목사후보생',
                  elderActive: '장로 (시무)',
                  elderRetired: '장로 (원로)',
                  deaconOrdained: '집사 (안수)'
                }).map(([k, label]) => (
                  <tr key={k}>
                    <th colSpan="2" className="text-left">{label}</th>
                    <td><input type="number" value={stats.staff[k].m || ''} onChange={e => updateStat('staff', k, 'm', e.target.value)} disabled={isReadonly}/></td>
                    <td><input type="number" value={stats.staff[k].f || ''} onChange={e => updateStat('staff', k, 'f', e.target.value)} disabled={isReadonly}/></td>
                    <td style={{ fontWeight: 'bold' }}>{sumObj(stats.staff[k]) === 0 ? '' : sumObj(stats.staff[k])}</td>
                  </tr>
                ))}
                
                {/* 교인 현황 */}
                <tr>
                  <th rowSpan="3">교<br/>인</th>
                  <th colSpan="2" className="text-left">세례 교인</th>
                  <td><input type="number" value={stats.members.baptized.m || ''} onChange={e => updateStat('members', 'baptized', 'm', e.target.value)} disabled={isReadonly}/></td>
                  <td><input type="number" value={stats.members.baptized.f || ''} onChange={e => updateStat('members', 'baptized', 'f', e.target.value)} disabled={isReadonly}/></td>
                  <td style={{ fontWeight: 'bold' }}>{sumObj(stats.members.baptized) === 0 ? '' : sumObj(stats.members.baptized)}</td>
                </tr>
                <tr>
                  <th colSpan="2" className="text-left">비세례 교인</th>
                  <td><input type="number" value={stats.members.unbaptized.m || ''} onChange={e => updateStat('members', 'unbaptized', 'm', e.target.value)} disabled={isReadonly}/></td>
                  <td><input type="number" value={stats.members.unbaptized.f || ''} onChange={e => updateStat('members', 'unbaptized', 'f', e.target.value)} disabled={isReadonly}/></td>
                  <td style={{ fontWeight: 'bold' }}>{sumObj(stats.members.unbaptized) === 0 ? '' : sumObj(stats.members.unbaptized)}</td>
                </tr>
                
                {/* 재정 블록 생략 및 축소 버전 적용 */}
                <tr><th colSpan="5" style={{ background: '#ddd' }}>재정 / 재산 현황</th></tr>
                <tr>
                  <th colSpan="2">일반 회계 결산액</th>
                  <td>수입:</td>
                  <td><input type="number" value={stats.finance.generalIncome || ''} onChange={e => updateStat('finance', 'generalIncome', null, e.target.value)} disabled={isReadonly}/> 원</td>
                  <td>지출: <input type="number" value={stats.finance.generalExpense || ''} onChange={e => updateStat('finance', 'generalExpense', null, e.target.value)} disabled={isReadonly} style={{ width: '80px' }}/> 원</td>
                </tr>
                <tr>
                  <th colSpan="2">재산 (자가)</th>
                  <td>건물(평):</td>
                  <td><input type="number" value={stats.property.ownedBuilding || ''} onChange={e => updateStat('property', 'ownedBuilding', null, e.target.value)} disabled={isReadonly}/></td>
                  <td>대지(평): <input type="number" value={stats.property.ownedLand || ''} onChange={e => updateStat('property', 'ownedLand', null, e.target.value)} disabled={isReadonly} style={{ width: '80px' }}/></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'elders' && (
          <div>
            <div className="report-title">시무장로 현황</div>
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>연번</th>
                  <th>이름</th>
                  <th style={{ width: 120 }}>생년월일</th>
                  <th>주소</th>
                  <th style={{ width: 140 }}>휴대폰</th>
                </tr>
              </thead>
              <tbody>
                {elders.map((e, idx) => (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td><input type="text" value={e.name} onChange={ev => updateElder(idx, 'name', ev.target.value)} disabled={isReadonly} /></td>
                    <td><input type="date" value={e.birth} onChange={ev => updateElder(idx, 'birth', ev.target.value)} disabled={isReadonly} /></td>
                    <td><input type="text" value={e.address} onChange={ev => updateElder(idx, 'address', ev.target.value)} disabled={isReadonly} className="text-left"/></td>
                    <td><input type="text" value={e.phone} onChange={ev => updateElder(idx, 'phone', ev.target.value)} disabled={isReadonly} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="report-footer-sigs">
              <div>재정부장 ____________ ㊞</div>
              <div>교회 ㊞</div>
              <div>담임교역자 ____________ ㊞<br/><br/>{reportYear}년 ____월 ____일</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChurchReportForm;
