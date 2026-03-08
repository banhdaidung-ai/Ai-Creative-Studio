
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { Lightbulb, Upload, Wand2, Copy, Check, Loader2, AlertCircle, RefreshCw, Sparkles, Key } from 'lucide-react';
import { fileToBase64 } from '../utils/image';

interface CreativePrompt {
  title_vn: string;
  title_en: string;
  description_vn: string;
  prompt_en: string;
  prompt_vn: string;
}

const PromptGenerator: React.FC = () => {
  const [idea, setIdea] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<CreativePrompt[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
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
    const files = e.target.files;
    if (files) {
      try {
        const newImages = await Promise.all(
          Array.from(files).map(file => fileToBase64(file))
        );
        setImages(prev => [...prev, ...newImages].slice(0, 3));
        setError(null);
      } catch (err) {
        setError("Lỗi đọc file ảnh.");
      }
    }
  };

  const generatePrompts = async () => {
    const hasManualKey = !!localStorage.getItem('gemini_api_key');
    if (!apiKeySelected && !hasManualKey) {
      handleSelectKey();
      return;
    }
    if (!idea.trim() && images.length === 0) {
      setError("Vui lòng nhập ý tưởng hoặc tải ảnh tham chiếu.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const result = await geminiService.generateCreativePrompts(idea, images);
      setPrompts(result);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo gợi ý.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-500 uppercase tracking-tighter">
            AI Prompt Generator
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Sáng tạo câu lệnh chuyên nghiệp cho các mô hình AI tạo ảnh</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 space-y-6 shadow-xl">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-lime-400" />
                  Ý tưởng của bạn
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Ví dụ: Một bộ sưu tập thời trang mùa hè rực rỡ, phong cách bohemian..."
                  className="w-full h-32 bg-black/5 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs text-slate-900 dark:text-white outline-none focus:border-lime-500/50 transition-all resize-none font-medium"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Upload className="w-3 h-3 text-lime-400" />
                  Ảnh tham chiếu ({images.length}/3)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                      <img src={`data:image/png;base64,${img}`} className="w-full h-full object-cover" alt="Ref" />
                      <button 
                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center text-[8px] hover:bg-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center hover:border-lime-500/50 transition-all group"
                    >
                      <Upload className="w-4 h-4 text-slate-600 group-hover:text-lime-500 transition-colors" />
                    </button>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
              </div>

              <button
                onClick={generatePrompts}
                disabled={isGenerating || (!idea.trim() && images.length === 0)}
                className="w-full py-4 bg-gradient-to-r from-lime-400 to-green-600 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-lime-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang sáng tạo...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Tạo Gợi Ý
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-8 space-y-6">
            {prompts.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {prompts.map((p, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4 hover:border-lime-500/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-lime-500/10 transition-all"></div>
                    
                    <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-1">
                        <h4 className="text-lg font-black text-white uppercase tracking-tighter">{p.title_vn}</h4>
                        <p className="text-[10px] font-bold text-lime-400 uppercase tracking-widest">{p.title_en}</p>
                      </div>
                      <div className="px-3 py-1 bg-lime-500/10 rounded-full text-[8px] font-black text-lime-400 uppercase tracking-widest border border-lime-500/20">
                        Concept {idx + 1}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 font-medium italic leading-relaxed border-l-2 border-lime-500/30 pl-4">
                      "{p.description_vn}"
                    </p>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Prompt (English)</span>
                          <button 
                            onClick={() => copyToClipboard(p.prompt_en, idx)}
                            className="flex items-center gap-1.5 text-[8px] font-black text-lime-400 uppercase tracking-widest hover:text-lime-300 transition-colors"
                          >
                            {copiedIndex === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedIndex === idx ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </div>
                        <div className="bg-black/40 rounded-xl p-4 text-[11px] font-mono text-slate-300 leading-relaxed border border-white/5">
                          {p.prompt_en}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-white/5 border border-white/10 rounded-[2rem] flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center animate-pulse">
                  <Lightbulb className="w-12 h-12 text-slate-700" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Chưa có gợi ý nào</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed max-w-xs">
                    Nhập ý tưởng của bạn ở cột bên trái để AI bắt đầu sáng tạo các câu lệnh chuyên nghiệp
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 animate-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptGenerator;
