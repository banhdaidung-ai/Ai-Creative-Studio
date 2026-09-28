
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { generateVideoViaFlow, FLOW_MODEL_IDS, isFlowBackendAvailable } from '../services/flowService';
import { Film, Upload, Play, Download, Loader2, AlertCircle, RefreshCw, Wand2, Box, Share2, Sparkles, Plus, Globe, X } from 'lucide-react';
import { fileToBase64, resizeImage } from '../utils/image';
import { useProject } from '../src/context/ProjectContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const VideoGenerator: React.FC = () => {
  const { workspaceAsset, addToWorkspace } = useProject();
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedVideoModel, setSelectedVideoModel] = useState<'gemini' | 'flow'>('flow');
  const [flowVideoModel, setFlowVideoModel] = useState<string>(FLOW_MODEL_IDS.VIDEO_VEO_QUALITY);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [duration, setDuration] = useState<number>(5);
  const usingFlow = selectedVideoModel === 'flow';
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
        const isFlowReady = await isFlowBackendAvailable();
        if (isFlowReady) {
            setSelectedVideoModel('flow');
            setApiKeySelected(true);
            return;
        }
        if (localStorage.getItem('gemini_api_key') || localStorage.getItem('google_account_pro') === 'true') {
            setApiKeySelected(true);
            return;
        }
        if (window.aistudio?.hasSelectedApiKey) {
            const has = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(has);
        }
    };
    checkKey();

    const handleKeyUpdate = async () => {
        const isFlowReady = await isFlowBackendAvailable();
        if (isFlowReady || localStorage.getItem('gemini_api_key') || localStorage.getItem('google_account_pro') === 'true') {
            setApiKeySelected(true);
        } else if (window.aistudio?.hasSelectedApiKey) {
            window.aistudio.hasSelectedApiKey().then(setApiKeySelected);
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
        } catch (e) { 
          console.error(e); 
          window.dispatchEvent(new Event('open_unlock_modal'));
        }
    } else {
        window.dispatchEvent(new Event('open_unlock_modal'));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeImage(file, 1280, 'image/jpeg', 0.85);
        setImage(base64);
        setError(null);
      } catch (err) {
        setError("Lỗi đọc file ảnh.");
      }
    }
  };

  const generateVideo = async () => {
    const usingFlow = selectedVideoModel === 'flow';

    if (!usingFlow && !apiKeySelected && !localStorage.getItem('gemini_api_key') && localStorage.getItem('google_account_pro') !== 'true') {
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
    setProgress(0);

    try {
      if (usingFlow) {
        let isLocalFlowActive = false;
        try {
          isLocalFlowActive = await isFlowBackendAvailable();
        } catch {
          isLocalFlowActive = false;
        }

        if (isLocalFlowActive) {
          // ── Google Flow (Veo / Omni) path ──────────────────────────────
          setStatus(`Đang kết nối Google Flow (${flowVideoModel})...`);
          const url = await generateVideoViaFlow(
            {
              prompt,
              aspectRatio,
              duration,
              model: flowVideoModel,
              referenceImageBase64: image || undefined,
              referenceImageMime: 'image/jpeg',
            },
            (prog, message) => {
              setProgress(prog);
              setStatus(message);
            }
          );
          if (url) {
            setVideoUrl(url);
            return;
          } else {
            setError("Google Flow không trả về video.");
            return;
          }
        } else {
          // Flow backend is not available locally -> THROW ERROR
          throw new Error('FLOW_BACKEND_UNAVAILABLE: Google Flow Backend chưa khả dụng trên môi trường web này. Vui lòng cấu hình URL (VITE_FLOW_BACKEND_URL) để sử dụng online.');
        }
      } else {

      // ── Gemini Veo path ────────────────────────────────────────────
      setStatus('Đang khởi tạo phiên làm việc với Google Veo Cloud...');
        let currentProgress = 0;
        const statusInterval = setInterval(() => {
          const messages = [
            'Đang phân tích yêu cầu...',
            'Đang render khủng hình...',
            'Đang xử lý chuyển động...',
            'Đang tối ưu hóa chất lượng...',
            'Gần xong rồi, vui lòng đợi thêm chút nữa...'
          ];
          setStatus(messages[Math.floor(Math.random() * messages.length)]);
          currentProgress += Math.random() * 5;
          if (currentProgress > 95) currentProgress = 95;
          setProgress(currentProgress);
        }, 5000);

        const url = await geminiService.generateVideo(prompt, image || undefined);
        clearInterval(statusInterval);
        setProgress(100);

        if (url) {
          setVideoUrl(url);
        } else {
          setError("Không nhận được kết quả từ server.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo video.");
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto w-full space-y-8"
      >
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
                className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-red-500/50 transition-all resize-none font-medium"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Upload className="w-3 h-3 text-red-500" />
                  Ảnh tham chiếu (Tùy chọn)
                </label>
                {workspaceAsset && (
                  <button 
                    onClick={() => setImage(workspaceAsset.url.split(',')[1])}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all"
                  >
                    <Box size={10} /> Load Workspace
                  </button>
                )}
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-video bg-white/5 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-red-500/50 transition-all"
              >
                {image ? (
                  <div className="relative w-full h-full">
                    <img src={`data:image/jpeg;base64,${image}`} className="w-full h-full object-cover" alt="Reference" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setImage(null); }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full shadow-lg transition-all z-10"
                      title="Xóa ảnh tham chiếu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Click để tải ảnh</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>

            {/* Engine Selector */}
            <div className="flex rounded-xl overflow-hidden border border-white/10 mb-2">
              <button
                onClick={() => setSelectedVideoModel('flow')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                  selectedVideoModel === 'flow'
                    ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Globe size={11} /> Google Flow (Khuyên dùng)
              </button>
              <button
                onClick={() => setSelectedVideoModel('gemini')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                  selectedVideoModel === 'gemini'
                    ? 'bg-red-500/20 text-red-400 border-b-2 border-red-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Sparkles size={11} /> Gemini Veo API
              </button>
            </div>

            {/* Chi tiết cài đặt khi chọn Google Flow */}
            {selectedVideoModel === 'flow' && (
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                {/* Chọn Model Flow Video */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                    Mô hình Video Google Flow
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: FLOW_MODEL_IDS.VIDEO_VEO_QUALITY, name: 'Veo 3.1 Quality', badge: '720p', desc: 'Chất lượng cao nhất' },
                      { id: FLOW_MODEL_IDS.VIDEO_VEO_FAST, name: 'Veo 3.1 Fast', badge: 'Fast', desc: 'Tốc độ cao' },
                      { id: FLOW_MODEL_IDS.VIDEO_VEO_LITE, name: 'Veo 3.1 Lite', badge: 'Lite', desc: 'Nhẹ & ổn định' },
                      { id: FLOW_MODEL_IDS.VIDEO_OMNI_FLASH, name: 'Omni 1.1 Flash', badge: 'Audio', desc: 'Kèm âm thanh' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFlowVideoModel(m.id)}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          flowVideoModel === m.id
                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                            : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold">{m.name}</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-mono">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-500 truncate mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tỷ lệ khung hình & Thời lượng */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Tỷ lệ khung hình
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAspectRatio('16:9')}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                          aspectRatio === '16:9'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-black/30 border border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        16:9 Ngang
                      </button>
                      <button
                        type="button"
                        onClick={() => setAspectRatio('9:16')}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                          aspectRatio === '9:16'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-black/30 border border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        9:16 Dọc
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Thời lượng
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {[4, 6, 8, 10].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setDuration(sec)}
                          className={`py-1.5 rounded-lg text-[9px] font-bold transition-all text-center ${
                            duration === sec
                              ? 'bg-emerald-500 text-white'
                              : 'bg-black/30 border border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={generateVideo}
              disabled={isGenerating || !prompt.trim()}
              className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 ${
                selectedVideoModel === 'flow'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-red-500 to-orange-600 shadow-red-500/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang tạo video...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  {selectedVideoModel === 'flow' ? 'Tạo với Google Flow' : 'Bắt đầu tạo'}
                </>
              )}
            </button>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-video bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-2xl">
              <AnimatePresence mode="wait">
              {videoUrl ? (
                <motion.video 
                  key="video"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                />
              ) : isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
                >
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-red-500/20 rounded-full animate-ping absolute inset-0"></div>
                    <div className="w-24 h-24 border-4 border-t-red-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    <Film className="w-10 h-10 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-2">AI is creating magic</h4>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse mb-6">{status}</p>
                  
                  <div className="w-full max-w-xs bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-red-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-2">{progress.toFixed(0)}%</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-8"
                >
                  <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-red-500/5 rounded-[2.5rem] blur-2xl animate-pulse"></div>
                    <Film className="w-10 h-10 text-slate-700" />
                    <div className="absolute -top-2 -right-2 bg-white p-2 rounded-xl shadow-xl rotate-12">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                    Video của bạn sẽ được hiển thị tại đây sau khi quá trình xử lý hoàn tất
                  </p>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setVideoUrl(null); setPrompt(''); setImage(null); }}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <RefreshCw className="w-5 h-5" />
                Làm mới
              </button>
              <button
                onClick={() => addToWorkspace({ url: videoUrl!, prompt, mode: 'VIDEO_GENERATOR', type: 'video' })}
                disabled={!videoUrl}
                className={`flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${!videoUrl && 'opacity-50 pointer-events-none'}`}
              >
                <Share2 className="w-5 h-5" />
                Workspace
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
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-3 text-red-400 animate-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide">
                  {error.includes('FLOW_BACKEND_UNAVAILABLE') ? 'Google Flow Backend chưa kết nối' : 'Đã xảy ra lỗi khi tạo video'}
                </p>
                <p className="text-[11px] text-red-300 font-normal leading-relaxed">
                  {error.replace('FLOW_BACKEND_UNAVAILABLE: ', '')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-500/10">
              <button
                type="button"
                onClick={() => {
                  setSelectedVideoModel('gemini');
                  setError(null);
                  toast.success('Đã chuyển sang mô hình Gemini Veo.');
                  if (!apiKeySelected) {
                    window.dispatchEvent(new Event('open_unlock_modal'));
                  }
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11px] font-bold transition-all shadow-md active:scale-95"
              >
                Chuyển sang Gemini Veo (API)
              </button>
              {usingFlow && (
                <button
                  type="button"
                  onClick={() => {
                    toast.info('Để dùng Google Flow Video, mở Terminal và chạy lệnh:\nnpm run dev:flow', {
                      duration: 8000,
                    });
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-[11px] font-medium transition-all border border-white/10"
                >
                  💻 Cách bật Local Backend
                </button>
              )}
            </div>
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
      </motion.div>
    </div>
  );
};

export default VideoGenerator;
