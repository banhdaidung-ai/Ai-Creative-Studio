
import React, { useState, useRef, useEffect } from 'react';
import { geminiService, MODEL_OPTIONS } from '../services/gemini';
import { resizeImage, padImageToRatio, unpadImage } from '../utils/image';
import { saveState, loadState } from '../utils/storage';
import PhotoEditor from './PhotoEditor';
import { ModelSelector } from './ModelSelector';
import { 
  Shirt, Upload, RefreshCw, Download, 
  Lightbulb, Loader2, Maximize2, X, Layers, Zap, 
  Trash2, Image as ImageIcon, CheckSquare, Square, DownloadCloud,
  Key, RotateCcw, ZoomIn, ZoomOut, ShoppingBag, MessageSquare, Columns, Eye, Sparkles, Edit3,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Settings2, Plus, History, Clock, Crown, Sliders
} from 'lucide-react';

interface GarmentJob {
  id: string;
  garmentBase64: string;
  resultBase64?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  prompt: string;
}

interface BatchHistoryItem {
  id: string;
  timestamp: number;
  modelImage: string;
  garmentImage: string;
  resultBase64: string;
  prompt: string;
  aspectRatio: string;
}

const PROMPT_SUGGESTIONS = [
  { id: 'default', label: 'Mặc định', text: "Replace the model's outfit with this garment. Maintain photorealism and lighting." },
  { id: 'tucked', label: 'Sơ vin', text: "Wear this outfit tucked in. Ensure a neat, professional fit." },
  { id: 'oversize', label: 'Oversize', text: "Wear this as an oversized fit. Keep the fabric loose and draped naturally." },
  { id: 'tight', label: 'Ôm body', text: "Wear this as a slim fit/tight fit. Accentuate the body silhouette." },
  { id: 'untucked', label: 'Thả ngoài', text: "Wear this untucked and relaxed. Casual style." }
];

const supportedRatios = ["Auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"];

const STORAGE_KEY = 'yody_batch_studio_state_v1';

