import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { MousePointer2, Eraser, Pen, X, Check, Save } from 'lucide-react';

interface MaskDrawEditorProps {
    imageSrc: string; // base64 string
    onSave: (maskBase64: string) => void;
    onCancel: () => void;
}

export const MaskDrawEditor: React.FC<MaskDrawEditorProps> = ({ imageSrc, onSave, onCancel }) => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [lines, setLines] = useState<any[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [brushSize, setBrushSize] = useState(40);

    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const img = new window.Image();
        const src = imageSrc.startsWith('data:') ? imageSrc : `data:image/png;base64,${imageSrc}`;
        img.src = src;
        img.onload = () => {
            setImage(img);
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth - 40;
                const containerHeight = containerRef.current.clientHeight - 40;
                const scale = Math.min(containerWidth / img.width, containerHeight / img.height);
                setStageSize({
                    width: img.width * scale,
                    height: img.height * scale
                });
            }
        };
    }, [imageSrc]);

    const handleMouseDown = (e: any) => {
        setIsDrawing(true);
        const pos = e.target.getStage().getPointerPosition();
        if(!pos) return;
        setLines([...lines, { tool, points: [pos.x, pos.y], size: brushSize }]);
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing) return;
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if(!point) return;
        
        const newLines = [...lines];
        const lastLine = { ...newLines[newLines.length - 1] };
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        newLines[newLines.length - 1] = lastLine;
        setLines(newLines);
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const exportMask = () => {
        const scale = image ? (image.width / stageSize.width) : 1;
        const canvas = document.createElement('canvas');
        canvas.width = image ? image.width : stageSize.width;
        canvas.height = image ? image.height : stageSize.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        lines.forEach(line => {
            ctx.globalCompositeOperation = line.tool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = 'white';
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = line.size * scale;
            ctx.beginPath();
            if (line.points.length > 0) {
                ctx.moveTo(line.points[0] * scale, line.points[1] * scale);
                for (let i = 2; i < line.points.length; i+=2) {
                    ctx.lineTo(line.points[i] * scale, line.points[i+1] * scale);
                }
            }
            ctx.stroke();
        });
        
        const dataUrl = canvas.toDataURL('image/png');
        const b64 = dataUrl.split(',')[1];
        onSave(b64);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col backdrop-blur-sm animate-in fade-in duration-300">
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-black/40">
                <div className="flex items-center gap-4">
                    <h3 className="text-white font-black uppercase text-sm flex items-center gap-2">
                        <Pen className="w-5 h-5 text-blue-500" />
                        Công cụ Inpainting Mask
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onCancel} className="px-4 py-2 hover:bg-white/10 text-white rounded-xl transition-all text-sm font-bold flex items-center gap-2 max-h-10">
                        <X className="w-4 h-4" /> Hủy
                    </button>
                    <button onClick={exportMask} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-sm font-black flex items-center gap-2 uppercase tracking-wide max-h-10">
                        <Check className="w-4 h-4" /> Áp dụng
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-64 bg-[#0a0a0a] border-r border-white/10 flex flex-col p-4 gap-6 shrink-0">
                    <div>
                        <h4 className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-3">Công cụ</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setTool('pen')} className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition-all ${tool === 'pen' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'border-white/5 hover:bg-white/5 text-white/60'}`}>
                                <Pen className="w-5 h-5" />
                                <span className="text-[10px] uppercase font-bold">Vẽ</span>
                            </button>
                            <button onClick={() => setTool('eraser')} className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition-all ${tool === 'eraser' ? 'bg-red-600/20 border-red-500 text-red-400' : 'border-white/5 hover:bg-white/5 text-white/60'}`}>
                                <Eraser className="w-5 h-5" />
                                <span className="text-[10px] uppercase font-bold">Tẩy</span>
                            </button>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Cỡ Cọ</h4>
                            <span className="text-white text-[10px] bg-white/10 px-2.5 py-1 rounded-full font-bold">{brushSize}px</span>
                        </div>
                        <input 
                            type="range" min="10" max="150" value={brushSize} 
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-full accent-blue-500 rounded-lg drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] h-2 bg-white/10 appearance-none" 
                        />
                    </div>
                    <div className="text-xs text-white/60 leading-relaxed font-medium bg-white/5 p-4 rounded-2xl border border-white/5 mt-auto">
                        <strong className="text-blue-400 block mb-1">Hướng dẫn:</strong>
                        Tô những vùng cần thay đổi. Trí tuệ nhân tạo sẽ tự động thay thế đối tượng dựa trên prompt, bảo toàn tuyệt đối không gian nền xung quanh.
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center bg-[#050505] p-6 relative" ref={containerRef}>
                    {image && stageSize.width > 0 && (
                        <div 
                           className="border-2 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden rounded-2xl bg-[#111]" 
                           style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
                        >
                            <Stage
                                width={stageSize.width}
                                height={stageSize.height}
                                onMouseDown={handleMouseDown}
                                onMousemove={handleMouseMove}
                                onMouseup={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={(e: any) => { e.evt.preventDefault(); handleMouseDown(e); }}
                                onTouchMove={(e: any) => { e.evt.preventDefault(); handleMouseMove(e); }}
                                onTouchEnd={handleMouseUp}
                                ref={stageRef}
                            >
                                <Layer>
                                    <KonvaImage image={image} width={stageSize.width} height={stageSize.height} />
                                    {lines.map((line, i) => (
                                        <Line
                                            key={i}
                                            points={line.points}
                                            stroke={line.tool === 'eraser' ? 'rgba(0,0,0,1)' : 'rgba(255, 255, 255, 0.6)'}
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
                    )}
                </div>
            </div>
        </div>
    );
};
export default MaskDrawEditor;
