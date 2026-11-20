import React from 'react';
import { X, Bell, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';

export interface UpdateItem {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'fix' | 'improvement';
  details: string[];
}

export const APP_UPDATES: UpdateItem[] = [
  {
    id: 'upd_300',
    version: '3.0.0',
    date: '2026-11-20 21:45',
    title: 'Ra mắt AI Creative Studio 3.0 — Thế hệ Gemini 4 & Omni 1.2',
    description: 'Đại nâng cấp toàn diện hệ thống AI Models tháng 11/2026, Video Studio đa khung hình và Dây chuyền sản xuất tự động.',
    type: 'feature',
    details: [
      'Nâng cấp lõi SDK @google/genai 3.6.1 (Interactions API v1) với Gemini 4 Argon / Hydrogen & Nano Banana 2.1 (hỗ trợ ghép tới 14 ảnh tham chiếu, tỷ lệ Banner 21:9, 4:1, 1:4 và Khóa mã màu Hex).',
      'AI Video Studio 2.0 với Omni 1.2 Flash (Google Flow & API): dựng video 3s–15s độ phân giải tới 4K kèm âm thanh thực, nội suy Khung Đầu–Cuối, giữ đồng nhất 6 ảnh Thành phần và Nối dài video tới 30s.',
      'Chấm điểm chất lượng tự động AI Auto-QC (Gemini Decision 1), Phối bộ Mix & Match nguyên cây và Xuất trọn gói file .zip theo mã SKU.',
      'Tách nền Pro tích hợp Hòa trộn Ánh sáng & Bóng đổ AI (Subject Relighting), khôi phục YODY Knowledge tra cứu xu hướng Google Search thời gian thực và Pipeline lồng tiếng Gemini 3.8 TTS.'
    ]
  },
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
        <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md flex justify-between items-start relative z-10">
          <div className="flex gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Bell className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase tracking-wider mb-1">
                Bản Tin 2026 — Studio 3.0
              </h2>
              <p className="text-xs text-slate-400 font-medium">Cập nhật hệ thống & Thế hệ AI Models mới nhất.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">
          {APP_UPDATES.map((item, index) => (
            <div key={item.id} className="relative pl-8 group/item">
              {index !== APP_UPDATES.length - 1 && (
                <div className="absolute left-[11px] top-8 bottom-[-32px] w-[2px] bg-white/5 group-hover/item:bg-blue-500/50 transition-colors duration-500" />
              )}

              <div
                className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-[#0a0a0a] flex items-center justify-center shadow-md transition-all duration-300 ${
                  index === 0 ? 'bg-blue-500 shadow-blue-500/40 scale-110' : 'bg-slate-700 group-hover/item:bg-slate-500'
                }`}
              >
                {index === 0 && <div className="w-2 h-2 bg-white rounded-full animate-ping" />}
              </div>

              <div className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-3xl p-5 transition-all duration-300">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.type === 'feature'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : item.type === 'fix'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      v{item.version}
                    </span>
                    <h3 className="font-bold text-white text-base">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                    <Calendar className="w-3 h-3" />
                    {item.date}
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-4 leading-relaxed font-medium">{item.description}</p>

                <div className="space-y-2 bg-black/20 rounded-2xl p-3.5 border border-white/5">
                  {item.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md flex justify-end relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg active:scale-95"
          >
            <span>Bắt đầu trải nghiệm</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
