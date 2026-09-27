import React, { useState, useEffect } from 'react';
import { AppMode } from '../types';
import { Sparkles, Eraser, Camera, Moon, Sun, User, Shirt, Film, Lightbulb, Edit3, Key, Crown, X, CheckCircle2, Loader2, RefreshCw, Box, ArrowRight, History, HelpCircle, Grid } from 'lucide-react';
import { useProject } from '../src/context/ProjectContext';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../services/gemini';
import { toast } from 'sonner';
import UserAvatar from './UserAvatar';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  currentMode: AppMode;
  onSwitchMode: (mode: AppMode) => void;
  children: React.ReactNode;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Layout: React.FC<LayoutProps> = ({ currentMode, onSwitchMode, children, isDarkMode, toggleTheme }) => {
  const { workspaceAsset, setWorkspaceAsset } = useProject();
  const { user, signInWithGoogle } = useAuth();
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexLocation, setVertexLocation] = useState('us-central1');
  const [vertexAccessToken, setVertexAccessToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configType, setConfigType] = useState<'google' | 'vertex'>('google');

  useEffect(() => {
    const checkKey = async () => {
        // Kiểm tra xem đã có key hoặc Google Pro trong localStorage chưa
        if (
            localStorage.getItem('gemini_api_key') || 
            localStorage.getItem('google_account_pro') === 'true' || 
            (localStorage.getItem('vertex_project_id') && localStorage.getItem('vertex_access_token'))
        ) {
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

  useEffect(() => {
    // Check Vertex Token Expiry every minute
    const interval = setInterval(() => {
      const issuedAtStr = localStorage.getItem('vertex_access_token_issued_at');
      if (issuedAtStr) {
        const issuedAt = parseInt(issuedAtStr, 10);
        const elapsedMinutes = (Date.now() - issuedAt) / (1000 * 60);
        // Warn if token is ~55 minutes old (almost expired)
        if (elapsedMinutes > 50 && elapsedMinutes < 60) {
           toast.warning('Token Vertex AI của bạn sắp hết hạn. Vui lòng lấy token mới để tránh gián đoạn.', {
              id: 'vertex-expiry-warning', 
              duration: 10000,
           });
        }
      }
    }, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleOpenUnlock = () => {
      setShowUnlockModal(true);
      // Load existing values
      setManualKey(localStorage.getItem('gemini_api_key') || '');
      setVertexProjectId(localStorage.getItem('vertex_project_id') || '');
      setVertexLocation(localStorage.getItem('vertex_location') || 'us-central1');
      setVertexAccessToken(localStorage.getItem('vertex_access_token') || '');
      if (localStorage.getItem('vertex_project_id')) {
        setConfigType('vertex');
      } else {
        setConfigType('google');
      }
  };

  const handleProjectKey = async () => {
    if (window.aistudio?.openSelectKey) {
        setIsVerifying(true);
        try {
            await window.aistudio.openSelectKey();
            // QUAN TRỌNG: Kiểm tra lại xem người dùng ĐÃ CHỌN key chưa.
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (hasKey) {
                // Clear manual key if switching to project key to avoid confusion
                localStorage.removeItem('gemini_api_key');
                localStorage.removeItem('vertex_project_id');
                localStorage.removeItem('vertex_location');
                localStorage.removeItem('vertex_access_token');
                localStorage.setItem('google_account_pro', 'true');
                setApiKeySelected(true);
                setShowUnlockModal(false);
                window.dispatchEvent(new Event('gemini_api_key_updated'));
                toast.success('Kích hoạt Pro từ Google AI Studio thành công!');
            } else {
                setApiKeySelected(false);
            }
        } catch (e) { 
            console.error("Select key failed/cancelled", e); 
            setApiKeySelected(false);
        } finally {
            setIsVerifying(false);
        }
    } else {
        // Nâng cấp: Tự động kích hoạt Pro cho tài khoản Google đang đăng nhập hoặc mở popup Google Sign-In
        setIsVerifying(true);
        try {
            if (user) {
                // Đã đăng nhập tài khoản Google
                localStorage.setItem('google_account_pro', 'true');
                localStorage.setItem('google_account_email', user.email || '');
                setApiKeySelected(true);
                setShowUnlockModal(false);
                window.dispatchEvent(new Event('gemini_api_key_updated'));
                toast.success(`Đã kích hoạt Pro thành công cho tài khoản ${user.email || user.displayName || 'Google'}!`);
            } else {
                // Chưa đăng nhập -> gọi popup đăng nhập Google
                await signInWithGoogle();
                localStorage.setItem('google_account_pro', 'true');
                setApiKeySelected(true);
                setShowUnlockModal(false);
                window.dispatchEvent(new Event('gemini_api_key_updated'));
                toast.success('Đăng nhập Google và kích hoạt Pro thành công!');
            }
        } catch (e: any) {
            console.error("Kích hoạt Pro qua tài khoản Google thất bại:", e);
            toast.error(e.message || 'Không thể đăng nhập hoặc kích hoạt Pro với tài khoản Google.');
        } finally {
            setIsVerifying(false);
        }
    }
  };

  const handleManualKey = async () => {
      setIsVerifying(true);
      setErrorMessage(null);
      try {
          if (configType === 'google') {
              const cleanedKey = manualKey.trim();
              if (cleanedKey.length < 10) throw new Error("Vui lòng nhập API Key hợp lệ.");
              
              await geminiService.validateApiKey(cleanedKey);
              localStorage.setItem('gemini_api_key', cleanedKey);
              localStorage.removeItem('vertex_project_id');
              localStorage.removeItem('vertex_location');
          } else {
              const cleanedProjectId = vertexProjectId.trim();
              const cleanedAccessToken = vertexAccessToken.trim();
              if (!cleanedProjectId || !cleanedAccessToken) throw new Error("Vui lòng nhập Project ID và Access Token.");
              
              await geminiService.validateVertexConfig(cleanedProjectId, vertexLocation, cleanedAccessToken);
              localStorage.setItem('vertex_project_id', cleanedProjectId);
              localStorage.setItem('vertex_location', vertexLocation);
              localStorage.setItem('vertex_access_token', cleanedAccessToken);
              localStorage.setItem('vertex_access_token_issued_at', Date.now().toString());
              localStorage.removeItem('gemini_api_key');
          }
          
          setApiKeySelected(true);
          setShowUnlockModal(false);
          toast.success('Kích hoạt Pro thành công!');
          // Notify other components that the key has changed
          window.dispatchEvent(new Event('gemini_api_key_updated'));
      } catch (e: any) {
          console.error("Configuration validation failed", e);
          setErrorMessage(e.message || 'Cấu hình không hợp lệ.');
          toast.error('Kích hoạt thất bại');
      } finally {
          setIsVerifying(false);
      }
  };

  const handleResetKey = () => {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('vertex_project_id');
      localStorage.removeItem('vertex_location');
      localStorage.removeItem('vertex_access_token');
      localStorage.removeItem('vertex_access_token_issued_at');
      localStorage.removeItem('google_account_pro');
      localStorage.removeItem('google_account_email');
      setApiKeySelected(false);
      setManualKey('');
      setVertexProjectId('');
      setVertexAccessToken('');
      setVertexLocation('us-central1');
      window.dispatchEvent(new Event('gemini_api_key_updated'));
      toast.info('Đã xóa cấu hình Pro.');
  };

  const navGroups = [
    {
      label: 'Sáng tạo',
      items: [
        { mode: AppMode.WORKFLOW, label: 'Workflow', icon: Box, color: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/40', animate: 'group-hover:rotate-6 transition-transform' },
        { mode: AppMode.IMAGE_EDITOR, label: 'Tạo Ảnh', icon: Sparkles, color: 'text-blue-400', gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/40', animate: 'group-hover:animate-pulse' },
        { mode: AppMode.VIDEO_GENERATOR, label: 'Tạo Video', icon: Film, color: 'text-red-500', gradient: 'from-red-500 to-orange-600', shadow: 'shadow-red-500/40', animate: 'group-hover:animate-bounce' },
        { mode: AppMode.MULTI_ANGLE, label: 'Đa Góc', icon: Camera, color: 'text-yellow-400', gradient: 'from-yellow-400 to-orange-500', shadow: 'shadow-yellow-500/40', animate: 'group-hover:rotate-12 transition-transform' },
      ]
    },
    {
      label: 'Công cụ',
      items: [
        { mode: AppMode.BATCH_FASHION, label: 'Thay Đồ', icon: Shirt, color: 'text-purple-400', gradient: 'from-purple-500 to-pink-600', shadow: 'shadow-purple-500/40', animate: 'group-hover:scale-110 transition-transform' },
        { mode: AppMode.BACKGROUND_REMOVER, label: 'Tách Nền', icon: Eraser, color: 'text-pink-400', gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/40', animate: 'group-hover:-translate-y-1 transition-transform' },
        { mode: AppMode.MANUAL_EDITOR, label: 'Sửa Ảnh', icon: Edit3, color: 'text-cyan-400', gradient: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/40', animate: 'group-hover:rotate-6 transition-transform' },
        { mode: AppMode.PROMPT_GENERATOR, label: 'Gợi Ý', icon: Lightbulb, color: 'text-lime-400', gradient: 'from-lime-400 to-green-500', shadow: 'shadow-lime-500/40', animate: 'group-hover:brightness-125 transition-all' },
      ]
    },
    {
      label: 'Hỗ trợ',
      items: [
        { mode: AppMode.PROMPT_LIBRARY, label: 'Thư Viện', icon: Grid, color: 'text-orange-400', gradient: 'from-orange-500 to-red-600', shadow: 'shadow-orange-500/40', animate: 'group-hover:scale-110 transition-transform' },
        { mode: AppMode.HISTORY, label: 'Lịch Sử', icon: History, color: 'text-indigo-400', gradient: 'from-indigo-500 to-purple-600', shadow: 'shadow-indigo-500/40', animate: 'group-hover:rotate-12 transition-transform' },
        { mode: AppMode.GUIDE, label: 'Hướng Dẫn', icon: HelpCircle, color: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/40', animate: 'group-hover:rotate-12 transition-transform' },
      ]
    }
  ];

  return (
    <div className={`h-[100dvh] w-full transition-colors duration-700 flex flex-col md:flex-row p-0 md:p-4 gap-0 md:gap-4 overflow-hidden ${
      isDarkMode 
        ? 'bg-[#050505] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black' 
        : 'bg-[#f0f2f5] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-50 via-white to-gray-100'
    }`}>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white/10 dark:bg-black/20 backdrop-blur-xl border-b border-white/10 z-50 shrink-0">
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
            <UserAvatar />
        </div>
      </header>

      {/* Navigation: Fixed Bottom on Mobile, Sidebar on Desktop */}
      <aside className="fixed bottom-0 left-0 right-0 md:static w-full md:w-20 lg:w-64 flex flex-col z-[60] md:z-20 shrink-0 h-auto md:h-full">
        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-3xl md:backdrop-blur-2xl border-t md:border border-white/20 dark:border-white/10 md:rounded-[2rem] flex flex-row md:flex-col h-16 md:h-full shadow-2xl overflow-hidden relative ring-1 ring-inset ring-white/10">
          
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
          <nav className="flex-1 px-2 md:px-3 py-1 md:py-3 space-x-1 md:space-x-0 space-y-0 md:space-y-4 lg:space-y-6 flex flex-row md:flex-col items-center lg:items-stretch justify-around md:justify-start overflow-x-auto md:overflow-y-auto no-scrollbar w-full">
            {navGroups.map((group) => (
              <div key={group.label} className="flex flex-row md:flex-col gap-1 md:gap-2 w-full">
                <span className="hidden lg:block text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-4 mb-1">{group.label}</span>
                <div className="flex flex-row md:flex-col gap-1 md:gap-1.5 w-full">
                  {group.items.map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => onSwitchMode(item.mode)}
                      className={`group relative flex flex-col md:flex-row items-center justify-center lg:justify-start gap-1 md:gap-3 p-1.5 md:p-2.5 rounded-xl md:rounded-[1.2rem] transition-all duration-300 shrink-0 outline-none ${
                        currentMode === item.mode 
                          ? `md:bg-gradient-to-r md:${item.gradient} text-white md:shadow-lg md:${item.shadow} md:scale-[1.02]` 
                          : 'text-slate-400 md:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white'
                      }`}
                    >
                      <div className={`p-1.5 md:p-2 rounded-xl transition-all duration-300 ${currentMode === item.mode ? 'bg-white/10 md:bg-white/20' : 'bg-transparent'}`}>
                        <item.icon className={`w-5 h-5 md:w-4 md:h-4 ${currentMode === item.mode ? 'text-blue-500 md:text-white' : item.color} ${item.animate}`} />
                      </div>
                      <span className={`text-[9px] md:text-[10px] font-black tracking-wide uppercase ${currentMode === item.mode ? 'text-blue-600 dark:text-blue-400 md:text-white' : 'text-slate-500 dark:text-slate-400'} md:block lg:block`}>
                        <span className="md:hidden lg:inline">{item.label}</span>
                      </span>
                      
                      {/* Active Indicator */}
                      {currentMode === item.mode && (
                        <div className="absolute top-0 md:right-3 md:top-auto w-1 h-1 md:w-1.5 md:h-1.5 bg-blue-500 md:bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
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
          <div className="p-3 mt-auto shrink-0 hidden md:block border-t border-white/10 bg-white/5 space-y-2">
             <UserAvatar variant="sidebar" />
             <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/20 backdrop-blur-md rounded-2xl p-2.5 border border-white/5 flex items-center gap-3 relative overflow-hidden group">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                        <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="hidden lg:block min-w-0">
                        <p className="font-black text-[7px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">Developed by</p>
                        <p className="font-black text-[10px] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 truncate">Dũng Bành</p>
                    </div>
                </div>
                <button onClick={toggleTheme} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-500 transition-all border border-white/10 active:scale-95" title="Chuyển chế độ sáng/tối">
                    {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Glass Stage */}
      <main className="flex-1 bg-white/10 dark:bg-white/5 backdrop-blur-3xl border-t md:border border-white/20 dark:border-white/10 md:rounded-[2.5rem] shadow-2xl overflow-hidden relative ring-1 ring-inset ring-white/10 flex flex-col h-full min-h-0 pb-16 md:pb-0">
         <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
         <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2 animate-pulse"></div>
         <div className="relative z-10 h-full flex flex-col">
            {children}
         </div>

         {/* Workspace Floating Indicator */}
         <AnimatePresence>
           {workspaceAsset && (
             <motion.div 
               initial={{ y: 100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 100, opacity: 0 }}
               className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#141414] text-[#E4E3E0] p-2 pr-4 rounded-full border border-white/20 shadow-2xl backdrop-blur-xl"
             >
               <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                 <img src={workspaceAsset.url} alt="Workspace" className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-mono uppercase tracking-widest opacity-50">Active Asset</span>
                 <span className="text-[10px] font-bold truncate max-w-[120px]">{workspaceAsset.prompt || 'Untitled'}</span>
               </div>
               <div className="h-6 w-px bg-white/10 mx-1" />
               <div className="flex gap-2">
                 <button 
                   onClick={() => setWorkspaceAsset(null)}
                   className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                   title="Clear Workspace"
                 >
                   <X size={14} />
                 </button>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
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
                    {/* Option 1: Google Account / Project Key */}
                    <button 
                        onClick={handleProjectKey} 
                        disabled={isVerifying}
                        className="group p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/50 transition-all text-left flex flex-col gap-3 h-full relative"
                    >
                        <div className="p-2.5 bg-amber-500/20 w-fit rounded-xl text-amber-400 group-hover:text-amber-300 group-hover:scale-110 transition-all">
                            {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5 text-amber-400" />}
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm mb-1 uppercase tracking-wide flex items-center gap-1.5">
                                Tài khoản Google / Project Key
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">Pro</span>
                            </div>
                            <div className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                {user ? (
                                    <span className="text-emerald-400 font-semibold">Tài khoản: {user.email} (Bấm để kích hoạt Pro ngay)</span>
                                ) : (
                                    <span>Đăng nhập hoặc sử dụng tài khoản Google đang có để mở khóa toàn bộ tính năng Pro & Google Flow.</span>
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Option 2: Manual Config */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-2 p-1 bg-black/40 rounded-lg">
                                <button 
                                    onClick={() => setConfigType('google')}
                                    className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${configType === 'google' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Google AI
                                </button>
                                <button 
                                    onClick={() => setConfigType('vertex')}
                                    className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${configType === 'vertex' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Vertex AI
                                </button>
                            </div>
                            <div className={`p-2 rounded-xl ${configType === 'google' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {configType === 'google' ? <Key className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="font-bold text-white text-sm mb-2 uppercase tracking-wide">
                                {configType === 'google' ? 'Nhập API Key' : 'Cấu hình Vertex AI'}
                            </div>
                            
                            <div className="space-y-3">
                                {configType === 'google' ? (
                                    <input 
                                        type="text" 
                                        value={manualKey}
                                        onChange={(e) => setManualKey(e.target.value)}
                                        placeholder="Paste API Key (AIza...) here..." 
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[10px] text-white outline-none focus:border-purple-500 transition-all font-mono"
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <input 
                                            type="text" 
                                            value={vertexProjectId}
                                            onChange={(e) => setVertexProjectId(e.target.value)}
                                            placeholder="Project ID (e.g. my-project-123)" 
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[10px] text-white outline-none focus:border-blue-500 transition-all font-mono"
                                        />
                                        <input 
                                            type="password" 
                                            value={vertexAccessToken}
                                            onChange={(e) => setVertexAccessToken(e.target.value)}
                                            placeholder="Access Token (ya29...)" 
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[10px] text-white outline-none focus:border-blue-500 transition-all font-mono"
                                        />
                                        <select 
                                            value={vertexLocation}
                                            onChange={(e) => setVertexLocation(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[10px] text-white outline-none focus:border-blue-500 transition-all"
                                        >
                                            <option value="us-central1">us-central1 (Iowa)</option>
                                            <option value="asia-southeast1">asia-southeast1 (Singapore)</option>
                                            <option value="asia-northeast1">asia-northeast1 (Tokyo)</option>
                                            <option value="europe-west1">europe-west1 (Belgium)</option>
                                        </select>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleManualKey} 
                                        disabled={isVerifying || (configType === 'google' ? manualKey.trim().length <= 10 : (!vertexProjectId.trim() || !vertexAccessToken.trim()))} 
                                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-white ${
                                            configType === 'google' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'
                                        } disabled:opacity-50`}
                                    >
                                        {isVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
                                        {isVerifying ? 'Đang kiểm tra...' : 'Kích hoạt ngay'}
                                    </button>
                                    {apiKeySelected && (
                                        <button onClick={handleResetKey} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 rounded-lg transition-all" title="Xóa cấu hình hiện tại">
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {errorMessage && (
                                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] text-red-400 font-medium animate-in slide-in-from-top-1 duration-200">
                                        {errorMessage}
                                    </div>
                                )}
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