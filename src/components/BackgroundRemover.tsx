
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService } from '../services/gemini';
import { 
  Upload, Eraser, Download, Loader2, AlertCircle, CheckCircle2, 
  RefreshCw, Box, X, Palette, Image as ImageIcon, 
  Paintbrush, RotateCcw, 
  Settings2, Sparkles, Wand2, Plus, Trash2, Maximize2, LayoutGrid
} from 'lucide-react';
import { fileToBase64, applyMask } from '../utils/image';
import { useProject } from '../contexts/ProjectContext';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ComparisonSlider from './ComparisonSlider';
import Skeleton from './Skeleton';

type BackgroundType = 'transparent' | 'color' | 'image' | 'prompt';

interface RefineLine {
  tool: 'pen' | 'eraser';
  points: number[];
  size: number;
  opacity: number;
}

const PRESET_BACKGROUNDS = [
  { id: 'studio-1', name: 'Studio Trắng', url: 'https://picsum.photos/seed/studio-white/1920/1080' },
  { id: 'studio-2', name: 'Studio Xám', url: 'https://picsum.photos/seed/studio-gray/1920/1080' },
  { id: 'nature-1', name: 'Rừng Xanh', url: 'https://picsum.photos/seed/forest/1920/1080' },
  { id: 'nature-2', name: 'Bãi Biển', url: 'https://picsum.photos/seed/beach/1920/1080' },
  { id: 'office-1', name: 'Văn Phòng', url: 'https://picsum.photos/seed/office/1920/1080' },
  { id: 'city-1', name: 'Thành Phố', url: 'https://picsum.photos/seed/city/1920/1080' },
];

interface BatchItem {
  id: string;
  original: string;
  result: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

const BackgroundRemover: React.FC = () => {
  const { workspaceAsset, setWorkspaceAsset } = useProject();
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [transparentResult, setTransparentResult] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Batch Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [modelTier, setModelTier] = useState<'standard' | 'pro'>('pro');

  // Background Settings
  const [bgType, setBgType] = useState<BackgroundType>('transparent');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgPrompt, setBgPrompt] = useState('');
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [feather, setFeather] = useState(0);
  const [shadow, setShadow] = useState(0);

  // Manual Refinement
  const [isRefining, setIsRefining] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState(20);
  const [lines, setLines] = useState<RefineLine[]>([]);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [maskImgElement, setMaskImgElement] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<any>(null);
  const isDrawing = useRef(false);

