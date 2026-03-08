
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { Message } from '../types';
import { Search, Send, Bot, User, Globe, ExternalLink } from 'lucide-react';

const ChatSearch: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Welcome to YODY Knowledge Base. I search the web in real-time to answer your queries accurately.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput(''); setMessages(prev => [...prev, { role: 'user', text: userMsg }]); setIsLoading(true);
    try {
      const response = await geminiService.searchChat(userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response.text, sources: response.sources }]);
    } catch (e) { setMessages(prev => [...prev, { role: 'model', text: "Web search failed. Please try again." }]); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 md:p-6 overflow-hidden">
      <div className="mb-6 shrink-0">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-3">
          <Globe className="w-8 h-8 text-emerald-400" /> YODY Knowledge
        </h2>
        <p className="text-slate-400 font-medium mt-1">Grounded insights via Google Search.</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl p-6 space-y-6 mb-4 custom-scrollbar ring-1 ring-inset ring-white/5">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10 ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300'}`}>
              {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-6 py-4 rounded-[1.5rem] text-sm leading-relaxed shadow-lg backdrop-blur-md border border-white/5 ${
                msg.role === 'user' 
                  ? 'bg-emerald-500/20 text-white rounded-tr-sm border-emerald-500/20' 
                  : 'bg-black/30 text-slate-200 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.sources.map((source, i) => (
                    <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-white/10 transition-all text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-sm hover:scale-105">
                       <ExternalLink className="w-3 h-3" /> {source.title || 'Source'}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center"><Bot className="w-5 h-5 text-slate-400" /></div>
                <div className="bg-black/20 px-6 py-4 rounded-[1.5rem] rounded-tl-sm border border-white/5"><div className="flex gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span><span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span></div></div>
            </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative shrink-0">
        <input 
            type="text" 
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about fashion trends, tech, or world events..."
            className="w-full pl-6 pr-16 py-5 rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white font-medium transition-all placeholder:text-slate-600"
        />
        <button onClick={handleSend} disabled={!input.trim() || isLoading} className="absolute right-3 top-3 p-3 bg-emerald-500 text-blue-900 rounded-full hover:scale-110 disabled:opacity-50 transition-all shadow-lg active:scale-90">
            <Send className="w-5 h-5 fill-current" />
        </button>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }`}</style>
    </div>
  );
};

export default ChatSearch;
