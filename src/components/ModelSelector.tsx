import React, { useState, useRef, useEffect } from 'react';
import { MODEL_OPTIONS, normalizeClientModelId } from '../services/gemini';
import { FLOW_MODEL_IDS, isFlowModel, isFlowBackendAvailable } from '../services/flowService';
import { MUSE_MODEL_OPTIONS, isMuseModel, getMuseReadyStatus, fetchMuseAdminUrl, getMuseAdminUrl } from '../services/museService';
import { Sparkles, Zap, Image as ImageIcon, Palette, ChevronDown, Video, Globe, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Google Flow model definitions (Đồng bộ trực tiếp với flow.google.com tháng 11/2026)
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
    id: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2_1,
    name: '🍌 Nano Banana 2.1 (Flow)',
    desc: 'Mới nhất — cân bằng tốc độ & chất lượng, hỗ trợ suy luận Cao.',
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
  // Video Models (Omni 1.2 Flash & Veo 3.1 Lite — Thế hệ mới thay thế bản ngừng ngày 05/12)
  {
    id: FLOW_MODEL_IDS.VIDEO_OMNI_1_2_FLASH,
    name: '🔊 Omni 1.2 Flash (Flow)',
    desc: 'Mới nhất — video điện ảnh kèm âm thanh đồng bộ, hỗ trợ Khung hình & Thành phần.',
    tier: 'flow' as const,
    type: 'video' as const,
  },
  {
    id: FLOW_MODEL_IDS.VIDEO_VEO_LITE,
    name: '🎈 Veo 3.1 Lite (Flow)',
    desc: 'Mô hình video ổn định, render nhanh trên Google Flow.',
    tier: 'flow' as const,
    type: 'video' as const,
  },
];

interface ModelSelectorProps {
  selectedModelId: string;
  onModelSelect: (modelId: string) => void;
  className?: string;
  filterType?: 'image' | 'video' | 'all';
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onModelSelect,
  className = "",
  filterType = 'image',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'gemini' | 'flow' | 'muse'>(
    isMuseModel(selectedModelId) ? 'muse' : isFlowModel(selectedModelId) ? 'flow' : 'gemini'
  );
  const [flowBackendOnline, setFlowBackendOnline] = useState<boolean | null>(null);
  const [museBackendOnline, setMuseBackendOnline] = useState<boolean | null>(null);
  const [museAccountsCount, setMuseAccountsCount] = useState<number>(0);
  const [museAdminUrl, setMuseAdminUrl] = useState<string>(getMuseAdminUrl());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleMuseModels = filterType === 'all'
    ? MUSE_MODEL_OPTIONS
    : MUSE_MODEL_OPTIONS.filter(m => m.type === filterType);

