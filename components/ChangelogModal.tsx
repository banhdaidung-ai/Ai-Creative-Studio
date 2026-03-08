
import React, { useState, useEffect } from 'react';
import { X, Bell, Calendar, Tag, ChevronRight, Zap, CheckCircle2 } from 'lucide-react';

export interface UpdateItem {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'fix' | 'improvement';
  details: string[];
}

// Dữ liệu cập nhật (Mô phỏng Realtime News) - Adjusted to Reality (2025)
export const APP_UPDATES: UpdateItem[] = [
  {
    id: 'upd_004',
    version: '2.3.0',
    date: '2026-02-26 20:00',
    title: 'Nâng cấp Photo Editor',
    description: 'Cập nhật công cụ chỉnh sửa ảnh với các tính năng mới mạnh mẽ.',
    type: 'feature',
    details: [
      'Thêm tính năng xoay và lật ảnh (ngang/dọc).',
      'Điều chỉnh độ sáng, độ tương phản và độ bão hòa.',
      'Bộ lọc màu: Trắng đen, Sepia và Làm mờ (Blur).',
      'Giao diện tối ưu hóa cho cả Mobile và Desktop.'
    ]
  },
  {
    id: 'upd_003',
    version: '2.2.0',
    date: '2025-12-22 09:30',
    title: 'Text Stroke & Decoration',
    description: 'Nâng cấp công cụ chỉnh sửa văn bản với các tùy chọn trang trí mới.',
    type: 'feature',
    details: [
      'Thêm tính năng viền chữ (Stroke) tùy chỉnh màu và độ dày.',
      'Bổ sung kiểu gạch chân (Underline) và gạch ngang (Strikethrough).',
      'Tối ưu hóa khả năng hiển thị layer văn bản trên nền tối.'
    ]
  },
  {
    id: 'upd_002',
    version: '2.1.5',
    date: '2025-11-20 14:00',
    title: 'Grid Layout System',
    description: 'Hệ thống lưới ảnh thông minh và chế độ Multi-select.',
    type: 'feature',
    details: [
      'Kéo thả nhiều ảnh cùng lúc vào khung lưới.',
      'Chế độ chọn nhiều Frame (Shift + Click) để thay đổi kích thước hàng loạt.',
      'Thêm các mẫu Layout mới: Top-1-Bottom-2, Left-1-Right-2.',
      'Tính năng Pan ảnh (giữ Alt + Drag) bên trong khung.'
    ]
  },
  {
    id: 'upd_001',
    version: '2.0.0',
    date: '2025-10-01 08:00',
    title: 'Official Launch 2.0',
    description: 'Ra mắt YODY Creative Studio với các tính năng AI cốt lõi.',
    type: 'improvement',
    details: [
      'Tích hợp Gemini 1.5 Pro cho xử lý hình ảnh.',
      'Tính năng xóa phông nền tự động.',
      'Gợi ý Prompt thông minh.',
      'Studio thay đồ ảo (Virtual Try-On).'
    ]
  }
];

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10 relative group">
        
        {/* Modern Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-blue-600/10 blur-[100px] rounded-full"></div>
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>
        </div>

        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md flex justify-between items-start relative z-10">
          <div className="flex gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Bell className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase tracking-wider mb-1">Bản Tin 2025</h2>
              <p className="text-xs text-slate-400 font-medium">Cập nhật hệ thống & Tính năng mới nhất.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">
          {APP_UPDATES.map((item, index) => (
            <div key={item.id} className="relative pl-8 group/item">
              {/* Timeline Line */}
              {index !== APP_UPDATES.length - 1 && (
                <div className="absolute left-[11px] top-8 bottom-[-32px] w-[2px] bg-white/5 group-hover/item:bg-blue-500/50 transition-colors duration-500"></div>
              )}
              
              {/* Timeline Dot */}
              <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-[#0a0a0a] flex items-center justify-center shadow-md transition-all duration-300 ${index === 0 ? 'bg-blue-500 shadow-blue-500/40 scale-110' : 'bg-slate-700 group-hover/item:bg-slate-500'}`}>
                {index === 0 && <div className="w-2 h-2 bg-white rounded-full animate-ping" />}
              </div>

              <div className="bg-white/5 border border-white/5 rounded-[1.5rem] p-5 hover:bg-white/10 hover:border-blue-500/30 transition-all shadow-lg group-hover/item:translate-x-1 duration-300 relative overflow-hidden">
                {/* Card Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover/item:from-blue-500/5 group-hover/item:to-purple-500/5 transition-all duration-500"></div>
                
                <div className="relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        item.type === 'feature' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        item.type === 'fix' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                        {item.type === 'feature' ? 'Feature' : item.type === 'fix' ? 'Bug Fix' : 'Update'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-black/40 px-2 py-1 rounded-lg border border-white/5">v{item.version}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold bg-black/20 px-2 py-1 rounded-lg">
                        <Calendar className="w-3 h-3" /> {item.date}
                    </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-300 mb-4 leading-relaxed font-light">{item.description}</p>

                    <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5">
                    {item.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{detail}</span>
                        </div>
                    ))}
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md flex justify-end relative z-10">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-white text-black hover:bg-blue-50 hover:text-blue-900 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            Đã Hiểu <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }`}</style>
    </div>
  );
};
