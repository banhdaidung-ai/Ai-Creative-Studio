import React, { useState, useMemo } from 'react';
import { useProject, ImageAsset } from '../contexts/ProjectContext';
import { Trash2, Download, Box, Search, Filter, Calendar, Clock, Image as ImageIcon, X, CheckCircle2, Share2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const HistoryGallery: React.FC = () => {
  const { history, removeFromHistory, clearHistory, setWorkspaceAsset, workspaceAsset } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<ImageAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<ImageAsset | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = (item.prompt || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterMode === 'all' || item.mode === filterMode;
      return matchesSearch && matchesFilter;
    });
  }, [history, searchTerm, filterMode]);

  const modes = useMemo(() => {
    const uniqueModes = Array.from(new Set(history.map(item => item.mode)));
    return ['all', ...uniqueModes];
  }, [history]);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-transparent p-4 md:p-8 overflow-hidden">
      {/* Header Section */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-2xl text-blue-400">
              <Calendar className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-800 dark:text-white">
              Lịch sử sáng tạo
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            Quản lý và tái sử dụng các tác phẩm AI của bạn ({history.length} mục)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm prompt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-w-[240px]"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-xl">
            {modes.map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  filterMode === mode 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode === 'all' ? 'Tất cả' : mode.replace('_', ' ')}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <button 
              onClick={() => setShowConfirmClear(true)}
              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all active:scale-95 border border-red-500/20"
              title="Xóa toàn bộ lịch sử"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {filteredHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
            <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6">
              <ImageIcon className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Không có dữ liệu</h3>
            <p className="text-slate-500 mt-2 max-w-xs">Bắt đầu tạo ảnh để lưu trữ lịch sử của bạn tại đây.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-12">
            <AnimatePresence mode="popLayout">
              {filteredHistory.map((item) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="group relative aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer"
                  onClick={() => setSelectedAsset(item)}
                >
                  <img 
                    src={item.url} 
                    alt={item.prompt} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                    <div className="flex items-center justify-between gap-2">
                       <div className="flex gap-1.5">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item.url, `yody-ai-${item.id}.png`);
                            }}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-md text-white transition-colors"
                          >
                            <Download size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setWorkspaceAsset(item);
                            }}
                            className={`p-2 rounded-lg backdrop-blur-md transition-colors ${
                              workspaceAsset?.id === item.id 
                                ? 'bg-green-500 text-white' 
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                            title="Đưa vào Workspace"
                          >
                            <Box size={14} />
                          </button>
                       </div>
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetToDelete(item);
                        }}
                        className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg backdrop-blur-md text-red-400 transition-colors"
                       >
                        <Trash2 size={14} />
                       </button>
                    </div>
                  </div>

                  {/* Mode Badge */}
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/10">
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">{item.mode.replace('_', ' ')}</span>
                  </div>

                  {/* Active Indicator */}
                  {workspaceAsset?.id === item.id && (
                    <div className="absolute top-3 right-3 p-1 bg-green-500 rounded-full shadow-lg shadow-green-500/50">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              onClick={() => setSelectedAsset(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-6xl bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Section */}
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden p-4">
                <img 
                  src={selectedAsset.url} 
                  alt={selectedAsset.prompt} 
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                />
              </div>

              {/* Info Section */}
              <div className="w-full md:w-[380px] border-l border-white/10 flex flex-col bg-[#111111]">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Chi tiết</h3>
                      <p className="text-[10px] text-slate-500 font-mono">{formatDate(selectedAsset.timestamp)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAsset(null)}
                    className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  {/* Prompt */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prompt</label>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-sm text-slate-300 leading-relaxed italic font-serif">
                      "{selectedAsset.prompt || 'Không có prompt'}"
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                       <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Chế độ</span>
                       <span className="text-xs font-bold text-white uppercase">{selectedAsset.mode.replace('_', ' ')}</span>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                       <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">ID</span>
                       <span className="text-xs font-mono text-slate-400">#{selectedAsset.id.slice(-6)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 pt-4">
                    <button 
                      onClick={() => {
                        setWorkspaceAsset(selectedAsset);
                        setSelectedAsset(null);
                      }}
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                        workspaceAsset?.id === selectedAsset.id
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      }`}
                    >
                      <Box size={18} />
                      {workspaceAsset?.id === selectedAsset.id ? 'Đang ở Workspace' : 'Đưa vào Workspace'}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleDownload(selectedAsset.url, `yody-ai-${selectedAsset.id}.png`)}
                        className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-white transition-all"
                      >
                        <Download size={16} /> Tải về
                      </button>
                      <button 
                        onClick={() => {
                          setAssetToDelete(selectedAsset);
                        }}
                        className="py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-red-500 transition-all"
                      >
                        <Trash2 size={16} /> Xóa
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-black/20 border-t border-white/10">
                   <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                      <span>YODY AI STUDIO</span>
                      <span>2026</span>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {(assetToDelete || showConfirmClear) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setAssetToDelete(null);
                setShowConfirmClear(false);
              }}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                <Trash2 className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">
                {showConfirmClear ? 'Xóa toàn bộ lịch sử?' : 'Xóa mục này?'}
              </h3>
              
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {showConfirmClear 
                  ? 'Hành động này sẽ xóa vĩnh viễn tất cả các tác phẩm trong lịch sử của bạn. Bạn không thể hoàn tác thao tác này.' 
                  : 'Bạn có chắc chắn muốn xóa tác phẩm này khỏi lịch sử không?'}
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setAssetToDelete(null);
                    setShowConfirmClear(false);
                  }}
                  className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm text-slate-300 transition-all"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={() => {
                    if (showConfirmClear) {
                      clearHistory();
                      setShowConfirmClear(false);
                    } else if (assetToDelete) {
                      removeFromHistory(assetToDelete.id);
                      if (selectedAsset?.id === assetToDelete.id) {
                        setSelectedAsset(null);
                      }
                      setAssetToDelete(null);
                    }
                  }}
                  className="py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-sm text-white shadow-lg shadow-red-600/20 transition-all"
                >
                  Xác nhận xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default HistoryGallery;
