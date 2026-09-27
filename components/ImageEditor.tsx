
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { generateImageViaFlow, isFlowModel, FLOW_MODEL_IDS } from '../services/flowService';
import { resizeImage, smoothImage, extractRatioFromPrompt } from '../utils/image';
import { saveState, loadState } from '../utils/storage';
import PhotoEditor from './PhotoEditor';
import { useProject } from '../src/context/ProjectContext';
import { toast } from 'sonner';
import { 
  X, Loader2, Sparkles, Image as ImageIcon, 
  Zap, Download, Columns, 
  Upload, Maximize2, ZoomIn, ZoomOut, AlertCircle, Wand2,
  Settings2, ChevronUp, ChevronDown, Crown, Sliders, PenTool,
  Plus, Check, Eraser, BookOpen, ChevronsUp, Box, Brush,
  History, Trash2, Dices, Copy, Search, Eye, EyeOff, Share2
} from 'lucide-react';
import { MODEL_OPTIONS } from '../services/gemini';
import { ModelSelector } from './ModelSelector';
import RefinementEditor from './RefinementEditor';
import { motion, AnimatePresence } from 'motion/react';
import ComparisonSlider from './ComparisonSlider';
import MaskDrawEditor from './MaskDrawEditor';
import AspectRatioSelector from './AspectRatioSelector';

const REF_LIB_KEY = 'yody_ref_library_v1';

