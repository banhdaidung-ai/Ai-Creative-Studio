
import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Image as KonvaImage } from 'react-konva';
import { X, Eraser, Paintbrush, RotateCcw, Check, Loader2, Sparkles, Undo2, ZoomIn, ZoomOut, Maximize2, MousePointer2, Wand2, Shirt, User, Image as ImageIcon, Upload, Plus, Trash2, Eye, EyeOff, Scissors, FlipHorizontal } from 'lucide-react';
import { GeminiService } from '../services/gemini';

const geminiService = new GeminiService();

interface RefinementEditorProps {
  image: string; // base64
  onSave: (maskBase64: string, prompt: string, referenceImages?: string[]) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

const RefinementEditor: React.FC<RefinementEditorProps> = ({ image, onSave, onClose, isProcessing }) => {
  const [tool, setTool] = useState<'pen' | 'eraser' | 'pan' | 'lasso'>('pen');
  const [lines, setLines] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [brushOpacity, setBrushOpacity] = useState(0.6);
  const [brushSoftness, setBrushSoftness] = useState(10);
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isInverted, setIsInverted] = useState(false);
  
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMask, setShowMask] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isAutoMasking, setIsAutoMasking] = useState(false);

  const updateSize = () => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setStageSize({ width, height });
    }
  };

  const handleUndo = () => {
    setLines(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setLines([]);
  };

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(5, Math.max(0.1, prev + delta)));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling with space
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
      }

      if (e.ctrlKey && e.key === 'z') {
        handleUndo();
      } else if (e.key === '[') {
        setBrushSize(prev => Math.max(5, prev - 5));
      } else if (e.key === ']') {
        setBrushSize(prev => Math.min(150, prev + 5));
      } else if (e.key === ' ') {
        setTool('pan');
      } else if (e.key.toLowerCase() === 'b') {
        setTool('pen');
      } else if (e.key.toLowerCase() === 'l') {
        setTool('lasso');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key.toLowerCase() === 'h') {
        setTool('pan');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === ' ') setTool('pen');
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = `data:image/png;base64,${image}`;
    img.onload = () => {
      setImgElement(img);
      updateSize();
    };
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [image]);

  const getBaseScale = () => {
    if (!imgElement || stageSize.width === 0) return 1;
    const scaleW = stageSize.width / imgElement.width;
    const scaleH = stageSize.height / imgElement.height;
    return Math.min(scaleW, scaleH) * 0.9;
  };

  const handleMouseDown = (e: any) => {
    if (tool === 'pan') return;
    setIsDrawing(true);
    const stage = e.target.getStage();
    if (!stage) return;
    
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const pos = transform.point(pointerPos);
    const bScale = getBaseScale();
    
    // Convert to Original Image Space
    const imgX = pos.x / bScale;
    const imgY = pos.y / bScale;
    
    setLines(prev => [...prev, { 
        tool: tool === 'lasso' ? 'pen' : tool, 
        points: [imgX, imgY], 
        size: tool === 'lasso' ? 2 : brushSize / (bScale * zoom),
        opacity: tool === 'lasso' ? 0.8 : brushOpacity,
        softness: tool === 'lasso' ? 0 : brushSoftness / (bScale * zoom),
        fill: tool === 'lasso' ? 'rgba(59, 130, 246, 0.4)' : undefined,
        closed: tool === 'lasso' ? true : false
    }]);
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const pos = transform.point(pointerPos);
    const bScale = getBaseScale();
    
    // Store cursor position in Stage Space for the preview circle
    setCursorPos(pos);

    if (!isDrawing || tool === 'pan') return;
    
    // Convert to Original Image Space
    const imgX = pos.x / bScale;
    const imgY = pos.y / bScale;
    
    setLines(prev => {
        if (prev.length === 0) return prev;
        const newLines = [...prev];
        const lastLine = { ...newLines[newLines.length - 1] };
        lastLine.points = lastLine.points.concat([imgX, imgY]);
        newLines[newLines.length - 1] = lastLine;
        return newLines;
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && tool === 'lasso') {
        setLines(prev => {
            if (prev.length === 0) return prev;
            const newLines = [...prev];
            const lastLine = { ...newLines[newLines.length - 1] };
            // Close the lasso path
            if (lastLine.points.length >= 4) {
                lastLine.points = lastLine.points.concat([lastLine.points[0], lastLine.points[1]]);
            }
            newLines[newLines.length - 1] = lastLine;
            return newLines;
        });
    }
    setIsDrawing(false);
  };

  const handleAutoMask = async (type: 'clothing' | 'face' | 'background') => {
    if (!imgElement) return;
    setIsAutoMasking(true);
    
    try {
        // For background, we detect the main subject and then we will invert it
        const description = type === 'clothing' ? 'clothing, apparel, garment' : type === 'face' ? 'human face' : 'person, product, main subject';
        const detections = await geminiService.detectObject(image, description);
        
        if (detections && detections.length > 0) {
            const w = imgElement.width;
            const h = imgElement.height;
            
            const newLinesFromDetections = detections.map(det => {
                const [ymin, xmin, ymax, xmax] = det.box_2d;
                const x = (xmin / 1000) * w;
                const y = (ymin / 1000) * h;
                const width = ((xmax - xmin) / 1000) * w;
                const height = ((ymax - ymin) / 1000) * h;
                
                return { 
                    tool: 'pen' as const, 
                    points: [x, y, x + width, y, x + width, y + height, x, y + height, x, y], 
                    size: 2,
                    opacity: 0.8,
                    fill: 'rgba(59, 130, 246, 0.6)',
                    closed: true
                };
            });
            
            setLines(prev => [...prev, ...newLinesFromDetections]);

            // If it's background mode, automatically invert the mask
            if (type === 'background') {
                setIsInverted(true);
            }
        } else {
            // Fallback to simulated mask if AI fails
            const w = imgElement.width;
            const h = imgElement.height;
            if (type === 'clothing') {
                setLines(prev => [...prev, { tool: 'pen', points: [w*0.3, h*0.3, w*0.7, h*0.3, w*0.7, h*0.8, w*0.3, h*0.8, w*0.3, h*0.3], size: 5, opacity: 0.8, fill: 'rgba(59, 130, 246, 0.6)', closed: true }]);
            } else if (type === 'face') {
                setLines(prev => [...prev, { tool: 'pen', points: [w*0.4, h*0.1, w*0.6, h*0.1, w*0.6, h*0.4, w*0.4, h*0.4, w*0.4, h*0.1], size: 5, opacity: 0.8, fill: 'rgba(59, 130, 246, 0.6)', closed: true }]);
            } else {
                // Background fallback: select center and invert
                setLines(prev => [...prev, { tool: 'pen', points: [w*0.2, h*0.2, w*0.8, h*0.2, w*0.8, h*0.8, w*0.2, h*0.8, w*0.2, h*0.2], size: 5, opacity: 0.8, fill: 'rgba(59, 130, 246, 0.6)', closed: true }]);
                setIsInverted(true);
            }
        }
    } catch (error) {
        console.error("Auto-masking failed:", error);
    } finally {
        setIsAutoMasking(false);
    }
  };

  const handleExport = () => {
    if (!stageRef.current || !imgElement) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgElement.width;
    tempCanvas.height = imgElement.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = isInverted ? 'white' : 'black';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw lines
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    lines.forEach(line => {
      ctx.lineWidth = line.size;
      ctx.globalAlpha = line.opacity || 1;
      
      if (isInverted) {
          // Inverted mode: pen draws black (deselect), eraser draws white (select)
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = line.tool === 'eraser' ? 'white' : 'black';
          ctx.fillStyle = line.tool === 'eraser' ? 'white' : 'black';
          ctx.shadowColor = line.tool === 'eraser' ? 'white' : 'black';
      } else {
          // Normal mode: draw white on black
          ctx.globalCompositeOperation = line.tool === 'eraser' ? 'destination-out' : 'source-over';
          ctx.strokeStyle = 'white';
          ctx.fillStyle = 'white';
          ctx.shadowColor = 'white';
      }
      
      if (line.softness > 0) {
        ctx.shadowBlur = line.softness;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(line.points[0], line.points[1]);
      for (let i = 2; i < line.points.length; i += 2) {
        ctx.lineTo(line.points[i], line.points[i+1]);
      }
      
      if (line.closed) {
        ctx.closePath();
      }
      
      if (line.fill || line.closed) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
    });

    const maskBase64 = tempCanvas.toDataURL('image/png').split(',')[1];
    onSave(maskBase64, prompt, referenceImages);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setReferenceImages(prev => [...prev, base64.split(',')[1]]);
        };
        reader.readAsDataURL(file);
    });
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const baseScale = getBaseScale();
  const canvasWidth = imgElement ? imgElement.width * baseScale : 0;
  const canvasHeight = imgElement ? imgElement.height * baseScale : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] backdrop-blur-2xl flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-slate-900/50 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col gap-6 shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tighter leading-none">Generative</h2>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Refine Studio</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar space-y-6">
            {/* Tool Selection */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Công cụ thông minh</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setTool('pen')}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${tool === 'pen' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">Cọ vẽ</span>
                </button>
                <button 
                  onClick={() => setTool('eraser')}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${tool === 'eraser' ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  <Eraser className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">Tẩy</span>
                </button>
                <button 
                  onClick={() => setTool('lasso')}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${tool === 'lasso' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  <Scissors className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">Lasso</span>
                </button>
              </div>
            </div>

            {/* Magic Selection */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Magic Selection (Beta)</label>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => handleAutoMask('clothing')}
                        disabled={isAutoMasking}
                        className="flex flex-col items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <Shirt className="w-4 h-4 text-amber-400" />
                        <span className="text-[8px] font-bold uppercase text-slate-400">Quần áo</span>
                    </button>
                    <button 
                        onClick={() => handleAutoMask('face')}
                        disabled={isAutoMasking}
                        className="flex flex-col items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="text-[8px] font-bold uppercase text-slate-400">Khuôn mặt</span>
                    </button>
                    <button 
                        onClick={() => handleAutoMask('background')}
                        disabled={isAutoMasking}
                        className="flex flex-col items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span className="text-[8px] font-bold uppercase text-slate-400">Hậu cảnh</span>
                    </button>
                </div>
                {isAutoMasking && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 rounded-lg">
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                        <span className="text-[9px] font-bold text-blue-400 uppercase">AI đang phân tích...</span>
                    </div>
                )}
            </div>

            {/* Brush Settings */}
            <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kích thước: {brushSize}px</label>
                <div className="flex gap-2">
                    <button onClick={handleUndo} disabled={lines.length === 0} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 disabled:opacity-30 transition-all active:scale-90" title="Hoàn tác (Ctrl+Z)">
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleClear} disabled={lines.length === 0} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 disabled:opacity-30 transition-all active:scale-90" title="Xóa tất cả">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
              </div>
              <input 
                type="range" 
                min="5" 
                max="150" 
                value={brushSize} 
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Độ mờ (Opacity): {Math.round(brushOpacity * 100)}%</label>
                <input 
                    type="range" 
                    min="0.1" 
                    max="1" 
                    step="0.1"
                    value={brushOpacity} 
                    onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Độ mềm (Softness): {brushSoftness}px</label>
                <input 
                    type="range" 
                    min="0" 
                    max="50" 
                    value={brushSoftness} 
                    onChange={(e) => setBrushSoftness(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Đảo ngược Mask (Invert)</span>
                <button 
                  onClick={() => setIsInverted(!isInverted)}
                  className={`w-10 h-5 rounded-full transition-all relative ${isInverted ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isInverted ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Hiển thị Mask</span>
                <button 
                  onClick={() => setShowMask(!showMask)}
                  className={`w-10 h-5 rounded-full transition-all relative ${showMask ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showMask ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Prompt Area */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Mô tả thay đổi (Generative Fill)</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ví dụ: Thay đổi áo thành sơ mi trắng, thêm kính râm đen, đổi màu tóc..."
                className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all resize-none custom-scrollbar"
              />
            </div>

            {/* Reference Images */}
            <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ảnh tham chiếu (Tùy chọn)</label>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1 hover:bg-white/10 rounded-lg text-blue-400 transition-all"
                        title="Thêm ảnh mẫu"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    multiple 
                    accept="image/*" 
                />
                
                <div className="grid grid-cols-4 gap-2">
                    {referenceImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                            <img src={`data:image/png;base64,${img}`} className="w-full h-full object-cover" />
                            <button 
                                onClick={() => removeReferenceImage(idx)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-red-400"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {referenceImages.length === 0 && (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-white/20 hover:text-slate-400 transition-all"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="text-[8px] font-bold uppercase">Tải lên</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Shortcuts Info */}
            <div className="mt-auto pt-4 border-t border-white/5">
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Phím tắt thông minh</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between items-center"><span className="text-[8px] text-slate-400">Cọ vẽ</span><kbd className="px-1 bg-white/10 rounded text-[8px] text-white">B</kbd></div>
                        <div className="flex justify-between items-center"><span className="text-[8px] text-slate-400">Lasso</span><kbd className="px-1 bg-white/10 rounded text-[8px] text-white">L</kbd></div>
                        <div className="flex justify-between items-center"><span className="text-[8px] text-slate-400">Tẩy</span><kbd className="px-1 bg-white/10 rounded text-[8px] text-white">E</kbd></div>
                        <div className="flex justify-between items-center"><span className="text-[8px] text-slate-400">Di chuyển</span><kbd className="px-1 bg-white/10 rounded text-[8px] text-white">H / Space</kbd></div>
                        <div className="flex justify-between items-center"><span className="text-[8px] text-slate-400">Hoàn tác</span><kbd className="px-1 bg-white/10 rounded text-[8px] text-white">Ctrl+Z</kbd></div>
                        <div className="flex justify-between items-center"><span className="text-[8px] text-slate-400">Size +/-</span><kbd className="px-1 bg-white/10 rounded text-[8px] text-white">[ ]</kbd></div>
                    </div>
                </div>
            </div>
        </div>

        <button 
          onClick={handleExport}
          disabled={isProcessing || !prompt.trim() || lines.length === 0}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
        >
          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {isProcessing ? 'Đang xử lý...' : 'Xác nhận chỉnh sửa'}
        </button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 relative bg-[#080808] flex items-center justify-center p-4 md:p-8 overflow-hidden"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Zoom Controls Overlay */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 z-20 shadow-2xl">
            <button onClick={() => handleZoom(-0.1)} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all"><ZoomOut className="w-4 h-4" /></button>
            <div className="px-3 border-x border-white/10">
                <span className="text-xs font-black text-white w-12 inline-block text-center">{Math.round(zoom * 100)}%</span>
            </div>
            <button onClick={() => handleZoom(0.1)} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={handleResetZoom} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all ml-1" title="Vừa khung hình"><Maximize2 className="w-4 h-4" /></button>
            <button 
                onClick={() => setShowOriginal(!showOriginal)} 
                className={`p-2 rounded-xl transition-all ml-1 ${showOriginal ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white'}`}
                title="So sánh với ảnh gốc"
            >
                {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>

        <div 
            className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden border border-white/5" 
            style={{ cursor: tool === 'pan' ? 'grab' : 'none' }}
        >
          {imgElement && (
            <Stage
              width={canvasWidth}
              height={canvasHeight}
              scaleX={zoom}
              scaleY={zoom}
              x={position.x}
              y={position.y}
              draggable={tool === 'pan'}
              onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { handleMouseUp(); setIsHovering(false); }}
              onMouseEnter={() => setIsHovering(true)}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
              ref={stageRef}
            >
              <Layer>
                <KonvaImage image={imgElement} width={imgElement.width * baseScale} height={imgElement.height * baseScale} />
                {/* Invert Background Overlay */}
                {isInverted && showMask && !showOriginal && (
                    <Line 
                        points={[0, 0, imgElement.width * baseScale, 0, imgElement.width * baseScale, imgElement.height * baseScale, 0, imgElement.height * baseScale, 0, 0]}
                        fill="rgba(59, 130, 246, 0.3)"
                        closed={true}
                        listening={false}
                    />
                )}
                {showMask && !showOriginal && lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line.points.map((p: number) => p * baseScale)}
                    stroke={line.tool === 'eraser' ? (isInverted ? 'rgba(59, 130, 246, 0.6)' : 'black') : (line.fill ? 'transparent' : (isInverted ? 'black' : 'rgba(59, 130, 246, 0.6)'))}
                    strokeWidth={line.size * baseScale}
                    fill={line.tool === 'eraser' ? (isInverted ? 'rgba(59, 130, 246, 0.6)' : 'transparent') : (line.fill ? (isInverted ? 'black' : 'rgba(59, 130, 246, 0.6)') : 'transparent')}
                    closed={line.closed}
                    shadowBlur={line.softness * baseScale}
                    shadowColor={line.tool === 'eraser' ? (isInverted ? 'rgba(59, 130, 246, 0.6)' : 'black') : (isInverted ? 'black' : 'rgba(59, 130, 246, 0.6)')}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    opacity={line.opacity || 1}
                    globalCompositeOperation={
                      isInverted 
                        ? (line.tool === 'eraser' ? 'source-over' : 'destination-out')
                        : (line.tool === 'eraser' ? 'destination-out' : 'source-over')
                    }
                  />
                ))}
                {/* Brush Preview Circle */}
                {isHovering && tool !== 'pan' && !showOriginal && (
                  <Circle
                    x={cursorPos.x}
                    y={cursorPos.y}
                    radius={(brushSize / 2) / zoom}
                    stroke={tool === 'eraser' ? 'rgba(236, 72, 153, 1)' : 'rgba(59, 130, 246, 1)'}
                    strokeWidth={2 / zoom}
                    fill={tool === 'eraser' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(59, 130, 246, 0.3)'}
                    shadowBlur={brushSoftness / zoom}
                    shadowColor={tool === 'eraser' ? 'rgba(236, 72, 153, 0.5)' : 'rgba(59, 130, 246, 0.5)'}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          )}
        </div>
        
        {/* Hint Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white/70 uppercase tracking-widest">
                {tool === 'pan' ? 'Giữ chuột để di chuyển ảnh' : 'Tô màu vùng bạn muốn AI thay đổi'}
            </div>
            <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Vùng chọn</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-pink-500 rounded-full" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Tẩy xóa</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RefinementEditor;
