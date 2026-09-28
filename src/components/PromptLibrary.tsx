import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Sparkles, Copy, Check, X } from 'lucide-react';
import { STARTER_PROMPTS } from '../constants/starterPrompts';
import { PromptTemplate, AppMode } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const PromptLibrary: React.FC<{ onSwitchMode: (mode: AppMode) => void }> = ({ onSwitchMode }) => {
  const { setActivePrompt } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStyle, setSelectedStyle] = useState('All');
  const [selectedLighting, setSelectedLighting] = useState('All');
  const [hiddenPromptIds, setHiddenPromptIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('yody_hidden_prompt_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [userPrompts, setUserPrompts] = useState<PromptTemplate[]>(() => {
    const saved = localStorage.getItem('yody_user_prompts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse user prompts', e);
        return [];
      }
    }
    return [];
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  // New prompt form state
  const [newPrompt, setNewPrompt] = useState<Partial<PromptTemplate>>({
    title: '',
    prompt: '',
    imageUrl: '',
    category: 'User',
    style: 'Photorealistic',
    lighting: 'Natural Light',
    tags: []
  });

  // Save user prompts and hidden IDs to localStorage
  useEffect(() => {
    localStorage.setItem('yody_user_prompts', JSON.stringify(userPrompts));
  }, [userPrompts]);

  useEffect(() => {
    localStorage.setItem('yody_hidden_prompt_ids', JSON.stringify(hiddenPromptIds));
  }, [hiddenPromptIds]);

  const allPrompts = [...STARTER_PROMPTS.filter(p => !hiddenPromptIds.includes(p.id)), ...userPrompts];
  const categories = ['All', ...Array.from(new Set(allPrompts.map(p => p.category)))];
  const styles = ['All', ...Array.from(new Set(allPrompts.map(p => p.style)))];
  const lightings = ['All', ...Array.from(new Set(allPrompts.map(p => p.lighting)))];

  const filteredPrompts = allPrompts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesStyle = selectedStyle === 'All' || p.style === selectedStyle;
    const matchesLighting = selectedLighting === 'All' || p.lighting === selectedLighting;
    return matchesSearch && matchesCategory && matchesStyle && matchesLighting;
  });

  const handleAddPrompt = () => {
    if (!newPrompt.title || !newPrompt.prompt || !newPrompt.imageUrl) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (editingPrompt) {
      // Update existing
      if (editingPrompt.id.startsWith('user-')) {
        const updatedPrompts = userPrompts.map(p => 
          p.id === editingPrompt.id 
            ? { ...editingPrompt, ...newPrompt as PromptTemplate, id: editingPrompt.id } 
            : p
        );
        setUserPrompts(updatedPrompts);
      } else {
        // Editing a starter prompt: hide the original and add as a new user prompt
        setHiddenPromptIds(prev => [...prev, editingPrompt.id]);
        const promptToAdd: PromptTemplate = {
          ...editingPrompt,
          ...newPrompt as PromptTemplate,
          id: `user-mod-${Date.now()}`,
        };
        setUserPrompts([promptToAdd, ...userPrompts]);
      }
      setEditingPrompt(null);
      toast.success('Đã cập nhật prompt');
    } else {
      // Add new
      const promptToAdd: PromptTemplate = {
        id: `user-${Date.now()}`,
        title: newPrompt.title!,
        prompt: newPrompt.prompt!,
        imageUrl: newPrompt.imageUrl!,
        category: newPrompt.category || 'User',
        style: newPrompt.style || 'Photorealistic',
        lighting: newPrompt.lighting || 'Natural Light',
        tags: newPrompt.tags || [],
        aspectRatio: '1:1'
      };

      setUserPrompts([promptToAdd, ...userPrompts]);
      toast.success('Đã thêm prompt mới vào thư viện');
    }
    
    setIsAddingNew(false);
    setNewPrompt({ title: '', prompt: '', imageUrl: '', category: 'User', style: 'Photorealistic', lighting: 'Natural Light', tags: [] });
  };

  const handleEditPrompt = (prompt: PromptTemplate) => {
    setEditingPrompt(prompt);
    setNewPrompt({
      title: prompt.title,
      prompt: prompt.prompt,
      imageUrl: prompt.imageUrl,
      category: prompt.category,
      style: prompt.style,
      lighting: prompt.lighting,
      tags: prompt.tags
    });
    setIsAddingNew(true);
  };

  const handleDeletePrompt = (id: string) => {
    setPromptToDelete(id);
  };

  const confirmDeletePrompt = () => {
    if (promptToDelete) {
      if (promptToDelete.startsWith('user-')) {
        setUserPrompts(userPrompts.filter(p => p.id !== promptToDelete));
      } else {
        // Deleting a starter prompt: just hide it
        setHiddenPromptIds(prev => [...prev, promptToDelete]);
      }
      setPromptToDelete(null);
      toast.success('Đã xóa prompt');
    }
  };

  const handleUsePrompt = (prompt: string) => {
    setActivePrompt(prompt);
    onSwitchMode(AppMode.IMAGE_EDITOR);
    toast.success('Đã áp dụng prompt vào trình tạo ảnh');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Đã sao chép prompt');
  };

  return (
    <div className="flex flex-col h-full bg-transparent p-4 md:p-8 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 uppercase tracking-tighter">
            Thư Viện Prompt
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Khám phá và lưu trữ cảm hứng sáng tạo của bạn</p>
        </div>
        <button 
          onClick={() => setIsAddingNew(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={18} />
          Thêm Prompt Mới
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Tìm kiếm prompt, chủ đề, từ khóa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-blue-500/50 transition-all backdrop-blur-md"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Category Filter */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Chủ đề</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    selectedCategory === cat 
                      ? 'bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/20' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 border-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Style Filter */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phong cách</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {styles.map(style => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    selectedStyle === style 
                      ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 border-white/10'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Lighting Filter */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ánh sáng</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {lightings.map(light => (
                <button
                  key={light}
                  onClick={() => setSelectedLighting(light)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    selectedLighting === light 
                      ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 border-white/10'
                  }`}
                >
                  {light}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPrompts.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-md hover:border-blue-500/30 transition-all"
              >
                {/* Image Preview */}
                <div className="aspect-[3/4] overflow-hidden relative">
                  <img 
                    src={p.imageUrl} 
                    alt={p.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleUsePrompt(p.prompt)}
                        className="flex-1 bg-white text-black py-3 rounded-xl font-black uppercase text-[10px] hover:bg-blue-500 hover:text-white transition-colors flex items-center justify-center gap-2"
                      >
                        <Sparkles size={14} />
                        Sử Dụng
                      </button>
                      <button 
                        onClick={() => copyToClipboard(p.prompt, p.id)}
                        className="p-3 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/30 transition-colors"
                      >
                        {copiedId === p.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Category Tag */}
                  <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-[8px] font-black text-white uppercase tracking-widest">
                    {p.category}
                  </div>
                  
                  {/* Actions */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEditPrompt(p)}
                      className="p-2 bg-blue-500/20 backdrop-blur-md rounded-xl text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"
                      title="Chỉnh sửa"
                    >
                      <Plus size={14} className="rotate-45" />
                    </button>
                    <button 
                      onClick={() => handleDeletePrompt(p.id)}
                      className="p-2 bg-red-500/20 backdrop-blur-md rounded-xl text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="font-black text-sm text-white mb-2 truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">{p.title}</h3>
                  <p className="text-[10px] text-slate-400 line-clamp-2 mb-4 font-medium leading-relaxed italic">"{p.prompt}"</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-white/5 rounded-md text-[8px] text-slate-500 font-bold uppercase tracking-tighter border border-white/5">#{tag}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {filteredPrompts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
              <Search className="text-slate-500" size={32} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">Không tìm thấy kết quả</h3>
            <p className="text-slate-500 text-sm mt-2">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc</p>
          </div>
        )}
      </div>

      {/* Add New Modal */}
      <AnimatePresence>
        {isAddingNew && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  {editingPrompt ? 'Chỉnh sửa Prompt' : 'Thêm Prompt Mới'}
                </h2>
                <button 
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingPrompt(null);
                    setNewPrompt({ title: '', prompt: '', imageUrl: '', category: 'User', style: 'Photorealistic', lighting: 'Natural Light', tags: [] });
                  }} 
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tiêu đề</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Studio Fashion 2024"
                      value={newPrompt.title}
                      onChange={(e) => setNewPrompt({...newPrompt, title: e.target.value})}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Chủ đề</label>
                    <select 
                      value={newPrompt.category}
                      onChange={(e) => setNewPrompt({...newPrompt, category: e.target.value})}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="User">Cá nhân</option>
                      <option value="Studio">Studio</option>
                      <option value="Streetwear">Streetwear</option>
                      <option value="Lookbook">Lookbook</option>
                      <option value="Artistic">Nghệ thuật</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phong cách</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Photorealistic, Cyberpunk..."
                      value={newPrompt.style}
                      onChange={(e) => setNewPrompt({...newPrompt, style: e.target.value})}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ánh sáng</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Golden Hour, Neon..."
                      value={newPrompt.lighting}
                      onChange={(e) => setNewPrompt({...newPrompt, lighting: e.target.value})}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">URL Hình ảnh tham chiếu</label>
                    <input 
                      type="text" 
                      placeholder="https://images.unsplash.com/..."
                      value={newPrompt.imageUrl}
                      onChange={(e) => setNewPrompt({...newPrompt, imageUrl: e.target.value})}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Đoạn Prompt</label>
                    <textarea 
                      placeholder="Mô tả chi tiết hình ảnh bạn muốn tạo..."
                      value={newPrompt.prompt}
                      onChange={(e) => setNewPrompt({...newPrompt, prompt: e.target.value})}
                      rows={6}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => {
                        setIsAddingNew(false);
                        setEditingPrompt(null);
                        setNewPrompt({ title: '', prompt: '', imageUrl: '', category: 'User', style: 'Photorealistic', lighting: 'Natural Light', tags: [] });
                      }}
                      className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase text-xs hover:bg-white/10 transition-all"
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleAddPrompt}
                      className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {editingPrompt ? 'Cập Nhật' : 'Lưu Lại'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {promptToDelete && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Xác nhận xóa</h2>
              <p className="text-slate-400 text-sm mb-8">Bạn có chắc chắn muốn xóa prompt này khỏi thư viện cá nhân không? Hành động này không thể hoàn tác.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setPromptToDelete(null)}
                  className="py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase text-xs hover:bg-white/10 transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmDeletePrompt}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-600/20 hover:bg-red-500 transition-all"
                >
                  Xác nhận xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PromptLibrary;
