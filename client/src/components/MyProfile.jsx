const MyProfile = ({ user, onBack }) => {
  const fields = [
    { label: '이름', value: user.name },
    { label: '직분', value: user.duty },
    { label: '교회', value: user.church },
    { label: '노회', value: user.presbytery },
    { label: '연락처', value: user.phone, type: 'tel' },
    { label: '이메일', value: user.email, type: 'email' },
    { label: '생년월일', value: user.birthday ? `${user.birthday.substring(0, 4)}.${user.birthday.substring(4, 6)}.${user.birthday.substring(6, 8)}` : '' },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <button className="btn-back" onClick={onBack}>뒤로</button>
          <div className="header-title-group">
            <h1>현재 정보</h1>
          </div>
        </div>
      </header>
      <main className="app-main" style={{ padding: '0 16px' }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="profile-header">
            <div className="profile-avatar">
              <span className="initials">{user.name?.charAt(0)}</span>
            </div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-subtitle">{user.duty}</div>
          </div>
        </div>

        <div className="section-header">등록 정보</div>
        <div className="card">
          {fields.map((f, idx) => (
            <div key={idx} className="info-row">
              <span className="info-label">{f.label}</span>
              {f.type === 'tel' && f.value ? (
                <a href={`tel:${f.value}`} className="info-link">{f.value}</a>
              ) : f.type === 'email' && f.value ? (
                <a href={`mailto:${f.value}`} className="info-link">{f.value}</a>
              ) : (
                <span className="info-text">{f.value || '—'}</span>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--system-gray2)', textAlign: 'center', marginTop: 24, lineHeight: 1.6, padding: '0 16px' }}>
          정보 수정이 필요한 경우 검색 탭에서 본인의 상세 정보 페이지에서 수정 요청을 제출해 주세요.
        </p>
      </main>
    </div>
  );
};

export default MyProfile;
