
import React, { useState, useRef, useEffect } from 'react';
import { geminiService, MODEL_OPTIONS } from '../services/gemini';
import { Upload, Eraser, Download, Loader2, AlertCircle, CheckCircle2, RefreshCw, Key, Settings2, Image as ImageIcon } from 'lucide-react';
import { fileToBase64, applyMask } from '../utils/image';
import { ModelSelector } from './ModelSelector';

const BackgroundRemover: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.1-flash-image-preview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
        if (localStorage.getItem('gemini_api_key')) {
            setApiKeySelected(true);
            return;
        }
        if (window.aistudio?.hasSelectedApiKey) {
            const has = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(has);
        }
    };
    checkKey();
    
    // Listen for storage changes
    const handleKeyUpdate = () => {
        if (localStorage.getItem('gemini_api_key')) {
            setApiKeySelected(true);
        } else {
            if (window.aistudio?.hasSelectedApiKey) {
                window.aistudio.hasSelectedApiKey().then(setApiKeySelected);
            }
        }
    };
    window.addEventListener('storage', handleKeyUpdate);
    window.addEventListener('gemini_api_key_updated', handleKeyUpdate);
    return () => {
        window.removeEventListener('storage', handleKeyUpdate);
        window.removeEventListener('gemini_api_key_updated', handleKeyUpdate);
    };
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
        try {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        } catch (e) { console.error(e); }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setImage(base64);
        setResult(null);
        setError(null);
      } catch (err) {
        setError("Lỗi đọc file ảnh.");
      }
    }
  };

  const processImage = async () => {
    if (!image) return;
    const hasManualKey = !!localStorage.getItem('gemini_api_key');
    if (!apiKeySelected && !hasManualKey) {
      handleSelectKey();
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const mask = await geminiService.removeBackground(image, 'pro', { modelId: selectedModelId });
      if (mask) {
        const finalResult = await applyMask(image, mask);
        setResult(finalResult);
      } else {
        setError("Không thể tạo mask tách nền.");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi tách nền.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${result}`;
    link.download = `removed_bg_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500 uppercase tracking-tighter">
            AI Background Remover
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Tách nền chuyên nghiệp bằng AI thế hệ mới</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="relative aspect-[3/4] bg-black/5 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2rem] overflow-hidden group transition-all hover:border-pink-500/50">
              {image ? (
                <img src={`data:image/png;base64,${image}`} className="w-full h-full object-contain" alt="Input" />
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="p-4 bg-pink-500/10 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-pink-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tải ảnh lên</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>
            
            <div className="bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 space-y-6">
              <div className="flex items-center gap-2 text-pink-400">
                <Settings2 size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Cấu hình Model</span>
              </div>
              
              <ModelSelector 
                selectedModelId={selectedModelId}
                onModelSelect={(id) => {
                  setSelectedModelId(id);
                  if (id.includes('pro') && !apiKeySelected) handleSelectKey();
                }}
              />
            </div>

            <button
              onClick={processImage}
              disabled={!image || isProcessing}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-pink-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Eraser className="w-5 h-5" />
                  Tách Nền Ngay
                </>
              )}
            </button>
          </div>

          {/* Result Section */}
          <div className="space-y-4">
            <div className="relative aspect-[3/4] bg-black/20 border border-white/10 rounded-[2rem] overflow-hidden flex items-center justify-center">
              {result ? (
                <div className="w-full h-full relative">
                   {/* Checkerboard background for transparency preview */}
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] opacity-10"></div>
                   <img src={`data:image/png;base64,${result}`} className="w-full h-full object-contain relative z-10" alt="Result" />
                </div>
              ) : (
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-8 h-8 text-slate-700" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Ảnh đã tách nền sẽ hiển thị tại đây</p>
                </div>
              )}
              
              {isProcessing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
                    <span className="text-xs font-black text-white uppercase tracking-widest animate-pulse">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setImage(null); setResult(null); }}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <RefreshCw className="w-5 h-5" />
                Làm mới
              </button>
              <button
                onClick={downloadResult}
                disabled={!result}
                className="flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Tải về
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 animate-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
          </div>
        )}

        <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] space-y-4">
          <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-pink-500" />
            Hướng dẫn sử dụng
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <li className="flex gap-2">
              <span className="text-pink-500">01.</span>
              Tải lên ảnh có chủ thể rõ ràng (người hoặc vật).
            </li>
            <li className="flex gap-2">
              <span className="text-pink-500">02.</span>
              Nhấn "Tách Nền Ngay" để AI xử lý ảnh.
            </li>
            <li className="flex gap-2">
              <span className="text-pink-500">03.</span>
              Kết quả trả về là ảnh nhân vật với nền trong suốt (PNG).
            </li>
            <li className="flex gap-2">
              <span className="text-pink-500">04.</span>
              Tải về và sử dụng trực tiếp cho các thiết kế của bạn.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BackgroundRemover;
