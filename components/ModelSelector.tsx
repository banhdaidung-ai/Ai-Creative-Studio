import React, { useState, useRef, useEffect } from 'react';
import { MODEL_OPTIONS } from '../services/gemini';
import { FLOW_MODEL_IDS, isFlowModel } from '../services/flowService';
import { Sparkles, Zap, Image as ImageIcon, Palette, ChevronDown, Video, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Google Flow model definitions
const FLOW_MODEL_OPTIONS = [
  // Image Models
  {
    id: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO,
    name: '🍌 Nano Banana Pro (Flow)',
    desc: 'Chất lượng cao nhất — độ phân giải và chi tiết chân thực chuẩn Studio.',
    tier: 'flow' as const,
    type: 'image' as const,
  },
  {
    id: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2,
    name: '🍌 Nano Banana 2 (Flow)',
    desc: 'Cân bằng tốc độ và chất lượng tạo ảnh.',
    tier: 'flow' as const,
    type: 'image' as const,
  },
  {
    id: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2_LITE,
    name: '🍌 Nano Banana 2 Lite (Flow)',
    desc: 'Tốc độ siêu tốc, phản hồi nhanh gọn.',
    tier: 'flow' as const,
    type: 'image' as const,
  },
  // Video Models
  {
    id: FLOW_MODEL_IDS.VIDEO_VEO_QUALITY,
    name: '🎬 Veo 3.1 Quality (Flow)',
    desc: 'Chất lượng video điện ảnh 720p cao cấp nhất.',
    tier: 'flow' as const,
    type: 'video' as const,
  },
  {
    id: FLOW_MODEL_IDS.VIDEO_VEO_FAST,
    name: '⚡ Veo 3.1 Fast (Flow)',
    desc: 'Tạo video tốc độ cao, chuyển động tự nhiên.',
    tier: 'flow' as const,
    type: 'video' as const,
  },
  {
    id: FLOW_MODEL_IDS.VIDEO_VEO_LITE,
    name: '🎈 Veo 3.1 Lite (Flow)',
    desc: 'Mô hình video rút gọn, render nhanh.',
    tier: 'flow' as const,
    type: 'video' as const,
  },
  {
    id: FLOW_MODEL_IDS.VIDEO_OMNI_FLASH,
    name: '🔊 Omni 1.1 Flash (Flow)',
    desc: 'Mô hình video thế hệ mới có tích hợp âm thanh sống động.',
    tier: 'flow' as const,
    type: 'video' as const,
  },
];

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
  const [activeTab, setActiveTab] = useState<'gemini' | 'flow'>(
    isFlowModel(selectedModelId) ? 'flow' : 'gemini'
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedGeminiModel = MODEL_OPTIONS.find(m => m.id === selectedModelId);
  const selectedFlowModel = FLOW_MODEL_OPTIONS.find(m => m.id === selectedModelId);
  const selectedModel = selectedGeminiModel || selectedFlowModel || FLOW_MODEL_OPTIONS[0];
  const isFlowSelected = !!selectedFlowModel;

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
    if (id.includes('omni') || id.includes('audio')) return Sparkles;
    if (id.includes('veo') || id === FLOW_MODEL_IDS.VIDEO) return Video;
    if (id.includes('flow')) return Globe;
    if (id.includes('pro')) return Sparkles;
    if (id.includes('imagen')) return Palette;
    if (id.includes('3.1') || id.includes('lite') || id.includes('fast')) return Zap;
    return ImageIcon;
  };

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
          <div className={`p-2 rounded-xl text-white ${isFlowSelected ? 'bg-emerald-500/20 dark:bg-emerald-500/30' : 'bg-slate-100 dark:bg-white/10 !text-slate-700 dark:!text-white'}`}>
            {React.createElement(getIcon(selectedModel.id), { size: 18, className: isFlowSelected ? 'text-emerald-500 dark:text-emerald-400' : '' })}
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
              {selectedModel.tier === 'flow' && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-black uppercase tracking-tighter">
                  FLOW
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
              {/* Provider Tabs */}
              <div className="flex border-b border-slate-200 dark:border-white/10">
                <button
                  onClick={() => setActiveTab('gemini')}
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === 'gemini'
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-b-2 border-blue-500'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  🔑 Gemini API
                </button>
                <button
                  onClick={() => setActiveTab('flow')}
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === 'flow'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-b-2 border-emerald-500'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  🌐 Google Flow
                </button>
              </div>

              {/* Gemini Tab Content */}
              {activeTab === 'gemini' && (
                <>
                  {/* COMPARISON TABLE */}
                  <div className="mx-3 mt-3 mb-2 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-slate-50 dark:bg-[#1f1f1f]">
                    <div className="text-[9px] font-bold text-center py-1.5 bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      So sánh hiệu năng
                    </div>
                    <table className="w-full text-[10px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
                          <th className="font-semibold p-2 w-1/3">Tiêu chí</th>
                          <th className="font-semibold p-2 w-1/3 border-l border-slate-200 dark:border-white/10">Nano Banana 2</th>
                          <th className="font-semibold p-2 w-1/3 border-l border-slate-200 dark:border-white/10 text-purple-600 dark:text-purple-400">Nano Banana Pro</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Tốc độ</td>
                          <td className="p-2 text-emerald-500 font-semibold border-r border-slate-200 dark:border-white/5">Cực nhanh (1x)</td>
                          <td className="p-2 text-amber-500">Trung bình (1.5x)</td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Độ chi tiết</td>
                          <td className="p-2 border-r border-slate-200 dark:border-white/5">Khá tốt</td>
                          <td className="p-2 text-emerald-500 font-semibold">Cực cao (tốt nhất)</td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Suy luận Prompt</td>
                          <td className="p-2 border-r border-slate-200 dark:border-white/5">Cơ bản</td>
                          <td className="p-2 text-emerald-500 font-semibold">Phức tạp</td>
                        </tr>
                        <tr className="text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Khuyên dùng</td>
                          <td className="p-2 border-r border-slate-200 dark:border-white/5 text-[9px] leading-tight">Chỉnh sửa nhanh, tạo hàng loạt</td>
                          <td className="p-2 text-[9px] leading-tight max-w-[100px]">Prompt khó, cần chân thực cao</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pb-4">
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
                </>
              )}

              {/* Google Flow Tab Content */}
              {activeTab === 'flow' && (
                <>
                  {/* Flow Info Banner */}
                  <div className="mx-3 mt-3 mb-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">🌐</span>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">Google Flow — Không cần API Key</p>
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                          Dùng tài khoản Google của bạn để tạo ảnh/video qua Google Flow.
                          Yêu cầu cấu hình <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">GOOGLE_EMAIL</code> và <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">GOOGLE_PASSWORD</code> trong <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">flow-backend/.env</code>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5 pb-4 max-h-[360px] overflow-y-auto custom-scrollbar space-y-3">
                    {/* Nhóm Mô hình Hình ảnh */}
                    <div>
                      <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <ImageIcon size={12} /> Mô hình Tạo Ảnh (Image)
                      </div>
                      <div className="space-y-1 mt-1">
                        {FLOW_MODEL_OPTIONS.filter(m => m.type === 'image').map((model) => {
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
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-400'}`}>
                                <Icon size={16} />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold truncate text-slate-900 dark:!text-white">
                                    {model.name}
                                  </span>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-black uppercase tracking-tighter">
                                    FLOW
                                  </span>
                                </div>
                                <p className="text-[9px] text-slate-400 dark:!text-slate-200 truncate">{model.desc}</p>
                              </div>
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] mr-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Nhóm Mô hình Video */}
                    <div>
                      <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Video size={12} /> Mô hình Tạo Video (Veo & Omni)
                      </div>
                      <div className="space-y-1 mt-1">
                        {FLOW_MODEL_OPTIONS.filter(m => m.type === 'video').map((model) => {
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
                                  ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-400'}`}>
                                <Icon size={16} />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold truncate text-slate-900 dark:!text-white">
                                    {model.name}
                                  </span>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300 font-black uppercase tracking-tighter">
                                    VIDEO
                                  </span>
                                </div>
                                <p className="text-[9px] text-slate-400 dark:!text-slate-200 truncate">{model.desc}</p>
                              </div>
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] mr-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Setup Guide */}
                  <div className="mx-3 mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">⚡ Cách bắt đầu:</p>
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1">cd flow-backend</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1">cp .env.example .env</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1">pip install -r requirements.txt</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1">uvicorn app:app --port 8000</p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
