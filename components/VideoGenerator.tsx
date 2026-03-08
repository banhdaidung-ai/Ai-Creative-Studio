
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { Film, Upload, Play, Download, Loader2, AlertCircle, RefreshCw, Wand2, Key } from 'lucide-react';
import { fileToBase64 } from '../utils/image';

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
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
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setImage(base64);
        setError(null);
      } catch (err) {
        setError("Lỗi đọc file ảnh.");
      }
    }
  };

  const generateVideo = async () => {
    const hasManualKey = !!localStorage.getItem('gemini_api_key');
    if (!apiKeySelected && !hasManualKey) {
      handleSelectKey();
      return;
    }
    if (!prompt.trim()) {
      setError("Vui lòng nhập mô tả video.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setStatus('Đang khởi tạo phiên làm việc...');

    try {
      // Custom status messages for better UX
      const statusInterval = setInterval(() => {
        const messages = [
          'Đang phân tích yêu cầu...',
          'Đang render khung hình...',
          'Đang xử lý chuyển động...',
          'Đang tối ưu hóa chất lượng...',
          'Gần xong rồi, vui lòng đợi thêm chút nữa...'
        ];
        setStatus(messages[Math.floor(Math.random() * messages.length)]);
      }, 15000);

      const url = await geminiService.generateVideo(prompt, image || undefined);
      clearInterval(statusInterval);
      
      if (url) {
        setVideoUrl(url);
      } else {
        setError("Không nhận được kết quả từ server.");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo video.");
    } finally {
      setIsGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600 uppercase tracking-tighter">
            AI Video Generator
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Biến ý tưởng và hình ảnh thành video sống động với Google Veo</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Wand2 className="w-3 h-3 text-red-500" />
                Mô tả video (Prompt)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ví dụ: Một người mẫu đang dạo bước trên sàn catwalk với bộ trang phục lụa bay bổng, ánh sáng studio chuyên nghiệp..."
                className="w-full h-32 bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm text-slate-900 dark:text-white outline-none focus:border-red-500/50 transition-all resize-none font-medium"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Upload className="w-3 h-3 text-red-500" />
                Ảnh tham chiếu (Tùy chọn)
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-video bg-black/5 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-red-500/50 transition-all"
              >
                {image ? (
                  <img src={`data:image/png;base64,${image}`} className="w-full h-full object-cover" alt="Reference" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Click để tải ảnh</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>

            <button
              onClick={generateVideo}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang tạo video...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Bắt đầu tạo
                </>
              )}
            </button>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-video bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-2xl">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Film className="w-10 h-10 text-slate-700" />
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                    Video của bạn sẽ được hiển thị tại đây sau khi quá trình xử lý hoàn tất
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
                  <div className="relative mb-8">
                    <div className="w-20 h-20 border-4 border-red-500/20 rounded-full animate-ping absolute inset-0"></div>
                    <div className="w-20 h-20 border-4 border-t-red-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    <Film className="w-8 h-8 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-2">AI is creating magic</h4>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">{status}</p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setVideoUrl(null); setPrompt(''); setImage(null); }}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <RefreshCw className="w-5 h-5" />
                Làm mới
              </button>
              <a
                href={videoUrl || '#'}
                download={`video_${Date.now()}.mp4`}
                className={`flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${!videoUrl && 'opacity-50 pointer-events-none'}`}
              >
                <Download className="w-5 h-5" />
                Tải video
              </a>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 animate-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
          </div>
        )}

        <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
             <div className="text-red-500 font-black text-xl">01</div>
             <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Mô tả chi tiết</h5>
             <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed">Mô tả càng chi tiết về bối cảnh, ánh sáng và chuyển động, kết quả càng ấn tượng.</p>
          </div>
          <div className="space-y-2">
             <div className="text-red-500 font-black text-xl">02</div>
             <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Ảnh tham chiếu</h5>
             <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed">Sử dụng ảnh để AI hiểu rõ hơn về nhân vật hoặc phong cách bạn mong muốn.</p>
          </div>
          <div className="space-y-2">
             <div className="text-red-500 font-black text-xl">03</div>
             <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Thời gian xử lý</h5>
             <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed">Quá trình tạo video có thể mất từ 1-3 phút tùy thuộc vào độ phức tạp.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
