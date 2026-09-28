import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { geminiService, MODEL_OPTIONS } from '../services/gemini';
import { ModelSelector } from './ModelSelector';
import { resizeImage } from '../utils/image';
import { generateImageViaFlow, isFlowBackendAvailable, isFlowModel, FLOW_MODEL_IDS } from '../services/flowService';
import MaskDrawEditor from './MaskDrawEditor';
import AspectRatioSelector from './AspectRatioSelector';
import { 
  UserCircle, Shirt, Layers, X, 
  Download, Columns, Eye, Zap, 
  Loader2, PenTool,
  Plus, ChevronDown, Wand2, Settings2, ChevronUp, Crown
} from 'lucide-react';

interface TryOnJob {
  modelImage: string | null;
  topRef: string | null;
  bottomRef: string | null;
  accessoryRef: string | null;
  resultImage: string | null;
  prompt: string;
}

const VirtualTryOn: React.FC = () => {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [topRef, setTopRef] = useState<string | null>(null);
  const [bottomRef, setBottomRef] = useState<string | null>(null);
  const [accessoryRef, setAccessoryRef] = useState<string | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [showConfig, setShowConfig] = useState(true);
  
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return localStorage.getItem('last_selected_model') || FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO;
  });
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('3:4');

  const comparisonRef = useRef<HTMLDivElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const topInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const accessoryInputRef = useRef<HTMLInputElement>(null);

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
    if (isLoading) {
      interval = setInterval(() => setTimer(t => t + 0.1), 100);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

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

  const processFile = async (file: File, type: 'model' | 'top' | 'bottom' | 'accessory') => {
    if (!file.type.startsWith('image/')) return;
    const base64 = await resizeImage(file, 1536, 'image/jpeg', 0.88);
    if (type === 'model') {
        setModelImage(base64);
        setResultImage(null);
    } else if (type === 'top') setTopRef(base64);
    else if (type === 'bottom') setBottomRef(base64);
    else if (type === 'accessory') setAccessoryRef(base64);
  };

  const handleTryOn = async () => {
    if (!modelImage || (!topRef && !bottomRef)) {
      setError("Vui lòng tải ảnh người mẫu và ít nhất một ảnh sản phẩm (Áo hoặc Quần).");
      return;
    }

    const isFlow = isFlowModel(selectedModelId);
    let flowReady = false;
    if (isFlow) {
      flowReady = await isFlowBackendAvailable().catch(() => false);
    }

    if (!isFlow && MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' && !apiKeySelected) {
      handleSelectKey();
      return;
    }

    setIsLoading(true);
    setError(null);
    if (window.innerWidth < 1024) setShowConfig(false);

    // Construct highly specialized prompt
    const outfitDesc = [];
    const refs = [];
    if (topRef) {
        outfitDesc.push("the jacket/top garment from product reference");
        refs.push(topRef);
    }
    if (bottomRef) {
        outfitDesc.push("the jeans/bottom garment from product reference");
        refs.push(bottomRef);
    }
    if (accessoryRef) {
        outfitDesc.push("the accessory from product reference");
        refs.push(accessoryRef);
    }

    let prompt = `Virtual fashion try-on: Replace the existing clothes on the model with: ${outfitDesc.join(' and ')}. 
    REQUIREMENTS:
    1. Perfect Edge isolation: The new garments must fit naturally onto the model's body with sharp, clean contours.
    2. Zero White Halo: Seamless integration between the garments, model body, and background.
    3. Material Fidelity: Realistic fabric textures, folds, wrinkles, and natural shadows corresponding to the model's pose.
    4. Identity Preservation: Maintain 100% identical facial features and body proportions of the original model.`;

    if (maskImage) {
        refs.push(maskImage);
        prompt += `\n\nCRITICAL MASK INSTRUCTION: An inpainting mask is provided. Only modify areas within the mask and keep everything else identical.`;
    }

    try {
      let result: string | null | undefined = null;

      if (isFlow && flowReady) {
        toast.info('Đang thực hiện ướm đồ qua Google Flow...');
        const flowResult = await generateImageViaFlow({
          prompt,
          aspectRatio,
          numImages: 1,
          model: selectedModelId,
          referenceImageBase64: modelImage,
          referenceImageMime: modelImage.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg',
        });
        if (flowResult) {
          result = flowResult.startsWith('data:') ? flowResult.split(',')[1] : flowResult;
        }
      } else if (isFlow && !flowReady) {
        throw new Error('FLOW_BACKEND_UNAVAILABLE: Google Flow Backend chưa khả dụng trên môi trường web này. Vui lòng cấu hình URL (VITE_FLOW_BACKEND_URL) để sử dụng online.');
      } else {
        result = await geminiService.editImage(modelImage, prompt, refs, {
          modelId: selectedModelId,
          aspectRatio,
          imageSize
        });
      }

      if (result) {
        setResultImage(result);
        toast.success('Đã ướm thử trang phục thành công!');
      } else {
        throw new Error("Không nhận được kết quả từ AI.");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi thực hiện ướm thử.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!comparisonRef.current) return;
    const rect = comparisonRef.current.getBoundingClientRect();
    const xPos = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    setSliderPosition(Math.max(0, Math.min(100, (xPos / rect.width) * 100)));
  };

  const Dropzone = ({ label, icon: Icon, image, onClear, onClick, sublabel }: any) => (
    <div className="space-y-1.5 flex-1">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">{label}</label>
        <div 
            onClick={onClick}
            className={`group relative h-28 md:h-36 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
                image ? 'border-indigo-400/50 bg-indigo-500/5' : 'border-white/10 hover:border-indigo-400/50 hover:bg-white/5'
            }`}
        >
            {image ? (
                <>
                    <img src={`data:image/png;base64,${image}`} className="w-full h-full object-contain p-2" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClear(); }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </>
            ) : (
                <div className="text-center p-4">
                    <Icon className="w-6 h-6 text-slate-400 mx-auto mb-1.5 opacity-40 group-hover:scale-110 transition-transform" />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter leading-tight">{sublabel || 'Tải ảnh'}</p>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col p-2 md:p-4 overflow-hidden">
      <div className="mb-3 md:mb-5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 md:p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
            <UserCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-none">Ướm Thử AI</h2>
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-indigo-500 block mt-1">Virtual Try-On: Kết hợp trang phục lên người mẫu.</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Sidebar - Controls */}
        <div className={`w-full lg:w-[340px] flex flex-col gap-4 transition-all duration-300 shrink-0 order-2 lg:order-1 ${showConfig ? 'h-auto max-h-[50vh] lg:max-h-full lg:h-full' : 'h-auto'}`}>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-4 flex-1 ring-1 ring-inset ring-white/10 overflow-hidden">
                
                {/* Mobile Toggle */}
                <div className="flex items-center justify-between lg:hidden p-1" onClick={() => setShowConfig(!showConfig)}>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Settings2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cấu hình & Model</span>
                    </div>
                    {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {showConfig && (
                    <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar flex-1">
                        {/* Model Selection */}
                        <ModelSelector selectedModelId={selectedModelId} onModelSelect={setSelectedModelId} />

                        {MODEL_OPTIONS.find(m => m.id === selectedModelId)?.tier === 'pro' && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Độ phân giải</label>
                                <div className="flex bg-black/10 dark:bg-black/20 p-1 rounded-xl">
                                    {['1K', '2K', '4K'].map(size => (
                                        <button 
                                            key={size}
                                            onClick={() => setImageSize(size)}
                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${imageSize === size ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Aspect Ratio */}
                        <div className="space-y-1.5">
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

                        <div className="relative">
                            <Dropzone 
                                label="1. Người Mẫu (Body)" 
                                icon={UserCircle} 
                                image={modelImage} 
                                onClear={() => { setModelImage(null); setMaskImage(null); }} 
                                onClick={() => modelInputRef.current?.click()} 
                                sublabel="Ảnh toàn thân"
                            />
                            {modelImage && (
                                <button 
                                    onClick={() => setShowMaskEditor(true)}
                                    className={`absolute top-2 right-10 p-1.5 rounded-lg text-[9px] font-bold flex items-center gap-1 shadow-md transition-all ${maskImage ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800/80 backdrop-blur-md text-blue-400 border border-blue-500/30 hover:bg-slate-700/80'}`}
                                >
                                    <PenTool className="w-3.5 h-3.5" />
                                    {maskImage ? 'Sửa Mask' : ' Vẽ Mask'}
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Dropzone 
                                label="2. Áo (Top)" 
                                icon={Shirt} 
                                image={topRef} 
                                onClear={() => setTopRef(null)} 
                                onClick={() => topInputRef.current?.click()} 
                            />
                            <Dropzone 
                                label="3. Quần/Váy" 
                                icon={Layers} 
                                image={bottomRef} 
                                onClear={() => setBottomRef(null)} 
                                onClick={() => bottomInputRef.current?.click()} 
                            />
                        </div>
                         
                         <Dropzone 
                            label="4. Phụ kiện (Optional)" 
                            icon={Wand2} 
                            image={accessoryRef} 
                            onClear={() => setAccessoryRef(null)} 
                            onClick={() => accessoryInputRef.current?.click()} 
                        />

                        <button
                            onClick={handleTryOn}
                            disabled={isLoading || !modelImage || (!topRef && !bottomRef)}
                            className={`w-full py-3 md:py-4 rounded-[1.5rem] font-black text-white flex items-center justify-center gap-3 transition-all uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-xl relative overflow-hidden group shrink-0 ${
                                isLoading || !modelImage || (!topRef && !bottomRef) ? 'bg-slate-700/50 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:scale-105 active:scale-95'
                            }`}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                            <span>{isLoading ? `AI Processing (${timer.toFixed(1)}s)...` : "Ướm Thử Ngay"}</span>
                        </button>
                        
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                                <div className="text-red-500 shrink-0 mt-0.5"><Zap className="w-3 h-3" /></div>
                                <p className="text-[9px] text-red-400 font-medium">{error}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden order-1 lg:order-2">
             <div className="flex-1 bg-black/20 backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] relative overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center p-4 ring-1 ring-inset ring-white/10 min-h-[300px]">
                {!resultImage && !isLoading && (
                    <div className="text-center opacity-50">
                        <Shirt className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 text-indigo-400" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kết quả hiển thị tại đây</p>
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md z-20">
                         <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4 shadow-2xl"></div>
                         <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Fitting Room...</p>
                    </div>
                )}

                {resultImage && (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        {isComparing && modelImage ? (
                             <div 
                                ref={comparisonRef}
                                className="relative w-full h-full max-h-[85vh] object-contain rounded-[1rem] shadow-2xl border border-white/10 overflow-hidden cursor-col-resize select-none"
                                onMouseMove={handleSliderMove}
                                onTouchMove={handleSliderMove}
                            >
                                <img src={`data:image/png;base64,${resultImage}`} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                                <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                                    <img src={`data:image/png;base64,${modelImage}`} className="absolute inset-0 w-full h-full object-contain" />
                                </div>
                                <div className="absolute inset-y-0 w-1 bg-white/80 shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20 pointer-events-none" style={{ left: `${sliderPosition}%` }}>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-2xl rounded-full flex items-center justify-center shadow-2xl border-2 border-indigo-900">
                                        <Columns className="w-4 h-4 text-indigo-900" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <img 
                                src={`data:image/png;base64,${resultImage}`} 
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" 
                            />
                        )}

                        <div className="absolute bottom-6 flex gap-3 z-30">
                            {modelImage && (
                                <button 
                                    onClick={() => setIsComparing(!isComparing)}
                                    className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl text-white font-black text-[9px] uppercase tracking-widest border border-white/10 hover:bg-black/80 flex items-center gap-2"
                                >
                                    {isComparing ? <Eye className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
                                    <span>{isComparing ? 'View' : 'Compare'}</span>
                                </button>
                            )}
                            <a 
                                href={`data:image/png;base64,${resultImage}`} 
                                download={`yody-tryon-${Date.now()}.png`}
                                className="px-6 py-2 bg-indigo-600 rounded-xl text-white font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-indigo-500 flex items-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" /> Download
                            </a>
                        </div>
                    </div>
                )}
             </div>
        </div>
      </div>

      <input type="file" ref={modelInputRef} onChange={(e) => { if(e.target.files?.[0]) processFile(e.target.files[0], 'model') }} accept="image/*" className="hidden" />
      <input type="file" ref={topInputRef} onChange={(e) => { if(e.target.files?.[0]) processFile(e.target.files[0], 'top') }} accept="image/*" className="hidden" />
      <input type="file" ref={bottomInputRef} onChange={(e) => { if(e.target.files?.[0]) processFile(e.target.files[0], 'bottom') }} accept="image/*" className="hidden" />
      <input type="file" ref={accessoryInputRef} onChange={(e) => { if(e.target.files?.[0]) processFile(e.target.files[0], 'accessory') }} accept="image/*" className="hidden" />
      
      {showMaskEditor && modelImage && (
          <MaskDrawEditor 
              imageSrc={modelImage}
              onSave={(maskStr) => { setMaskImage(maskStr); setShowMaskEditor(false); }}
              onCancel={() => setShowMaskEditor(false)}
          />
      )}
      
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default VirtualTryOn;