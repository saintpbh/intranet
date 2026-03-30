import { useState, useEffect, useCallback } from 'react';
import ChurchList from './ChurchList';
import MinisterList from './MinisterList';
import ElderList from './ElderList';
import MinisterDetail from './MinisterDetail';
import ElderDetail from './ElderDetail';
import ChurchDetail from './ChurchDetail';
import { useBackButton } from '../useBackButton';

const SearchPage = () => {
  const [activeTab, setActiveTab] = useState('ministers');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMinister, setSelectedMinister] = useState(null);
  const [selectedElder, setSelectedElder] = useState(null);
  const [selectedChurch, setSelectedChurch] = useState(null);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(searchTerm); }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedMinister(null);
    setSelectedElder(null);
    setSelectedChurch(null);
  };

  const hasDetail = selectedMinister || selectedElder || selectedChurch;

  const clearDetail = useCallback(() => {
    setSelectedMinister(null);
    setSelectedElder(null);
    setSelectedChurch(null);
  }, []);

  // Android back button support
  useBackButton(!!hasDetail, clearDetail);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          {hasDetail ? (
            <button className="btn-back" onClick={clearDetail}>뒤로</button>
          ) : (
            <>
              <img src="/assets/logo_v3.png" alt="한국기독교장로회총회" className="header-logo" />
              <div className="header-title-group">
                <h1>검색</h1>
              </div>
            </>
          )}
        </div>

        {!hasDetail && (
          <div className="search-container">
            <input
              type="text"
              placeholder="이름, 노회명, 교회명으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              id="search-input"
            />
          </div>
        )}
      </header>

      <main className="app-main">
        {!hasDetail && (
          <div className="tabs">
            <button className={`tab ${activeTab === 'ministers' ? 'active' : ''}`} onClick={() => handleTabChange('ministers')}>
              목회자
            </button>
            <button className={`tab ${activeTab === 'elders' ? 'active' : ''}`} onClick={() => handleTabChange('elders')}>
              장로
            </button>
            <button className={`tab ${activeTab === 'churches' ? 'active' : ''}`} onClick={() => handleTabChange('churches')}>
              교회
            </button>
          </div>
        )}

        <div className="tab-content">
          {selectedMinister ? (
            <MinisterDetail ministerCode={selectedMinister} onBack={clearDetail} />
          ) : selectedElder ? (
            <ElderDetail priestCode={selectedElder} onBack={clearDetail} />
          ) : selectedChurch ? (
            <ChurchDetail church={selectedChurch} onBack={clearDetail} />
          ) : (
            <>
              {activeTab === 'ministers' && <MinisterList searchTerm={debouncedSearch} onSelect={setSelectedMinister} />}
              {activeTab === 'elders' && <ElderList searchTerm={debouncedSearch} onSelect={setSelectedElder} />}
              {activeTab === 'churches' && <ChurchList searchTerm={debouncedSearch} onSelect={setSelectedChurch} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
