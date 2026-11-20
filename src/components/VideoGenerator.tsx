import React, { useState, useRef, useEffect } from 'react';
import { geminiService, hasRealGeminiCredentials, hasSyncGeminiCredentials } from '../services/gemini';
import {
  generateVideoViaFlow,
  enhancePromptViaFlow,
  FLOW_MODEL_IDS,
  isFlowBackendAvailable,
  isLanOrLocalHostname,
  buildFlowUnavailableMessage,
} from '../services/flowService';
import {
  generateVideoViaMuse,
  getMuseReadyStatus,
  fetchMuseAdminUrl,
  getMuseAdminUrl,
} from '../services/museService';
import {
  Film,
  Upload,
  Play,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wand2,
  Box,
  Share2,
  Sparkles,
  Globe,
  X,
  ExternalLink,
  ArrowLeftRight,
  Layers,
  Plus,
  Scissors,
  Volume2,
} from 'lucide-react';
import { resizeImage } from '../utils/image';
import { useProject } from '../contexts/ProjectContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

type VideoEngine = 'flow' | 'gemini' | 'muse';
type VideoCreationMode = 'standard' | 'interpolation' | 'ingredients' | 'extend' | 'edit';

async function blobOrUrlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) {
    return url;
  }
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const VideoGenerator: React.FC = () => {
  const { workspaceAsset, addToWorkspace, addToHistory } = useProject();

  const [prompt, setPrompt] = useState('');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  // Media inputs across modes
  const [image, setImage] = useState<string | null>(null); // Opening / Start frame
  const [endFrameImage, setEndFrameImage] = useState<string | null>(null); // End keyframe
  const [ingredientImages, setIngredientImages] = useState<string[]>([]); // Up to 6 reference images
  const [sourceVideoData, setSourceVideoData] = useState<string | null>(null); // Source video for Extend / Edit
  const [sourceVideoName, setSourceVideoName] = useState<string>('');
  const [regenerateAudio, setRegenerateAudio] = useState<boolean>(false);

  // Output & progress
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  // Engine & Model selection
  const [selectedVideoModel, setSelectedVideoModel] = useState<VideoEngine>('flow');
  const [videoMode, setVideoMode] = useState<VideoCreationMode>('standard');
  const [flowVideoModel, setFlowVideoModel] = useState<string>(FLOW_MODEL_IDS.VIDEO_OMNI_1_2_FLASH);
  const [geminiVideoModel, setGeminiVideoModel] = useState<'gemini-omni-1.2-flash' | 'veo-3.1-lite-generate-preview'>('gemini-omni-1.2-flash');
  const [flowResolution, setFlowResolution] = useState<'360p' | '720p'>('720p');
  const [geminiResolution, setGeminiResolution] = useState<'360p' | '720p' | '1080p' | '4k'>('1080p');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [duration, setDuration] = useState<number>(8);

  const [museAccountsCount, setMuseAccountsCount] = useState<number>(0);
  const [museAdminUrl, setMuseAdminUrl] = useState<string>(getMuseAdminUrl());

  const usingFlow = selectedVideoModel === 'flow';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endFrameInputRef = useRef<HTMLInputElement>(null);
  const ingredientsInputRef = useRef<HTMLInputElement>(null);
  const sourceVideoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMuseAdminUrl().then(setMuseAdminUrl);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const checkKey = async () => {
      const [isFlowReady, museStatus, realGemini] = await Promise.all([
        isFlowBackendAvailable(false),
        getMuseReadyStatus(false),
        hasRealGeminiCredentials(),
      ]);
      setMuseAccountsCount(museStatus.accounts);

      if (isFlowReady) {
        setSelectedVideoModel('flow');
        return;
      }
      if (museStatus.accounts > 0) {
        setSelectedVideoModel('muse');
        return;
      }
      if (realGemini) {
        setSelectedVideoModel('gemini');
      }
    };
    checkKey();
  }, []);

  // Keep duration within valid range when switching modes
  const maxAllowedDuration =
    videoMode === 'interpolation' || videoMode === 'extend' || selectedVideoModel !== 'gemini' || geminiVideoModel !== 'gemini-omni-1.2-flash'
      ? 10
      : 15;

  useEffect(() => {
    if (duration > maxAllowedDuration) {
      setTimeout(() => setDuration(maxAllowedDuration), 0);
    }
  }, [duration, maxAllowedDuration]);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
      } catch {
        window.dispatchEvent(new Event('open_unlock_modal'));
      }
    } else {
      window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'google' } }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeImage(file, 1280, 'image/jpeg', 0.88);
        setImage(base64);
        setError(null);
      } catch {
        setError('Lỗi đọc file ảnh mở đầu.');
      }
    }
    e.target.value = '';
  };

  const handleEndFrameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeImage(file, 1280, 'image/jpeg', 0.88);
        setEndFrameImage(base64);
        setError(null);
      } catch {
        setError('Lỗi đọc file ảnh kết thúc.');
      }
    }
    e.target.value = '';
  };

  const handleIngredientsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = 6 - ingredientImages.length;
    const toRead = Array.from(files).slice(0, remainingSlots);
    try {
      const converted = await Promise.all(toRead.map((f) => resizeImage(f, 1280, 'image/jpeg', 0.86)));
      setIngredientImages((prev) => [...prev, ...converted].slice(0, 6));
      setError(null);
    } catch {
      setError('Không thể đọc một số ảnh thành phần.');
    }
    e.target.value = '';
  };

  const handleSourceVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 28 * 1024 * 1024) {
      toast.error('Video tải lên quá lớn (> 28MB). Vui lòng chọn clip ngắn hơn (dưới 20 giây).');
      e.target.value = '';
      return;
    }
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceVideoData(String(reader.result || ''));
        setSourceVideoName(file.name);
        setError(null);
        toast.success(`Đã nạp video gốc: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Không thể đọc file video gốc.');
    }
    e.target.value = '';
  };

  const loadGeneratedVideoForPostEdit = async (targetMode: 'extend' | 'edit') => {
    if (!videoUrl) return;
    try {
      const dataUri = await blobOrUrlToBase64(videoUrl);
      setSourceVideoData(dataUri);
      setSourceVideoName('video-vua-tao.mp4');
      setSelectedVideoModel('gemini');
      setGeminiVideoModel('gemini-omni-1.2-flash');
      setVideoMode(targetMode);
      if (targetMode === 'extend') {
        setDuration(5);
        if (!prompt.trim()) {
          setPrompt('Continue the smooth camera motion and natural model movement seamlessly');
        }
        toast.success('Đã nạp video vào chế độ Nối dài (+5s) trên Omni 1.2 Flash!');
      } else {
        toast.success('Đã nạp video vào chế độ Chỉnh sửa trên Omni 1.2 Flash!');
      }
    } catch {
      toast.error('Không thể nạp lại video vừa tạo.');
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const canUseGemini = hasSyncGeminiCredentials() || (await hasRealGeminiCredentials());
      const enhanced = canUseGemini
        ? await geminiService.enhancePrompt(prompt)
        : await enhancePromptViaFlow(prompt, 'video');
      if (enhanced && enhanced !== prompt) {
        setPrompt(enhanced);
        toast.success('Đã tối ưu hóa Prompt chuyển động điện ảnh!');
      }
    } catch {
      toast.error('Không thể tối ưu prompt lúc này.');
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const swapKeyframes = () => {
    const prevStart = image;
    setImage(endFrameImage);
    setEndFrameImage(prevStart);
  };

  const generateVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const isFlow = selectedVideoModel === 'flow';
    const isMuse = selectedVideoModel === 'muse';

    if ((videoMode === 'extend' || videoMode === 'edit') && !sourceVideoData) {
      setError('Vui lòng tải lên video gốc (.mp4) hoặc chọn video vừa tạo để nối dài / chỉnh sửa.');
      return;
    }
    if (videoMode === 'interpolation' && (!image || !endFrameImage)) {
      setError('Chế độ Khung Đầu & Cuối yêu cầu tải đủ cả 2 ảnh: Khung Bắt Đầu và Khung Kết Thúc.');
      return;
    }
    if (videoMode === 'ingredients' && ingredientImages.length === 0) {
      setError('Vui lòng tải ít nhất 1 ảnh Thành phần (tối đa 6 ảnh).');
      return;
    }
    if (!prompt.trim() && videoMode !== 'extend') {
      setError('Vui lòng nhập mô tả chuyển động video.');
      return;
    }

    if (!isFlow && !isMuse) {
      const hasRealKey = hasSyncGeminiCredentials() || (await hasRealGeminiCredentials());
      if (!hasRealKey) {
        handleSelectKey();
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setProgress(0);

    let statusInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // ── 1. Google Flow (Omni 1.2 Flash / Veo 3.1 Lite) path ──────────────────
      if (isFlow && videoMode !== 'extend' && videoMode !== 'edit') {
        let isLocalFlowActive = await isFlowBackendAvailable().catch(() => false);

        if (!isLocalFlowActive && isLanOrLocalHostname(window.location.hostname)) {
          try {
            setStatus('Đang khởi động Google Flow Local Backend...');
            await fetch('/api/start-flow-backend', { method: 'POST' }).catch(() => null);
            for (let i = 0; i < 7; i++) {
              await new Promise((r) => setTimeout(r, 1000));
              isLocalFlowActive = await isFlowBackendAvailable(true);
              if (isLocalFlowActive) break;
            }
          } catch {
            // Ignore
          }
        }

        if (isLocalFlowActive) {
          setStatus(`Đang kết nối Google Flow (${flowVideoModel === FLOW_MODEL_IDS.VIDEO_VEO_LITE ? 'Veo 3.1 Lite' : 'Omni 1.2 Flash'})...`);
          const url = await generateVideoViaFlow(
            {
              prompt: prompt.trim(),
              aspectRatio,
              duration,
              model: flowVideoModel,
              mode: videoMode === 'interpolation' ? 'interpolation' : videoMode === 'ingredients' ? 'ingredients' : 'standard',
              resolution: flowResolution,
              referenceImageBase64: videoMode === 'ingredients' ? undefined : image || undefined,
              referenceImageMime: 'image/jpeg',
              endFrameBase64: videoMode === 'interpolation' ? endFrameImage || undefined : undefined,
              endFrameMime: 'image/jpeg',
              referenceImagesBase64: videoMode === 'ingredients' ? ingredientImages : undefined,
            },
            (prog, message) => {
              setProgress(prog);
              setStatus(message);
            }
          );
          if (url) {
            setVideoUrl(url);
            addToHistory({ url, prompt, mode: 'VIDEO_GENERATOR', type: 'video' });
            toast.success('Đã tạo xong video qua Google Flow và lưu vào Lịch sử!');
            return;
          } else {
            setError('Google Flow không trả về video.');
            return;
          }
        } else {
          const canFallbackGemini = await hasRealGeminiCredentials();
          if (canFallbackGemini) {
            toast.info('⚡ Google Flow Backend chưa kết nối, tự động chuyển sang Gemini Omni 1.2 Flash...');
          } else {
            window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'flow' } }));
            throw new Error(buildFlowUnavailableMessage());
          }
        }
      } else if (isFlow && (videoMode === 'extend' || videoMode === 'edit')) {
        const canUseGemini = await hasRealGeminiCredentials();
        if (!canUseGemini) {
          window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'google' } }));
          throw new Error('Tính năng Nối dài & Sửa Video trực tiếp sử dụng mô hình Gemini Omni 1.2 Flash (cần Gemini API Key).');
        }
        toast.info('Đang xử lý Nối dài / Sửa Video bằng Gemini Omni 1.2 Flash...');
      }

      // ── 2. Muse AI path ──────────────────────────────────────────────────────
      if (isMuse) {
        setStatus('Đang gửi yêu cầu tạo video tới Muse.ai...');
        setProgress(10);
        const primaryRef = videoMode === 'ingredients' ? ingredientImages[0] : image;
        const refImgPayload = primaryRef
          ? primaryRef.startsWith('data:')
            ? primaryRef
            : `data:image/jpeg;base64,${primaryRef}`
          : undefined;
        const effectivePrompt = prompt.trim() || 'Cinematic dramatic camera movement, high quality 4k video';
        const url = await generateVideoViaMuse(
          {
            prompt: effectivePrompt,
            duration,
            aspectRatio,
            referenceImage: refImgPayload,
          },
          (prog, message) => {
            setProgress(prog);
            setStatus(message);
          }
        );
        if (url) {
          setVideoUrl(url);
          setProgress(100);
          addToHistory({ url, prompt: effectivePrompt, mode: 'VIDEO_GENERATOR', type: 'video' });
          toast.success('Đã tạo xong video Muse và lưu vào Lịch sử!');
          return;
        } else {
          setError('Muse không trả về video.');
          return;
        }
      }

      // ── 3. Gemini Omni 1.2 Flash / Veo 3.1 Lite Cloud path ───────────────────
      const activeApiModel =
        videoMode !== 'standard' ? 'gemini-omni-1.2-flash' : geminiVideoModel;
      setStatus(
        activeApiModel === 'gemini-omni-1.2-flash'
          ? 'Đang khởi tạo tiến trình với Gemini Omni 1.2 Flash...'
          : 'Đang khởi tạo tiến trình với Veo 3.1 Lite...'
      );
      let currentProgress = 8;
      setProgress(currentProgress);

      statusInterval = setInterval(() => {
        const messages = [
          'Omni 1.2 Flash đang phân tích bố cục & chuyển động...',
          'Đang tổng hợp khung hình đồng nhất nhân vật...',
          'Đang xử lý ánh sáng vật lý và âm thanh đồng bộ...',
          'Đang hoàn thiện chất lượng video đầu ra...',
        ];
        setStatus(messages[Math.floor(Math.random() * messages.length)]);
        currentProgress = Math.min(94, currentProgress + Math.random() * 6);
        setProgress(currentProgress);
      }, 4500);

      const url = await geminiService.generateVideo(
        prompt.trim() || 'Smoothly continue the cinematic motion',
        image || undefined,
        {
          model: activeApiModel,
          mode: videoMode,
          resolution: geminiResolution,
          aspectRatio,
          duration,
          endFrameBase64: videoMode === 'interpolation' ? endFrameImage || undefined : undefined,
          referenceImagesBase64: videoMode === 'ingredients' ? ingredientImages : undefined,
          sourceVideoBase64: videoMode === 'extend' || videoMode === 'edit' ? sourceVideoData || undefined : undefined,
          regenerateAudio,
        }
      );
      setProgress(100);

      if (url) {
        setVideoUrl(url);
        addToHistory({ url, prompt: prompt || 'Omni 1.2 Video', mode: 'VIDEO_GENERATOR', type: 'video' });
        toast.success('Đã tạo xong video và lưu vào Lịch sử!');
      } else {
        setError('Không nhận được kết quả video từ máy chủ.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo video.');
    } finally {
      if (statusInterval) clearInterval(statusInterval);
      setIsGenerating(false);
    }
  };

  const resetAll = () => {
    setVideoUrl(null);
    setPrompt('');
    setImage(null);
    setEndFrameImage(null);
    setIngredientImages([]);
    setSourceVideoData(null);
    setSourceVideoName('');
    setError(null);
  };

  const videoIntrinsicWidth = aspectRatio === '16:9' ? 1280 : 720;
  const videoIntrinsicHeight = aspectRatio === '16:9' ? 720 : 1280;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto w-full space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> Thế hệ mới • Omni 1.2 Flash & Veo 3.1
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 uppercase tracking-tighter">
            AI Video Studio 2.0
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
            Dựng video thời trang có âm thanh, nội suy Khung Đầu–Cuối, giữ đồng nhất 6 ảnh Thành phần & Nối dài tới 30s
          </p>
        </div>

        <form onSubmit={generateVideo} className="grid grid-cols-1 lg:grid-cols-12 gap-8" noValidate>
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Engine Selector Tablist */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 block">
                1. Nền tảng AI Video
              </span>
              <div
                role="tablist"
                aria-label="Chọn nền tảng AI tạo video"
                className="flex overflow-x-auto no-scrollbar rounded-xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedVideoModel === 'flow'}
                  onClick={() => setSelectedVideoModel('flow')}
                  className={`flex-none flex-1 min-w-[100px] py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 relative ${
                    selectedVideoModel === 'flow'
                      ? 'bg-emerald-500/15 text-emerald-400 border-b-2 border-emerald-500'
                      : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                  }`}
                >
                  <Globe size={12} /> Google Flow
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedVideoModel === 'gemini'}
                  onClick={() => setSelectedVideoModel('gemini')}
                  className={`flex-none flex-1 min-w-[110px] py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 relative ${
                    selectedVideoModel === 'gemini'
                      ? 'bg-orange-500/15 text-orange-400 border-b-2 border-orange-500'
                      : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                  }`}
                >
                  <Sparkles size={12} /> Omni 1.2 API
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedVideoModel === 'muse'}
                  onClick={() => {
                    setSelectedVideoModel('muse');
                    if (videoMode !== 'standard') setVideoMode('standard');
                  }}
                  className={`flex-none flex-1 min-w-[95px] py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 relative ${
                    selectedVideoModel === 'muse'
                      ? 'bg-pink-500/15 text-pink-400 border-b-2 border-pink-500'
                      : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                  }`}
                >
                  <Film size={12} /> Muse {museAccountsCount > 0 ? `(${museAccountsCount})` : ''}
                </button>
              </div>
            </div>

            {/* 2. Creation Mode Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 block">
                2. Chế độ Dựng Video
              </span>
              <div
                role="tablist"
                aria-label="Chế độ dựng video"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
              >
                {[
                  { id: 'standard', label: 'Chuẩn', icon: Play, museOk: true },
                  { id: 'interpolation', label: 'Đầu & Cuối', icon: ArrowLeftRight, museOk: false },
                  { id: 'ingredients', label: '6 Thành phần', icon: Layers, museOk: false },
                  { id: 'extend', label: 'Nối / Sửa', icon: Scissors, museOk: false },
                ].map((m) => {
                  const active =
                    m.id === 'extend'
                      ? videoMode === 'extend' || videoMode === 'edit'
                      : videoMode === m.id;
                  const disabled = selectedVideoModel === 'muse' && !m.museOk;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="tab"
                      disabled={disabled}
                      aria-selected={active}
                      onClick={() => {
                        const target = m.id as VideoCreationMode;
                        setVideoMode(target);
                        if (target === 'extend' && selectedVideoModel !== 'gemini') {
                          setSelectedVideoModel('gemini');
                          setGeminiVideoModel('gemini-omni-1.2-flash');
                        }
                      }}
                      className={`py-2 px-2 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                        active
                          ? 'bg-white/10 border-orange-500 text-white border-b-2'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <Icon size={13} className={active ? 'text-orange-400' : 'text-slate-400'} />
                      <span className="truncate max-w-full">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Prompt Input + AI Enhance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label
                  htmlFor="video-prompt-input"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"
                >
                  <Wand2 className="w-3 h-3 text-orange-500" />
                  {videoMode === 'edit'
                    ? 'Lệnh chỉnh sửa Video'
                    : videoMode === 'extend'
                    ? 'Mô tả cảnh nối tiếp (Tùy chọn)'
                    : 'Mô tả chuyển động & âm thanh'}
                </label>
                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={!prompt.trim() || isEnhancingPrompt}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  {isEnhancingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Tối ưu AI
                </button>
              </div>
              <textarea
                id="video-prompt-input"
                name="prompt"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  videoMode === 'interpolation'
                    ? 'Ví dụ: Máy quay lia mượt từ dáng đứng sang dáng xoay người trên sàn diễn thời trang, tà váy lụa tung bay kèm tiếng nhạc runway nhẹ...'
                    : videoMode === 'edit'
                    ? 'Ví dụ: Đổi bối cảnh sang đường phố Paris lúc hoàng hôn vàng ấm, giữ nguyên người mẫu và trang phục...'
                    : 'Ví dụ: Người mẫu bước đi tự tin trên sàn catwalk, chất vải bay mềm mại dưới ánh đèn studio điện ảnh...'
                }
                className="w-full h-28 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500/60 transition-all font-medium"
              />
            </div>

            {/* 4. Contextual Media Inputs by Mode */}
            {videoMode === 'standard' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Upload className="w-3 h-3 text-orange-500" />
                    Ảnh mở đầu (Tùy chọn)
                  </span>
                  {workspaceAsset && workspaceAsset.type !== 'video' && (
                    <button
                      type="button"
                      onClick={() => setImage(workspaceAsset.url.includes(',') ? workspaceAsset.url.split(',')[1] : workspaceAsset.url)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all"
                    >
                      <Box size={10} /> Lấy từ Workspace
                    </button>
                  )}
                </div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-36 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-orange-500/50 transition-all"
                >
                  {image ? (
                    <div className="relative w-full h-full">
                      <img
                        src={image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`}
                        className="w-full h-full object-contain bg-black/30"
                        alt="Ảnh mở đầu"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImage(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full shadow-lg transition-all z-10"
                        aria-label="Xóa ảnh mở đầu"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Upload className="w-6 h-6 text-slate-500 mb-1.5 group-hover:scale-110 transition-transform" />
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bấm tải ảnh mở đầu</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
              </div>
            )}

            {videoMode === 'interpolation' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Khung Đầu & Khung Cuối (3s–10s)
                  </span>
                  <button
                    type="button"
                    onClick={swapKeyframes}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[9px] font-bold uppercase"
                  >
                    <ArrowLeftRight size={11} /> Đảo khung
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Start Frame */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-emerald-500/50 transition-all"
                  >
                    {image ? (
                      <>
                        <img
                          src={image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`}
                          className="w-full h-full object-cover"
                          alt="Khung bắt đầu"
                        />
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-black text-emerald-400 uppercase">
                          Bắt đầu
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImage(null);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full"
                          aria-label="Xóa khung bắt đầu"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-2 text-center">
                        <Upload className="w-5 h-5 text-emerald-400/70 mb-1" />
                        <span className="text-[8px] font-black text-slate-400 uppercase">1. Khung Bắt Đầu</span>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  </div>

                  {/* End Frame */}
                  <div
                    onClick={() => endFrameInputRef.current?.click()}
                    className="relative h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden group cursor-pointer hover:border-orange-500/50 transition-all"
                  >
                    {endFrameImage ? (
                      <>
                        <img
                          src={endFrameImage.startsWith('data:') ? endFrameImage : `data:image/jpeg;base64,${endFrameImage}`}
                          className="w-full h-full object-cover"
                          alt="Khung kết thúc"
                        />
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-black text-orange-400 uppercase">
                          Kết thúc
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEndFrameImage(null);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full"
                          aria-label="Xóa khung kết thúc"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-2 text-center">
                        <Upload className="w-5 h-5 text-orange-400/70 mb-1" />
                        <span className="text-[8px] font-black text-slate-400 uppercase">2. Khung Kết Thúc</span>
                      </div>
                    )}
                    <input type="file" ref={endFrameInputRef} onChange={handleEndFrameChange} className="hidden" accept="image/*" />
                  </div>
                </div>
              </div>
            )}

            {videoMode === 'ingredients' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Ảnh Thành Phần ({ingredientImages.length}/6 — Mẫu, Áo, Quần, Bối cảnh)
                  </span>
                  {ingredientImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIngredientImages([])}
                      className="text-[9px] font-bold text-red-400 hover:underline"
                    >
                      Xóa hết
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ingredientImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/30">
                      <img
                        src={img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}
                        className="w-full h-full object-cover"
                        alt={`Thành phần ${idx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => setIngredientImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full"
                        aria-label={`Xóa thành phần ${idx + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {ingredientImages.length < 6 && (
                    <button
                      type="button"
                      onClick={() => ingredientsInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-orange-400 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[8px] font-black uppercase">Thêm ảnh</span>
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={ingredientsInputRef}
                  onChange={handleIngredientsChange}
                  className="hidden"
                  accept="image/*"
                  multiple
                />
              </div>
            )}

            {(videoMode === 'extend' || videoMode === 'edit') && (
              <div className="p-3.5 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
                    Hậu kỳ Video với Omni 1.2 Flash
                  </span>
                  <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setVideoMode('extend')}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                        videoMode === 'extend' ? 'bg-orange-500 text-white' : 'text-slate-400'
                      }`}
                    >
                      Nối dài (+3–10s)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoMode('edit')}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                        videoMode === 'edit' ? 'bg-orange-500 text-white' : 'text-slate-400'
                      }`}
                    >
                      Chỉnh sửa Clip
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => sourceVideoInputRef.current?.click()}
                  className="p-3 rounded-xl bg-black/30 border border-dashed border-white/15 hover:border-orange-500/50 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Film className="w-5 h-5 text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {sourceVideoData ? sourceVideoName || 'Đã nạp video gốc' : 'Bấm để chọn file video (.mp4)'}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {videoMode === 'extend'
                          ? 'Nối dài mượt mà tới tối đa 30 giây tích lũy'
                          : 'Đổi bối cảnh, ánh sáng hoặc phong cách video'}
                      </p>
                    </div>
                  </div>
                  {sourceVideoData && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceVideoData(null);
                        setSourceVideoName('');
                      }}
                      className="p-1 text-slate-400 hover:text-red-400"
                      aria-label="Xóa video gốc"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <input
                    type="file"
                    ref={sourceVideoInputRef}
                    onChange={handleSourceVideoUpload}
                    className="hidden"
                    accept="video/mp4,video/webm,video/quicktime"
                  />
                </div>

                {videoMode === 'edit' && (
                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      id="regenerate-audio-toggle"
                      name="regenerateAudio"
                      checked={regenerateAudio}
                      onChange={(e) => setRegenerateAudio(e.target.checked)}
                      className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                    />
                    <label
                      htmlFor="regenerate-audio-toggle"
                      className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 size={12} className="text-orange-400" />
                      Tái tạo âm thanh mới khớp bối cảnh vừa sửa
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 5. Engine-Specific Model, Aspect Ratio, Resolution & Duration Settings */}
            {selectedVideoModel === 'flow' && (
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                <div>
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block mb-1.5">
                    Mô hình Google Flow (Cập nhật 11/2026)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: FLOW_MODEL_IDS.VIDEO_OMNI_1_2_FLASH,
                        name: 'Omni 1.2 Flash',
                        badge: 'Mới + Audio',
                        desc: 'Mặc định mới thay thế bản 05/12',
                      },
                      {
                        id: FLOW_MODEL_IDS.VIDEO_VEO_LITE,
                        name: 'Veo 3.1 Lite',
                        badge: 'Lite',
                        desc: 'Render nhanh & ổn định',
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFlowVideoModel(m.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          flowVideoModel === m.id
                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                            : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold">{m.name}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-mono">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-400 truncate mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Tỷ lệ</span>
                    <div className="flex gap-1">
                      {(['16:9', '9:16'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setAspectRatio(r)}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                            aspectRatio === r ? 'bg-emerald-500 text-white' : 'bg-black/30 text-slate-400'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Độ nét</span>
                    <div className="flex gap-1">
                      {(['720p', '360p'] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setFlowResolution(res)}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                            flowResolution === res ? 'bg-emerald-500 text-white' : 'bg-black/30 text-slate-400'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Thời lượng</span>
                    <div className="grid grid-cols-2 gap-1">
                      {[8, 10].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setDuration(sec)}
                          className={`py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                            duration === sec ? 'bg-emerald-500 text-white' : 'bg-black/30 text-slate-400'
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

            {selectedVideoModel === 'gemini' && (
              <div className="p-3.5 bg-orange-500/5 rounded-2xl border border-orange-500/20 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: 'gemini-omni-1.2-flash' as const,
                      name: 'Omni 1.2 Flash',
                      badge: '4K + Audio',
                      desc: '3s–15s, Đa khung hình & Hậu kỳ',
                    },
                    {
                      id: 'veo-3.1-lite-generate-preview' as const,
                      name: 'Veo 3.1 Lite',
                      badge: '1080p',
                      desc: 'Cơ bản (Chỉ hỗ trợ chế độ Chuẩn)',
                    },
                  ].map((m) => {
                    const disabled = m.id === 'veo-3.1-lite-generate-preview' && videoMode !== 'standard';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setGeminiVideoModel(m.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          geminiVideoModel === m.id
                            ? 'bg-orange-500/20 border-orange-500 text-white'
                            : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold">{m.name}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-300 font-mono">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-400 truncate mt-0.5">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Tỷ lệ khung</span>
                    <div className="flex gap-1.5">
                      {(['16:9', '9:16'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setAspectRatio(r)}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                            aspectRatio === r ? 'bg-orange-500 text-white' : 'bg-black/30 text-slate-400'
                          }`}
                        >
                          {r === '16:9' ? '16:9 Ngang' : '9:16 Dọc'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Độ phân giải</span>
                    <div className="grid grid-cols-4 gap-1">
                      {(['360p', '720p', '1080p', '4k'] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setGeminiResolution(res)}
                          className={`py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                            geminiResolution === res ? 'bg-orange-500 text-white' : 'bg-black/30 text-slate-400'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {geminiVideoModel === 'gemini-omni-1.2-flash' && (
                  <div className="pt-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="omni-duration-slider"
                        className="text-[9px] font-black text-slate-400 uppercase tracking-wider"
                      >
                        Thời lượng chính xác (3s – {maxAllowedDuration}s)
                      </label>
                      <span className="text-xs font-black text-orange-400 font-mono">{duration}s</span>
                    </div>
                    <input
                      id="omni-duration-slider"
                      name="duration"
                      type="range"
                      min={3}
                      max={maxAllowedDuration}
                      step={1}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedVideoModel === 'muse' && (
              <div className="p-3.5 bg-pink-500/5 rounded-2xl border border-pink-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-pink-400 uppercase tracking-wider block">
                      Mô hình Muse Video (muse.ai)
                    </span>
                    <p className="text-[9px] text-slate-400">Text-to-Video & Image-to-Video 5s–10s.</p>
                  </div>
                  <a
                    href={museAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-600/80 hover:bg-pink-600 text-white text-[8px] font-black uppercase tracking-wider transition-all"
                  >
                    <span>Cookie ({museAccountsCount})</span>
                    <ExternalLink size={9} />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
                  <div className="flex gap-1.5">
                    {(['16:9', '9:16'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAspectRatio(r)}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                          aspectRatio === r ? 'bg-pink-500 text-white' : 'bg-black/30 text-slate-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 6, 8, 10].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDuration(sec)}
                        className={`py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                          duration === sec ? 'bg-pink-500 text-white' : 'bg-black/30 text-slate-400'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 ${
                selectedVideoModel === 'muse'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 shadow-pink-500/20'
                  : selectedVideoModel === 'flow'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-orange-500 to-red-600 shadow-orange-500/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang dựng video ({progress.toFixed(0)}%)...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  {selectedVideoModel === 'flow'
                    ? 'Tạo Video với Google Flow'
                    : selectedVideoModel === 'muse'
                    ? 'Tạo Video với Muse AI'
                    : 'Tạo Video với Omni 1.2 Flash'}
                </>
              )}
            </button>
          </div>

          {/* Right Column: Video Player & Post-Production Actions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-video bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-2xl">
              <AnimatePresence mode="wait">
                {videoUrl ? (
                  <motion.video
                    key={videoUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={videoUrl}
                    width={videoIntrinsicWidth}
                    height={videoIntrinsicHeight}
                    controls
                    playsInline
                    preload="metadata"
                    autoPlay={!prefersReducedMotion}
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : isGenerating ? (
                  <motion.div
                    key="loading"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
                  >
                    <div className="relative mb-6">
                      <div className="w-20 h-20 border-4 border-orange-500/20 rounded-full animate-ping absolute inset-0" />
                      <div className="w-20 h-20 border-4 border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                      <Film className="w-9 h-9 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <h4 className="text-base font-black text-white uppercase tracking-tight mb-1.5">
                      AI Video Studio đang kết xuất
                    </h4>
                    <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-5 max-w-md">
                      {status}
                    </p>
                    <div className="w-full max-w-xs bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">
                      {progress.toFixed(0)}%
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center p-8"
                  >
                    <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-5 relative">
                      <Film className="w-10 h-10 text-slate-600" />
                      <div className="absolute -top-2 -right-2 bg-white p-2 rounded-xl shadow-xl rotate-12">
                        <Sparkles className="w-4 h-4 text-orange-500" />
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                      Hỗ trợ Omni 1.2 Flash có âm thanh thực, nội suy Khung Đầu–Cuối, giữ nhân vật với 6 ảnh Thành phần & Nối dài clip tới 30s
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Post-generation Omni 1.2 Flash Quick Actions */}
            {videoUrl && (
              <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 items-center justify-between">
                <span className="text-[10px] font-black text-orange-300 uppercase tracking-wider px-1">
                  Hậu kỳ nhanh (Omni 1.2 Flash):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadGeneratedVideoForPostEdit('extend')}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <Plus size={12} /> Nối dài thêm +5s
                  </button>
                  <button
                    type="button"
                    onClick={() => loadGeneratedVideoForPostEdit('edit')}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <Scissors size={12} /> Đổi bối cảnh / Sửa video
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetAll}
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
              <button
                type="button"
                onClick={() => videoUrl && addToWorkspace({ url: videoUrl, prompt, mode: 'VIDEO_GENERATOR', type: 'video' })}
                disabled={!videoUrl}
                className={`flex-1 py-3.5 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${
                  !videoUrl ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Share2 className="w-4 h-4" />
                Workspace
              </button>
              <a
                href={videoUrl || '#'}
                download={`omni_video_${Date.now()}.mp4`}
                className={`flex-1 py-3.5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${
                  !videoUrl ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Download className="w-4 h-4" />
                Tải video
              </a>
            </div>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-3 text-red-400 animate-in slide-in-from-bottom-2"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide">
                  {error.includes('FLOW_BACKEND_UNAVAILABLE')
                    ? 'Google Flow Backend chưa kết nối'
                    : 'Đã xảy ra lỗi khi tạo video'}
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
                  setGeminiVideoModel('gemini-omni-1.2-flash');
                  setError(null);
                  toast.success('Đã chuyển sang mô hình Gemini Omni 1.2 Flash (API).');
                  if (!hasSyncGeminiCredentials()) {
                    window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'google' } }));
                  }
                }}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[11px] font-bold transition-all shadow-md active:scale-95"
              >
                Chuyển sang Gemini Omni 1.2 Flash (API)
              </button>
              {usingFlow && isLanOrLocalHostname(window.location.hostname) && (
                <button
                  type="button"
                  onClick={() => {
                    toast.promise(
                      fetch('/api/start-flow-backend', { method: 'POST' }).then((res) => res.json()),
                      {
                        loading: 'Đang khởi động Local Backend...',
                        success: (data) => data.message || 'Đã khởi động Local Backend!',
                        error: 'Không thể khởi động Local Backend',
                      }
                    );
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-[11px] font-medium transition-all border border-white/10"
                >
                  💻 Bật Local Backend
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default VideoGenerator;
