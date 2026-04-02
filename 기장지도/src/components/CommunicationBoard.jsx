import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Send, Lock } from 'lucide-react';

export default function CommunicationBoard({ churchId, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', content: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('inquiries')
        .insert([{
            church_id: churchId,
            name: form.name,
            phone: form.phone,
            content: form.content
        }]);

      if (error) throw error;

      alert("문의가 성공적으로 접수되었습니다. 담당 교역자가 확인 후 연락드리겠습니다.");
      setForm({ name: '', phone: '', content: '' });
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      alert("오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="p-1">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Lock size={18} className="text-blue-900"/>
          비밀 문의하기
        </h3>
        <p className="text-sm text-slate-500 mb-6">등록하신 문의 내용은 암호화되어 해당 교회의 담당 교역자만 확인할 수 있습니다. 새가족 등록, 이명, 기타 방문 사항을 편하게 남겨주세요.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="이름 (또는 단체명)" 
            className="w-full p-4 rounded-xl bg-slate-100 border-none focus:outline-none focus:ring-2 focus:ring-blue-900/50 transition-shadow"
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            required
          />
          <input 
            type="tel" 
            placeholder="연락처 (답변 받을 번호)" 
            className="w-full p-4 rounded-xl bg-slate-100 border-none focus:outline-none focus:ring-2 focus:ring-blue-900/50 transition-shadow"
            value={form.phone}
            onChange={(e) => setForm({...form, phone: e.target.value})}
            required
          />
          <textarea 
            placeholder="문의 내용을 입력해주세요." 
            className="w-full p-4 rounded-xl bg-slate-100 border-none focus:outline-none focus:ring-2 focus:ring-blue-900/50 transition-shadow h-32 resize-none"
            value={form.content}
            onChange={(e) => setForm({...form, content: e.target.value})}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800 active:scale-[0.98] transition-all shadow-md mt-2"
          >
            {loading ? "전송 중..." : <><Send size={18}/> 문의 접수하기</>}
          </button>
        </form>
      </div>
    </div>
  );
}
