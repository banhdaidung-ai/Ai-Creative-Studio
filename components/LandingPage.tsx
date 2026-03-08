
import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Bell } from 'lucide-react';
import { ChangelogModal, APP_UPDATES } from './ChangelogModal';

interface LandingPageProps {
  onStart: () => void;
}

const PALETTES = [
  { primary: 'from-blue-600 to-indigo-700', blobs: ['bg-blue-500', 'bg-indigo-400', 'bg-cyan-300'] },
  { primary: 'from-purple-600 to-pink-700', blobs: ['bg-purple-500', 'bg-pink-400', 'bg-fuchsia-300'] },
  { primary: 'from-emerald-600 to-teal-700', blobs: ['bg-emerald-500', 'bg-teal-400', 'bg-lime-300'] },
  { primary: 'from-orange-600 to-red-700', blobs: ['bg-orange-500', 'bg-red-400', 'bg-amber-300'] },
  { primary: 'from-cyan-600 to-blue-700', blobs: ['bg-cyan-500', 'bg-blue-400', 'bg-indigo-300'] },
];

const LAST_SEEN_UPDATE_KEY = 'yody_last_seen_update_id';

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [palette, setPalette] = useState(PALETTES[0]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    // Chọn ngẫu nhiên một bảng màu mỗi lần truy cập
    const randomIdx = Math.floor(Math.random() * PALETTES.length);
    setPalette(PALETTES[randomIdx]);


  }, []);

  const handleCloseChangelog = () => {
    setShowChangelog(false);
    // Lưu lại ID bản cập nhật mới nhất đã xem
    const latestUpdateId = APP_UPDATES[0]?.id;
    if (latestUpdateId) {
      localStorage.setItem(LAST_SEEN_UPDATE_KEY, latestUpdateId);
      setHasNewUpdate(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#050505] flex flex-col items-center justify-center font-sans">
      {/* Changelog Modal */}
      <ChangelogModal isOpen={showChangelog} onClose={handleCloseChangelog} />

      {/* Background Animated Blobs */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${palette.blobs[0]} rounded-full blur-[120px] opacity-40 animate-blob`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] ${palette.blobs[1]} rounded-full blur-[120px] opacity-30 animate-blob animation-delay-2000`}></div>
        <div className={`absolute top-[20%] right-[10%] w-[30%] h-[30%] ${palette.blobs[2]} rounded-full blur-[100px] opacity-20 animate-blob animation-delay-4000`}></div>
      </div>

      {/* Header News Button (Top Right) */}
      <div className="absolute top-6 right-6 z-20 animate-in fade-in slide-in-from-top-4 duration-1000 delay-300">
        <button 
          onClick={() => setShowChangelog(true)}
          className="relative group flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full backdrop-blur-md transition-all active:scale-95"
        >
          <div className="relative">
            <Bell className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
            {hasNewUpdate && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
            {hasNewUpdate && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></span>}
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-wider hidden md:block">Có gì mới?</span>
        </button>
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 text-center px-6 max-w-5xl">
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-in slide-in-from-top duration-700">
          <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Ai.YODY.IO</span>
        </div>

        <h1 className="text-3xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight tracking-tight drop-shadow-2xl animate-in fade-in slide-in-from-bottom duration-1000">
          Chào mừng bạn đến với <br />
          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${palette.primary} whitespace-nowrap inline-block`}>
            KHÔNG GIAN SÁNG TẠO
          </span>
          <br />
          <span className="text-xl md:text-3xl lg:text-4xl opacity-90 font-bold uppercase tracking-[0.1em]">Ai Creative Studio</span>
        </h1>

        <p className="text-slate-400 text-sm md:text-lg max-w-2xl mx-auto mb-12 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom duration-1000 delay-200">
          Khám phá sức mạnh của Trí tuệ nhân tạo trong thiết kế thời trang, chỉnh sửa hình ảnh chuyên nghiệp và sáng tạo nội dung không giới hạn.
        </p>

        <button 
          onClick={onStart}
          className={`group relative px-10 py-5 rounded-[2rem] bg-white text-black font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_50px_rgba(255,255,255,0.2)] hover:shadow-[0_20px_50px_rgba(255,255,255,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto overflow-hidden animate-in zoom-in duration-1000 delay-500`}
        >
          <div className={`absolute inset-0 bg-gradient-to-r ${palette.primary} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
          <span className="relative z-10">Hãy bắt đầu</span>
          <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 left-0 w-full z-10 text-center animate-in fade-in duration-1000 delay-700">
        <div className="max-w-md mx-auto px-4 py-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            Ứng dụng được phát triển bởi <span className="text-white">Bành Đại Dũng</span>
          </p>
          <p className="text-[9px] text-slate-500 mt-1 font-medium">
            Cần trợ giúp xin gọi ngay SĐT: <span className={`text-transparent bg-clip-text bg-gradient-to-r ${palette.primary} font-black`}>0982333097</span>
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite alternate ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
