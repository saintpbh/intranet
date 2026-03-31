import { useState, useEffect } from 'react';
import ChurchList from './ChurchList';
import MinisterList from './MinisterList';
import MinisterDetail from './MinisterDetail';
import ChurchDetail from './ChurchDetail';
import { Link } from 'react-router-dom';

const MinisterApp = () => {
  const [activeTab, setActiveTab] = useState('ministers');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMinister, setSelectedMinister] = useState(null);
  const [selectedChurch, setSelectedChurch] = useState(null);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(searchTerm); }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedMinister(null);
    setSelectedChurch(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <img src="/assets/admin_logo.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>주소록</h1>
            <span className="header-badge">목회자</span>
          </div>
          <Link to="/" className="header-nav-link">홈</Link>
        </div>
        
        {!selectedMinister && !selectedChurch && (
          <div className="search-container">
            <input 
              type="text" 
              placeholder="이름, 노회명, 교회명으로 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        )}
      </header>

      <main className="app-main">
        {!selectedMinister && !selectedChurch && (
          <div className="tabs">
            <button className={`tab ${activeTab === 'ministers' ? 'active' : ''}`} onClick={() => handleTabChange('ministers')}>
              목회자
            </button>
            <button className={`tab ${activeTab === 'churches' ? 'active' : ''}`} onClick={() => handleTabChange('churches')}>
              교회
            </button>
          </div>
        )}

        <div className="tab-content">
          {selectedMinister ? (
            <MinisterDetail ministerCode={selectedMinister} onBack={() => setSelectedMinister(null)} />
          ) : selectedChurch ? (
            <ChurchDetail church={selectedChurch} onBack={() => setSelectedChurch(null)} />
          ) : (
            <>
              {activeTab === 'ministers' && <MinisterList searchTerm={debouncedSearch} onSelect={setSelectedMinister} />}
              {activeTab === 'churches' && <ChurchList searchTerm={debouncedSearch} onSelect={setSelectedChurch} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default MinisterApp;
