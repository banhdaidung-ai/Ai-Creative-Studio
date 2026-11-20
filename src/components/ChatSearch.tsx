import React, { useState, useRef, useEffect } from 'react';
import { geminiService, hasRealGeminiCredentials } from '../services/gemini';
import { chatViaMuseSpark, getMuseReadyStatus } from '../services/museService';
import { AppMode, Message } from '../types';
import { useProject } from '../contexts/ProjectContext';
import {
  Send,
  Bot,
  User,
  Globe,
  ExternalLink,
  Sparkles,
  Search,
  Wand2,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface ChatSearchProps {
  onSwitchMode?: (mode: AppMode) => void;
}

const SUGGESTED_TOPICS = [
  'Xu hướng màu sắc & chất liệu thời trang Thu Đông 2026–2027',
  'Phong cách chụp Lookbook Studio thương mại đang thịnh hành 2026',
  'Ý tưởng bộ sưu tập thời trang công sở bền vững cho giới trẻ Việt Nam',
  'Xu hướng thiết kế Streetwear tối giản châu Á mới nhất',
];

const ChatSearch: React.FC<ChatSearchProps> = ({ onSwitchMode }) => {
  const { setActivePrompt } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [convertingIdx, setConvertingIdx] = useState<number | null>(null);
  const [previousInteractionId, setPreviousInteractionId] = useState<string | undefined>(undefined);

  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastCompositionEndAtRef = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const canGemini = await hasRealGeminiCredentials();
      if (canGemini) {
        const response = await geminiService.searchChat(userMsg, previousInteractionId);
        if (response?.interactionId) {
          setPreviousInteractionId(response.interactionId);
        }
        setMessages((prev) => [
          ...prev,
          { role: 'model', text: response.text, sources: response.sources },
        ]);
      } else {
        const museSt = await getMuseReadyStatus().catch(() => ({ available: false, accounts: 0 }));
        if (museSt.accounts > 0) {
          const reply = await chatViaMuseSpark([
            {
              role: 'system',
              content:
                'Bạn là chuyên gia tư vấn xu hướng thời trang YODY Knowledge. Hãy trả lời súc tích bằng tiếng Việt kèm gợi ý chất liệu và màu sắc.',
            },
            { role: 'user', content: userMsg },
          ]);
          setMessages((prev) => [...prev, { role: 'model', text: reply }]);
        } else {
          window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'google' } }));
          setMessages((prev) => [
            ...prev,
            {
              role: 'model',
              text: 'Vui lòng nhập Gemini API Key (để dùng Gemini 4 Argon + Google Search thời gian thực) hoặc kết nối Muse AI để tra cứu xu hướng.',
            },
          ]);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: err?.message || 'Tra cứu xu hướng thất bại. Vui lòng thử lại.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // IME-safe Enter check (including Safari WebKit compositionend ordering & keyCode 229)
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      if (
        lastCompositionEndAtRef.current !== null &&
        Math.abs(event.timeStamp - lastCompositionEndAtRef.current) < 50
      ) {
        return;
      }
      formRef.current?.requestSubmit();
    }
  };

  const handleSendToStudio = async (trendText: string, idx: number) => {
    setConvertingIdx(idx);
    try {
      let studioPrompt = `Commercial high-fashion studio photography inspired by: ${trendText.slice(0, 320)}, 8k photorealistic, sharp fabric texture`;
      if (await hasRealGeminiCredentials()) {
        const refined = await geminiService.enhancePrompt(
          `Extract a concise high-end fashion lookbook photography prompt (garment, color palette, fabric, lighting, setting) from this trend insight: ${trendText.slice(0, 600)}`
        );
        if (refined) studioPrompt = refined;
      }
      setActivePrompt(studioPrompt);
      if (onSwitchMode) {
        onSwitchMode(AppMode.IMAGE_EDITOR);
      } else {
        window.location.hash = '#image-editor';
      }
    } catch {
      toast.error('Không thể chuyển sang Prompt tạo ảnh.');
    } finally {
      setConvertingIdx(null);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setPreviousInteractionId(undefined);
    toast.info('Đã bắt đầu phiên nghiên cứu xu hướng mới.');
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 md:p-8 overflow-hidden">
      <header className="mb-5 shrink-0 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-3">
            <Globe className="w-8 h-8 text-emerald-400" /> YODY Knowledge 3.0
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.18em] text-[10px] mt-1.5 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-emerald-500" /> Gemini 4 Argon • Google Search Thời gian thực • Hội thoại đa lượt
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" /> Phiên mới
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto bg-black/25 rounded-[2.5rem] border border-white/10 shadow-2xl p-6 md:p-8 space-y-6 mb-4 custom-scrollbar relative">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto"
            >
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-emerald-500/20">
                <Search className="w-9 h-9 text-emerald-400" />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">
                Nghiên cứu Xu hướng Thời trang 2026
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium leading-relaxed mb-6">
                Tra cứu trực tiếp xu hướng màu sắc, chất liệu, sàn diễn quốc tế qua Google Search với Gemini 4 và biến ngay thành Prompt tạo ảnh chỉ với 1 chạm.
              </p>
              <div className="grid grid-cols-1 gap-2.5 w-full">
                {SUGGESTED_TOPICS.map((suggestion, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="p-3.5 bg-white/5 hover:bg-emerald-500/10 rounded-2xl border border-white/10 text-left text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-emerald-400 transition-all flex items-center justify-between group"
                  >
                    <span>{suggestion}</span>
                    <Send className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 ${
                    msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-emerald-400'
                  }`}
                >
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`flex flex-col max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-6 py-4 rounded-[1.75rem] text-xs md:text-sm leading-relaxed whitespace-pre-wrap border ${
                      msg.role === 'user'
                        ? 'bg-emerald-500/20 text-slate-900 dark:text-white rounded-tr-sm border-emerald-500/30'
                        : 'bg-white/5 text-slate-800 dark:text-slate-200 rounded-tl-sm border-white/10'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.role === 'model' && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendToStudio(msg.text, idx)}
                        disabled={convertingIdx === idx}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                      >
                        {convertingIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        <span>Đưa Concept sang Studio Tạo Ảnh</span>
                      </button>

                      {msg.sources?.map((source, i) => (
                        <a
                          key={i}
                          href={source.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 px-3 py-1.5 rounded-xl border border-white/10 transition-all text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[180px]">{source.title || 'Nguồn Web'}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {isLoading && (
          <div role="status" aria-live="polite" className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div className="bg-white/5 px-6 py-4 rounded-[1.5rem] rounded-tl-sm border border-white/10 text-xs text-emerald-400 font-bold">
              Đang tra cứu Google Search thời gian thực với Gemini 4...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <search className="shrink-0">
        <form ref={formRef} onSubmit={handleSend} className="relative flex items-end gap-2">
          <label htmlFor="trend-search-input" className="sr-only">
            Nhập câu hỏi xu hướng thời trang hoặc thiết kế
          </label>
          <textarea
            id="trend-search-input"
            name="query"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionEnd={(e) => {
              lastCompositionEndAtRef.current = e.timeStamp;
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Hỏi về xu hướng màu sắc, chất liệu 2026, phong cách chụp Lookbook... (Enter để gửi, Shift+Enter xuống dòng)"
            className="w-full pl-6 pr-16 py-4 rounded-[2rem] border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl focus-visible:ring-2 focus-visible:ring-emerald-400 focus:ring-2 focus:ring-emerald-500/50 outline-none text-white text-base font-medium transition-all placeholder:text-slate-500 resize-none"
          />
          <button
            type="submit"
            disabled={isLoading}
            aria-label="Gửi câu hỏi tra cứu"
            className="absolute right-3 bottom-3 p-3.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 transition-all shadow-xl"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </search>
    </div>
  );
};

export default ChatSearch;
