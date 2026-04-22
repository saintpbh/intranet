import re

with open('client/src/components/ChurchDetail.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace(
    \"import ChurchPhotoUpload from './ChurchPhotoUpload';\",
    \"import ChurchPhotoUpload from './ChurchPhotoUpload';\nimport ApiImage from './ApiImage';\"
)

# 2. State & actions
state_target = \"\"\"  const [showFormer, setShowFormer] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const isMyChurch = user && user.chrCode === church.ChrCode;\"\"\"

state_replacement = \"\"\"  const [showFormer, setShowFormer] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);

  const isMyChurch = user && user.chrCode === church.ChrCode;

  const churchName = (church.CHRNAME || church.ChrName)?.trim();
  const churchAddress = [church.ADDRESS || church.Address, church.JUSO || church.Juso].filter(Boolean).join(' ');
  const naverMapSearchUrl = \
map://search?query=\&appname=com.prok.intranet\;

  const handleShareLocation = async () => {
    const text = \[\]\\n📍 \\\n📞 \\\n\\n[네이버 지도에서 보기]\\nhttps://map.naver.com/v5/search/\\;
    if (navigator.share) {
      try {
        await navigator.share({ title: churchName, text });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopiedLocation(true);
      setTimeout(() => setCopiedLocation(false), 2000);
    }
  };\"\"\"
code = code.replace(state_target, state_replacement)

# 3. ApiImage replacement
img_target = \"<img src={\\\\} alt={\Church slide \\} className=\\\"w-full h-full object-cover\\\" />\"
img_replacement = \"<ApiImage src={photo.photo_url} alt={\Church slide \\} className=\\\"w-full h-full object-cover\\\" fallback={<div className=\\\"w-full h-full bg-[#1a283b] flex items-center justify-center text-white/50\\\">로딩중...</div>} />\"
code = code.replace(img_target, img_replacement)

# 4. Address Bento Grid
addr_target = \"\"\"        {/* Bento Grid: Info */}
        <div className=\"bg-white rounded-[2rem] p-6 shadow-sm border border-surface-variant/50\">
          <h3 className=\"font-['Manrope',_'Pretendard'] font-bold text-lg text-primary mb-4 flex items-center gap-2\">
            <span className=\"material-symbols-outlined text-secondary text-xl\">location_on</span>
            소재지
          </h3>
          <p className=\"text-on-surface font-medium text-[15px] leading-relaxed\">
            {[church.ADDRESS || church.Address, church.JUSO || church.Juso].filter(Boolean).join(' ') || '주소 정보가 없습니다.'}
            {church.PostNo ? <span className=\"text-outline-variant font-mono text-sm ml-2\">[{church.PostNo.trim()}]</span> : ''}
          </p>
          <div className=\"flex justify-between items-center mt-4 pt-4 border-t border-surface-variant/50\">
            <span className=\"text-[12px] font-bold text-outline uppercase tracking-wider\">팩스 번호</span>
            <span className=\"text-on-surface-variant font-medium text-[13px]\">{church.Tel_Fax || '없음'}</span>
          </div>
        </div>\"\"\"

addr_replacement = \"\"\"        {/* Bento Grid: Info & Map Actions */}
        <div className=\"bg-white rounded-[2rem] p-6 shadow-sm border border-surface-variant/50\">
          <h3 className=\"font-['Manrope',_'Pretendard'] font-bold text-lg text-primary mb-4 flex items-center gap-2\">
            <span className=\"material-symbols-outlined text-secondary text-xl\">location_on</span>
            소재지
          </h3>
          <p className=\"text-on-surface font-medium text-[15px] leading-relaxed\">
            {churchAddress || '주소 정보가 없습니다.'}
            {church.PostNo ? <span className=\"text-outline-variant font-mono text-sm ml-2\">[{church.PostNo.trim()}]</span> : ''}
          </p>
          
          {/* Map & Share Action Buttons */}
          <div className=\"flex gap-2 mt-4\">
            <button
              onClick={() => setShowMap(true)}
              className=\"flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-[13px] transition-all active:scale-95 border border-blue-200\"
            >
              <span className=\"material-symbols-outlined text-[18px]\">map</span>
              지도에서 보기
            </button>
            <button
              onClick={handleShareLocation}
              className={\lex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all active:scale-95 border \\}
            >
              <span className=\"material-symbols-outlined text-[18px]\">
                {copiedLocation ? 'check_circle' : 'share'}
              </span>
              {copiedLocation ? '복사 완료!' : '위치 공유'}
            </button>
          </div>

          <div className=\"flex justify-between items-center mt-4 pt-4 border-t border-surface-variant/50\">
            <span className=\"text-[12px] font-bold text-outline uppercase tracking-wider\">팩스 번호</span>
            <span className=\"text-on-surface-variant font-medium text-[13px]\">{church.Tel_Fax || '없음'}</span>
          </div>
        </div>\"\"\"
code = code.replace(addr_target, addr_replacement)

# 5. Map Modal
modal_target = \"\"\"      {/* Upload Modal */}
      {showUpload && (
        <ChurchPhotoUpload 
          church={church} 
          onClose={() => setShowUpload(false)} 
          onSuccess={handleUploadSuccess} 
        />
      )}
    </div>
  );
};

export default ChurchDetail;\"\"\"

modal_replacement = \"\"\"      {/* Upload Modal */}
      {showUpload && (
        <ChurchPhotoUpload 
          church={church} 
          onClose={() => setShowUpload(false)} 
          onSuccess={handleUploadSuccess} 
        />
      )}

      {/* ====== Google Map Modal ====== */}
      {showMap && (
        <div className=\"fixed inset-0 z-[9999] flex flex-col bg-white\" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          {/* Map Header */}
          <div className=\"flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0 shadow-sm relative z-10\">
            <button
              onClick={() => setShowMap(false)}
              className=\"w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors\"
            >
              <span className=\"material-symbols-outlined text-gray-700\">arrow_back</span>
            </button>
            <div className=\"flex-1 text-center px-2\">
              <h3 className=\"font-bold text-[15px] text-gray-900 truncate\">{churchName}</h3>
              <p className=\"text-[11px] text-gray-500 truncate\">{churchAddress || '주소 없음'}</p>
            </div>
            <div className=\"flex gap-1\">
              <button
                onClick={handleShareLocation}
                className={\w-10 h-10 rounded-full flex items-center justify-center transition-colors \\}
                title=\"위치 공유\"
              >
                <span className=\"material-symbols-outlined text-[20px]\">
                  {copiedLocation ? 'check' : 'share'}
                </span>
              </button>
              <a
                href={naverMapSearchUrl}
                target=\"_blank\"
                rel=\"noopener noreferrer\"
                className=\"w-10 h-10 rounded-full flex items-center justify-center hover:bg-green-50 text-green-700 transition-colors\"
                title=\"네이버 지도 앱에서 열기\"
              >
                <span className=\"material-symbols-outlined text-[20px]\">open_in_new</span>
              </a>
            </div>
          </div>

          {/* Map Container (Google Maps iframe) */}
          <div className=\"flex-1 w-full bg-surface-container-low relative\">
            {churchAddress ? (
              <iframe
                title={\\ map\}
                width=\"100%\"
                height=\"100%\"
                style={{ border: 0 }}
                loading=\"lazy\"
                referrerPolicy=\"no-referrer-when-downgrade\"
                src={\https://maps.google.com/maps?q=\&t=&z=15&ie=UTF8&iwloc=&output=embed\}
              />
            ) : (
              <div className=\"w-full h-full flex items-center justify-center text-outline-variant\">
                주소 정보가 없습니다
              </div>
            )}
          </div>

          {/* Bottom Info Bar */}
          <div className=\"px-4 py-3 bg-white border-t border-gray-200 shrink-0 relative z-10 shadow-[0_-4px_6px_rgba(0,0,0,0.05)]\">
            <div className=\"flex items-center gap-3\">
              <div className=\"w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0\">
                <span className=\"material-symbols-outlined text-blue-600 text-[22px]\">church</span>
              </div>
              <div className=\"flex-1 min-w-0\">
                <p className=\"font-bold text-[14px] text-gray-900 truncate\">{churchName}</p>
                <p className=\"text-[12px] text-gray-500 truncate\">{churchAddress || '주소 정보 없음'}</p>
              </div>
              <a
                href={naverMapSearchUrl}
                target=\"_blank\"
                rel=\"noopener noreferrer\"
                className=\"shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors active:scale-95\"
              >
                길찾기
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{\
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      \}</style>
    </div>
  );
};

export default ChurchDetail;\"\"\"
code = code.replace(modal_target, modal_replacement)

with open('client/src/components/ChurchDetail.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Success')
