import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import MobileHeader from './MobileHeader';
import PensionStatus from '../PensionStatus';
import InsuranceStatus from '../InsuranceStatus';

const PensionInsurancePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pension'); // 'pension' | 'insurance'

  useEffect(() => {
    // Reset view hook
    const handleResetView = () => {
      setActiveTab('pension');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('reset-documents-view', handleResetView);
    return () => window.removeEventListener('reset-documents-view', handleResetView);
  }, []);

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-['Plus_Jakarta_Sans',_'Pretendard']">
      <MobileHeader title="연금/생보 현황" />
      
      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-6">
        {/* Top Tab Bar Switcher */}
        <div className="flex bg-surface-container-lowest rounded-2xl p-1 shadow-sm border border-surface-variant/30">
          <button
            onClick={() => setActiveTab('pension')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'pension'
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-lg">savings</span>
            연금납입 현황
          </button>
          <button
            onClick={() => setActiveTab('insurance')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'insurance'
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-lg">account_balance</span>
            생보납입 현황
          </button>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'pension' ? (
            <PensionStatus user={user} hideHeader={true} />
          ) : (
            <InsuranceStatus user={user} hideHeader={true} />
          )}
        </div>
      </main>
    </div>
  );
};

export default PensionInsurancePage;
