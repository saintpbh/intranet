import { useState, useEffect } from 'react';
import ChurchList from './ChurchList';
import ElderList from './ElderList';
import ElderDetail from './ElderDetail';
import ChurchDetail from './ChurchDetail';
import { Link } from 'react-router-dom';
import ApiImage from './ApiImage';

const ElderApp = () => {
  const [activeTab, setActiveTab] = useState('elders');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedElder, setSelectedElder] = useState(null);
  const [selectedChurch, setSelectedChurch] = useState(null);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(searchTerm); }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedElder(null);
    setSelectedChurch(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <ApiImage src="/assets/admin_logo.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>주소록</h1><span className="header-badge">장로</span>
          </div>
          <Link to="/" className="header-nav-link">홈</Link>
        </div>
        {!selectedElder && !selectedChurch && (
          <div className="search-container">
            <input type="text" placeholder="이름, 노회명, 교회명으로 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
          </div>
        )}
      </header>
      <main className="app-main">
        {!selectedElder && !selectedChurch && (
          <div className="tabs">
            <button className={`tab ${activeTab === 'elders' ? 'active' : ''}`} onClick={() => handleTabChange('elders')}>장로</button>
            <button className={`tab ${activeTab === 'churches' ? 'active' : ''}`} onClick={() => handleTabChange('churches')}>교회</button>
          </div>
        )}
        <div className="tab-content">
          {selectedElder ? (<ElderDetail priestCode={selectedElder} onBack={() => setSelectedElder(null)} />) : selectedChurch ? (<ChurchDetail church={selectedChurch} onBack={() => setSelectedChurch(null)} />) : (
            <>{activeTab === 'elders' && <ElderList searchTerm={debouncedSearch} onSelect={setSelectedElder} />}
              {activeTab === 'churches' && <ChurchList searchTerm={debouncedSearch} onSelect={setSelectedChurch} />}</>
          )}
        </div>
      </main>
    </div>
  );
};
export default ElderApp;
