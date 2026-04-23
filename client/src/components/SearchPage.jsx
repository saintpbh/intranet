import { useState, useEffect, useCallback } from 'react';
import ChurchList from './ChurchList';
import MinisterList from './MinisterList';
import ElderList from './ElderList';
import MinisterDetail from './MinisterDetail';
import ElderDetail from './ElderDetail';
import ChurchDetail from './ChurchDetail';
import { useBackButton } from '../useBackButton';
import MobileHeader from './mobile/MobileHeader';
import { triggerHaptic } from '../utils/haptics';

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
    triggerHaptic(30);
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

  useBackButton(!!hasDetail, clearDetail);

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
      {!hasDetail ? (
        <MobileHeader title="주소록 검색" />
      ) : (
        <MobileHeader showBack={true} onBack={clearDetail} title="상세 정보" />
      )}

      <main className="pt-24 px-4 max-w-2xl mx-auto">
        {!hasDetail && (
          <div className="mb-6 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>search</span>
              </div>
              <input
                type="text"
                placeholder="이름, 노회명, 교회명..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-surface-variant rounded-2xl py-4 flex pl-12 pr-4 focus:ring-2 focus:ring-secondary-container/20 focus:border-secondary text-on-surface placeholder:text-outline transition-all shadow-sm"
              />
            </div>

            {/* Liquid Animation Tabs */}
            <div className="relative flex bg-surface-container-high rounded-[50px] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] overflow-hidden">
              {/* Blob Effect Marker */}
              <div 
                className="absolute top-1.5 bottom-1.5 w-[calc(33.333%-4px)] bg-white rounded-[50px] shadow-sm z-0"
                style={{ 
                  transform: `translateX(${
                    ['ministers', 'elders', 'churches'].indexOf(activeTab) * 100
                  }%)`,
                  /* 변경: 원래의 0.3초 빠르고 쫀득한 효과로 롤백 */
                  transition: 'transform 0.3s cubic-bezier(0.7, -0.6, 0.2, 1.6)'
                }}
              />
              
              {[
                { id: 'ministers', label: '목회자' },
                { id: 'elders', label: '장로' },
                { id: 'churches', label: '교회' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex-1 py-2.5 text-sm rounded-[50px] transition-colors duration-300 z-10 ${
                    activeTab === tab.id 
                      ? 'font-extrabold text-primary' 
                      : 'font-bold text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          {selectedMinister ? (
            <MinisterDetail ministerCode={selectedMinister} onBack={clearDetail} />
          ) : selectedElder ? (
            <ElderDetail priestCode={selectedElder} onBack={clearDetail} />
          ) : selectedChurch ? (
            <ChurchDetail church={selectedChurch} onBack={clearDetail} />
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_20px_40px_rgba(10,37,64,0.04)] overflow-hidden">
              {activeTab === 'ministers' && <MinisterList searchTerm={debouncedSearch} onSelect={setSelectedMinister} />}
              {activeTab === 'elders' && <ElderList searchTerm={debouncedSearch} onSelect={setSelectedElder} />}
              {activeTab === 'churches' && <ChurchList searchTerm={debouncedSearch} onSelect={setSelectedChurch} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
