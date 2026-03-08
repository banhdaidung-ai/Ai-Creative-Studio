
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCw, FlipHorizontal, FlipVertical, Download, Sliders, Undo, Image as ImageIcon } from 'lucide-react';

interface PhotoEditorProps {
  imageSrc: string;
  onSave: (img: string) => void;
  onClose: () => void;
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({ imageSrc, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [blur, setBlur] = useState(0);
  
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = `data:image/png;base64,${imageSrc}`;
    img.onload = () => {
      setImageObj(img);
    };
  }, [imageSrc]);

  useEffect(() => {
    applyFilters();
  }, [imageObj, brightness, contrast, saturation, grayscale, sepia, blur, rotation, flipH, flipV]);

  const applyFilters = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on rotation
    if (rotation % 180 !== 0) {
      canvas.width = imageObj.height;
      canvas.height = imageObj.width;
    } else {
      canvas.width = imageObj.width;
      canvas.height = imageObj.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    ctx.filter = `
      brightness(${brightness}%) 
      contrast(${contrast}%) 
      saturate(${saturation}%) 
      grayscale(${grayscale}%) 
      sepia(${sepia}%) 
      blur(${blur}px)
    `;

    ctx.drawImage(
      imageObj,
      -imageObj.width / 2,
      -imageObj.height / 2,
      imageObj.width,
      imageObj.height
    );

    ctx.restore();
  };

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
    setSepia(0);
    setBlur(0);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  const handleSave = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      onSave(base64);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col md:flex-row overflow-hidden font-sans pb-[env(safe-area-inset-bottom)]">
      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col relative pt-[env(safe-area-inset-top)]">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90">
                <X className="w-5 h-5" />
            </button>
        </div>
        
        <div className="absolute top-4 right-4 z-10 flex gap-2 md:hidden">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95">
                <Check className="w-4 h-4" /> Lưu
            </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyEgSRC0AQB9CGwScxU1IQAAAABJRU5ErkJggg==')]">
          <canvas 
            ref={canvasRef} 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
          />
        </div>
      </div>

      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-[#0f1115] border-t md:border-t-0 md:border-l border-white/10 flex flex-col h-[45vh] md:h-full shrink-0">
        <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-black uppercase tracking-widest text-sm">Chỉnh sửa ảnh</h3>
          </div>
          <button onClick={handleReset} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Khôi phục gốc">
            <Undo className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6">
          {/* Transform Controls */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Xoay & Lật</label>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setRotation(r => (r + 90) % 360)} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-slate-300 hover:text-white">
                    <RotateCw className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Xoay</span>
                </button>
                <button onClick={() => setFlipH(!flipH)} className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${flipH ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300 hover:text-white'}`}>
                    <FlipHorizontal className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Lật Ngang</span>
                </button>
                <button onClick={() => setFlipV(!flipV)} className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${flipV ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300 hover:text-white'}`}>
                    <FlipVertical className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Lật Dọc</span>
                </button>
            </div>
          </div>

          {/* Adjustments */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Màu sắc & Ánh sáng</label>
            
            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>Độ sáng</span>
                    <span>{brightness}%</span>
                </div>
                <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>Độ tương phản</span>
                    <span>{contrast}%</span>
                </div>
                <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>Độ bão hòa</span>
                    <span>{saturation}%</span>
                </div>
                <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bộ lọc</label>
            
            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>Trắng đen</span>
                    <span>{grayscale}%</span>
                </div>
                <input type="range" min="0" max="100" value={grayscale} onChange={(e) => setGrayscale(Number(e.target.value))} className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>Sepia (Cổ điển)</span>
                    <span>{sepia}%</span>
                </div>
                <input type="range" min="0" max="100" value={sepia} onChange={(e) => setSepia(Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>Làm mờ</span>
                    <span>{blur}px</span>
                </div>
                <input type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-white/10 bg-white/5 hidden md:block">
            <button onClick={handleSave} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0">
                <Check className="w-4 h-4" /> Áp dụng & Lưu
            </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditor;
