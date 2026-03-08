import React, { useState, useEffect } from 'react';
import { AppMode } from '../types';
import { Sparkles, Eraser, Camera, Moon, Sun, User, Shirt, Film, Lightbulb, Edit3, Key, Crown, X, CheckCircle2, Loader2, RefreshCw, LogOut, LogIn } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface LayoutProps {
  currentMode: AppMode;
  onSwitchMode: (mode: AppMode) => void;
  children: React.ReactNode;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Layout: React.FC<LayoutProps> = ({ currentMode, onSwitchMode, children, isDarkMode, toggleTheme }) => {
  const { user, login, logout, loading: authLoading } = useUser();
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
        // Kiểm tra xem đã có key trong localStorage chưa
        if (localStorage.getItem('gemini_api_key')) {
            setApiKeySelected(true);
            return;
        }
        // Kiểm tra xem đã select key từ AI Studio chưa
        if (window.aistudio?.hasSelectedApiKey) {
            const has = await window.aistudio.hasSelectedApiKey();
            if (has) setApiKeySelected(true);
        }
    };
    checkKey();
  }, []);

  const handleOpenUnlock = () => {
      setShowUnlockModal(true);
  };

  const handleProjectKey = async () => {
    if (window.aistudio?.openSelectKey) {
        setIsVerifying(true);
        try {
            await window.aistudio.openSelectKey();
            // QUAN TRỌNG: Kiểm tra lại xem người dùng ĐÃ CHỌN key chưa.
            // openSelectKey resolve kể cả khi user đóng popup mà ko chọn gì.
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (hasKey) {
                // Clear manual key if switching to project key to avoid confusion
                localStorage.removeItem('gemini_api_key');
                setApiKeySelected(true);
                setShowUnlockModal(false);
                window.dispatchEvent(new Event('gemini_api_key_updated'));
            } else {
                setApiKeySelected(false);
            }
        } catch (e) { 
            console.error("Select key failed/cancelled", e); 
            setApiKeySelected(false);
        } finally {
            setIsVerifying(false);
        }
    }
  };

  const handleManualKey = () => {
      // Basic validation: Key Gemini thường dài và bắt đầu bằng AIza...
      // Trim whitespace is crucial here
      const cleanedKey = manualKey.trim();
      if (cleanedKey.length > 10) {
          localStorage.setItem('gemini_api_key', cleanedKey);
          setApiKeySelected(true);
          setShowUnlockModal(false);
          window.dispatchEvent(new Event('gemini_api_key_updated'));
      }
  };

  const handleResetKey = () => {
      localStorage.removeItem('gemini_api_key');
      setApiKeySelected(false);
      setManualKey('');
      window.dispatchEvent(new Event('gemini_api_key_updated'));
      // Force reload to clear any cached states if necessary, or just state update
      // window.location.reload(); 
  };

  const navItems = [
    { mode: AppMode.IMAGE_EDITOR, label: 'Tạo Ảnh', icon: Sparkles, color: 'text-blue-400', gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/40', animate: 'group-hover:animate-pulse' },
    { mode: AppMode.BATCH_FASHION, label: 'Thay Đồ', icon: Shirt, color: 'text-purple-400', gradient: 'from-purple-500 to-pink-600', shadow: 'shadow-purple-500/40', animate: 'group-hover:scale-110 transition-transform' },
    { mode: AppMode.MULTI_ANGLE, label: 'Đa Góc', icon: Camera, color: 'text-yellow-400', gradient: 'from-yellow-400 to-orange-500', shadow: 'shadow-yellow-500/40', animate: 'group-hover:rotate-12 transition-transform' },
    { mode: AppMode.BACKGROUND_REMOVER, label: 'Tách Nền', icon: Eraser, color: 'text-pink-400', gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/40', animate: 'group-hover:-translate-y-1 transition-transform' },
    { mode: AppMode.VIDEO_GENERATOR, label: 'Tạo Video', icon: Film, color: 'text-red-500', gradient: 'from-red-500 to-orange-600', shadow: 'shadow-red-500/40', animate: 'group-hover:animate-bounce' },
    { mode: AppMode.PROMPT_GENERATOR, label: 'Gợi Ý', icon: Lightbulb, color: 'text-lime-400', gradient: 'from-lime-400 to-green-500', shadow: 'shadow-lime-500/40', animate: 'group-hover:brightness-125 transition-all' },
    { mode: AppMode.MANUAL_EDITOR, label: 'Sửa Ảnh', icon: Edit3, color: 'text-cyan-400', gradient: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/40', animate: 'group-hover:rotate-6 transition-transform' },
  ];

  return (
    <div className={`h-[100dvh] transition-colors duration-700 flex flex-col md:flex-row p-0 md:p-4 gap-0 md:gap-4 overflow-hidden select-none ${
      isDarkMode 
        ? 'bg-[#050505] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black' 
        : 'bg-[#f0f2f5] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-50 via-white to-gray-100'
    }`}>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-black/5 dark:bg-black/20 backdrop-blur-xl border-b border-white/10 z-50 shrink-0 pt-[env(safe-area-inset-top)] box-content">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg p-1 shadow-md">
            <img src="https://yody.vn/favicon.ico" alt="Y" className="w-full h-full object-contain" />
          </div>
          <span className="text-[12px] font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Ai.YODY.IO</span>
        </div>
        <div className="flex items-center gap-2">
            {!apiKeySelected ? (
                <button onClick={handleOpenUnlock} className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1.5 rounded-lg font-black text-[8px] uppercase shadow-lg">
                    <Key className="w-3 h-3" /> <span className="hidden sm:inline">Pro</span>
                </button>
            ) : (
                <button onClick={handleOpenUnlock} className="flex items-center gap-1 bg-gradient-to-r from-slate-800 to-black text-yellow-400 px-2 py-1.5 rounded-lg font-black text-[8px] uppercase shadow-lg border border-white/10">
                    <Crown className="w-3 h-3" /> <span className="hidden sm:inline">Active</span>
                </button>
            )}
            <button onClick={toggleTheme} className="p-2 rounded-xl bg-white/5 text-slate-500 dark:text-white transition-all active:scale-90 border border-white/10">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
        </div>
      </header>

      {/* Navigation: Fixed Bottom on Mobile, Sidebar on Desktop */}
      <aside className="fixed bottom-0 left-0 right-0 md:static w-full md:w-20 lg:w-64 flex flex-col z-[60] md:z-20 shrink-0 h-auto md:h-full pb-[env(safe-area-inset-bottom)] bg-black/5 dark:bg-white/5 backdrop-blur-3xl md:backdrop-blur-none border-t md:border-none border-white/20 dark:border-white/10">
        <div className="md:bg-black/5 md:dark:bg-white/5 md:backdrop-blur-2xl md:border border-white/20 dark:border-white/10 md:rounded-[2rem] flex flex-row md:flex-col h-16 md:h-full shadow-2xl md:shadow-none overflow-hidden relative ring-1 ring-inset ring-white/10 md:ring-0">
          
          {/* Desktop Logo Area */}
          <div className="hidden md:flex p-3 md:p-5 md:border-b border-white/10 items-center justify-between lg:justify-start lg:gap-4 shrink-0 min-w-0 bg-white/5">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-white to-gray-100 rounded-2xl flex items-center justify-center shadow-lg border border-white/50 p-2 shrink-0 transform transition-transform hover:scale-105 hover:rotate-3">
                 <img src="https://yody.vn/favicon.ico" alt="YODY" className="w-full h-full object-contain" />
               </div>
               <div className="flex flex-col justify-center">
                  <span className="text-[14px] md:text-[16px] font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 leading-none tracking-tight drop-shadow-sm uppercase">Ai Creative Studio</span>
               </div>
             </div>
          </div>
          
          {/* Nav Items */}
          <nav className="flex-1 px-2 md:px-3 py-1 md:py-3 space-x-1 md:space-x-0 space-y-0 md:space-y-2 lg:space-y-3 flex flex-row md:flex-col items-center lg:items-stretch justify-around md:justify-start overflow-x-auto md:overflow-y-auto no-scrollbar w-full">
            {navItems.map((item) => (
              <button
                key={item.mode}
                onClick={() => onSwitchMode(item.mode)}
                className={`group relative flex flex-col md:flex-row items-center justify-center lg:justify-start gap-1 md:gap-4 p-1.5 md:p-3.5 rounded-xl md:rounded-[1.5rem] transition-all duration-300 shrink-0 outline-none ${
                  currentMode === item.mode 
                    ? `md:bg-gradient-to-r md:${item.gradient} text-white md:shadow-lg md:${item.shadow} md:scale-[1.02]` 
                    : 'text-slate-400 md:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white'
                }`}
              >
                <div className={`p-1.5 md:p-2 rounded-xl transition-all duration-300 ${currentMode === item.mode ? 'bg-white/10 md:bg-white/20' : 'bg-transparent'}`}>
                  <item.icon className={`w-5 h-5 md:w-5 md:h-5 ${currentMode === item.mode ? 'text-blue-500 md:text-white' : item.color} ${item.animate}`} />
                </div>
                <span className={`text-[9px] md:text-xs font-black tracking-wide uppercase ${currentMode === item.mode ? 'text-blue-600 dark:text-blue-400 md:text-white' : 'text-slate-500 dark:text-slate-400'} md:block lg:block`}>
                  <span className="md:hidden lg:inline">{item.label}</span>
                </span>
                
                {/* Active Indicator */}
                {currentMode === item.mode && (
                  <div className="absolute top-0 md:right-3 md:top-auto w-1 h-1 md:w-1.5 md:h-1.5 bg-blue-500 md:bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
              </button>
            ))}
          </nav>

          {/* Unlock Pro / Active Status (Desktop) */}
          <div className="hidden md:block p-3">
            {!apiKeySelected ? (
                <button 
                    onClick={handleOpenUnlock}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-600 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-2 lg:gap-3 shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden relative"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <div className="p-2 bg-white/20 rounded-xl">
                        <Key className="w-4 h-4 text-white" />
                    </div>
                    <div className="hidden lg:block text-left">
                        <span className="text-[10px] font-black text-white uppercase block leading-none mb-0.5">Unlock Pro</span>
                        <span className="text-[8px] font-bold text-white/80 uppercase tracking-wider block">Get API Key</span>
                    </div>
                </button>
            ) : (
                <div onClick={handleOpenUnlock} className="w-full bg-gradient-to-r from-slate-800 to-slate-900 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-2 lg:gap-3 border border-white/5 relative overflow-hidden cursor-pointer group hover:bg-slate-800 transition-colors">
                    <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20 z-10">
                        <Crown className="w-4 h-4 text-white" />
                    </div>
                    <div className="hidden lg:block text-left z-10">
                        <span className="text-[10px] font-black text-white uppercase block leading-none mb-0.5">Pro Active</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block group-hover:text-slate-300">Click to Manage</span>
                    </div>
                </div>
            )}
          </div>

          {/* Footer Desktop */}
          <div className="p-3 mt-auto shrink-0 hidden md:block border-t border-white/10 bg-white/5">
             <div className="flex items-center gap-2">
                {user ? (
                  <div className="flex-1 bg-black/20 backdrop-blur-md rounded-2xl p-2.5 border border-white/5 flex items-center gap-3 relative overflow-hidden group">
                      <img 
                        src={user.picture} 
                        alt={user.name} 
                        className="w-8 h-8 rounded-full border border-white/10 shrink-0 group-hover:scale-105 transition-transform" 
                      />
                      <div className="hidden lg:block min-w-0 flex-1">
                          <p className="font-black text-[7px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">Welcome back</p>
                          <p className="font-black text-[10px] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 truncate">{user.name}</p>
                      </div>
                      <button 
                        onClick={logout}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        title="Đăng xuất"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                  </div>
                ) : (
                  <button 
                    onClick={login}
                    disabled={authLoading}
                    className="flex-1 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/5 flex items-center justify-center gap-3 group transition-all active:scale-95"
                  >
                    {authLoading ? (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                            <LogIn className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="hidden lg:block text-left">
                            <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Login with</p>
                            <p className="font-black text-[10px] text-white">Google</p>
                        </div>
                      </>
                    )}
                  </button>
                )}
                <button onClick={toggleTheme} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-500 transition-all border border-white/10 active:scale-95">
                    {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Glass Stage */}
      <main className="flex-1 bg-black/5 dark:bg-white/5 backdrop-blur-3xl border-t md:border border-white/20 dark:border-white/10 md:rounded-[2.5rem] shadow-2xl overflow-hidden relative ring-1 ring-inset ring-white/10 flex flex-col h-full min-h-0 pb-16 md:pb-0 mb-[env(safe-area-inset-bottom)] md:mb-0">
         <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
         <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2 animate-pulse"></div>
         <div className="relative z-10 h-full flex flex-col">
            {children}
         </div>
      </main>

      {/* Unlock Pro Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-6 max-w-lg w-full shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button onClick={() => setShowUnlockModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
                        <Key className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">Unlock Pro Features</h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Lựa chọn phương thức kích hoạt</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: Project Key */}
                    <button 
                        onClick={handleProjectKey} 
                        disabled={isVerifying}
                        className="group p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-yellow-500/50 transition-all text-left flex flex-col gap-3 h-full relative"
                    >
                        <div className="p-2.5 bg-blue-500/20 w-fit rounded-xl text-blue-400 group-hover:text-blue-300 group-hover:scale-110 transition-all">
                            {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm mb-1 uppercase tracking-wide">Project Key</div>
                            <div className="text-[10px] text-slate-400 leading-relaxed font-medium">Sử dụng key từ dự án Google AI Studio hiện tại.</div>
                        </div>
                    </button>

                    {/* Option 2: Manual Key */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
                        <div className="p-2.5 bg-purple-500/20 w-fit rounded-xl text-purple-400">
                            <Key className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-white text-sm mb-2 uppercase tracking-wide">Nhập API Key</div>
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    value={manualKey}
                                    onChange={(e) => setManualKey(e.target.value)}
                                    placeholder="Paste API Key here..." 
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[10px] text-white outline-none focus:border-purple-500 transition-all font-mono"
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleManualKey} disabled={manualKey.trim().length <= 10} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95">
                                        Active Ngay
                                    </button>
                                    {apiKeySelected && (
                                        <button onClick={handleResetKey} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 rounded-lg transition-all" title="Xóa Key hiện tại">
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (max-width: 768px) {
          body { overscroll-behavior-y: contain; }
        }
      `}</style>
    </div>
  );
};

export default Layout;