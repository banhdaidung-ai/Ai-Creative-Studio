
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { Message } from '../types';
import { Send, Bot, User, Globe, ExternalLink, Sparkles, Command, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ChatSearch: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput(''); 
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]); 
    setIsLoading(true);
    try {
      const response = await geminiService.searchChat(userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response.text, sources: response.sources }]);
    } catch { 
      setMessages(prev => [...prev, { role: 'model', text: "Web search failed. Please try again." }]); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 md:p-8 overflow-hidden">
      <header className="mb-8 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-3">
            <Globe className="w-10 h-10 text-emerald-400" /> YODY Knowledge
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-emerald-500" /> Grounded insights via Google Search
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
          <Command className="w-4 h-4 text-slate-500" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time Web Access</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-black/20 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.05)] p-8 space-y-8 mb-6 custom-scrollbar relative">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto"
            >
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-[2.5rem] blur-2xl animate-pulse"></div>
                <Search className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Bạn muốn tìm hiểu gì hôm nay?</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                Tôi có thể truy cập internet thời gian thực để trả lời các câu hỏi về xu hướng thời trang, công nghệ, hoặc bất kỳ sự kiện nào đang diễn ra.
              </p>
              <div className="grid grid-cols-1 gap-3 w-full">
                {["Xu hướng thời trang bền vững 2026", "Công nghệ AI mới nhất của Google", "Địa điểm du lịch hot nhất mùa hè này"].map((suggestion, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-left text-xs font-bold text-slate-400 hover:text-emerald-400 transition-all flex items-center justify-between group"
                  >
                    {suggestion}
                    <Send className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className={`flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl border border-white/10 ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300'}`}>
                  {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                </div>
                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-8 py-5 rounded-[2rem] text-sm leading-relaxed shadow-2xl backdrop-blur-md border border-white/5 ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500/20 text-white rounded-tr-sm border-emerald-500/20' 
                      : 'bg-white/5 text-slate-200 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {msg.sources.map((source, i) => (
                        <motion.a 
                          key={i} 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          href={source.uri} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 px-4 py-2 rounded-xl border border-white/10 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
                        >
                           <ExternalLink className="w-3 h-3" /> {source.title || 'Source'}
                        </motion.a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-5"
            >
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-slate-400 animate-pulse" />
                </div>
                <div className="bg-white/5 px-8 py-5 rounded-[2rem] rounded-tl-sm border border-white/5">
                  <div className="flex gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  </div>
                </div>
            </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative shrink-0 group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] blur opacity-20 group-focus-within:opacity-40 transition-opacity"></div>
        <input 
            type="text" 
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Bạn muốn tìm hiểu gì về thời trang, công nghệ, hay sự kiện thế giới..."
            className="relative w-full pl-8 pr-20 py-6 rounded-[2.5rem] border border-white/10 bg-black/60 backdrop-blur-2xl shadow-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white font-medium transition-all placeholder:text-slate-600"
        />
        <button 
          onClick={handleSend} 
          disabled={!input.trim() || isLoading} 
          className="absolute right-4 top-4 p-4 bg-emerald-500 text-black rounded-2xl hover:scale-110 active:scale-95 disabled:opacity-50 transition-all shadow-xl"
        >
            <Send className="w-6 h-6" />
        </button>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }`}</style>
    </div>
  );
};

export default ChatSearch;
