
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Columns, Navigation, Layers, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

type Mode = 'slide' | 'fade' | 'split';

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ 
  beforeImage, 
  afterImage, 
  beforeLabel = 'Trước', 
  afterLabel = 'Sau',
  className = '' 
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [mode, setMode] = useState<Mode>('slide');
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleMove = useCallback((event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!containerRef.current) return;
    
    if (isDragging && mode === 'slide') {
        const rect = containerRef.current.getBoundingClientRect();
        const x = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
        const position = ((x - rect.left) / rect.width) * 100;
        setSliderPosition(Math.max(0, Math.min(100, position)));
    } else if (isPanning) {
        const x = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
        const y = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;
        setPan({
            x: x - panStart.x,
            y: y - panStart.y
        });
    }
  }, [isDragging, isPanning, mode, panStart]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
     // If clicking on the slider handle, it starts dragging
     // For this simple implementation, we detect if shift is pressed or middle click to pan
     const isMiddleClick = 'button' in e && e.button === 1;
     const isShiftPressed = 'shiftKey' in e && e.shiftKey;
     
     if (isMiddleClick || isShiftPressed || mode !== 'slide') {
         setIsPanning(true);
         const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
         const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
         setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
     } else {
         setIsDragging(true);
     }
  };
  
  const handleMouseUp = () => {
      setIsDragging(false);
      setIsPanning(false);
  };

  useEffect(() => {
    if (isDragging || isPanning) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isPanning, handleMove]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = -e.deltaY * 0.002;
    setZoom(prev => Math.max(0.5, Math.min(10, prev + zoomFactor)));
  };

  const resetZoom = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
  };

  return (
    <div 
      className={`relative flex flex-col group/comparison bg-[#0a0a0a] ${className}`}
    >
        <div 
            ref={containerRef}
            className={`relative flex-1 overflow-hidden select-none ${mode === 'slide' ? 'cursor-ew-resize' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            onWheel={handleWheel}
        >
            {mode === 'split' ? (
                <div className="absolute inset-0 flex">
                    <div className="flex-1 border-r border-white/10 relative overflow-hidden bg-slate-900/50 flex flex-col">
                        <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-md border border-white/10">{beforeLabel}</div>
                        <div className="flex-1 overflow-hidden relative">
                            <img src={beforeImage} className="absolute inset-0 w-full h-full object-contain pointer-events-none transform-gpu" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }} />
                        </div>
                    </div>
                    <div className="flex-1 relative overflow-hidden bg-slate-900/50 flex flex-col">
                        <div className="absolute top-4 right-4 z-20 px-2 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-md border border-white/10">{afterLabel}</div>
                        <div className="flex-1 overflow-hidden relative">
                            <img src={afterImage} className="absolute inset-0 w-full h-full object-contain pointer-events-none transform-gpu" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }} />
                        </div>
                    </div>
                </div>
            ) : mode === 'fade' ? (
                <div className="absolute inset-0 overflow-hidden bg-slate-900/50">
                    <img src={afterImage} className="absolute inset-0 w-full h-full object-contain pointer-events-none transform-gpu" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }} />
                    <img src={beforeImage} className="absolute inset-0 w-full h-full object-contain pointer-events-none transform-gpu" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, opacity: opacity / 100 }} />
                    <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-md border border-white/10">Blend: {opacity}% {beforeLabel}</div>
                    
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex flex-col gap-2 z-20 opacity-0 group-hover/comparison:opacity-100 transition-opacity">
                        <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase">
                            <span>{afterLabel}</span>
                            <span>{beforeLabel}</span>
                        </div>
                        <input type="range" min="0" max="100" value={opacity} onChange={e => setOpacity(parseInt(e.target.value))} className="w-full accent-blue-500 rounded-lg h-1.5 bg-white/20 appearance-none" onMouseDown={e => e.stopPropagation()} />
                    </div>
                </div>
            ) : (
                <div className="absolute inset-0 overflow-hidden bg-slate-900/50">
                    <img src={afterImage} className="absolute inset-0 w-full h-full object-contain pointer-events-none transform-gpu" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }} />
                    <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPosition}%` }}>
                        <img src={beforeImage} className="absolute inset-0 h-full object-contain pointer-events-none transform-gpu" style={{ width: containerWidth, maxWidth: 'none', transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }} />
                    </div>

                    <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)] z-10" style={{ left: `${sliderPosition}%` }}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full shadow-xl flex items-center justify-center cursor-ew-resize border-2 border-white">
                            <div className="flex gap-1">
                                <div className="w-0.5 h-3 bg-white rounded-full" />
                                <div className="w-0.5 h-3 bg-white rounded-full" />
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-md border border-white/10">{beforeLabel}</div>
                    <div className="absolute top-4 right-4 z-20 px-2 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-md border border-white/10">{afterLabel}</div>
                </div>
            )}
            
            {/* Zoom controls */}
             <div className="absolute bottom-4 right-4 flex bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-1 shadow-xl z-20">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomOut className="w-4 h-4" /></button>
                <button onClick={resetZoom} className="px-3 hover:bg-white/10 text-[10px] font-bold text-slate-300 hover:text-white rounded-lg transition-colors">{Math.round(zoom * 100)}%</button>
                <button onClick={() => setZoom(z => Math.min(10, z + 0.2))} className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button>
            </div>
            
            {(zoom > 1 && mode === 'slide') && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500/80 backdrop-blur-md rounded-full text-white text-[10px] font-bold flex items-center gap-2 drop-shadow-md z-30">
                    <Maximize className="w-3 h-3" />
                    Giữ Shift hoặc Chuột giữa để di chuyển ảnh
                </div>
            )}
        </div>

        {/* Toolbar */}
        <div className="h-14 bg-black/40 border-t border-white/10 shrink-0 flex items-center justify-center gap-1 z-20">
            <button onClick={() => setMode('slide')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${mode === 'slide' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                <Navigation className="w-4 h-4" /> Trượt
            </button>
            <button onClick={() => setMode('fade')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${mode === 'fade' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                <Layers className="w-4 h-4" /> Làm mờ
            </button>
            <button onClick={() => setMode('split')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${mode === 'split' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                <Columns className="w-4 h-4" /> Song song
            </button>
        </div>
    </div>
  );
};

export default ComparisonSlider;
