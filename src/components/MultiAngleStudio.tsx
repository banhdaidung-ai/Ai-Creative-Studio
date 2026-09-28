import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { geminiService, ANGLE_CONFIGS, MODEL_OPTIONS } from '../services/gemini';
import { ModelSelector } from './ModelSelector';
import AspectRatioSelector from './AspectRatioSelector';
import { resizeImage, extractRatioFromPrompt } from '../utils/image';
import { generateImageViaFlow, isFlowBackendAvailable, isFlowModel, FLOW_MODEL_IDS } from '../services/flowService';
import PhotoEditor from './PhotoEditor';
import { useProject } from '../contexts/ProjectContext';
import { 
  Camera, Upload, RefreshCw, Download, DownloadCloud,
  Lightbulb, Loader2, Maximize2, X, Layers, Zap, Crown,
  Square, Image as ImageIcon, CheckSquare, Check,
  RotateCcw, Eye, Scan, LayoutGrid, Film, ZoomIn, ZoomOut, User, Shirt, Palette,
  Settings2, ChevronUp, ChevronDown, Sliders, Sparkles, Play, Box
} from 'lucide-react';

const STYLE_PRESETS = [
  { id: 'clean', label: 'Studio Clean', prompt: 'Professional studio lighting, solid neutral background, commercial e-commerce look.' },
  { id: 'street', label: 'Street Style', prompt: 'Natural outdoor daylight, blurred urban background, lifestyle fashion vibe.' },
  { id: 'luxury', label: 'Luxury', prompt: 'Cinematic golden hour lighting, rich textures, high-fashion editorial aesthetic.' },
  { id: 'minimal', label: 'Minimalist', prompt: 'Soft diffuse lighting, simple architectural geometry, muted tones.' },
  { id: 'neon', label: 'Cyberpunk', prompt: 'Neon lighting accents, high contrast, futuristic night city atmosphere.' },
  { id: 'vintage', label: 'Vintage', prompt: 'Warm film grain, retro color grading, nostalgic analog photography look.' },
  { id: 'nature', label: 'Nature', prompt: 'Soft sunlight, organic green background, fresh outdoor atmosphere.' },
  { id: 'monochrome', label: 'B&W Art', prompt: 'High contrast black and white photography, artistic shadows, dramatic mood.' },
];