const LazyImage: React.FC<{ src: string; className?: string; alt?: string }> = ({ src, className, alt }) => {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className?.includes('w-full') ? 'w-full' : ''} ${className?.includes('h-full') ? 'h-full' : ''}`}>
      {inView ? (
        <img src={src} className={`${className} animate-in fade-in duration-300`} alt={alt} loading="lazy" />
      ) : (
        <div className="w-full h-full bg-white/5 animate-pulse" />
      )}
    </div>
  );
};

const BatchFashionStudio: React.FC = () => {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GarmentJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [isDraggingGarment, setIsDraggingGarment] = useState(false);
  
  const [history, setHistory] = useState<BatchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [timer, setTimer] = useState(0);

  const [modelTier, setModelTier] = useState<'standard' | 'pro'>('pro');
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.1-flash-image-preview');
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('Auto');
  const [detectedRatio, setDetectedRatio] = useState('3:4');
  
  const [defaultPrompt, setDefaultPrompt] = useState<string>("Replace the model's outfit with this garment. Maintain photorealism and lighting.");
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(true);
  
  // Editor State
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // Zoom & Pan State for Preview
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const comparisonRef = useRef<HTMLDivElement>(null);
  
  const modelInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const isLoadedRef = useRef(false);

  const jobsRef = useRef<GarmentJob[]>(jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  useEffect(() => {
    const initData = async () => {
        try {
            const savedState = await loadState(STORAGE_KEY);
            if (savedState) {
                if (savedState.modelImage) setModelImage(savedState.modelImage);
                if (savedState.jobs) setJobs(savedState.jobs);
                if (savedState.defaultPrompt) setDefaultPrompt(savedState.defaultPrompt);
                if (savedState.modelTier) setModelTier(savedState.modelTier);
                if (savedState.imageSize) setImageSize(savedState.imageSize);
                if (savedState.aspectRatio) setAspectRatio(savedState.aspectRatio);
                if (savedState.history) setHistory(savedState.history);
            }
        } catch (e) {
            console.warn("Failed to load batch studio state", e);
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
        const stateToSave = {
          modelImage,
          jobs,
          defaultPrompt,
          modelTier,
          imageSize,
          aspectRatio,
          history: history.slice(0, 50) 
        };
        await saveState(STORAGE_KEY, stateToSave);
      } catch (e) {}
    }, 1000); 
    return () => clearTimeout(timeoutId);
  }, [modelImage, jobs, defaultPrompt, modelTier, imageSize, aspectRatio, history]);

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

  useEffect(() => {
    let interval: any;
    const isAnyProcessing = isProcessing || jobs.some(j => j.status === 'processing');
    if (isAnyProcessing) {
      interval = setInterval(() => setTimer(t => t + 0.1), 100);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing, jobs]);

  useEffect(() => {
    if (previewImage) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setIsComparing(false); 
        setSliderPosition(50);
    }
  }, [previewImage]);

  // Global Paste Handler
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
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
            if (!modelImage) {
                await processModelFile(files[0]);
                if (files.length > 1) {
                    await processGarmentFiles(files.slice(1));
                }
            } else {
                await processGarmentFiles(files);
            }
        }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [modelImage]);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
        try {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        } catch (e) { console.error(e); }
    }
  };

  const getClosestRatio = (width: number, height: number): string => {
    const target = width / height;
    const ratios = [
      { name: "1:1", val: 1 }, { name: "3:4", val: 3 / 4 }, { name: "4:3", val: 4 / 3 },
      { name: "9:16", val: 9 / 16 }, { name: "16:9", val: 16 / 9 }
    ];
    return ratios.reduce((prev, curr) => 
      Math.abs(curr.val - target) < Math.abs(prev.val - target) ? curr : prev
    ).name;
  };

  const processModelFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
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
    const base64 = await resizeImage(file);
    setModelImage(base64);
  };

  const processGarmentFiles = async (files: FileList | File[]) => {
      const newJobs: GarmentJob[] = [];
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type.startsWith('image/')) continue;
          const base64 = await resizeImage(file);
          newJobs.push({
              id: Math.random().toString(36).substring(7),
              garmentBase64: base64,
              status: 'pending',
              prompt: defaultPrompt 
          });
      }
      setJobs(prev => [...prev, ...newJobs]);
      if (!focusedJobId && newJobs.length > 0) setFocusedJobId(newJobs[0].id);
      if (window.innerWidth < 1024) setShowConfig(false); 
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processModelFile(e.target.files[0]);
  };

  const handleGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processGarmentFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent, type: 'model' | 'garment') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'model') setIsDraggingModel(true);
    else setIsDraggingGarment(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'model' | 'garment') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'model') setIsDraggingModel(false);
    else setIsDraggingGarment(false);
  };

  const handleDrop = async (e: React.DragEvent, type: 'model' | 'garment') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'model') setIsDraggingModel(false);
    else setIsDraggingGarment(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (type === 'model') await processModelFile(e.dataTransfer.files[0]);
        else await processGarmentFiles(e.dataTransfer.files);
    }
  };

  const generateJob = async (jobId: string) => {
    const job = jobsRef.current.find(j => j.id === jobId);
    if (!job || !modelImage) return;

    if (modelTier === 'pro' && !apiKeySelected) {
        handleSelectKey();
        return;
    }

    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'processing' } : j));

    try {
        const finalRatio = aspectRatio === 'Auto' ? detectedRatio : aspectRatio;
        
        // Pad image to match the target ratio exactly before sending to AI
        const { base64: processedModelImage, info: paddingInfo } = await padImageToRatio(modelImage, finalRatio);

        let result = await geminiService.editImage(
            processedModelImage,
            job.prompt, 
            [job.garmentBase64],
            { modelTier, aspectRatio: finalRatio, imageSize, modelId: selectedModelId }
        );

        if (result && paddingInfo) {
            // Unpad (crop) the result back to original dimensions
            result = await unpadImage(result, paddingInfo);
        }

        if (result) {
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed', resultBase64: result } : j));
            setSelectedJobs(prev => new Set(prev).add(jobId));
            
            const historyItem: BatchHistoryItem = {
              id: Date.now().toString() + Math.random().toString().slice(2),
              timestamp: Date.now(),
              modelImage: modelImage,
              garmentImage: job.garmentBase64,
              resultBase64: result,
              prompt: job.prompt,
              aspectRatio: finalRatio
            };
            setHistory(prev => [historyItem, ...prev]);
        } else {
            throw new Error("No result");
        }
    } catch (e) {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error' } : j));
    }
  };

  const generateAll = async () => {
    if (!modelImage) return;
    const hasManualKey = !!localStorage.getItem('gemini_api_key');
    if (modelTier === 'pro' && !apiKeySelected && !hasManualKey) { handleSelectKey(); return; }
    setIsProcessing(true);
    if (window.innerWidth < 1024) setShowConfig(false);
    const pendingIds = jobs.filter(j => j.status === 'pending' || j.status === 'error').map(j => j.id);
    for (const id of pendingIds) await generateJob(id);
    setIsProcessing(false);
  };

  const removeJob = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setJobs(prev => prev.filter(j => j.id !== id));
      setSelectedJobs(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
      });
      if (focusedJobId === id) setFocusedJobId(null);
  };

  const toggleSelectAll = () => {
      const completedIds = jobs.filter(j => j.status === 'completed').map(j => j.id);
      if (selectedJobs.size === completedIds.length && completedIds.length > 0) {
          setSelectedJobs(new Set());
      } else {
          setSelectedJobs(new Set(completedIds));
      }
  };

  const toggleSelection = (id: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDownload = () => {
      jobs.filter(j => selectedJobs.has(j.id) && j.resultBase64).forEach((job, index) => {
          setTimeout(() => {
              const link = document.createElement('a');
              link.href = `data:image/png;base64,${job.resultBase64}`;
              link.download = `yody-outfit-${job.id}.png`;
              link.click();
          }, index * 400);
      });
  };

  const activePrompt = focusedJobId 
      ? jobs.find(j => j.id === focusedJobId)?.prompt || defaultPrompt 
      : defaultPrompt;

  const handlePromptChange = (text: string) => {
      if (focusedJobId) {
          setJobs(prev => prev.map(j => j.id === focusedJobId ? { ...j, prompt: text } : j));
      } else {
          setDefaultPrompt(text);
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (previewImage && !isComparing) {
        e.stopPropagation();
        const scaleAmount = -e.deltaY * 0.001;
        const newZoom = Math.min(Math.max(1, zoom + scaleAmount), 5);
        setZoom(newZoom);
        if (newZoom === 1) setPan({ x: 0, y: 0 });
    }
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!isComparing) {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        if (zoom > 1) {
            e.preventDefault();
            setIsDraggingPreview(true);
            setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
        } else {
            setZoom(2); 
        }
    }
  };

  const onDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isComparing && isDraggingPreview && zoom > 1) {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        e.preventDefault();
        setPan({ x: clientX - dragStart.x, y: clientY - dragStart.y });
    }
  };

  const endDrag = () => {
    setIsDraggingPreview(false);
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!comparisonRef.current) return;
    e.stopPropagation();
    const rect = comparisonRef.current.getBoundingClientRect();
    let x = 0;
    if ('touches' in e) {
        x = e.touches[0].clientX - rect.left;
    } else {
        x = (e as React.MouseEvent).clientX - rect.left;
    }
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleSaveEdit = (editedBase64: string) => {
      if (editingJobId) {
          setJobs(prev => prev.map(j => j.id === editingJobId ? { ...j, resultBase64: editedBase64 } : j));
          if (previewImage && jobs.find(j => j.id === editingJobId)?.resultBase64 === previewImage) {
              setPreviewImage(editedBase64);
          }
      }
      setEditingJobId(null);
  };

  return (
    <div className="h-full flex flex-col p-2 md:p-4 overflow-hidden">
      {/* ... (Render code unchanged) ... */}
      <div className="mb-2 md:mb-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 md:p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
            <Shirt className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-none">Thay Đồ Hàng Loạt</h2>
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-purple-500 block mt-0.5">Tự động ướm thử nhiều trang phục lên mẫu.</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-3 md:gap-4 overflow-hidden">
        {/* Sidebar Controls */}
        <div className={`w-full lg:w-[320px] flex flex-col gap-3 lg:gap-4 transition-all duration-300 shrink-0 order-1 ${showConfig ? 'h-auto max-h-[55vh] lg:max-h-full lg:h-full' : 'h-auto'}`}>
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl p-3 md:p-4 rounded-[1.5rem] lg:rounded-[2.5rem] border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-3 md:gap-5 flex-1 ring-1 ring-inset ring-white/10 overflow-hidden">
            {/* Mobile Header */}
            <div className="flex items-center justify-between lg:hidden p-1" onClick={() => setShowConfig(!showConfig)}>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Settings2 className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cấu hình & Model</span>
                </div>
                {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {/* Config Section */}
            {showConfig && (
                <div className="flex flex-col gap-3 md:gap-4 animate-in slide-in-from-top-2 duration-300 overflow-y-auto no-scrollbar">
                    <ModelSelector 
                        selectedModelId={selectedModelId}
                        onModelSelect={(id) => {
                            setSelectedModelId(id);
                            const model = MODEL_OPTIONS.find(m => m.id === id);
                            if (model) setModelTier(model.tier as any);
                            if (id.includes('pro') && !apiKeySelected) handleSelectKey();
                        }}
                    />

                    <div className={`grid ${modelTier === 'pro' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 transition-all duration-300`}>
                        {modelTier === 'pro' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2">
                                <label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2">Độ phân giải</label>
                                <div className="relative group">
                                    <select 
                                        value={imageSize} 
                                        onChange={(e) => setImageSize(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.2rem] py-2.5 px-4 text-[10px] font-black text-purple-600 dark:text-purple-400 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500/20 transition-all"
                                    >
                                        {['1K', '2K', '4K'].map(size => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-purple-500 transition-colors" />
                                </div>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2">Tỷ lệ khung hình</label>
                            <div className="relative group">
                                <select 
                                    value={aspectRatio} 
                                    onChange={(e) => setAspectRatio(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.2rem] py-2.5 px-4 text-[10px] font-black text-purple-600 dark:text-purple-400 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500/20 transition-all"
                                >
                                    {supportedRatios.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-purple-500 transition-colors" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2 hidden lg:block">1. Ảnh Mẫu Gốc (Model)</label>
                        <div 
                            onClick={() => modelInputRef.current?.click()} 
                            onDragOver={(e) => handleDragOver(e, 'model')}
                            onDragLeave={(e) => handleDragLeave(e, 'model')}
                            onDrop={(e) => handleDrop(e, 'model')} 
                            className={`relative h-24 lg:h-36 rounded-[1.2rem] lg:rounded-[1.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden outline-none group ${modelImage ? 'border-purple-400/50' : isDraggingModel ? 'border-purple-400 bg-purple-400/5' : 'border-white/20 hover:border-purple-400/50'}`}
                        >
                            {modelImage ? (
                                <>
                                    <img src={`data:image/png;base64,${modelImage}`} className="w-full h-full object-contain p-2" />
                                    <button onClick={(e) => { e.stopPropagation(); setModelImage(null); }} className="absolute top-2 right-2 z-20 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg"><X className="w-3 h-3" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setPreviewImage(modelImage); }} className="absolute bottom-2 right-2 z-20 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-lg"><Maximize2 className="w-3 h-3" /></button>
                                </>
                            ) : (
                                <div className="text-center pointer-events-none"><ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" /><span className="text-[9px] font-bold text-slate-500 uppercase block">Tải Ảnh / Paste</span></div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center px-1"><label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Prompt</label></div>
                        
                        {/* Prompt Suggestions Chips */}
                        <div className="flex flex-wrap gap-1.5 pb-1">
                            {PROMPT_SUGGESTIONS.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handlePromptChange(s.text)}
                                    className="px-2 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-[9px] font-bold text-purple-400 hover:text-purple-300 transition-all whitespace-nowrap shadow-sm"
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <textarea value={activePrompt} onChange={(e) => handlePromptChange(e.target.value)} className="w-full p-2.5 text-[10px] md:text-xs bg-black/10 dark:bg-black/20 border border-white/5 rounded-xl outline-none resize-none h-14 md:h-16 text-white dark:text-white shadow-inner" placeholder="Mô tả..." />
                    </div>
                </div>
            )}

            {/* Garment List & Generate Button */}
            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">2. Danh sách đồ ({jobs.length})</label>
                    {jobs.length > 0 && <button onClick={() => setJobs([])} className="text-[9px] text-red-400 hover:text-red-500 font-bold uppercase">Clear</button>}
                </div>
                <div 
                    className={`flex-1 bg-black/5 dark:bg-black/20 rounded-[1.2rem] lg:rounded-[1.5rem] border p-2 overflow-hidden relative flex flex-col shadow-inner ${isDraggingGarment ? 'border-purple-400 ring-2 ring-purple-400/20' : 'border-white/10'}`}
                    onDragOver={(e) => handleDragOver(e, 'garment')}
                    onDragLeave={(e) => handleDragLeave(e, 'garment')}
                    onDrop={(e) => handleDrop(e, 'garment')}
                >
                    <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar h-full lg:h-auto items-center lg:items-stretch">
                        <div onClick={() => garmentInputRef.current?.click()} className="w-14 h-14 lg:w-full lg:h-16 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all shrink-0 border-white/20 hover:bg-white/5 bg-white/5 hover:border-purple-400 group">
                            <Plus className="w-5 h-5 text-slate-400 group-hover:text-purple-400" />
                        </div>
                        {jobs.map(job => (
                            <div key={job.id} onClick={() => setFocusedJobId(focusedJobId === job.id ? null : job.id)} className={`w-14 h-14 lg:w-full lg:h-auto flex-shrink-0 flex lg:flex-row flex-col justify-center lg:justify-start gap-1 lg:gap-3 p-1 lg:p-2 rounded-xl border items-center group cursor-pointer transition-all relative hover:translate-x-1 ${focusedJobId === job.id ? 'bg-purple-600/20 border-purple-400/50 shadow-md' : 'bg-white/10 border-white/5 hover:bg-white/15'}`}>
                                <div className="relative group/image flex-shrink-0">
                                    <img src={`data:image/png;base64,${job.garmentBase64}`} className="w-12 h-12 lg:w-10 lg:h-10 rounded-lg object-cover bg-white/5" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(job.garmentBase64); }} 
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-lg"
                                    >
                                        <Maximize2 className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                                <div className="flex-1 min-w-0 hidden lg:block">
                                    <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-slate-300">Garment_{job.id}</span></div>
                                    <p className="text-[8px] uppercase font-black text-slate-500">{job.status}</p>
                                </div>
                                <div className="hidden lg:flex items-center"><button onClick={(e) => removeJob(job.id, e)} className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <button onClick={generateAll} disabled={!modelImage || isProcessing || jobs.length === 0} className="w-full py-3 md:py-4 rounded-[1.2rem] lg:rounded-[1.5rem] font-black text-white flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 shadow-xl shadow-purple-500/30 uppercase tracking-[0.2em] text-[10px] md:text-xs relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />} <span>{isProcessing ? `Đang xử lý (${timer.toFixed(1)}s)...` : "Thực hiện"}</span>
            </button>
          </div>
        </div>

        {/* Main Grid View */}
        <div className="flex-1 flex flex-col overflow-hidden order-2 lg:order-2 relative">
            {/* ... (Keep existing results view logic) ... */}
            <div className="mb-2 md:mb-3 flex items-center justify-between bg-white/5 backdrop-blur-3xl p-2 md:p-3 rounded-2xl border border-white/10 shadow-lg shrink-0">
                 <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-widest pl-2">
                        Kết quả ({jobs.filter(j => j.status === 'completed').length})
                    </span>
                    {jobs.some(j => j.status === 'completed') && (
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-xl hover:bg-white/10 text-[8px] md:text-[9px] font-black uppercase text-slate-400 border border-transparent hover:border-white/10">
                            {selectedJobs.size > 0 ? <CheckSquare className="w-3 h-3 text-purple-400" /> : <Square className="w-3 h-3" />} <span className="hidden md:inline">Select All</span>
                        </button>
                    )}
                </div>
                <button onClick={handleBulkDownload} disabled={selectedJobs.size === 0} className="px-3 py-1.5 md:px-5 md:py-2 rounded-xl font-black text-[8px] md:text-[9px] uppercase flex items-center gap-2 transition-all shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 hover:shadow-purple-500/40">
                    <DownloadCloud className="w-3.5 h-3.5" /> <span>Tải xuống ({selectedJobs.size})</span>
                </button>
            </div>

            <div className="flex-1 bg-black/20 backdrop-blur-3xl rounded-[1.5rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl border border-white/10 ring-1 ring-inset ring-white/10 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto no-scrollbar p-3 md:p-4 pb-20 md:pb-24">
                    {jobs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                            <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
                                <Shirt className="w-16 h-16 text-white" />
                            </div>
                            <p className="font-black text-white uppercase tracking-[0.3em] text-xs">Studio Ready</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                            {jobs.map((job) => (
                                <div key={job.id} className={`group relative bg-white/5 backdrop-blur-2xl rounded-[1rem] md:rounded-[1.5rem] border border-white/10 overflow-hidden shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 flex flex-col aspect-[3/4] ${selectedJobs.has(job.id) ? 'ring-2 ring-purple-400' : ''}`}>
                                    {job.status === 'completed' && job.resultBase64 ? (
                                        <>
                                            <LazyImage src={`data:image/png;base64,${job.resultBase64}`} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 left-2 w-8 h-8 md:w-12 md:h-12 rounded-lg border border-white/20 shadow-lg overflow-hidden bg-black/40 backdrop-blur-sm z-10 transition-transform group-hover:scale-110">
                                                <LazyImage src={`data:image/png;base64,${job.garmentBase64}`} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 p-2 md:p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                                <div className="flex gap-2">
                                                    <button onClick={() => setPreviewImage(job.resultBase64!)} className="p-1.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/30 border border-white/10 shadow-lg"><Maximize2 className="w-3 h-3 md:w-4 md:h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingJobId(job.id); }} className="p-1.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/30 border border-white/10 shadow-lg" title="Chỉnh sửa màu/ánh sáng"><Sliders className="w-3 h-3 md:w-4 md:h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); generateJob(job.id); }} className="p-1.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/30 border border-white/10 shadow-lg"><RefreshCw className="w-3 h-3 md:w-4 md:h-4" /></button>
                                                </div>
                                                <button onClick={() => toggleSelection(job.id)} className={`p-1.5 backdrop-blur-md rounded-xl border transition-all shadow-lg ${selectedJobs.has(job.id) ? 'bg-purple-500 text-white border-purple-500' : 'bg-white/10 text-white border-white/10 hover:bg-white/30'}`}>{selectedJobs.has(job.id) ? <CheckSquare className="w-3 h-3 md:w-4 md:h-4" /> : <Square className="w-3 h-3 md:w-4 md:h-4" />}</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-black/40">
                                            <div className={`absolute inset-0 transition-all ${job.status === 'processing' ? 'opacity-30 blur-sm scale-110' : 'opacity-20 blur-xl'}`}><img src={`data:image/png;base64,${job.garmentBase64}`} className="w-full h-full object-cover" /></div>
                                            <div className="relative z-10 flex flex-col items-center">
                                                {job.status === 'processing' ? (<div className="flex flex-col items-center bg-black/40 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl"><Loader2 className="w-5 h-5 md:w-6 md:h-6 text-purple-400 animate-spin mb-2" /><span className="text-[9px] font-black uppercase text-purple-200 tracking-widest">Processing</span></div>) : (<><Layers className="w-6 h-6 md:w-8 md:h-8 text-slate-500 mb-2 opacity-50" /><span className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 tracking-widest">Wait</span></>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <input type="file" ref={modelInputRef} onChange={handleModelUpload} accept="image/*" className="hidden" />
      <input type="file" ref={garmentInputRef} onChange={handleGarmentUpload} accept="image/*" multiple className="hidden" />

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300 pb-[env(safe-area-inset-bottom)]" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 md:top-8 md:right-8 z-[110] text-white/60 hover:text-white bg-white/10 p-2 md:p-3 rounded-2xl border border-white/10 shadow-xl active:scale-90 transition-transform"><X className="w-6 h-6" /></button>
            <div 
                className="relative flex items-center justify-center w-full h-full" 
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={startDrag}
                onMouseMove={onDrag}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={startDrag}
                onTouchMove={onDrag}
                onTouchEnd={endDrag}
            >
                {isComparing && modelImage ? (
                    <div ref={comparisonRef} className="relative w-full h-full max-h-[85vh] object-contain rounded-[1rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] border border-white/10 overflow-hidden cursor-col-resize select-none" style={{ aspectRatio: aspectRatio.replace(':', '/') }} onMouseMove={handleSliderMove} onTouchMove={handleSliderMove}>
                        <img src={`data:image/png;base64,${previewImage}`} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}><img src={`data:image/png;base64,${modelImage}`} className="absolute inset-0 w-full h-full object-contain" /></div>
                        <div className="absolute inset-y-0 w-1 bg-white/80 z-20 pointer-events-none" style={{ left: `${sliderPosition}%` }}><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-2xl border-2 border-purple-900"><Columns className="w-4 h-4 text-purple-900" /></div></div>
                    </div>
                ) : (
                    <img 
                        src={`data:image/png;base64,${previewImage}`} 
                        className="max-w-full max-h-[85vh] object-contain rounded-[1rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] transition-transform duration-100 ease-out select-none"
                        style={{ 
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            cursor: zoom > 1 ? (isDraggingPreview ? 'grabbing' : 'grab') : 'zoom-in'
                        }}
                        draggable={false}
                    />
                )}
                <div className="absolute bottom-6 md:bottom-8 flex gap-4 z-[110]">
                     {modelImage && <button onClick={() => setIsComparing(!isComparing)} className="px-4 py-3 bg-black/60 backdrop-blur-md rounded-2xl text-white font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg hover:scale-105 transition-transform">{isComparing ? <Eye className="w-4 h-4" /> : <Columns className="w-4 h-4" />}<span>{isComparing ? "View" : "Compare"}</span></button>}
                     <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md p-1.5 md:p-2 rounded-2xl border border-white/10 shadow-xl">
                        <button onClick={() => { setZoom(Math.max(1, zoom - 0.5)); if(zoom-0.5 <= 1) setPan({x:0,y:0}); }} className="p-1.5 md:p-2 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90"><ZoomOut className="w-4 h-4"/></button>
                        <span className="text-[10px] font-black text-white w-8 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(Math.min(5, zoom + 0.5))} className="p-1.5 md:p-2 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90"><ZoomIn className="w-4 h-4"/></button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Editor Modal */}
      {editingJobId && jobs.find(j => j.id === editingJobId)?.resultBase64 && (
          <PhotoEditor 
              imageSrc={jobs.find(j => j.id === editingJobId)!.resultBase64!}
              onSave={handleSaveEdit}
              onClose={() => setEditingJobId(null)}
          />
      )}

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default BatchFashionStudio;
