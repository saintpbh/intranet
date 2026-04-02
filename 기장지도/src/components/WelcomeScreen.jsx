import React, { useState, useEffect } from 'react';
import { MapPin, Search, Navigation, Star, Info, ChevronRight } from 'lucide-react';

export default function WelcomeScreen({ totalChurches, onStart }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // slight delay for entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-[#2B3990]/20 backdrop-blur-xl transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onStart}
      />
      
      {/* Modal Card */}
      <div 
        className={`relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden transition-all duration-700 ease-out transform ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95'}`}
        style={{ border: '1px solid rgba(255, 255, 255, 0.6)' }}
      >
        {/* Header Graphic */}
        <div className="bg-gradient-to-br from-[#2B3990] to-[#00A5D9] p-8 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white flex opacity-10 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white flex opacity-10 rounded-full translate-y-1/3 -translate-x-1/4"></div>
          
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-lg">
            <MapPin size={32} className="text-white drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2 drop-shadow-sm tracking-tight">
            기장 교회 지도 서비스
          </h1>
          <p className="text-white/90 text-sm font-medium">
            전국 한국기독교장로회 교회를 한눈에 확인하세요.
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Summary Data */}
          <div className="bg-gray-50/80 rounded-2xl p-5 mb-8 border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#00A5D9]/10 flex items-center justify-center shrink-0">
              <Info size={24} className="text-[#00A5D9]" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold mb-0.5">전체 데이터 요약</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[#2B3990]">{totalChurches > 0 ? totalChurches.toLocaleString() : '---'}</span>
                <span className="text-sm font-bold text-gray-600">개의 교회가 등록되어 있습니다.</span>
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <h2 className="text-sm font-black text-gray-900 mb-4 px-1">서비스 주요 기능 안내</h2>
          <div className="space-y-4 mb-8">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Search size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">교회 및 지역 맞춤 검색</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">교회 이름, 행정 구역(시/군/구), 또는 소속 노회를 검색해 빠르게 교회를 찾아보세요.</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center shrink-0 mt-0.5">
                <Navigation size={16} className="text-cyan-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">손쉬운 길찾기 & 주변 탐색</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">다른 앱을 켤 필요 없이 곧바로 대중교통 및 자동차 목적지 길안내를 받을 수 있습니다.</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
                <Star size={16} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">관심 교회 모아보기</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">자주 방문하시거나 관심 있는 교회를 별표(☆)로 저장해두면 편리하게 다시 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={onStart}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-[#2B3990] to-[#00A5D9] text-white font-bold text-base py-4 rounded-2xl shadow-[0_8px_24px_rgba(43,57,144,0.3)] hover:shadow-[0_12px_32px_rgba(0,165,217,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="relative z-10">지도에서 시작하기</span>
            <ChevronRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
          </button>
        </div>
      </div>
    </div>
  );
}
