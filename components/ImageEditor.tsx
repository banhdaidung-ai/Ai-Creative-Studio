
import React, { useState, useRef, useEffect } from 'react';
import { geminiService, MODEL_OPTIONS } from '../services/gemini';
import { resizeImage, smoothImage, padImageToRatio, unpadImage } from '../utils/image';
import { saveState, loadState } from '../utils/storage';
import PhotoEditor from './PhotoEditor';
import { ModelSelector } from './ModelSelector';
import { 
  X, Loader2, Sparkles, Image as ImageIcon, Key, 
  Zap, Download, Columns, History,
  Upload, Clock, Maximize2, ZoomIn, ZoomOut, AlertCircle, Wand2, ChevronsUp,
  Settings2, ChevronUp, ChevronDown, Crown, Sliders,
  Plus, Check, Trash2, Search, Eraser, BookOpen, Info, ArrowLeftRight
} from 'lucide-react';

interface HistoryItem {
  id: string;
  timestamp: number;
  resultImage: string;
  modelImage: string;
  refImages: string[];
  prompt: string;
  aspectRatio: string;
}

const STORAGE_KEY = 'yody_editor_state_v1';
const REF_LIB_KEY = 'yody_ref_library_v1';

const ImageEditor: React.FC = () => {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [refLibrary, setRefLibrary] = useState<string[]>([]);
  const [showLib, setShowLib] = useState(false);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isSmoothing, setIsSmoothing] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [showUpscaleMenu, setShowUpscaleMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [timer, setTimer] = useState(0);
  const [modelTier, setModelTier] = useState<'standard' | 'pro'>('pro');
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.1-flash-image-preview');
  const [aspectRatio, setAspectRatio] = useState('Auto');
  const [detectedRatio, setDetectedRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showConfig, setShowConfig] = useState(true);
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("ĐANG KHỞI TẠO...");

  const modelInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const isLoadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initData = async () => {
        try {
            const savedState = await loadState(STORAGE_KEY);
            if (savedState) {
                if (savedState.modelImage) setModelImage(savedState.modelImage);
                if (savedState.refImages) setRefImages(savedState.refImages);
                if (savedState.resultImage) setResultImage(savedState.resultImage);
                if (savedState.prompt) setPrompt(savedState.prompt);
                if (savedState.modelTier) setModelTier(savedState.modelTier);
                if (savedState.aspectRatio) setAspectRatio(savedState.aspectRatio);
                if (savedState.imageSize) setImageSize(savedState.imageSize);
            }
            const savedLib = await loadState(REF_LIB_KEY);
            if (savedLib) setRefLibrary(savedLib);
        } catch (e) {
            console.warn("Failed to load state", e);
        } finally {
            isLoadedRef.current = true;
        }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    const timeoutId = setTimeout(async () => {
      try {
        const stateToSave = { modelImage, refImages, resultImage, prompt, modelTier, aspectRatio, imageSize };
        await saveState(STORAGE_KEY, stateToSave);
      } catch (e) {
        console.error("Failed to save state to IndexedDB", e);
      }
    }, 1000); 
    return () => clearTimeout(timeoutId);
  }, [modelImage, refImages, resultImage, prompt, modelTier, aspectRatio, imageSize]);

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
    
    // Listen for storage changes (if user updates key in another tab or modal)
    const handleKeyUpdate = () => {
        if (localStorage.getItem('gemini_api_key')) {
            setApiKeySelected(true);
        } else {
            // Re-check project key as well
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

  useEffect(() => {
    let interval: any;
    if (isLoading || isSmoothing || isUpscaling) interval = setInterval(() => setTimer(t => t + 0.1), 100);
    else setTimer(0);
    return () => clearInterval(interval);
  }, [isLoading, isSmoothing, isUpscaling]);

  // UX Improvement: Dynamic Status Messages based on Timer and Resolution
  useEffect(() => {
    if (!isLoading) return;

    if (imageSize === '4K') {
        if (timer < 5) setLoadingMessage("KẾT NỐI SERVER 4K...");
        else if (timer < 15) setLoadingMessage("PHÁC THẢO BỐ CỤC...");
        else if (timer < 30) setLoadingMessage("XỬ LÝ ÁNH SÁNG & TEXTURE...");
        else if (timer < 45) setLoadingMessage("TỐI ƯU HÓA ĐỘ PHÂN GIẢI...");
        else setLoadingMessage("HOÀN THIỆN CHI TIẾT CUỐI...");
    } else if (imageSize === '2K') {
        if (timer < 5) setLoadingMessage("KẾT NỐI SERVER...");
        else if (timer < 15) setLoadingMessage("ĐANG VẼ CHI TIẾT...");
        else setLoadingMessage("ĐANG HOÀN THIỆN...");
    } else {
         if (timer < 3) setLoadingMessage("ĐANG TẠO...");
         else setLoadingMessage("ĐANG XỬ LÝ...");
    }
  }, [timer, isLoading, imageSize]);

  useEffect(() => {
    if (previewImage) { setZoom(1); setPan({ x: 0, y: 0 }); }
  }, [previewImage]);

  // Auto-expand prompt textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [prompt]);

  const getClosestRatio = (width: number, height: number): string => {
    const target = width / height;
    const ratios = [
      { name: "1:1", val: 1 },
      { name: "3:4", val: 3 / 4 },
      { name: "4:3", val: 4 / 3 },
      { name: "9:16", val: 9 / 16 },
      { name: "16:9", val: 16 / 9 }
    ];
    return ratios.reduce((prev, curr) => 
      Math.abs(curr.val - target) < Math.abs(prev.val - target) ? curr : prev
    ).name;
  };

  const processFiles = async (files: FileList | File[], type: 'model' | 'ref') => {
    try {
        const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (fileArray.length === 0) return;

        if (type === 'model') {
            const file = fileArray[0];
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.src = objectUrl;
            img.onload = () => {
              const closest = getClosestRatio(img.width, img.height);
              setDetectedRatio(closest);
              if (aspectRatio === 'Auto') {
                // Keep it as Auto, but detectedRatio is updated
              }
              URL.revokeObjectURL(objectUrl);
            };

            const base64 = await resizeImage(file, 2048, 'image/png');
            setModelImage(base64);
            setResultImage(null);
            if (modelInputRef.current) modelInputRef.current.value = '';
        } else {
            const base64s = await Promise.all(fileArray.map(f => resizeImage(f, 1024, 'image/jpeg', 0.8)));
            setRefImages(prev => [...prev, ...base64s]);
            base64s.forEach(b => addToLibrary(b));
            if (refInputRef.current) refInputRef.current.value = '';
        }
    } catch (err) {
        console.error("Error processing images:", err);
        setError("Lỗi xử lý ảnh. Có thể do file quá lớn hoặc không đúng định dạng.");
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
        if (!isLoadedRef.current) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length > 0) {
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

            if (!modelImage) {
                await processFiles([files[0]], 'model');
                if (files.length > 1) await processFiles(files.slice(1), 'ref');
            } else {
                await processFiles(files, 'ref');
            }
        }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [modelImage]);

  const handleDragOver = (e: React.DragEvent, type: 'model' | 'ref') => {
    e.preventDefault(); e.stopPropagation();
    if (type === 'model') setIsDraggingModel(true); else setIsDraggingRef(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'model' | 'ref') => {
    e.preventDefault(); e.stopPropagation();
    if (type === 'model') setIsDraggingModel(false); else setIsDraggingRef(false);
  };

  const handleDrop = async (e: React.DragEvent, type: 'model' | 'ref') => {
    e.preventDefault(); e.stopPropagation();
    if (type === 'model') setIsDraggingModel(false); else setIsDraggingRef(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) await processFiles(e.dataTransfer.files, type);
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancingPrompt(true);
    try {
        const ai = geminiService.getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Rewrite the following simple image generation prompt into a detailed, professional, and descriptive fashion photography prompt. Keep it in English. 
            Original: "${prompt}"`,
            config: { temperature: 0.7 }
        });
        if (response.text) setPrompt(response.text.trim());
    } catch (e) {
        console.error("Enhance failed", e);
    } finally {
        setIsEnhancingPrompt(false);
    }
  };

  const playSuccessSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        
        // C Major Arpeggio (C5, E5, G5, C6) for a "Magical/Success" chime
        const notes = [523.25, 659.25, 783.99, 1046.50];
        
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // 'triangle' wave has more harmonics than 'sine', making it clearer/brighter/louder
            osc.type = 'triangle'; 
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            const startTime = now + (i * 0.08); // Faster arpeggio
            
            // Envelope
            gain.gain.setValueAtTime(0, startTime);
            // Increased volume to 0.4 (was 0.1)
            gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05); 
            // Longer decay for a bell-like ring
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.2);
            
            osc.start(startTime);
            osc.stop(startTime + 1.2);
        });
    } catch (e) {
        console.error("Audio play failed", e);
    }
  };

  const handleGenerate = async () => {
    // Final check for manual key before asking for project key
    const hasManualKey = !!localStorage.getItem('gemini_api_key');
    if (modelTier === 'pro' && !apiKeySelected && !hasManualKey) { handleSelectKey(); return; }
    if (!modelImage && !prompt) { setError("Vui lòng tải ảnh mẫu hoặc nhập mô tả ý tưởng."); return; }
    setIsLoading(true); setError(null);
    if (window.innerWidth < 1024) setShowConfig(false);
    try {
        let resultBase64;
        const finalRatio = aspectRatio === 'Auto' ? detectedRatio : aspectRatio;
        
        let processedModelImage = modelImage;
        let paddingInfo = null;
        if (modelImage && finalRatio !== 'Auto') {
            // Pad image to match the target ratio exactly before sending to AI
            const padResult = await padImageToRatio(modelImage, finalRatio);
            processedModelImage = padResult.base64;
            paddingInfo = padResult.info;
        }

        if (modelImage) resultBase64 = await geminiService.editImage(processedModelImage!, prompt, refImages, { modelTier, aspectRatio: finalRatio, imageSize, modelId: selectedModelId });
        else resultBase64 = await geminiService.generateImage(prompt, { modelTier, aspectRatio: finalRatio, imageSize, modelId: selectedModelId }, refImages);
        
        if (resultBase64 && paddingInfo) {
            // Unpad (crop) the result back to original dimensions
            resultBase64 = await unpadImage(resultBase64, paddingInfo);
        }
        if (resultBase64) {
          playSuccessSound(); // Play enhanced chime on success
          setResultImage(resultBase64);
          setHistory(prev => [{ id: Date.now().toString(), timestamp: Date.now(), resultImage: resultBase64, modelImage: modelImage || '', refImages: [...refImages], prompt, aspectRatio: finalRatio }, ...prev].slice(0, 20));
        } else throw new Error("Không nhận được dữ liệu ảnh.");
    } catch (err: any) { setError(err.message || "Lỗi khi tạo ảnh."); } finally { setIsLoading(false); }
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setModelImage(item.modelImage || null);
    setRefImages(item.refImages);
    setPrompt(item.prompt);
    setAspectRatio(item.aspectRatio);
    setResultImage(item.resultImage);
    setIsComparing(false);
  };

  const handleSelectKey = async () => { if (window.aistudio?.openSelectKey) { try { await window.aistudio.openSelectKey(); setApiKeySelected(true); } catch (e) {} } };

  const addToLibrary = (base64: string) => {
    setRefLibrary(prev => {
        if (prev.includes(base64)) return prev;
        const newLib = [base64, ...prev].slice(0, 30);
        saveState(REF_LIB_KEY, newLib).catch(console.warn);
        return newLib; 
    });
  };

  const removeFromLibrary = (img: string) => {
    setRefLibrary(prev => {
      const newLib = prev.filter(i => i !== img);
      saveState(REF_LIB_KEY, newLib).catch(console.warn);
      return newLib;
    });
  };

  const toggleFromLib = (img: string) => {
      if (refImages.includes(img)) setRefImages(prev => prev.filter(i => i !== img));
      else setRefImages(prev => [...prev, img]);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (previewImage) {
        e.stopPropagation();
        const scaleAmount = -e.deltaY * 0.001;
        setZoom(Math.min(Math.max(1, zoom + scaleAmount), 8));
        if (zoom <= 1) setPan({ x: 0, y: 0 });
    }
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (previewImage) {
        e.stopPropagation();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        if (zoom > 1) {
            setIsDraggingPreview(true);
            setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
        }
    }
  };

  const onDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDraggingPreview && zoom > 1) {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setPan({ x: clientX - dragStart.x, y: clientY - dragStart.y });
    }
  };

  const endDrag = () => setIsDraggingPreview(false);

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!comparisonRef.current) return;
    const rect = comparisonRef.current.getBoundingClientRect();
    let x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    setSliderPosition(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  const handleSmooth = async () => {
    if (!resultImage || isSmoothing) return;
    setIsSmoothing(true);
    setTimeout(async () => {
        try {
            const smoothed = await smoothImage(resultImage);
            setResultImage(smoothed);
        } catch (e) {
            setError("Lỗi khi làm mịn ảnh.");
        } finally {
            setIsSmoothing(false);
        }
    }, 50);
  };

  const handleUpscale = async (size: '2K' | '4K') => {
      if (!resultImage || isUpscaling) return;
      if (!apiKeySelected) { handleSelectKey(); return; }
      setIsUpscaling(true); setShowUpscaleMenu(false); setError(null);
      try {
          const upscaled = await geminiService.upscaleImage(resultImage, size, aspectRatio);
          if (upscaled) setResultImage(upscaled);
      } catch (e: any) { setError(e.message || "Upscaling failed."); } finally { setIsUpscaling(false); }
  };

  const supportedRatios = ["Auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"];

  return (
    <div ref={containerRef} className="h-full flex flex-col p-2 md:p-3 overflow-hidden relative outline-none" tabIndex={0}>
      <div className="mb-2 md:mb-2.5 flex justify-between items-center shrink-0 px-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 md:p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 transition-all hover:scale-110 active:rotate-12">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm md:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 leading-none">Chuyên gia tạo ảnh</h2>
            <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest text-blue-500">Ai.YODY.IO Creative Studio</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-2 md:gap-3 overflow-hidden">
        {/* Controls Column */}
        <div className={`w-full lg:w-[420px] flex flex-col gap-2 md:gap-3 transition-all duration-300 shrink-0 order-2 lg:order-1 ${showConfig ? 'h-auto max-h-[70vh] lg:max-h-none lg:h-full' : 'h-auto'}`}>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl p-4 md:p-6 rounded-[2.5rem] border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-6 flex-1 overflow-hidden ring-1 ring-inset ring-white/10">
                {/* Mobile Header Toggle */}
                <div className="flex items-center justify-between lg:hidden p-1 cursor-pointer" onClick={() => setShowConfig(!showConfig)}>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Settings2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cấu hình & Upload</span>
                    </div>
                    {showConfig ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </div>

                {showConfig && (
                    <div className="flex flex-col gap-6 overflow-y-auto no-scrollbar flex-1 pr-1">
                        <ModelSelector 
                            selectedModelId={selectedModelId}
                            onModelSelect={(id) => {
                                setSelectedModelId(id);
                                const model = MODEL_OPTIONS.find(m => m.id === id);
                                if (model) setModelTier(model.tier as any);
                                if (id.includes('pro') && !apiKeySelected) handleSelectKey();
                            }}
                        />

                        {/* ĐỘ PHÂN GIẢI & TỶ LỆ */}
                        <div className={`grid ${modelTier === 'pro' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 transition-all duration-300`}>
                            {modelTier === 'pro' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">ĐỘ PHÂN GIẢI</label>
                                    <div className="relative group">
                                        <select 
                                            value={imageSize} 
                                            onChange={(e) => setImageSize(e.target.value)}
                                            className="w-full bg-black/10 dark:bg-white/5 border border-white/10 dark:border-white/10 rounded-[1.2rem] py-3 px-4 text-[11px] font-black text-amber-600 dark:text-amber-400 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-amber-500/20 transition-all"
                                        >
                                            {['1K', '2K', '4K'].map(size => <option key={size} value={size}>{size}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-amber-500 transition-colors" />
                                    </div>
                                    {/* Warning for 4K Generation */}
                                    {modelTier === 'pro' && imageSize === '4K' && (
                                        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[9px] text-amber-500 font-medium leading-relaxed">
                                                Lưu ý: Ảnh 4K cần khoảng 40-60 giây để xử lý chi tiết siêu thực.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">TỶ LỆ</label>
                                <div className="relative group">
                                    <select 
                                        value={aspectRatio} 
                                        onChange={(e) => setAspectRatio(e.target.value)}
                                    className="w-full bg-black/10 dark:bg-white/5 border border-white/10 dark:border-white/10 rounded-[1.2rem] py-3 px-4 text-[11px] font-black text-blue-600 dark:text-blue-400 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    >
                                        {supportedRatios.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                                </div>
                            </div>
                        </div>
                        
                        {/* ẢNH NGƯỜI MẪU - COMPACT VERSION */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">ẢNH NGƯỜI MẪU (TÙY CHỌN)</label>
                            {modelImage ? (
                                <div className="relative flex items-center gap-4 p-3 bg-black/10 dark:bg-white/5 rounded-3xl border border-white/10 dark:border-white/10 animate-in slide-in-from-left-2">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-black/20 shrink-0">
                                        <img src={`data:image/png;base64,${modelImage}`} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate">Đã tải ảnh mẫu</p>
                                        <p className="text-[9px] text-slate-400">Sẵn sàng để tạo ảnh.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setPreviewImage(modelImage)} className="p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-slate-500 dark:text-white rounded-xl transition-all active:scale-90"><Maximize2 className="w-3.5 h-3.5"/></button>
                                        <button onClick={() => { setModelImage(null); setResultImage(null); }} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all active:scale-90"><X className="w-3.5 h-3.5"/></button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => modelInputRef.current?.click()} 
                                    onDragOver={(e) => handleDragOver(e, 'model')}
                                    onDragLeave={(e) => handleDragLeave(e, 'model')}
                                    onDrop={(e) => handleDrop(e, 'model')}
                                    className={`h-24 md:h-28 rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group ${isDraggingModel ? 'border-blue-500 bg-blue-50/50 shadow-inner' : 'border-white/10 dark:border-white/10 bg-black/10 dark:bg-white/5 hover:border-blue-400'}`}
                                >
                                    <div className="p-2 rounded-2xl bg-slate-100 dark:bg-white/5 mb-1 group-hover:scale-110 transition-transform">
                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">TẢI ẢNH MẪU</span>
                                </div>
                            )}
                            <input type="file" ref={modelInputRef} onChange={(e) => e.target.files && processFiles(e.target.files, 'model')} accept="image/*" className="hidden" />
                        </div>

                        {/* ẢNH THAM CHIẾU */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">ẢNH THAM CHIẾU ({refImages.length})</label>
                                <button 
                                    onClick={() => setShowLib(!showLib)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${showLib ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-500'}`}
                                >
                                    <BookOpen className="w-3 h-3" /> Thư viện
                                </button>
                            </div>

                            {!showLib ? (
                                <div 
                                    onClick={() => refInputRef.current?.click()}
                                    className={`flex gap-3 p-4 rounded-[2rem] bg-black/10 dark:bg-white/5 min-h-[100px] overflow-x-auto no-scrollbar shadow-inner border-2 border-transparent transition-all cursor-pointer ${isDraggingRef ? 'border-blue-500 ring-4 ring-blue-500/10' : 'hover:border-white/10 dark:hover:border-white/10'}`}
                                    onDragOver={(e) => handleDragOver(e, 'ref')}
                                    onDragLeave={(e) => handleDragLeave(e, 'ref')}
                                    onDrop={(e) => handleDrop(e, 'ref')}
                                >
                                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 flex flex-col items-center justify-center shrink-0 hover:bg-white hover:border-blue-400 dark:hover:bg-white/10 transition-all group">
                                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all" />
                                    </div>

                                    {refImages.map((img, idx) => (
                                        <div key={idx} className="relative w-16 h-16 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shrink-0 group shadow-sm hover:ring-2 hover:ring-blue-500/50 transition-all" onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }}>
                                            <img src={`data:image/png;base64,${img}`} className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); setRefImages(p => p.filter((_, i) => i !== idx)); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20 shadow-md"><X className="w-2.5 h-2.5" /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-black/10 dark:bg-white/5 rounded-[2rem] p-3 border-2 border-dashed border-white/10 dark:border-white/10">
                                    {refLibrary.length === 0 ? (
                                        <div className="text-center p-4 text-slate-400 text-[9px] font-bold uppercase">Thư viện trống</div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto no-scrollbar">
                                            {refLibrary.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group" onClick={() => toggleFromLib(img)}>
                                                    <img src={`data:image/png;base64,${img}`} className={`w-full h-full object-cover transition-all ${refImages.includes(img) ? 'opacity-50' : ''}`} />
                                                    {refImages.includes(img) && <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20"><Check className="w-4 h-4 text-white" /></div>}
                                                    <button onClick={(e) => { e.stopPropagation(); removeFromLibrary(img); }} className="absolute top-0.5 right-0.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"><X className="w-2 h-2" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <input type="file" ref={refInputRef} onChange={(e) => e.target.files && processFiles(e.target.files, 'ref')} accept="image/*" multiple className="hidden" />
                        </div>

                        {/* Ý TƯỞNG (PROMPT BUILDER) */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Ý TƯỞNG (PROMPT BUILDER)</label>
                            
                            <div className="relative group">
                                <textarea 
                                    ref={textareaRef}
                                    value={prompt} 
                                    onChange={(e) => setPrompt(e.target.value)} 
                                    className="w-full p-4 bg-black/10 dark:bg-white/5 rounded-[1.8rem] border border-white/10 dark:border-white/10 text-sm text-white dark:text-white outline-none min-h-[100px] shadow-inner focus:border-blue-500/50 transition-all resize-none leading-relaxed overflow-hidden" 
                                    placeholder="Mô tả ý tưởng của bạn tại đây..." 
                                />
                                <div className="absolute bottom-3 right-3 flex gap-2">
                                    <button 
                                        onClick={() => setPrompt('')} 
                                        className="p-2 bg-slate-100 dark:bg-black/60 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all active:scale-90"
                                        title="Xóa Prompt"
                                    >
                                        <Eraser className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={handleEnhancePrompt} 
                                        disabled={isEnhancingPrompt || !prompt.trim()}
                                        className={`p-2 rounded-xl transition-all flex items-center gap-2 px-4 ${isEnhancingPrompt ? 'bg-blue-50 text-blue-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 active:scale-95'}`}
                                    >
                                        {isEnhancingPrompt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                        <span className="text-[9px] font-black uppercase tracking-wider">Tối ưu</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showConfig && (
                    <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
                        {/* Generate Button - Sticky at the bottom of sidebar */}
                        <button onClick={handleGenerate} disabled={isLoading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shrink-0">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current text-amber-400" />}
                            <span>{isLoading ? `${loadingMessage} (${timer.toFixed(1)}s)` : "TẠO ẢNH NGAY"}</span>
                        </button>
                        
                        {error && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">{error}</p>
                          </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col overflow-hidden order-1 lg:order-2">
             {/* ... (Keep existing preview logic) ... */}
             <div className="flex-1 bg-black/20 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] relative overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center p-2 md:p-6 ring-1 ring-inset ring-white/10 min-h-0">
                 {isLoading && (
                    <div className="flex flex-col items-center animate-in fade-in">
                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4 shadow-2xl"></div>
                        <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{loadingMessage}</p>
                    </div>
                 )}
                 {resultImage && (
                    <div className="relative w-full h-full flex items-center justify-center group/result">
                        {isComparing && modelImage ? (
                            <div ref={comparisonRef} className="relative w-full h-full overflow-hidden rounded-[2rem] cursor-col-resize select-none" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove}>
                                <img src={`data:image/png;base64,${modelImage}`} className="absolute inset-0 w-full h-full object-contain" />
                                <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPosition}%` }}>
                                    <img src={`data:image/png;base64,${resultImage}`} className="absolute inset-0 h-full object-contain max-w-none" style={{ width: comparisonRef.current?.offsetWidth }} />
                                </div>
                                <div className="absolute inset-y-0 w-0.5 bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ left: `${sliderPosition}%` }}>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-200">
                                        <Columns className="w-4 h-4 text-blue-900" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative h-full w-full flex items-center justify-center">
                                <img src={`data:image/png;base64,${resultImage}`} onClick={() => setPreviewImage(resultImage)} className={`max-h-full max-w-full object-contain rounded-[2rem] shadow-2xl border border-white/10 animate-in zoom-in-95 duration-700 cursor-zoom-in ${isUpscaling ? 'blur-sm' : ''}`} />
                            </div>
                        )}
                        <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover/result:opacity-100 transition-opacity">
                            <button 
                                onClick={() => {
                                    if (resultImage) {
                                        setModelImage(resultImage);
                                        setResultImage(null);
                                        setIsComparing(false);
                                        if (window.innerWidth < 1024) setShowConfig(true);
                                    }
                                }} 
                                className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all" 
                                title="Dùng làm ảnh mẫu để chỉnh sửa tiếp"
                            >
                                <ArrowLeftRight className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsEditing(true)} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all" title="Chỉnh sửa chi tiết"><Sliders className="w-4 h-4" /></button>
                            <button onClick={() => setShowUpscaleMenu(!showUpscaleMenu)} disabled={isUpscaling} className="p-3 bg-black/60 text-white rounded-2xl shadow-lg hover:scale-110" title="Phóng to 2K/4K"><ChevronsUp className="w-4 h-4" /></button>
                            <button onClick={handleSmooth} disabled={isSmoothing} className="p-3 bg-black/60 text-white rounded-2xl shadow-lg hover:scale-110" title="Làm mịn ảnh"><Wand2 className={`w-4 h-4 ${isSmoothing ? 'animate-spin' : ''}`} /></button>
                            {modelImage && <button onClick={() => setIsComparing(!isComparing)} className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase transition-all flex items-center gap-2 active:scale-90 shadow-lg ${isComparing ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 text-white border-white/10'}`}>{isComparing ? <X className="w-4 h-4" /> : <Columns className="w-4 h-4" />}<span>{isComparing ? 'Thoát' : 'So Sánh'}</span></button>}
                            <a href={`data:image/png;base64,${resultImage}`} download={`yody-${Date.now()}.png`} className="p-3 bg-white text-blue-900 rounded-2xl shadow-lg hover:scale-110" title="Tải xuống"><Download className="w-4 h-4" /></a>
                        </div>
                    </div>
                 )}
                 {!resultImage && !isLoading && (
                    <div className="flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in-95 duration-700 select-none h-full relative">
                        <div onClick={() => modelInputRef.current?.click()} className="relative w-32 h-32 md:w-44 md:h-44 mb-8 group cursor-pointer">
                            <div className="absolute inset-0 bg-blue-500/10 rounded-[3rem] blur-3xl group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative w-full h-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:-translate-y-3 group-hover:rotate-2">
                                <ImageIcon className="w-16 h-16 text-slate-300 group-hover:text-white transition-all duration-700" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10"><Plus className="w-5 h-5 text-white" /></div>
                            </div>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-3 tracking-tight">Studio Sáng Tạo</h3>
                        <p className="text-slate-400 text-xs md:text-base font-medium max-w-[300px] leading-relaxed mb-8 opacity-80 uppercase tracking-widest">Tải ảnh hoặc nhập mô tả để bắt đầu</p>
                    </div>
                 )}
             </div>

             {history.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 shrink-0 animate-in slide-in-from-bottom-3 duration-700 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-4 border border-white/10 shadow-2xl">
                    <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2"><History className="w-4 h-4" /> LỊCH SỬ TẠO ẢNH ({history.length})</span>
                        <button onClick={() => setHistory([])} className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase flex items-center gap-1.5 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Xóa sạch</button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 px-2 custom-history-scrollbar">
                        {history.map(item => (
                            <div key={item.id} onClick={() => restoreHistoryItem(item)} className={`flex-shrink-0 w-52 md:w-64 rounded-[1.8rem] border backdrop-blur-3xl overflow-hidden cursor-pointer transition-all flex flex-col group relative ${item.resultImage === resultImage ? 'bg-blue-600/20 border-blue-500/50 shadow-lg scale-[1.02]' : 'bg-white/5 border-white/10 hover:border-white/30'}`}>
                                <div className="aspect-[16/9] w-full overflow-hidden relative shadow-inner bg-black/20">
                                    <img src={`data:image/png;base64,${item.resultImage}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                        <div className="flex gap-2 w-full justify-between items-center">
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); setPreviewImage(item.resultImage); }} className="p-2 bg-white/20 hover:bg-white/40 rounded-xl text-white backdrop-blur-md transition-all active:scale-90"><Search className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); setHistory(h => h.filter(x => x.id !== item.id)); }} className="p-2 bg-red-500/30 hover:bg-red-500/60 rounded-xl text-white backdrop-blur-md transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                            <span className="text-[8px] font-black text-white/50 uppercase">{item.aspectRatio}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 space-y-1.5">
                                    <p className="text-[10px] text-slate-200 line-clamp-2 font-medium leading-relaxed opacity-90 group-hover:opacity-100">{item.prompt || "Tạo từ ảnh mẫu"}</p>
                                    <div className="flex items-center justify-between opacity-50">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             )}
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8 pb-[env(safe-area-inset-bottom)]" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-6 right-6 z-[110] text-white/60 p-3 rounded-[1.5rem] bg-white/10 active:scale-90 transition-all hover:text-white" onClick={() => setPreviewImage(null)}><X className="w-8 h-8" /></button>
            <div className="relative flex items-center justify-center w-full h-full overflow-hidden" onClick={(e) => e.stopPropagation()} onWheel={handleWheel} onMouseDown={startDrag} onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag} onTouchStart={startDrag} onTouchMove={onDrag} onTouchEnd={endDrag}>
                <img src={`data:image/png;base64,${previewImage}`} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] transition-transform duration-150 ease-out select-none" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? (isDraggingPreview ? 'grabbing' : 'grab') : 'zoom-in' }} draggable={false} />
                <div className="absolute bottom-8 flex flex-col md:flex-row items-center gap-4 z-[110]">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl p-2.5 rounded-[1.8rem] border border-white/10 shadow-2xl">
                        <button onClick={() => setZoom(prev => Math.max(1, prev - 0.5))} className="p-2.5 hover:bg-white/20 rounded-2xl text-white transition-all"><ZoomOut className="w-6 h-6"/></button>
                        <div className="flex flex-col items-center px-4 min-w-[70px] border-x border-white/10"><span className="text-xs font-black text-white">{Math.round(zoom * 100)}%</span><span className="text-[8px] font-bold text-white/50 uppercase tracking-tighter">Scale</span></div>
                        <button onClick={() => setZoom(prev => Math.min(8, prev + 0.5))} className="p-2.5 hover:bg-white/20 rounded-2xl text-white transition-all"><ZoomIn className="w-6 h-6"/></button>
                    </div>
                    <div className="flex gap-2"><a href={`data:image/png;base64,${previewImage}`} download={`yody-hd-${Date.now()}.png`} className="px-8 py-4 bg-white text-blue-900 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] flex items-center gap-3 shadow-2xl hover:bg-blue-50 active:scale-95 transition-all"><Download className="w-5 h-5" /> Export Image</a></div>
                </div>
            </div>
        </div>
      )}

      {isEditing && resultImage && (
          <PhotoEditor 
              imageSrc={resultImage}
              onSave={(edited) => { setResultImage(edited); setIsEditing(false); }}
              onClose={() => setIsEditing(false)}
          />
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-history-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-history-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          margin-inline: 10px;
        }
        .custom-history-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to right, #3b82f6, #6366f1);
          border-radius: 10px;
        }
        .custom-history-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to right, #60a5fa, #818cf8);
        }
      `}</style>
    </div>
  );
};

export default ImageEditor;
