
import React, { useState, useRef } from 'react';
import { resizeImage } from '../utils/image';
import PhotoEditor from './PhotoEditor';
import { Edit3, Upload, ImageIcon, X } from 'lucide-react';

const ManualEditor: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const base64 = await resizeImage(e.target.files[0], 2048);
      setImage(base64);
    }
  };

  const handleSave = (base64: string) => {
    setImage(base64);
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {!image ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
           <div className="mb-8">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-white/20 transform hover:scale-105 transition-transform group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                 <Edit3 className="w-16 h-16 text-white group-hover:rotate-12 transition-transform" />
              </div>
           </div>
           
           <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 uppercase tracking-tight">Studio Chỉnh Sửa</h2>
           <p className="text-slate-400 text-sm font-medium mb-10 max-w-sm text-center">
             Tải ảnh của bạn lên để chỉnh sửa màu sắc, ánh sáng, bộ lọc và thêm các lớp văn bản chuyên nghiệp.
           </p>

           <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-10 py-4 bg-white text-slate-900 rounded-[1.8rem] font-black uppercase tracking-widest text-xs shadow-xl hover:shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
           >
              <Upload className="w-4 h-4 text-cyan-500" /> Chọn ảnh bắt đầu
           </button>
           <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
        </div>
      ) : (
        <PhotoEditor 
          imageSrc={image} 
          onSave={handleSave} 
          onClose={() => setImage(null)} 
        />
      )}
    </div>
  );
};

export default ManualEditor;