const ImageEditor: React.FC = () => {
  const { history, addToHistory, removeFromHistory, clearHistory, workspaceAsset, addToWorkspace, activePrompt, setActivePrompt } = useProject();
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [refLibrary, setRefLibrary] = useState<string[]>([]);
  const [showLib, setShowLib] = useState(false);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isSmoothing, setIsSmoothing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isGeneratingVariation, setIsGeneratingVariation] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUpscaleMenu, setShowUpscaleMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [beforeUpscaleImage, setBeforeUpscaleImage] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isEditing, setIsEditing] = useState(false);
  const [timer, setTimer] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState<string>(FLOW_MODEL_IDS.IMAGE);
  const [aspectRatio, setAspectRatio] = useState('1:1');

  useEffect(() => {
    const extracted = extractRatioFromPrompt(prompt);
    if (extracted) {
      setAspectRatio(extracted);
    }
  }, [prompt]);
  const [imageSize, setImageSize] = useState('1K');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showConfig, setShowConfig] = useState(true);
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [cfgScale, setCfgScale] = useState<number>(7);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("ĐANG KHỞI TẠO...");

  const modelInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const isLoadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initData = async () => {
        try {
            const savedLib = await loadState(REF_LIB_KEY) as string[];
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
    const checkKey = async () => {
      if (
        localStorage.getItem('gemini_api_key') || 
        localStorage.getItem('google_account_pro') === 'true' || 
        localStorage.getItem('vertex_project_id')
      ) {
        setApiKeySelected(true);
        return;
      }
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(has);
      }
    };
    checkKey();

    const handleKeyUpdate = () => {
      if (
        localStorage.getItem('gemini_api_key') || 
        localStorage.getItem('google_account_pro') === 'true' || 
        localStorage.getItem('vertex_project_id')
      ) {
        setApiKeySelected(true);
      } else if (window.aistudio?.hasSelectedApiKey) {
        window.aistudio.hasSelectedApiKey().then(setApiKeySelected);
      } else {
        setApiKeySelected(false);
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

  useEffect(() => {
    if (activePrompt) {
      setPrompt(activePrompt);
      setActivePrompt(null);
      toast.success('Đã áp dụng prompt từ thư viện');
    }
  }, [activePrompt, setActivePrompt]);

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

  const processFiles = React.useCallback(async (files: FileList | File[], type: 'model' | 'ref') => {
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
              setAspectRatio(closest);
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
  }, []);

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
  }, [modelImage, processFiles]);

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
        const enhanced = await geminiService.enhancePrompt(prompt);
        if (enhanced) setPrompt(enhanced.trim());
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
    const selectedModel = MODEL_OPTIONS.find(m => m.id === selectedModelId);
    const usingFlow = isFlowModel(selectedModelId);

    // Gemini API key check (only for non-Flow models)
    if (!usingFlow && selectedModel?.tier === 'pro' && !apiKeySelected) { handleSelectKey(); return; }
    if (!modelImage && !prompt) { setError("Vui lòng tải ảnh mẫu hoặc nhập mô tả ý tưởng."); return; }
    setIsLoading(true);
    setLoadingMessage("Đang phân tích yêu cầu...");
    setError(null);
    setTimer(0);
    
    if (window.innerWidth < 1024) setShowConfig(false);

    try {
      // ── Google Flow path ──────────────────────────────────────────────────
      if (usingFlow) {
        const flowResult = await generateImageViaFlow(
          {
            prompt: prompt || 'Generate a high quality image',
            aspectRatio,
            numImages: 1,
            referenceImageBase64: modelImage || undefined,
            referenceImageMime: modelImage?.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg',
          },
          (progress, message) => {
            setLoadingMessage(message || `Google Flow (${progress}%)`);
          }
        );

        if (flowResult) {
          playSuccessSound();
          // flowResult is a data URI from Google Flow
          const base64Part = flowResult.startsWith('data:')
            ? flowResult.split(',')[1]
            : flowResult;
          setResultImage(base64Part);
          addToHistory({
            url: flowResult,
            prompt,
            mode: 'IMAGE_EDITOR'
          });
        } else {
          throw new Error("Google Flow không trả về ảnh.");
        }
        return;
      }

      // ── Gemini API path ───────────────────────────────────────────────────
      let resultBase64;
      const genConfig = { 
        modelId: selectedModelId, 
        aspectRatio, 
        imageSize,
        negativePrompt,
        seed,
        cfgScale
      };

      const finalRefs = [...refImages];
      let finalPrompt = prompt;
      if (maskImage) {
          finalRefs.push(maskImage);
          finalPrompt += `\n\nCRITICAL MASK INSTRUCTION: The final reference image provided is a black-and-white INPAINTING MASK. You MUST ONLY modify the areas indicated in WHITE on the mask. Preserve 100% of the original model image outside of the white mask area exactly.`;
      }

      if (modelImage) resultBase64 = await geminiService.editImage(modelImage, finalPrompt, finalRefs, genConfig);
      else resultBase64 = await geminiService.generateImage(finalPrompt, genConfig, finalRefs);
      
      if (resultBase64) {
        playSuccessSound();
        setResultImage(resultBase64);
        addToHistory({
          url: `data:image/png;base64,${resultBase64}`,
          prompt,
          mode: 'IMAGE_EDITOR'
        });
      } else throw new Error("Không nhận được dữ liệu ảnh.");
    } catch (err: any) { setError(err.message || "Lỗi khi tạo ảnh."); } finally { setIsLoading(false); }
  };

  const handleAddToWorkspace = () => {
    if (!resultImage) return;
    addToWorkspace({
      url: `data:image/png;base64,${resultImage}`,
      prompt: prompt,
      mode: 'IMAGE_EDITOR',
      type: 'image'
    });
    toast.success('Đã thêm vào Workspace');
  };

  const handleRefineSave = async (maskBase64: string, refinePrompt: string, referenceImages?: string[]) => {
    if (!resultImage) return;
    
    setIsLoading(true);
    setIsRefining(false);
    setLoadingMessage("Đang tinh chỉnh vùng chọn...");
    setTimer(0);
    
    try {
      const result = await geminiService.refineImage(resultImage, maskBase64, refinePrompt, {
        aspectRatio,
        imageSize,
        negativePrompt,
        seed,
        cfgScale,
        referenceImages
      });
      
      if (result) {
        setBeforeUpscaleImage(resultImage);
        setResultImage(result);
        setIsComparing(true);
      } else {
        setError("Không thể tinh chỉnh ảnh. Vui lòng thử lại.");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi tinh chỉnh ảnh.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectKey = async () => { 
    if (window.aistudio?.openSelectKey) { 
      try { 
        await window.aistudio.openSelectKey(); 
        setApiKeySelected(true); 
      } catch (e) { 
        console.error("Key selection failed", e); 
      } 
    } else {
      toast.info('Vui lòng kích hoạt Pro bằng tài khoản Google hoặc nhập API Key tại nút Unlock Pro bên góc trái!');
    }
  };

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
    const xPos = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    setSliderPosition(Math.max(0, Math.min(100, (xPos / rect.width) * 100)));
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
      const currentResult = resultImage;
    try {
        const upscaled = await geminiService.upscaleImage(resultImage, size, aspectRatio);
        if (upscaled) {
            setBeforeUpscaleImage(currentResult);
            setResultImage(upscaled);
            setIsComparing(true); // Tự động bật so sánh để thấy sự khác biệt
        }
    } catch (err: any) { setError(err.message || "Upscaling failed."); } finally { setIsUpscaling(false); }
  };

  const handleGenerateVariation = async () => {
    if (!resultImage || isGeneratingVariation) return;
    setIsGeneratingVariation(true);
    setLoadingMessage("Đang tạo biến thể...");
    setTimer(0);
    setIsLoading(true);
    try {
        const variation = await geminiService.generateVariation(resultImage, {
            modelId: selectedModelId,
            aspectRatio,
            imageSize,
            negativePrompt,
            seed: seed ? seed + 1 : undefined, // Slightly change seed for variation
            cfgScale
        });
        if (variation) {
            setBeforeUpscaleImage(resultImage);
            setResultImage(variation);
            setIsComparing(true);
            addToHistory({
                url: `data:image/png;base64,${variation}`,
                prompt: `Variation of: ${prompt}`,
                mode: 'IMAGE_EDITOR'
            });
        }
    } catch (err: any) {
        setError(err.message || "Lỗi khi tạo biến thể.");
    } finally {
        setIsGeneratingVariation(false);
        setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!modelImage || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
        const analyzedPrompt = await geminiService.analyzeImageForPrompt(modelImage);
        if (analyzedPrompt) setPrompt(analyzedPrompt);
    } catch (err: any) {
        console.error("Analysis failed", err);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const editorHistory = history.filter(item => item.mode === 'IMAGE_EDITOR');

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col p-2 md:p-3 overflow-hidden relative outline-none" tabIndex={0}>
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
        <div className={`w-full lg:w-[380px] flex flex-col gap-2 md:gap-3 transition-all duration-300 shrink-0 order-2 lg:order-1 ${showConfig ? 'h-auto max-h-[70vh] lg:max-h-none lg:h-full' : 'h-auto'}`}>
            <div className="bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur-2xl p-4 md:p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6 mb-4">
                        {/* CHẤT LƯỢNG XỬ LÝ */}
                        <ModelSelector selectedModelId={selectedModelId} onModelSelect={setSelectedModelId} />

                        {/* ĐỘ PHÂN GIẢI & TỶ LỆ */}
                        <div className={`grid ${MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 transition-all duration-300`}>
                            {MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">ĐỘ PHÂN GIẢI</label>
                                    <div className="relative group">
                                        <select 
                                            value={imageSize} 
                                            onChange={(e) => setImageSize(e.target.value)}
                                            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.2rem] py-3 px-4 text-[11px] font-black text-amber-600 dark:text-amber-400 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-amber-500/20 transition-all"
                                        >
                                            {['1K', '2K', '4K'].map(size => <option key={size} value={size}>{size}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-amber-500 transition-colors" />
                                    </div>
                                    {/* Warning for 4K Generation */}
                                    {MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' && imageSize === '4K' && (
                                        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[9px] text-amber-500 font-medium leading-relaxed">
                                                Lưu ý: Ảnh 4K cần khoảng 40-60 giây để xử lý chi tiết siêu thực.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Aspect Ratio Selector */}
                            <AspectRatioSelector 
                                value={aspectRatio}
                                onChange={setAspectRatio}
                                hasImage={!!modelImage}
                                onAutoDetect={() => {
                                    if (modelImage) {
                                        const img = new Image();
                                        img.onload = () => {
                                            const w = img.width;
                                            const h = img.height;
                                            // Find closest ratio
                                            const ratios = ["1:1", "3:4", "4:3", "2:3", "3:2", "4:5", "5:4", "9:16", "16:9"];
                                            let closestRatio = "1:1";
                                            let minDiff = Infinity;
                                            ratios.forEach(r => {
                                                const [rw, rh] = r.split(':').map(Number);
                                                const diff = Math.abs((w/h) - (rw/rh));
                                                if (diff < minDiff) {
                                                    minDiff = diff;
                                                    closestRatio = r;
                                                }
                                            });
                                            setAspectRatio(closestRatio);
                                        };
                                        img.src = `data:image/png;base64,${modelImage}`;
                                    }
                                }}
                            />
                        </div>
                        
                        {/* ẢNH NGƯỜI MẪU */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">ẢNH NGƯỜI MẪU (TÙY CHỌN)</label>
                                {modelImage && (
                                    <button 
                                        onClick={handleAnalyzeImage}
                                        disabled={isAnalyzing}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all"
                                    >
                                        {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                        Auto-Tag Prompt
                                    </button>
                                )}
                                {workspaceAsset && (
                                    <button 
                                        onClick={() => setModelImage(workspaceAsset.url.split(',')[1])}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all"
                                    >
                                        <Box size={10} /> Load Workspace
                                    </button>
                                )}
                            </div>
                            <div 
                                onClick={() => modelInputRef.current?.click()} 
                                onDragOver={(e) => handleDragOver(e, 'model')}
                                onDragLeave={(e) => handleDragLeave(e, 'model')}
                                onDrop={(e) => handleDrop(e, 'model')}
                                className={`h-44 md:h-48 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group ${isDraggingModel ? 'border-blue-500 bg-blue-50/50 shadow-inner' : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:border-blue-400'}`}
                            >
                                {modelImage ? (
                                    <>
                                    <img src={`data:image/png;base64,${modelImage}`} className="w-full h-full object-contain p-4" />
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); setShowMaskEditor(true); }} className={`p-2.5 backdrop-blur-md rounded-2xl shadow-xl transition-all active:scale-90 ${maskImage ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800/80 text-blue-400 border border-blue-500/30 hover:bg-slate-700/80'}`} title="Vẽ Mask (Inpainting)"><PenTool className="w-4 h-4"/></button>
                                        <button onClick={(e) => { e.stopPropagation(); setPreviewImage(modelImage); }} className="p-2.5 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white rounded-2xl shadow-xl transition-all active:scale-90" title="Xem ảnh mẫu"><Maximize2 className="w-4 h-4"/></button>
                                        <button onClick={(e) => { e.stopPropagation(); setModelImage(null); setMaskImage(null); setResultImage(null); }} className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-xl transition-all active:scale-90" title="Xóa ảnh mẫu"><X className="w-4 h-4"/></button>
                                    </div>
                                    </>
                                ) : (
                                    <>
                                    <div className="p-4 rounded-[1.8rem] bg-slate-100 dark:bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                                        <ImageIcon className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">CLICK / DROP IMAGE</span>
                                    </>
                                )}
                                <input type="file" ref={modelInputRef} onChange={(e) => e.target.files && processFiles(e.target.files, 'model')} accept="image/*" className="hidden" />
                            </div>

                            {/* Inpainting & Model Guidance */}
                            {modelImage && (
                                <div className="flex items-center justify-between px-3 py-2 bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 rounded-2xl animate-in fade-in slide-in-from-top-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400 truncate">
                                            {maskImage ? '✅ Đã chọn vùng Inpainting (sẽ chỉ sửa vùng vẽ)' : 'Mẹo: Bấm 🖊️ (Vẽ Mask) để đổi màu áo giữ nguyên người mẫu'}
                                        </span>
                                    </div>
                                    {!maskImage && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setShowMaskEditor(true); }}
                                            className="text-[9.5px] font-black text-blue-600 dark:text-blue-400 underline hover:text-blue-700 shrink-0 ml-1.5"
                                        >
                                            Vẽ ngay
                                        </button>
                                    )}
                                </div>
                            )}
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
                                    className={`flex gap-3 p-4 rounded-[2rem] bg-slate-100/50 dark:bg-white/5 min-h-[100px] overflow-x-auto no-scrollbar shadow-inner border-2 border-transparent transition-all cursor-pointer ${isDraggingRef ? 'border-blue-500 ring-4 ring-blue-500/10' : 'hover:border-slate-200 dark:hover:border-white/10'}`}
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
                                <div className="bg-slate-100/50 dark:bg-white/5 rounded-[2rem] p-3 border-2 border-dashed border-slate-200 dark:border-white/10">
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
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ý TƯỞNG (PROMPT BUILDER)</label>
                                <div className="flex gap-2">
                                    {[
                                        { label: 'Cinematic', val: 'cinematic lighting, high contrast, professional photography' },
                                        { label: 'Realistic', val: 'photorealistic, 8k, highly detailed, sharp focus' },
                                        { label: 'Studio', val: 'studio lighting, clean background, fashion editorial' }
                                    ].map(s => (
                                        <button 
                                            key={s.label}
                                            onClick={() => setPrompt(prev => prev ? `${prev}, ${s.val}` : s.val)}
                                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[8px] font-bold text-slate-500 hover:bg-blue-500 hover:text-white transition-all"
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <textarea 
                                    value={prompt} 
                                    onChange={(e) => setPrompt(e.target.value)} 
                                    className="w-full p-6 bg-white dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-white outline-none min-h-[160px] shadow-xl shadow-slate-100/50 dark:shadow-none focus:border-blue-500/50 transition-all resize-none leading-relaxed" 
                                    placeholder="Mô tả ý tưởng của bạn tại đây..." 
                                />
                                
                                {/* Prompt Actions - Compact & Outside */}
                                <div className="flex justify-end gap-2 px-2">
                                    <button 
                                        onClick={() => setPrompt('')} 
                                        className="p-1.5 bg-slate-100 dark:bg-black/40 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg transition-all active:scale-90 border border-slate-200 dark:border-white/10"
                                        title="Xóa Prompt"
                                    >
                                        <Eraser className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={handleEnhancePrompt} 
                                        disabled={isEnhancingPrompt || !prompt.trim()}
                                        className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 px-3 border border-slate-200 dark:border-white/10 ${isEnhancingPrompt ? 'bg-blue-50 text-blue-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95'}`}
                                    >
                                        {isEnhancingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                        <span className="text-[9px] font-black uppercase tracking-wider">Tối ưu AI</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ADVANCED SETTINGS */}
                        <div className="space-y-4">
                            <button 
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors px-1"
                            >
                                <Settings2 className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                                Cài đặt nâng cao
                            </button>

                            {showAdvanced && (
                                <div className="space-y-5 p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/10 animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">NEGATIVE PROMPT (TRÁNH CÁC YẾU TỐ)</label>
                                        <textarea 
                                            value={negativePrompt} 
                                            onChange={(e) => setNegativePrompt(e.target.value)} 
                                            className="w-full p-4 text-[10px] bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl outline-none resize-none h-20 text-slate-900 dark:text-white shadow-inner" 
                                            placeholder="Ví dụ: blurry, low quality, distorted hands, extra fingers..." 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Dices className="w-3 h-3" /> SEED</label>
                                            <input 
                                                type="number" 
                                                value={seed || ''} 
                                                onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                                                className="w-full p-3 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-bold text-blue-600 outline-none"
                                                placeholder="Ngẫu nhiên..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">CFG SCALE</label>
                                                <span className="text-[9px] font-black text-blue-500">{cfgScale}</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="1" 
                                                max="20" 
                                                step="0.5"
                                                value={cfgScale} 
                                                onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                                                className="w-full accent-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sticky Footer for Generate Button */}
                    <div className="pt-2 space-y-4 border-t border-slate-100 dark:border-white/5">
                        {/* Generate Button */}
                        <button onClick={handleGenerate} disabled={isLoading} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2.5rem] font-black uppercase tracking-[0.25em] text-xs shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current text-amber-400" />}
                            <span>{isLoading ? `${loadingMessage} (${timer.toFixed(1)}s)` : "TẠO ẢNH NGAY"}</span>
                        </button>
                        
                        {error && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
                          </div>
                        )}
                    </div>
                </div>
            </div>
                {/* Preview Area */}
        <div className="flex-1 flex flex-col overflow-hidden order-1 lg:order-2">
             <div className="flex-1 bg-black/20 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] relative overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center p-2 md:p-6 ring-1 ring-inset ring-white/10 min-h-0">
                 <AnimatePresence mode="wait">
                 {isLoading ? (
                    <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center"
                    >
                        <div className="relative mb-6">
                            <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin shadow-2xl"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Wand2 className="w-8 h-8 text-blue-500 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{loadingMessage}</p>
                        <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-2">Thời gian: {timer.toFixed(1)}s</p>
                    </motion.div>
                 ) : resultImage ? (
                    <motion.div 
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full h-full flex flex-col items-center justify-center relative group/result"
                    >
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-[2rem]">
                            {isComparing && (modelImage || beforeUpscaleImage) ? (
                                <ComparisonSlider 
                                    beforeImage={`data:image/png;base64,${beforeUpscaleImage || modelImage}`}
                                    afterImage={`data:image/png;base64,${resultImage}`}
                                    className="w-full h-full max-h-full aspect-square overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl"
                                />
                            ) : (
                                <img 
                                    src={`data:image/png;base64,${resultImage}`} 
                                    onClick={() => setPreviewImage(resultImage)}
                                    className={`max-h-full max-w-full object-contain rounded-[2rem] shadow-2xl border border-white/10 cursor-zoom-in transition-transform duration-500 ${isUpscaling ? 'blur-sm' : ''}`} 
                                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                                    onWheel={handleWheel}
                                    onMouseDown={startDrag}
                                    onMouseMove={onDrag}
                                    onMouseUp={endDrag}
                                    onMouseLeave={endDrag}
                                    alt="Result"
                                />
                            )}
                            
                            {/* Result Actions Overlay */}
                            <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover/result:opacity-100 transition-opacity">
                                <button onClick={() => setIsRefining(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all" title="Tinh chỉnh vùng chọn (Inpainting)"><Brush className="w-4 h-4" /></button>
                                <button onClick={() => setIsEditing(true)} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all" title="Chỉnh sửa chi tiết"><Sliders className="w-4 h-4" /></button>
                                <button 
                                    onClick={handleGenerateVariation} 
                                    disabled={isGeneratingVariation || isLoading || !resultImage}
                                    className={`p-3 rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all ${isGeneratingVariation ? 'bg-blue-100 text-blue-400' : 'bg-blue-500 text-white'}`} 
                                    title="Tạo biến thể (Variation)"
                                >
                                    {isGeneratingVariation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                                </button>
                                <div className="relative">
                                    <button onClick={() => setShowUpscaleMenu(!showUpscaleMenu)} disabled={isUpscaling} className="p-3 bg-black/60 text-white rounded-2xl shadow-lg hover:scale-110" title="Phóng to 2K/4K"><ChevronsUp className="w-4 h-4" /></button>
                                    {showUpscaleMenu && (
                                        <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl z-30 min-w-[120px] animate-in slide-in-from-top-2">
                                            <button onClick={() => handleUpscale('2K')} className="px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] font-black text-white uppercase text-left flex items-center justify-between gap-2">
                                                <span>2K Resolution</span>
                                                <span className="text-[8px] text-blue-400">HD+</span>
                                            </button>
                                            <button onClick={() => handleUpscale('4K')} className="px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] font-black text-white uppercase text-left flex items-center justify-between gap-2">
                                                <span>4K Resolution</span>
                                                <span className="text-[8px] text-amber-400">ULTRA</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleSmooth} disabled={isSmoothing} className="p-3 bg-black/60 text-white rounded-2xl shadow-lg hover:scale-110" title="Làm mịn ảnh"><Wand2 className={`w-4 h-4 ${isSmoothing ? 'animate-spin' : ''}`} /></button>
                                {(modelImage || beforeUpscaleImage) && <button onClick={() => setIsComparing(!isComparing)} className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase transition-all flex items-center gap-2 active:scale-90 shadow-lg ${isComparing ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 text-white border-white/10'}`}>{isComparing ? <X className="w-4 h-4" /> : <Columns className="w-4 h-4" />}<span>{isComparing ? 'Thoát' : 'So Sánh'}</span></button>}
                                <button 
                                    onClick={handleAddToWorkspace}
                                    className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all"
                                    title="Gửi tới Workspace"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>
                                <a href={`data:image/png;base64,${resultImage}`} download={`yody-${Date.now()}.png`} className="p-3 bg-white text-blue-900 rounded-2xl shadow-lg hover:scale-110" title="Tải xuống"><Download className="w-4 h-4" /></a>
                            </div>
                        </div>

                        {/* Quick Actions below image */}
                        <div className="mt-4 flex gap-3 w-full max-w-md shrink-0">
                            <button
                                onClick={handleAddToWorkspace}
                                className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Box className="w-4 h-4" />
                                <span>Workspace</span>
                            </button>
                            <a 
                                href={`data:image/png;base64,${resultImage}`} 
                                download={`yody-${Date.now()}.png`}
                                className="flex-1 py-4 bg-white dark:bg-white/10 text-slate-900 dark:text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
                            >
                                <Download className="w-4 h-4" />
                                <span>Tải về</span>
                            </a>
                        </div>
                    </motion.div>
                 ) : (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center text-center max-w-md"
                    >
                        <div onClick={() => modelInputRef.current?.click()} className="relative w-32 h-32 md:w-44 md:h-44 mb-8 group cursor-pointer">
                            <div className="absolute inset-0 bg-blue-500/10 rounded-[3rem] blur-3xl group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative w-full h-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:-translate-y-3 group-hover:rotate-2">
                                <ImageIcon className="w-16 h-16 text-slate-300 group-hover:text-white transition-all duration-700" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10"><Plus className="w-5 h-5 text-white" /></div>
                            </div>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-3 tracking-tight uppercase">Studio Sáng Tạo</h3>
                        <p className="text-slate-400 text-[10px] font-black max-w-[300px] leading-relaxed mb-8 opacity-80 uppercase tracking-[0.2em]">Tải ảnh hoặc nhập mô tả để bắt đầu</p>
                        
                        <div className="grid grid-cols-3 gap-4 w-full">
                            {[
                                { icon: <Zap size={16} />, label: 'Tốc độ' },
                                { icon: <Crown size={16} />, label: 'Chất lượng' },
                                { icon: <Wand2 size={16} />, label: 'Sáng tạo' }
                            ].map((item, i) => (
                                <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center gap-2">
                                    <div className="text-blue-500">{item.icon}</div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                 )}
                 </AnimatePresence>
             </div>
        </div>

        {/* History Column (Right) */}
        <div className="w-full lg:w-[220px] flex flex-col gap-2 md:gap-3 shrink-0 order-3">
            <div className="bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur-2xl p-4 md:p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Lịch sử</h3>
                    </div>
                    {editorHistory.length > 0 && (
                        <button 
                            onClick={clearHistory}
                            className="text-[9px] font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                        >
                            <Trash2 size={10} /> Xóa
                        </button>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                    {editorHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl p-6 text-center">
                            <History className="w-8 h-8 text-slate-200 dark:text-white/5 mb-3" />
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Chưa có ảnh nào</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 pb-10">
                            {editorHistory.map((item) => (
                                <div key={item.id} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:ring-2 hover:ring-blue-500/50">
                                    <img 
                                        src={item.url} 
                                        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-110" 
                                        onClick={() => {
                                            setResultImage(item.url.split(',')[1]);
                                            if (item.prompt) setPrompt(item.prompt);
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <Plus className="w-5 h-5 text-white" />
                                    </div>
                                    <button 
                                        onClick={() => removeFromHistory(item.id)}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 active:scale-90"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {isRefining && resultImage && (
        <RefinementEditor 
          image={resultImage}
          onClose={() => setIsRefining(false)}
          onSave={handleRefineSave}
          isProcessing={isLoading}
        />
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8" onClick={() => setPreviewImage(null)}>
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

      {showMaskEditor && modelImage && (
          <MaskDrawEditor 
              imageSrc={modelImage}
              onSave={(maskStr) => { setMaskImage(maskStr); setShowMaskEditor(false); }}
              onCancel={() => setShowMaskEditor(false)}
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