  // Responsive Stage Size for Refinement
  const [stageSize, setStageSize] = useState({ width: 600, height: 800 });
  const refineContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRefining && refineContainerRef.current && imgElement) {
        const container = refineContainerRef.current;
        const padding = 40;
        const maxWidth = container.clientWidth - padding;
        const maxHeight = container.clientHeight - padding - 80; // leave room for tools
        
        let scale = Math.min(maxWidth / imgElement.width, maxHeight / imgElement.height);
        if (scale > 1) scale = 1; // don't upscale too much
        
        setStageSize({
             width: imgElement.width * scale,
             height: imgElement.height * scale
        });
    }
  }, [isRefining, imgElement]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isBatchMode) {
      const newItems: BatchItem[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const base64 = await fileToBase64(files[i]);
          newItems.push({
            id: Math.random().toString(36).substr(2, 9),
            original: base64,
            result: null,
            status: 'pending'
          });
        } catch {
          toast.error(`Lỗi đọc file: ${files[i].name}`);
        }
      }
      setBatchItems(prev => [...prev, ...newItems]);
    } else {
      const file = files[0];
      try {
        const base64 = await fileToBase64(file);
        setImage(base64);
        setOriginalImage(base64);
        setMask(null);
        setTransparentResult(null);
        setFinalResult(null);
        setLines([]);
        setError(null);
        
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        img.onload = () => setImgElement(img);
      } catch {
        setError("Lỗi đọc file ảnh.");
      }
    }
  };

  const processBatch = async () => {
    if (batchItems.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    
    const itemsToProcess = batchItems.filter(item => item.status === 'pending');
    
    for (const item of itemsToProcess) {
      setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
      
      try {
        const maskBase64 = await geminiService.removeBackground(item.original, modelTier, {
          imageSize: modelTier === 'pro' ? '2K' : undefined
        });
        if (maskBase64) {
          const transparent = await applyMask(item.original, maskBase64);
          setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', result: transparent } : i));
        } else {
          setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Không tạo được mask' } : i));
        }
      } catch (err: any) {
        setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message } : i));
      }
    }
    
    setIsBatchProcessing(false);
    toast.success("Đã xử lý xong hàng loạt!");
  };

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const downloadBatchResults = () => {
    const completedItems = batchItems.filter(item => item.status === 'completed' && item.result);
    if (completedItems.length === 0) return;
    
    completedItems.forEach((item, index) => {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${item.result}`;
      link.download = `batch_result_${index}_${Date.now()}.png`;
      link.click();
    });
  };

  const handleBgImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setBgImage(`data:image/png;base64,${base64}`);
        setBgType('image');
      } catch {
        toast.error("Lỗi đọc file ảnh nền.");
      }
    }
  };

  const handleGenerateBg = async () => {
    if (!bgPrompt) {
      toast.error('Vui lòng nhập mô tả nền.');
      return;
    }
    
    setIsGeneratingBg(true);
    try {
      const generatedBase64 = await geminiService.generateImage(`A professional high-quality background without any subject, seamlessly integrating with this description: ${bgPrompt}`, {
        modelId: 'imagen-4.0-generate-001',
        aspectRatio: '1:1'
      });
      if (generatedBase64) {
        setBgImage(`data:image/png;base64,${generatedBase64}`);
        setBgType('image');
        toast.success('Đã tạo nền thành công!');
      }
    } catch (err: any) {
      toast.error('Lỗi khi tạo nền.', { description: err.message });
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const processImage = async () => {
    if (!image) return;
    setIsProcessing(true);
    setError(null);
    try {
      const maskBase64 = await geminiService.removeBackground(image, modelTier, { 
        imageSize: modelTier === 'pro' ? '2K' : undefined 
      });
      if (maskBase64) {
        setMask(maskBase64);
        
        const maskImg = new Image();
        maskImg.src = `data:image/png;base64,${maskBase64}`;
        maskImg.onload = () => setMaskImgElement(maskImg);

        const transparent = await applyMask(image, maskBase64);
        setTransparentResult(transparent);
        
        toast.success("Tách nền thành công!");
      } else {
        setError("Không thể tạo mask tách nền.");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi tách nền.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Final Result with Background, Feather, and Shadow
  const generateFinalResult = useCallback(async () => {
    if (!transparentResult) return;

    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = `data:image/png;base64,${transparentResult}`;
    
    await new Promise((resolve) => { img.onload = resolve; });
    
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Background
    if (bgType === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgType === 'image' && bgImage) {
      const bgImg = new Image();
      bgImg.src = bgImage;
      bgImg.crossOrigin = "anonymous";
      await new Promise((resolve) => { bgImg.onload = resolve; });
      
      // Cover logic
      const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
      const x = (canvas.width - bgImg.width * scale) / 2;
      const y = (canvas.height - bgImg.height * scale) / 2;
      ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
    }

    // 2. Draw Shadow (Simple drop shadow)
    if (shadow > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = shadow * 5;
      ctx.shadowOffsetX = shadow * 2;
      ctx.shadowOffsetY = shadow * 2;
    }

    // 3. Draw Subject with Feathering
    if (feather > 0) {
      // Use a temporary canvas for feathering
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.filter = `blur(${feather}px)`;
        tempCtx.drawImage(img, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    } else {
      ctx.drawImage(img, 0, 0);
    }

    setFinalResult(canvas.toDataURL('image/png').split(',')[1]);
  }, [transparentResult, bgType, bgColor, bgImage, feather, shadow]);

  useEffect(() => {
    if (transparentResult) {
      generateFinalResult();
    }
  }, [transparentResult, bgType, bgColor, bgImage, feather, shadow, generateFinalResult]);

  // Manual Refinement Handlers
  const handleMouseDown = (e: any) => {
    if (!isRefining) return;
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y], size: brushSize, opacity: 1 }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || !isRefining) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const saveRefinedMask = async () => {
    if (!stageRef.current || !imgElement) return;
    
    // Create a canvas to export the refined mask
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.width;
    canvas.height = imgElement.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw original mask as base
    if (maskImgElement) {
      ctx.drawImage(maskImgElement, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw manual lines
    // We need to scale the lines back to original image size
    const stage = stageRef.current;
    const scale = imgElement.width / stage.width();
    
    lines.forEach(line => {
      ctx.beginPath();
      ctx.lineWidth = line.size * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = line.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = line.tool === 'eraser' ? 'black' : 'white';
      
      const points = line.points;
      ctx.moveTo(points[0] * scale, points[1] * scale);
      for (let i = 2; i < points.length; i += 2) {
        ctx.lineTo(points[i] * scale, points[i+1] * scale);
      }
      ctx.stroke();
    });

    const refinedMaskBase64 = canvas.toDataURL('image/png').split(',')[1];
    setMask(refinedMaskBase64);
    
    const maskImg = new Image();
    maskImg.src = `data:image/png;base64,${refinedMaskBase64}`;
    maskImg.onload = () => setMaskImgElement(maskImg);

    const transparent = await applyMask(originalImage!, refinedMaskBase64);
    setTransparentResult(transparent);
    setIsRefining(false);
    toast.success("Đã cập nhật mặt nạ!");
  };

  const downloadResult = () => {
    if (!finalResult) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${finalResult}`;
    link.download = `removed_bg_${Date.now()}.png`;
    link.click();
  };

  const addToWorkspace = () => {
    if (finalResult) {
      setWorkspaceAsset({
        id: Date.now().toString(),
        url: `data:image/png;base64,${finalResult}`,
        prompt: 'Background Removed Result',
        timestamp: Date.now(),
        mode: 'BACKGROUND_REMOVER'
      });
      toast.success("Đã thêm vào Workspace!");
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar bg-slate-950">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-500 to-amber-500 uppercase tracking-tighter"
          >
            AI Background Remover Pro
          </motion.h2>
          <p className="text-slate-400 font-medium tracking-wide">Tách nền & Thay bối cảnh chuyên nghiệp trong tích tắc</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left: Input & Controls */}
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-6 backdrop-blur-xl">
                <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chế độ làm việc</label>
                    <div className="flex bg-black/40 p-1 rounded-full border border-white/10">
                        <button 
                            onClick={() => setIsBatchMode(false)}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wide transition-all ${!isBatchMode ? 'bg-pink-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Đơn lẻ
                        </button>
                        <button 
                            onClick={() => setIsBatchMode(true)}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wide transition-all ${isBatchMode ? 'bg-pink-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Hàng loạt
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mô hình AI</label>
                    <div className="flex bg-black/40 p-1 rounded-full border border-white/10">
                        <button 
                            onClick={() => setModelTier('standard')}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wide transition-all ${modelTier === 'standard' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Standard
                        </button>
                        <button 
                            onClick={() => setModelTier('pro')}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wide transition-all ${modelTier === 'pro' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Pro
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {isBatchMode ? 'Danh sách ảnh' : 'Ảnh đầu vào'}
                        </label>
                        {!isBatchMode && workspaceAsset && (
                            <button 
                                onClick={() => {
                                    const base64 = workspaceAsset.url.split(',')[1];
                                    setImage(base64);
                                    setOriginalImage(base64);
                                    setTransparentResult(null);
                                    setFinalResult(null);
                                    const img = new Image();
                                    img.src = workspaceAsset.url;
                                    img.onload = () => setImgElement(img);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-all border border-pink-500/20"
                            >
                                <Box size={10} /> Load Workspace
                            </button>
                        )}
                    </div>
                    
                    {isBatchMode ? (
                        <div className="space-y-3">
                            <div 
                                onClick={() => batchInputRef.current?.click()}
                                className="w-full py-8 bg-black/40 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-pink-500/50 transition-all group"
                            >
                                <div className="p-4 bg-pink-500/10 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                                    <Plus className="w-6 h-6 text-pink-500" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thêm nhiều ảnh</span>
                                <input type="file" ref={batchInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {batchItems.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 group">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0">
                                            <img src={`data:image/png;base64,${item.original}`} className="w-full h-full object-cover" alt="Batch" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-slate-400 uppercase truncate">Image_{item.id.substr(0,4)}</span>
                                                {item.status === 'processing' && <Loader2 size={10} className="text-pink-500 animate-spin" />}
                                                {item.status === 'completed' && <CheckCircle2 size={10} className="text-emerald-500" />}
                                                {item.status === 'error' && <AlertCircle size={10} className="text-red-500" />}
                                            </div>
                                            <div className="h-1 w-full bg-white/5 rounded-full mt-1.5 overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${item.status === 'completed' ? 'w-full bg-emerald-500' : item.status === 'processing' ? 'w-1/2 bg-pink-500 animate-pulse' : item.status === 'error' ? 'w-full bg-red-500' : 'w-0'}`}
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeBatchItem(item.id)}
                                            className="p-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {batchItems.length > 0 && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={processBatch}
                                        disabled={isBatchProcessing || batchItems.every(i => i.status === 'completed')}
                                        className="flex-1 py-4 bg-pink-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                                    >
                                        {isBatchProcessing ? 'Đang xử lý...' : 'Bắt đầu xử lý'}
                                    </button>
                                    <button 
                                        onClick={downloadBatchResults}
                                        disabled={!batchItems.some(i => i.status === 'completed')}
                                        className="p-4 bg-white/5 text-slate-400 rounded-2xl border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-all"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative aspect-[3/4] bg-black/40 border-2 border-dashed border-white/10 rounded-[2rem] overflow-hidden group transition-all hover:border-pink-500/50">
                            {image ? (
                                <>
                                    <img src={`data:image/png;base64,${image}`} className="w-full h-full object-contain" alt="Input" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-3 bg-white text-black rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all"
                                            title="Thay đổi ảnh"
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                        <button 
                                            onClick={() => { setImage(null); setTransparentResult(null); setFinalResult(null); }}
                                            className="p-3 bg-red-500 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all"
                                            title="Xóa ảnh"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                                >
                                    <div className="p-6 bg-pink-500/10 rounded-3xl mb-4 group-hover:scale-110 transition-transform border border-pink-500/20">
                                        <Upload className="w-10 h-10 text-pink-500" />
                                    </div>
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Tải ảnh lên</p>
                                    <p className="text-[10px] text-slate-500 mt-2 uppercase">PNG, JPG up to 10MB</p>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        </div>
                    )}
                </div>

                {!isBatchMode && (
                    <button
                        onClick={processImage}
                        disabled={!image || isProcessing}
                        className="w-full py-5 bg-gradient-to-r from-pink-500 via-rose-600 to-amber-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 group"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                Đang phân tích...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                Tách Nền Ngay
                            </>
                        )}
                    </button>
                )}

                {transparentResult && (
                    <div className="pt-6 border-t border-white/10 space-y-6">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Palette size={12} className="text-pink-500" />
                                Tùy chọn nền
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                <button 
                                    onClick={() => setBgType('transparent')}
                                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${bgType === 'transparent' ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <Maximize2 size={16} />
                                    <span className="text-[8px] font-bold uppercase">Trong suốt</span>
                                </button>
                                <button 
                                    onClick={() => setBgType('color')}
                                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${bgType === 'color' ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <Palette size={16} />
                                    <span className="text-[8px] font-bold uppercase">Màu sắc</span>
                                </button>
                                <button 
                                    onClick={() => setBgType('image')}
                                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${bgType === 'image' ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <ImageIcon size={16} />
                                    <span className="text-[8px] font-bold uppercase">Hình ảnh</span>
                                </button>
                                <button 
                                    onClick={() => setBgType('prompt')}
                                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${bgType === 'prompt' ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <Sparkles size={16} />
                                    <span className="text-[8px] font-bold uppercase">Nền AI</span>
                                </button>
                            </div>

                            {bgType === 'prompt' && (
                                <div className="space-y-3 p-4 bg-black/40 rounded-2xl border border-white/10">
                                    <textarea 
                                        value={bgPrompt}
                                        onChange={(e) => setBgPrompt(e.target.value)}
                                        placeholder="Ví dụ: Nền studio màu pastel, rực rỡ, chuyên nghiệp..."
                                        className="w-full text-xs bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 min-h-[80px]"
                                    />
                                    <button 
                                        onClick={handleGenerateBg}
                                        disabled={isGeneratingBg || !bgPrompt}
                                        className="w-full py-3 bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-pink-600 disabled:opacity-50 transition-colors"
                                    >
                                        {isGeneratingBg ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                        {isGeneratingBg ? 'Đang tạo...' : 'Tạo nền AI'}
                                    </button>
                                </div>
                            )}

                            {bgType === 'color' && (
                                <div className="flex items-center gap-3 p-3 bg-black/40 rounded-2xl border border-white/10">
                                    <input 
                                        type="color" 
                                        value={bgColor} 
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg bg-transparent cursor-pointer"
                                    />
                                    <span className="text-xs font-mono text-slate-400 uppercase">{bgColor}</span>
                                </div>
                            )}

                            {bgType === 'image' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {PRESET_BACKGROUNDS.slice(0, 3).map(bg => (
                                            <button 
                                                key={bg.id}
                                                onClick={() => { setBgImage(bg.url); setBgType('image'); }}
                                                className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${bgImage === bg.url ? 'border-pink-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            >
                                                <img src={bg.url} className="w-full h-full object-cover" alt={bg.name} />
                                            </button>
                                        ))}
                                        <button 
                                            onClick={() => bgInputRef.current?.click()}
                                            className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-white/20 transition-all"
                                        >
                                            <Plus size={16} />
                                            <span className="text-[7px] font-bold uppercase">Tải lên</span>
                                        </button>
                                    </div>
                                    <input type="file" ref={bgInputRef} onChange={handleBgImageChange} className="hidden" accept="image/*" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Làm mượt biên (Feather)</label>
                                    <span className="text-[10px] font-bold text-pink-400">{feather}px</span>
                                </div>
                                <input 
                                    type="range" min="0" max="10" step="1" 
                                    value={feather} onChange={(e) => setFeather(parseInt(e.target.value))}
                                    className="w-full accent-pink-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Đổ bóng (Shadow)</label>
                                    <span className="text-[10px] font-bold text-pink-400">{shadow}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="10" step="1" 
                                    value={shadow} onChange={(e) => setShadow(parseInt(e.target.value))}
                                    className="w-full accent-pink-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsRefining(true)}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 group"
                        >
                            <Paintbrush size={18} className="text-pink-500 group-hover:rotate-12 transition-transform" />
                            Tinh chỉnh thủ công
                        </button>
                    </div>
                )}
            </div>
          </div>

          {/* Right: Preview & Result */}
          <div className="xl:col-span-8 space-y-6">
            <div className="bg-black/40 border border-white/10 rounded-[3rem] p-8 min-h-[600px] flex flex-col relative overflow-hidden backdrop-blur-3xl">
                {/* Background Pattern for Transparency */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <div className="flex-1 flex items-center justify-center relative">
                    <AnimatePresence mode="wait">
                        {isRefining ? (
                            <motion.div 
                                key="refining"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full h-full flex flex-col items-center gap-6"
                                ref={refineContainerRef}
                            >
                                <div className="flex gap-4 p-3 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl shrink-0">
                                    <button 
                                        onClick={() => setTool('pen')}
                                        className={`p-3 rounded-2xl transition-all ${tool === 'pen' ? 'bg-pink-500 text-white' : 'text-slate-400 hover:bg-white/10'}`}
                                    >
                                        <Paintbrush size={20} />
                                    </button>
                                    <button 
                                        onClick={() => setTool('eraser')}
                                        className={`p-3 rounded-2xl transition-all ${tool === 'eraser' ? 'bg-pink-500 text-white' : 'text-slate-400 hover:bg-white/10'}`}
                                    >
                                        <Eraser size={20} />
                                    </button>
                                    <div className="w-px bg-white/10 mx-2"></div>
                                    <div className="flex items-center gap-3 px-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Size</span>
                                        <input 
                                            type="range" min="5" max="100" 
                                            value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                            className="w-32 accent-pink-500 h-1 bg-white/10 rounded-full cursor-pointer"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => setLines([])}
                                        className="p-3 text-slate-400 hover:text-red-400 transition-colors"
                                    >
                                        <RotateCcw size={20} />
                                    </button>
                                </div>

                                <div className="relative bg-black/60 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex-1 flex items-center justify-center">
                                    <Stage
                                        width={stageSize.width || 600}
                                        height={stageSize.height || 800}
                                        onMouseDown={handleMouseDown}
                                        onMousemove={handleMouseMove}
                                        onMouseup={handleMouseUp}
                                        onMouseLeave={handleMouseUp}
                                        ref={stageRef}
                                        className={tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}
                                    >
                                        <Layer>
                                            {imgElement && (
                                                <KonvaImage 
                                                    image={imgElement} 
                                                    width={stageSize.width || 600} 
                                                    height={stageSize.height || 800} 
                                                    opacity={0.3}
                                                />
                                            )}
                                            {maskImgElement && (
                                                <KonvaImage 
                                                    image={maskImgElement} 
                                                    width={stageSize.width || 600} 
                                                    height={stageSize.height || 800} 
                                                    opacity={0.7}
                                                />
                                            )}
                                            {lines.map((line, i) => (
                                                <Line
                                                    key={i}
                                                    points={line.points}
                                                    stroke={line.tool === 'eraser' ? 'black' : 'white'}
                                                    strokeWidth={line.size}
                                                    tension={0.5}
                                                    lineCap="round"
                                                    lineJoin="round"
                                                    globalCompositeOperation={
                                                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                                                    }
                                                />
                                            ))}
                                        </Layer>
                                    </Stage>
                                </div>

                                <div className="flex gap-4 shrink-0">
                                    <button 
                                        onClick={() => setIsRefining(false)}
                                        className="px-8 py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                                    >
                                        Hủy bỏ
                                    </button>
                                    <button 
                                        onClick={saveRefinedMask}
                                        className="px-12 py-4 bg-pink-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Lưu thay đổi
                                    </button>
                                </div>
                            </motion.div>
                        ) : finalResult ? (
                            <motion.div 
                                key="result"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full h-full flex flex-col items-center justify-center gap-8"
                            >
                                <div className="relative group max-h-[70vh] aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(236,72,153,0.15)] border border-white/10 w-full">
                                    <ComparisonSlider 
                                        beforeImage={image || ''} 
                                        afterImage={`data:image/png;base64,${finalResult}`}
                                        className="w-full h-full"
                                    />
                                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                                        <button 
                                            onClick={downloadResult}
                                            className="p-4 bg-white text-black rounded-2xl shadow-2xl hover:scale-110 transition-transform"
                                        >
                                            <Download size={24} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-4 w-full max-w-md">
                                    <button
                                        onClick={() => { setImage(null); setTransparentResult(null); setFinalResult(null); }}
                                        className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-3xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        Làm mới
                                    </button>
                                    <button
                                        onClick={addToWorkspace}
                                        className="flex-1 py-5 bg-amber-500 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Box className="w-5 h-5" />
                                        Workspace
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="text-center space-y-6 max-w-md">
                                <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto border border-white/10">
                                    <Sparkles className="w-12 h-12 text-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-lg font-black text-slate-500 uppercase tracking-widest">Sẵn sàng tách nền</p>
                                    <p className="text-xs text-slate-600 font-medium leading-relaxed">Tải ảnh lên và nhấn nút để bắt đầu trải nghiệm công nghệ AI tách nền đỉnh cao.</p>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>

                    {isProcessing && (
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-50 rounded-[3rem] p-12">
                            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
                                <div className="w-full max-w-md aspect-[3/4] space-y-4">
                                    <Skeleton className="w-full h-full rounded-[2.5rem]" />
                                </div>
                                <div className="flex flex-col items-center gap-6">
                                    <div className="relative">
                                        <Loader2 className="w-20 h-20 text-pink-500 animate-spin" />
                                        <Wand2 className="w-8 h-8 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <span className="text-sm font-black text-white uppercase tracking-[0.3em] animate-pulse block">AI is processing</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Đang nhận diện chủ thể và tách lớp...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Batch Info / Tips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
                    <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center">
                        <Maximize2 size={20} className="text-pink-500" />
                    </div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">PNG Trong Suốt</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Tự động xuất file PNG chất lượng cao với nền trong suốt, sẵn sàng cho thiết kế.</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                        <LayoutGrid size={20} className="text-amber-500" />
                    </div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Thay Nền Thông Minh</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Thư viện bối cảnh đa dạng từ Studio đến Thiên nhiên, giúp chủ thể nổi bật hơn.</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                        <Settings2 size={20} className="text-emerald-500" />
                    </div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Tinh Chỉnh Pro</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Công cụ thủ công cho phép bạn can thiệp sâu vào từng chi tiết nhỏ nhất của mask.</p>
                </div>
            </div>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-400"
          >
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BackgroundRemover;