  const normalizedSelectedId = normalizeClientModelId(selectedModelId);
  const geminiApiModels = MODEL_OPTIONS.filter(m => !isFlowModel(m.id));
  const selectedGeminiModel = geminiApiModels.find(m => m.id === normalizedSelectedId);
  const selectedFlowModel = FLOW_MODEL_OPTIONS.find(m => m.id === normalizedSelectedId);
  const selectedMuseModel = MUSE_MODEL_OPTIONS.find(m => m.id === normalizedSelectedId);
  const selectedModel = selectedGeminiModel || selectedFlowModel || selectedMuseModel || FLOW_MODEL_OPTIONS[0];
  const isFlowSelected = !!selectedFlowModel;
  const isMuseSelected = !!selectedMuseModel;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      isFlowBackendAvailable(false),
      getMuseReadyStatus(false),
      fetchMuseAdminUrl(),
    ]).then(([isOnline, st, adminUrl]) => {
      if (cancelled) return;
      setFlowBackendOnline(isOnline);
      setMuseBackendOnline(st.available);
      setMuseAccountsCount(st.accounts);
      setMuseAdminUrl(adminUrl);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-sync cached status when user opens dropdown
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void Promise.all([
      isFlowBackendAvailable(false),
      getMuseReadyStatus(false),
    ]).then(([isOnline, st]) => {
      if (cancelled) return;
      setFlowBackendOnline(isOnline);
      setMuseBackendOnline(st.available);
      setMuseAccountsCount(st.accounts);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
    if (id.includes('muse-video') || id.includes('veo') || id === FLOW_MODEL_IDS.VIDEO) return Video;
    if (id.includes('muse-spark') || id.includes('omni') || id.includes('audio')) return Sparkles;
    if (id.includes('muse') || id.includes('flow')) return Globe;
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
          <div className={`p-2 rounded-xl text-white ${
            isMuseSelected
              ? 'bg-pink-500/20 dark:bg-pink-500/30'
              : isFlowSelected
              ? 'bg-emerald-500/20 dark:bg-emerald-500/30'
              : 'bg-slate-100 dark:bg-white/10 !text-slate-700 dark:!text-white'
          }`}>
            {React.createElement(getIcon(selectedModel.id), {
              size: 18,
              className: isMuseSelected ? 'text-pink-500 dark:text-pink-400' : isFlowSelected ? 'text-emerald-500 dark:text-emerald-400' : ''
            })}
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
              {isMuseSelected && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-600 dark:text-pink-300 font-black uppercase tracking-tighter">
                  MUSE
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
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'flow'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-b-2 border-emerald-500'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span>🌐 Google Flow</span>
                  {flowBackendOnline === false && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold normal-case">
                      Local
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('muse')}
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'muse'
                      ? 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10 border-b-2 border-pink-500'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span>✨ Muse AI</span>
                  {museAccountsCount > 0 ? (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold normal-case">
                      {museAccountsCount}
                    </span>
                  ) : museBackendOnline === false ? (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-slate-500/20 text-slate-500 font-bold normal-case">
                      Off
                    </span>
                  ) : (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold normal-case">
                      Cookie
                    </span>
                  )}
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
                          <th className="font-semibold p-2 w-1/3 border-l border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400">Nano Banana 2.1</th>
                          <th className="font-semibold p-2 w-1/3 border-l border-slate-200 dark:border-white/10 text-purple-600 dark:text-purple-400">Nano Banana Pro</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Tốc độ & Đa ảnh</td>
                          <td className="p-2 text-emerald-500 font-semibold border-r border-slate-200 dark:border-white/5">Nhanh (Tới 14 ảnh)</td>
                          <td className="p-2 text-amber-500">Chuẩn Studio</td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Độ chi tiết</td>
                          <td className="p-2 text-emerald-500 font-semibold border-r border-slate-200 dark:border-white/5">Rất cao (1K–4K)</td>
                          <td className="p-2 text-emerald-500 font-semibold">Cực cao (tốt nhất)</td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Suy luận Prompt</td>
                          <td className="p-2 border-r border-slate-200 dark:border-white/5">Minimal – High</td>
                          <td className="p-2 text-emerald-500 font-semibold">Phức tạp</td>
                        </tr>
                        <tr className="text-slate-500 dark:text-slate-400">
                          <td className="p-2 font-medium border-r border-slate-200 dark:border-white/5">Khuyên dùng</td>
                          <td className="p-2 border-r border-slate-200 dark:border-white/5 text-[9px] leading-tight">Phối bộ nhiều sản phẩm, sửa ảnh</td>
                          <td className="p-2 text-[9px] leading-tight max-w-[100px]">Lookbook cao cấp, chân thực cao</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pb-4">
                    {geminiApiModels.map((model) => {
                      const isSelected = normalizedSelectedId === model.id;
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
                  {flowBackendOnline === false ? (
                    <div className="mx-3 mt-3 mb-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-base">🌐</span>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Chế độ Web Trực Tiếp</p>
                          <p className="text-[9px] text-blue-600 dark:text-blue-400 leading-relaxed mt-0.5">
                            Bạn đang dùng trên web mà không cần chạy backend máy tính. Khi chọn các mô hình này, Studio sẽ <strong>tự động kết nối Cloud AI (Nano Banana / Veo)</strong> để tạo nội dung ngay lập tức!
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
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
                  )}

                  <div className="p-1.5 pb-4 max-h-[360px] overflow-y-auto custom-scrollbar space-y-3">
                    {/* Nhóm Mô hình Hình ảnh */}
                    <div>
                      <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <ImageIcon size={12} /> Mô hình Tạo Ảnh (Image)
                      </div>
                      <div className="space-y-1 mt-1">
                        {FLOW_MODEL_OPTIONS.filter(m => m.type === 'image').map((model) => {
                          const isSelected = normalizedSelectedId === model.id;
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

                    {/* Nhóm Mô hình Video (chỉ hiển thị khi filterType !== 'image') */}
                    {filterType !== 'image' && (
                    <div>
                      <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Video size={12} /> Mô hình Tạo Video (Veo & Omni)
                      </div>
                      <div className="space-y-1 mt-1">
                        {FLOW_MODEL_OPTIONS.filter(m => m.type === 'video').map((model) => {
                          const isSelected = normalizedSelectedId === model.id;
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
                    )}
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

              {/* Muse AI Tab Content */}
              {activeTab === 'muse' && (
                <>
                  <div className="mx-3 mt-3 mb-2 p-3 rounded-xl bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-pink-700 dark:text-pink-300 mb-0.5">
                          Muse.ai (muse2api)
                        </p>
                        <p className="text-[9px] text-pink-600 dark:text-pink-400 leading-relaxed">
                          Tạo ảnh, video điện ảnh (5s-10s) và prompt qua tài khoản Muse. Tự động renew session 48h.
                        </p>
                      </div>
                      <a
                        href={museAdminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pink-600 text-white text-[9px] font-bold shrink-0 hover:bg-pink-700 transition-all shadow-sm"
                      >
                        <span>Quản lý Cookie</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {museAccountsCount === 0 && (
                      <div className="mt-2 pt-2 border-t border-pink-200/60 dark:border-pink-800/40 text-[9px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <span>⚠️ Chưa có tài khoản. Bấm "Quản lý Cookie" để import cookie từ muse.ai.</span>
                      </div>
                    )}
                  </div>

                  <div className="p-1.5 pb-4 max-h-[360px] overflow-y-auto custom-scrollbar space-y-2">
                    {visibleMuseModels.map((model) => {
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
                              ? 'bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30'
                              : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-400'}`}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate text-slate-900 dark:!text-white">
                                {model.name}
                              </span>
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-600 dark:text-pink-300 font-black uppercase tracking-tighter">
                                MUSE
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:!text-slate-200 truncate">{model.desc}</p>
                          </div>
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)] mr-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Setup Guide */}
                  <div className="mx-3 mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">⚡ Cách import cookie Muse:</p>
                    <ol className="text-[9px] text-slate-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
                      <li>Bấm nút <strong>"Quản lý Cookie"</strong> ở trên để mở trang Admin Muse.</li>
                      <li>Đăng nhập <a href="https://muse.ai" target="_blank" rel="noreferrer" className="text-pink-500 underline">muse.ai</a> trên Chrome.</li>
                      <li>Dùng extension hoặc copy cookie dán vào ô Add Account.</li>
                    </ol>
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