const MultiAngleStudio: React.FC = () => {
  const { addToHistory, workspaceAsset, addToWorkspace } = useProject();
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [processingAngles, setProcessingAngles] = useState<Set<string>>(new Set());
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(new Set());
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingAngleId, setEditingAngleId] = useState<string | null>(null);
  
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [isDraggingFace, setIsDraggingFace] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);

  const [viewMode, setViewMode] = useState<'reel' | 'grid'>('grid');
  const [showConfig, setShowConfig] = useState(true);
  
  const [timer, setTimer] = useState(0);

  const [prompts, setPrompts] = useState<Record<string, string>>(() => {
    const initialPrompts: Record<string, string> = {};
    ANGLE_CONFIGS.forEach(angle => {
      initialPrompts[angle.id] = angle.userDesc;
    });
    return initialPrompts;
  });

  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return localStorage.getItem('last_selected_model') || FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO;
  });
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('3:4');
  
  // Zoom & Pan State for Preview
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
            if (has) return;
        }
        const flowReady = await isFlowBackendAvailable().catch(() => false);
        if (flowReady) {
            setApiKeySelected(true);
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
            isFlowBackendAvailable().then(ready => {
                if (ready) setApiKeySelected(true);
                else setApiKeySelected(false);
            }).catch(() => setApiKeySelected(false));
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
    if (processingAngles.size > 0) {
      interval = setInterval(() => setTimer(t => t + 0.1), 100);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [processingAngles.size]);

  useEffect(() => {
    if (previewImage) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }
  }, [previewImage]);

  const processFile = React.useCallback(async (file: File, type: 'model' | 'face' | 'back') => {
    if (!file.type.startsWith('image/')) return;
    
    if (type === 'model') {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = objectUrl;
        img.onload = () => {
          const closest = getClosestRatio(img.width, img.height);
          setAspectRatio(closest);
          URL.revokeObjectURL(objectUrl);
        };
    }
    
    const base64 = await resizeImage(file, 1536, 'image/jpeg', 0.88);
    if (type === 'model') {
        setModelImage(base64);
        setResults({});
        setProcessingAngles(new Set());
        setSelectedAngles(new Set());
        if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (type === 'face') {
        setFaceImage(base64);
        if (faceInputRef.current) faceInputRef.current.value = '';
    } else if (type === 'back') {
        setBackImage(base64);
        if (backInputRef.current) backInputRef.current.value = '';
    }
  }, [aspectRatio]);

  // Handle Paste Event
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) imageFiles.push(file);
            }
        }

        if (imageFiles.length > 0) {
            // Priority: Model -> Face -> Back
            if (!modelImage) {
                await processFile(imageFiles[0], 'model');
                if (imageFiles.length > 1) await processFile(imageFiles[1], 'face');
                if (imageFiles.length > 2) await processFile(imageFiles[2], 'back');
            } else if (!faceImage) {
                await processFile(imageFiles[0], 'face');
                if (imageFiles.length > 1) await processFile(imageFiles[1], 'back');
            } else {
                await processFile(imageFiles[0], 'back');
            }
        }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [modelImage, faceImage, backImage, processFile]);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
        try {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        } catch (e) { console.error(e); }
    } else {
        toast.info('Vui lòng kích hoạt Pro bằng tài khoản Google hoặc nhập API Key tại nút Unlock Pro bên góc trái!');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'model' | 'face' | 'back' = 'model') => {
    const file = e.target.files?.[0];
    if (file) processFile(file, type);
  };

  const handleDragOver = (e: React.DragEvent, type: 'model' | 'face' | 'back') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'model') setIsDraggingModel(true);
    else if (type === 'face') setIsDraggingFace(true);
    else if (type === 'back') setIsDraggingBack(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'model' | 'face' | 'back') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'model') setIsDraggingModel(false);
    else if (type === 'face') setIsDraggingFace(false);
    else if (type === 'back') setIsDraggingBack(false);
  };

  const handleDrop = async (e: React.DragEvent, type: 'model' | 'face' | 'back') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'model') setIsDraggingModel(false);
    else if (type === 'face') setIsDraggingFace(false);
    else if (type === 'back') setIsDraggingBack(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0], type);
    }
  };

  const generateAngle = async (angleId: string) => {
    if (!modelImage) return;
    const isFlow = isFlowModel(selectedModelId);
    let flowReady = false;
    if (isFlow) {
      flowReady = await isFlowBackendAvailable().catch(() => false);
    }

    if (!isFlow && MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' && !apiKeySelected) {
        handleSelectKey();
        return;
    }
    if (window.innerWidth < 1024) setShowConfig(false);

    setProcessingAngles(prev => new Set(prev).add(angleId));
    try {
        let result: string | null | undefined = null;

        if (isFlow && flowReady) {
            const angleConfig = ANGLE_CONFIGS.find(a => a.id === angleId);
            const stylePrompt = STYLE_PRESETS.find(s => s.id === selectedStyle)?.prompt || '';
            const customUserPrompt = prompts[angleId] || angleConfig?.userDesc || '';
            const prompt = `Professional high-end fashion lookbook photoshoot of the identical model wearing the exact same clothes from reference. Camera framing and angle: ${angleConfig?.promptDesc || ''}. Model pose: ${customUserPrompt}. ${stylePrompt}. Maintain 100% consistent model facial identity, body proportions, identical garment fabrics and patterns, studio flash lighting, 8k resolution, crisp photorealistic quality.`;

            let refImg = modelImage;
            if ((angleId === 'close' || angleId === 'macro') && faceImage) refImg = faceImage;
            else if (angleId === 'back' && backImage) refImg = backImage;

            const flowResult = await generateImageViaFlow({
                prompt,
                aspectRatio,
                numImages: 1,
                model: selectedModelId,
                referenceImageBase64: refImg,
                referenceImageMime: refImg.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg',
            });

            if (flowResult) {
                result = flowResult.startsWith('data:') ? flowResult.split(',')[1] : flowResult;
            }
        } else if (isFlow && !flowReady) {
            throw new Error('FLOW_BACKEND_UNAVAILABLE: Google Flow Backend chưa khả dụng trên môi trường web này. Vui lòng cấu hình URL (VITE_FLOW_BACKEND_URL) để sử dụng online.');
        } else {
            result = await geminiService.generateSingleAngle(
                modelImage, 
                angleId, 
                [], 
                { 
                    aspectRatio: aspectRatio, 
                    imageSize: imageSize,
                    modelId: selectedModelId,
                    customPrompt: prompts[angleId],
                    faceImageBase64: faceImage || undefined,
                    backImageBase64: backImage || undefined,
                    stylePrompt: STYLE_PRESETS.find(s => s.id === selectedStyle)?.prompt
                }
            );
        }

        if (result) {
            setResults(prev => ({ ...prev, [angleId]: result! }));
            setSelectedAngles(prev => new Set(prev).add(angleId));
            
            // Add to global history
            addToHistory({
              url: `data:image/png;base64,${result}`,
              prompt: prompts[angleId],
              mode: 'MULTI_ANGLE'
            });
            toast.success(`Đã tạo xong góc: ${ANGLE_CONFIGS.find(a => a.id === angleId)?.name || angleId}`);
        } else {
            throw new Error('Không nhận được kết quả từ AI.');
        }
    } catch (err: any) { 
        console.error(err); 
        toast.error(`Lỗi khi tạo góc ${ANGLE_CONFIGS.find(a => a.id === angleId)?.name || angleId}`, { 
            description: err.message || 'Vui lòng kiểm tra lại cấu hình hoặc kết nối Google Flow.' 
        });
    } finally {
        setProcessingAngles(prev => {
            const next = new Set(prev);
            next.delete(angleId);
            return next;
        });
    }
  };

  const generateAll = async () => {
    if (!modelImage || processingAngles.size > 0) return;
    const isFlow = isFlowModel(selectedModelId);
    const selectedModel = MODEL_OPTIONS.find(m => m.id === selectedModelId);
    if (!isFlow && selectedModel?.tier === 'pro' && !apiKeySelected) { handleSelectKey(); return; }
    if (window.innerWidth < 1024) setShowConfig(false);

    // Sequential generation ensures stability and avoids Flow rate limits
    for (const angle of ANGLE_CONFIGS) {
        await generateAngle(angle.id);
    }
  };

  const toggleSelectAll = () => {
      const allResultIds = Object.keys(results);
      if (selectedAngles.size === allResultIds.length && allResultIds.length > 0) {
          setSelectedAngles(new Set());
      } else {
          setSelectedAngles(new Set(allResultIds));
      }
  };

  const toggleSelection = (id: string) => {
    setSelectedAngles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDownload = () => {
      Array.from(selectedAngles).forEach((id, index) => {
          const base64 = results[id];
          if (base64) {
              setTimeout(() => {
                  const link = document.createElement('a');
                  link.href = `data:image/png;base64,${base64}`;
                  link.download = `yody-${id}-${Date.now()}.png`;
                  link.click();
              }, index * 400);
          }
      });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (previewImage) {
        e.stopPropagation();
        const scaleAmount = -e.deltaY * 0.001;
        const nextZoom = Math.min(Math.max(1, zoom + scaleAmount), 5);
        setZoom(nextZoom);
        if (nextZoom === 1) setPan({ x: 0, y: 0 });
    }
  };

  const startDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1) {
        e.preventDefault();
        setIsDraggingPreview(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else {
        setZoom(2); 
    }
  };

  const onDrag = (e: React.MouseEvent) => {
    if (isDraggingPreview && zoom > 1) {
        e.preventDefault();
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const endDrag = () => {
    setIsDraggingPreview(false);
  };

  const handleSaveEdit = (editedBase64: string) => {
      if (editingAngleId) {
          setResults(prev => ({ ...prev, [editingAngleId]: editedBase64 }));
          if (previewImage === results[editingAngleId]) setPreviewImage(editedBase64);
      }
      setEditingAngleId(null);
  };

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col p-2 md:p-4 overflow-hidden outline-none" tabIndex={0}>
      {/* Header */}
      <div className="mb-2 md:mb-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 md:p-2.5 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/30">
            <Camera className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-none">Studio Đa Góc</h2>
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-yellow-500 block mt-0.5">Tự động tạo các góc chụp với Posing tùy chỉnh.</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-3 md:gap-4 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-full lg:w-[320px] flex flex-col gap-4 transition-all duration-300 shrink-0 order-2 lg:order-1 ${showConfig ? 'h-auto max-h-[50vh] lg:max-h-full lg:h-full' : 'h-auto'}`}>
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl p-3 md:p-4 rounded-[2rem] md:rounded-[2.5rem] border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-3 md:gap-4 flex-1 ring-1 ring-inset ring-white/10 overflow-hidden">
            <div className="flex items-center justify-between lg:hidden p-1" onClick={() => setShowConfig(!showConfig)}>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Settings2 className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cấu hình & Model</span>
                </div>
                {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {showConfig && (
                <div className="flex flex-col gap-3 md:gap-4 overflow-y-auto no-scrollbar flex-1 pb-16">
                    {/* 1. Quality */}
                    <ModelSelector selectedModelId={selectedModelId} onModelSelect={setSelectedModelId} />

                    <div className={`grid ${MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                        {/* 2. Resolution (Pro Only) */}
                        {MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                                <label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2">Độ phân giải</label>
                                <div className="relative group">
                                    <select 
                                        value={imageSize}
                                        onChange={(e) => setImageSize(e.target.value)}
                                        className="w-full appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-3 pr-8 text-[10px] font-black text-yellow-600 dark:text-yellow-400 shadow-sm outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >
                                        {['1K', '2K', '4K'].map(size => <option key={size} value={size} className="bg-slate-800 text-white">{size}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-yellow-500/70 pointer-events-none group-hover:translate-y-0.5 transition-transform" />
                                </div>
                            </div>
                        )}

                        {/* 3. Aspect Ratio */}
                        <div className={`space-y-1.5 ${MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier !== 'pro' ? 'col-span-2' : ''}`}>
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
                    </div>

                    {/* 4. Styles - Compact 2-column grid */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2">Phong cách ảnh</label>
                        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                            {STYLE_PRESETS.map(style => (
                                <button 
                                    key={style.id} 
                                    onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                                    className={`px-2 py-2 rounded-xl text-[8px] md:text-[9px] font-bold text-left transition-all border leading-tight ${selectedStyle === style.id ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    {style.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 5. Inputs */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                        {/* Main Model */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2">1. Ảnh Gốc (Full Body)</label>
                                {workspaceAsset && (
                                    <button 
                                        onClick={() => setModelImage(workspaceAsset.url.split(',')[1])}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-all"
                                    >
                                        <Box size={10} /> Load Workspace
                                    </button>
                                )}
                            </div>
                            <div 
                                onClick={() => fileInputRef.current?.click()} 
                                onDragOver={(e) => handleDragOver(e, 'model')}
                                onDragLeave={(e) => handleDragLeave(e, 'model')}
                                onDrop={(e) => handleDrop(e, 'model')}
                                className={`group relative h-28 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${modelImage ? 'border-yellow-400/50' : isDraggingModel ? 'border-yellow-400 bg-yellow-400/5' : 'border-white/20 hover:border-yellow-400/50'}`}
                            >
                                {modelImage ? (
                                    <>
                                        <img src={`data:image/png;base64,${modelImage}`} className="w-full h-full object-contain p-2" />
                                        <button onClick={(e) => { e.stopPropagation(); setModelImage(null); }} className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white shadow-lg"><X className="w-3 h-3"/></button>
                                    </>
                                ) : (
                                    <div className="text-center p-2">
                                        <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-bold text-slate-500 uppercase block leading-tight">Tải Ảnh / Paste</span>
                                        <span className="text-[7px] text-slate-600 uppercase font-black tracking-widest">DRAG & DROP</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Face & Back */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">2. Chân dung (Mặt)</label>
                                <div 
                                    onClick={() => faceInputRef.current?.click()} 
                                    onDragOver={(e) => handleDragOver(e, 'face')}
                                    onDragLeave={(e) => handleDragLeave(e, 'face')}
                                    onDrop={(e) => handleDrop(e, 'face')}
                                    className={`h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all group ${faceImage ? 'border-blue-400/50' : isDraggingFace ? 'border-blue-400 bg-blue-400/5' : 'border-white/20 hover:border-yellow-400/50'}`}
                                >
                                    {faceImage ? (
                                        <>
                                            <img src={`data:image/png;base64,${faceImage}`} className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); setFaceImage(null); }} className="absolute top-1 right-1 p-0.5 bg-red-500 rounded-full text-white shadow-md"><X className="w-3 h-3"/></button>
                                        </>
                                    ) : (
                                        <div className="text-center">
                                            <User className="w-4 h-4 text-slate-400 mx-auto mb-1 opacity-60 group-hover:scale-110 transition-transform" />
                                            <span className="text-[8px] font-bold text-slate-500 uppercase block">DRAG / PASTE</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">3. Mặt sau (Áo/Đồ)</label>
                                <div 
                                    onClick={() => backInputRef.current?.click()} 
                                    onDragOver={(e) => handleDragOver(e, 'back')}
                                    onDragLeave={(e) => handleDragLeave(e, 'back')}
                                    onDrop={(e) => handleDrop(e, 'back')}
                                    className={`h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all group ${backImage ? 'border-purple-400/50' : isDraggingBack ? 'border-purple-400 bg-purple-400/5' : 'border-white/20 hover:border-yellow-400/50'}`}
                                >
                                    {backImage ? (
                                        <>
                                            <img src={`data:image/png;base64,${backImage}`} className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); setBackImage(null); }} className="absolute top-1 right-1 p-0.5 bg-red-500 rounded-full text-white shadow-md"><X className="w-3 h-3"/></button>
                                        </>
                                    ) : (
                                        <div className="text-center">
                                            <Shirt className="w-4 h-4 text-slate-400 mx-auto mb-1 opacity-60 group-hover:scale-110 transition-transform" />
                                            <span className="text-[8px] font-bold text-slate-500 uppercase block">DRAG / PASTE</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Render Button */}
                    <button onClick={generateAll} disabled={!modelImage || processingAngles.size > 0} className="w-full py-3 md:py-4 rounded-[1.5rem] md:rounded-[1.8rem] font-black text-white flex items-center justify-center gap-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:scale-105 active:scale-95 shadow-2xl relative overflow-hidden group shrink-0 uppercase tracking-[0.2em] text-[10px] md:text-xs mt-2 transition-all">
                        {processingAngles.size > 0 ? <Loader2 className="w-4 h-4 animate-spin text-yellow-200" /> : <Zap className="w-4 h-4 fill-current text-yellow-200" />}
                        <span>{processingAngles.size > 0 ? `Rendering (${timer.toFixed(1)}s)...` : "Tạo Bộ Ảnh"}</span>
                    </button>

                    {/* Pro Tip */}
                    <div className="p-3 bg-slate-500/10 border border-slate-500/20 rounded-xl flex gap-2">
                        <Lightbulb className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Professional Tip</p>
                            <p className="text-[9px] text-slate-400/80 leading-relaxed font-medium">Bấm Ctrl+V để dán ảnh trực tiếp từ clipboard vào các ô upload theo thứ tự.</p>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden order-1 lg:order-2">
            <div className="mb-2 md:mb-3 flex items-center justify-between bg-white/5 backdrop-blur-3xl p-2 md:p-3 rounded-2xl border border-white/10 shadow-lg shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-widest">Góc Máy ({Object.keys(results).length})</span>
                    {Object.keys(results).length > 0 && <button onClick={toggleSelectAll} className="flex items-center gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-xl hover:bg-white/10 text-[8px] md:text-[9px] font-black uppercase text-slate-400 transition-all border border-transparent hover:border-white/10">{selectedAngles.size === Object.keys(results).length ? <CheckSquare className="w-3 h-3 text-yellow-400" /> : <Square className="w-3 h-3" />} <span className="hidden md:inline">Select All</span></button>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode('reel')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'reel' ? 'bg-white/20 text-yellow-400' : 'text-slate-500 hover:text-slate-300'}`}><Film className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/20 text-yellow-400' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
                    <button onClick={handleBulkDownload} disabled={selectedAngles.size === 0} className="px-3 py-1.5 md:px-5 md:py-2 rounded-xl font-black text-[8px] md:text-[9px] uppercase flex items-center gap-2 transition-all shadow-xl bg-blue-600 text-white hover:bg-blue-500"><DownloadCloud className="w-3.5 h-3.5" /> <span className="hidden md:inline">Download ({selectedAngles.size})</span></button>
                </div>
            </div>

            <div className="flex-1 bg-black/20 backdrop-blur-3xl rounded-[2rem] md:rounded-[3rem] relative overflow-hidden shadow-2xl border border-white/10 ring-1 ring-inset ring-white/10 flex flex-col min-h-0">
                <div className={`flex-1 ${viewMode === 'reel' ? 'overflow-x-auto overflow-y-hidden flex items-center' : 'overflow-y-auto overflow-x-hidden'} no-scrollbar p-3 md:p-4 transition-all`}>
                    <div className={viewMode === 'reel' ? "flex gap-3 px-2 mx-auto md:mx-0" : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 w-full"}>
                        {ANGLE_CONFIGS.map((config) => (
                            <div key={config.id} className={`${viewMode === 'reel' ? 'w-[200px] md:w-[250px] flex-shrink-0' : 'w-full'} group relative bg-white/5 backdrop-blur-2xl rounded-[1rem] md:rounded-[1.5rem] border border-white/10 overflow-hidden shadow-xl transition-all duration-500 hover:shadow-2xl flex flex-col ${selectedAngles.has(config.id) ? 'ring-2 ring-yellow-400' : ''}`}>
                                <div className={`relative w-full bg-black/40 overflow-hidden ${aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[3/4]'}`}>
                                    {processingAngles.has(config.id) ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-20"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin mb-2" /><span className="text-[8px] font-bold text-yellow-400/60 uppercase tracking-widest">Rendering...</span></div>
                                    ) : results[config.id] ? (
                                        <>
                                            <img src={`data:image/png;base64,${results[config.id]}`} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 inset-x-0 p-2 md:p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                                <div className="flex gap-1.5 md:gap-2">
                                                    <button onClick={() => setPreviewImage(results[config.id])} className="p-1.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/30 border border-white/10" title="Phóng to"><Maximize2 className="w-3 h-3 md:w-4 md:h-4" /></button>
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            addToWorkspace({
                                                                url: `data:image/png;base64,${results[config.id]}`,
                                                                prompt: prompts[config.id],
                                                                mode: 'MULTI_ANGLE'
                                                            });
                                                        }} 
                                                        className="p-1.5 bg-amber-500/80 backdrop-blur-md rounded-xl text-white hover:bg-amber-500 border border-white/10" 
                                                        title="Gửi vào Workspace"
                                                    >
                                                        <Box className="w-3 h-3 md:w-4 md:h-4" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingAngleId(config.id); }} className="p-1.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/30 border border-white/10" title="Sửa ảnh"><Sliders className="w-3 h-3 md:w-4 md:h-4" /></button>
                                                    <button onClick={() => generateAngle(config.id)} className="p-1.5 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/30 border border-white/10" title="Tạo lại"><RefreshCw className="w-3 h-3 md:w-4 md:h-4" /></button>
                                                    <button 
                                                        onClick={() => {
                                                            const link = document.createElement('a');
                                                            link.href = `data:image/png;base64,${results[config.id]}`;
                                                            link.download = `yody-angle-${config.id}-${Date.now()}.png`;
                                                            link.click();
                                                        }} 
                                                        className="p-1.5 bg-emerald-500/80 backdrop-blur-md rounded-xl text-white hover:bg-emerald-600 border border-white/10" 
                                                        title="Tải xuống"
                                                    >
                                                        <Download className="w-3 h-3 md:w-4 md:h-4" />
                                                    </button>
                                                </div>
                                                <button onClick={() => toggleSelection(config.id)} className={`p-1.5 rounded-xl border transition-all ${selectedAngles.has(config.id) ? 'bg-yellow-400 text-blue-900 border-yellow-500' : 'bg-white/10 text-white border-white/10 hover:bg-white/30'}`}>{selectedAngles.has(config.id) ? <Check className="w-3 h-3 md:w-4 md:h-4" /> : <Square className="w-3 h-3 md:w-4 md:h-4" />}</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
                                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20"><Layers className="w-8 h-8 md:w-12 md:h-12 text-white mb-2" /><span className="text-[7px] font-black uppercase text-white tracking-widest">{config.name}</span></div>
                                            {modelImage && (
                                                <button 
                                                    onClick={() => generateAngle(config.id)}
                                                    className="relative z-10 p-4 rounded-full bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-400 backdrop-blur-sm border border-yellow-400/30 group/btn transition-all hover:scale-110 active:scale-95 shadow-2xl"
                                                    title="Tạo góc chụp này"
                                                >
                                                    <Play className="w-6 h-6 fill-current group-hover/btn:animate-pulse" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 border-t border-white/5 bg-white/5">
                                    <textarea 
                                        value={prompts[config.id]} 
                                        onChange={(e) => setPrompts(prev => ({...prev, [config.id]: e.target.value}))}
                                        className="w-full bg-transparent text-[9px] text-slate-400 focus:text-white outline-none resize-none h-10 leading-tight font-medium placeholder-slate-600 focus:bg-black/20 rounded p-1 transition-colors"
                                        placeholder="Mô tả góc chụp..."
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'model')} accept="image/*" className="hidden" />
      <input type="file" ref={faceInputRef} onChange={(e) => handleFileUpload(e, 'face')} accept="image/*" className="hidden" />
      <input type="file" ref={backInputRef} onChange={(e) => handleFileUpload(e, 'back')} accept="image/*" className="hidden" />

      {/* Editor Modal */}
      {editingAngleId && results[editingAngleId] && (
          <PhotoEditor 
              imageSrc={results[editingAngleId]}
              onSave={handleSaveEdit}
              onClose={() => setEditingAngleId(null)}
          />
      )}

      {/* Fullscreen Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 z-[110] text-white/60 hover:text-white bg-white/10 p-2 rounded-2xl"><X className="w-6 h-6" /></button>
            <div className="relative flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()} onWheel={handleWheel} onMouseDown={startDrag} onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
                <img src={`data:image/png;base64,${previewImage}`} className="max-w-full max-h-[85vh] object-contain rounded-[1rem] shadow-2xl transition-transform duration-100 ease-out select-none" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? (isDraggingPreview ? 'grabbing' : 'grab') : 'zoom-in' }} draggable={false} />
            </div>
        </div>
      )}

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default MultiAngleStudio;