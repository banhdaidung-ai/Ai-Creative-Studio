import React, { useState, useRef, useEffect } from 'react';
import { MODEL_OPTIONS } from '../services/gemini';
import { Sparkles, Zap, Image as ImageIcon, Palette, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModelSelectorProps {
  selectedModelId: string;
  onModelSelect: (modelId: string) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onModelSelect,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = MODEL_OPTIONS.find(m => m.id === selectedModelId) || MODEL_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (id: string) => {
    if (id.includes('pro')) return Sparkles;
    if (id.includes('imagen')) return Palette;
    if (id.includes('3.1')) return Zap;
    return ImageIcon;
  };

  const SelectedIcon = getIcon(selectedModel.id);

  return (
    <div className={`space-y-2 ${className}`} ref={dropdownRef}>
      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest px-1">
        AI Model Engine
      </label>
      
      <div className="relative">
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all relative overflow-hidden group bg-black/5 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 ${
            isOpen ? 'ring-2 ring-blue-500/20 dark:ring-white/10 border-blue-500/50 dark:border-white/30' : ''
          }`}
        >
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white">
            <SelectedIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold truncate text-slate-900 dark:!text-white">
                {selectedModel.name}
              </span>
              {selectedModel.tier === 'pro' && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-black uppercase tracking-tighter">
                  PRO
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:!text-slate-200 truncate">{selectedModel.desc}</p>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400 dark:text-white/40"
          >
            <ChevronDown size={16} />
          </motion.div>
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              <div className="p-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pb-4">
                {MODEL_OPTIONS.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  const Icon = getIcon(model.id);

                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        onModelSelect(model.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all relative group ${
                        isSelected 
                          ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' 
                          : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-slate-200 dark:bg-white/20 text-slate-800 dark:text-slate-50' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate text-slate-900 dark:!text-white">
                            {model.name}
                          </span>
                          {model.tier === 'pro' && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-black uppercase tracking-tighter">
                              PRO
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 dark:!text-slate-200 truncate">{model.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-white shadow-[0_0_10px_rgba(59,130,246,0.8)] dark:shadow-[0_0_10px_rgba(255,255,255,0.8)] mr-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
