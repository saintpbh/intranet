import { useState, useRef } from 'react';
import API_BASE from '../api';

const ChurchPhotoUpload = ({ church, onClose, onSuccess }) => {
  const [photos, setPhotos] = useState([]); // Array of File objects
  const [previews, setPreviews] = useState([]); // Array of Object URLs
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const remainingSlots = 3 - photos.length;
      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      
      if (selectedFiles.length > remainingSlots && photos.length > 0) {
         setError(`최대 3장까지만 업로드할 수 있습니다.`);
      } else {
         setError(null);
      }

      setPhotos(prev => [...prev, ...filesToAdd]);
      
      const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (photos.length === 0) {
      setError("업로드할 사진을 선택해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    photos.forEach(photo => {
      formData.append('files', photo);
    });

    try {
      const response = await fetch(`${API_BASE}/api/churches/${church.ChrCode}/photos`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('업로드에 실패했습니다.');
      
      const data = await response.json();
      if (data.success) {
        onSuccess(data.photos);
      } else {
        throw new Error('서버 응답 오류');
      }
    } catch (err) {
      setError(err.message || '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center font-['Plus_Jakarta_Sans',_'Pretendard']">
      <div 
        className="absolute inset-0 bg-primary-container/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in border border-white/50">
        
        {/* Header */}
        <div className="pt-6 pb-4 px-6 border-b border-surface-variant/30 flex justify-between items-center bg-white/50 backdrop-blur-md">
          <div>
            <h3 className="font-['Manrope',_'Pretendard'] font-bold text-xl text-primary">{church.CHRNAME || church.ChrName} 사진 관리</h3>
            <p className="text-sm font-medium text-on-surface-variant mt-1">교회 전경, 예배당 사진을 최대 3장까지 올려주세요.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-outline hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="flex flex-col gap-4">
            {/* Image Preview Grid */}
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-container shadow-sm border border-surface-variant/30 group">
                    <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                    >
                       <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
                {previews.length < 3 && (
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/3] rounded-2xl border-2 border-dashed border-outline-variant/60 flex flex-col items-center justify-center text-outline hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-all"
                   >
                     <span className="material-symbols-outlined text-2xl mb-1">add_photo_alternate</span>
                     <span className="text-[11px] font-bold">추가</span>
                   </button>
                )}
              </div>
            )}

            {/* Empty State Upload Button */}
            {previews.length === 0 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-3xl border-2 border-dashed border-outline-variant/60 bg-surface-container-low/50 flex flex-col items-center justify-center cursor-pointer hover:border-secondary hover:bg-secondary/5 transition-all text-on-surface-variant hover:text-secondary"
              >
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                </div>
                <p className="font-bold text-[15px]">사진을 선택해 주세요</p>
                <p className="text-xs mt-1">최대 3장까지 디졸브 연출로 보여집니다.</p>
              </div>
            )}
            
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-xl text-sm font-medium animate-shake">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}
          
          <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-3">
             <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
             <p className="text-[13px] text-on-surface-variant leading-relaxed">
               사진을 새로 업로드하면 기존 사진들은 모두 삭제되고 새로 올린 사진들로 교체됩니다. 시무 중인 담임목사님만 대표 이미지를 수정할 수 있습니다.
             </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleUpload}
            disabled={loading || photos.length === 0}
            className="w-full h-14 bg-gradient-to-r from-secondary to-secondary-container text-white font-['Manrope',_'Pretendard'] font-bold text-lg rounded-2xl shadow-[0_8px_16px_rgba(0,88,188,0.2)] disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_12px_24px_rgba(0,88,188,0.3)] hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined">cloud_upload</span>
            )}
            {loading ? '업로드 중...' : `${photos.length}장 서버에 저장하기`}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ChurchPhotoUpload;
