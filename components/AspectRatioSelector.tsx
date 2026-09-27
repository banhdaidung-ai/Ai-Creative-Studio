import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Smartphone, Square, ArrowLeftRight, Image as ImageIcon, ChevronDown } from 'lucide-react';

interface AspectRatioSelectorProps {
  value: string;
  onChange: (ratio: string) => void;
  className?: string;
  onAutoDetect?: () => void;
  hasImage?: boolean;
}

const RATIO_GROUPS = [
  {
    label: 'Mạng xã hội & Khổ dọc',
    icon: <Smartphone className="w-3 h-3" />,
    items: [
      { ratio: '9:16', name: 'Story / Reels', desc: 'TikTok, IG Reels' },
      { ratio: '4:5', name: 'IG Portrait', desc: 'Bài đăng Instagram' },
      { ratio: '3:4', name: 'Chân dung', desc: 'Ảnh chuẩn' },
      { ratio: '2:3', name: 'Pinterest', desc: 'Ghim chuẩn' },
    ]
  },
  {
    label: 'Ảnh vuông & Khổ ngang',
    icon: <Monitor className="w-3 h-3" />,
    items: [
      { ratio: '1:1', name: 'Vuông', desc: 'Avatar, Sản phẩm' },
      { ratio: '16:9', name: 'Widescreen', desc: 'YouTube, Cover' },
      { ratio: '4:3', name: 'Cảnh quan', desc: 'Ảnh ngang chuẩn' },
      { ratio: '3:2', name: 'Nhiếp ảnh', desc: 'Máy ảnh cơ' },
    ]
  }
];

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ 
    value, 
    onChange, 
    className = '',
    onAutoDetect,
    hasImage
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // SVG helpers to draw boxes representing aspect ratios
  const renderRatioBox = (ratioStr: string, active: boolean) => {
      const [w, h] = ratioStr.split(':').map(Number);
      const isLandscape = w > h;
      const maxDim = 24;
      const calcW = w && h ? (isLandscape ? maxDim : (w / h) * maxDim) : maxDim;
      const calcH = w && h ? (!isLandscape ? maxDim : (h / w) * maxDim) : maxDim;

      return (
          <div className="w-[24px] h-[24px] flex items-center justify-center shrink-0">
             <div 
                className={`border-2 rounded-sm transition-all ${active ? 'border-blue-500 bg-blue-500/20' : 'border-slate-400 group-hover:border-slate-300'}`}
                style={{ width: `${calcW}px`, height: `${calcH}px` }}
             />
          </div>
      );
  };

  const handleSwap = (e: React.MouseEvent) => {
      e.stopPropagation();
      const [w, h] = value.split(':');
      if (w && h && w !== h) {
          onChange(`${h}:${w}`);
      }
  };
  
  const fromPrompt = !RATIO_GROUPS.some(g => g.items.some(i => i.ratio === value));
  const selectedItem = RATIO_GROUPS.flatMap(g => g.items).find(i => i.ratio === value);

  return (
    <div className={`space-y-2 ${className}`} ref={dropdownRef}>
        <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tỷ lệ ảnh</label>
        </div>

        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${isOpen ? 'border-blue-500 bg-blue-500/5' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                type="button"
            >
                <div className="flex items-center gap-2">
                    {fromPrompt ? (
                        <>
                            <div className="flex w-[24px] h-[24px] items-center justify-center shrink-0">
                                <div className="border-2 border-blue-500 bg-blue-500/20 rounded-sm transition-all" style={{width: '24px', height: '24px'}} />
                            </div>
                            <div className="flex flex-col items-start tracking-tight">
                                <span className="text-[12px] font-bold text-blue-500">Từ Prompt</span>
                                <span className="text-[10px] font-semibold text-slate-500">{value}</span>
                            </div>
                        </>
                    ) : (
                        selectedItem && (
                            <>
                                {renderRatioBox(value, true)}
                                <div className="flex flex-col items-start overflow-hidden text-left">
                                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{selectedItem.ratio}</span>
                                    <span className="text-[10px] font-semibold text-slate-500 leading-tight">{selectedItem.name}</span>
                                </div>
                            </>
                        )
                    )}
                </div>
                
                <div className="flex items-center gap-1">
                    {hasImage && onAutoDetect && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); onAutoDetect(); setIsOpen(false); }}
                            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            title="Phân tích tỷ lệ từ ảnh gốc"
                        >
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                    )}
                    {value.split(':')[0] !== value.split(':')[1] && (
                        <div 
                            onClick={handleSwap}
                            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            title="Đảo chiều (Xoay ngang/dọc)"
                        >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                    )}
                    <div className="pl-1 flex items-center justify-center">
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 p-2 bg-white dark:bg-[#1a1b1e] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                    {RATIO_GROUPS.map((group, gIdx) => (
                        <div key={gIdx} className="mb-4 last:mb-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-2 px-1 uppercase">
                                {group.icon} {group.label}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {group.items.map((item) => {
                                    const isActive = value === item.ratio;
                                    return (
                                        <button
                                            key={item.ratio}
                                            onClick={() => {
                                                onChange(item.ratio);
                                                setIsOpen(false);
                                            }}
                                            className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-all text-left ${isActive ? 'bg-blue-600/10 border-blue-500 border text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-black/40 border border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                            type="button"
                                        >
                                            <div className="flex w-full items-center gap-2">
                                                {renderRatioBox(item.ratio, isActive)}
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[11px] font-bold leading-tight">{item.ratio}</span>
                                                    <span className="text-[9px] font-semibold opacity-70 leading-tight truncate">{item.name}</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export default AspectRatioSelector;
