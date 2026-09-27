import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Save, 
  ArrowRight, 
  Eraser, 
  Shirt, 
  Film, 
  Sparkles, 
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Download,
  Box,
  Maximize2
} from 'lucide-react';
import { useProject } from '../src/context/ProjectContext';
import { toast } from 'sonner';

type StepType = 'INGEST' | 'REMOVE_BG' | 'FASHION_STUDIO' | 'VIDEO_GEN' | 'UPSCALE' | 'EXPORT';

interface WorkflowStep {
  id: string;
  type: StepType;
  title: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  config: any;
  output?: string;
}

const STEP_METADATA: Record<StepType, { icon: any; color: string; description: string }> = {
  INGEST: { icon: ImageIcon, color: 'text-blue-400', description: 'Tải ảnh đầu vào' },
  REMOVE_BG: { icon: Eraser, color: 'text-pink-400', description: 'Tách nền AI' },
  FASHION_STUDIO: { icon: Shirt, color: 'text-purple-400', description: 'Thử đồ ảo' },
  VIDEO_GEN: { icon: Film, color: 'text-red-400', description: 'Tạo video từ ảnh' },
  UPSCALE: { icon: Sparkles, color: 'text-yellow-400', description: 'Nâng cấp 4K' },
  EXPORT: { icon: Download, color: 'text-emerald-400', description: 'Xuất sản phẩm' },
};

const WorkflowStudio: React.FC = () => {
  const { workspaceAsset, addToHistory } = useProject();
  const stepCounter = useRef(0);
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 'initial-ingest', type: 'INGEST', title: 'Đầu vào', status: 'completed', config: {}, output: workspaceAsset?.url }
  ]);
  const [activeStepId, setActiveStepId] = useState<string>('initial-ingest');
  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);

  const activeStep = steps.find(s => s.id === activeStepId) || steps[0];

  // Update ingest step output when workspaceAsset changes without useEffect if possible
  // Or just use a derived value for the first step's output
  const getStepOutput = (step: WorkflowStep) => {
    if (step.id === 'initial-ingest' && workspaceAsset) return workspaceAsset.url;
    return step.output;
  };

  const addStep = useCallback((type: StepType) => {
    stepCounter.current += 1;
    const id = `step-${stepCounter.current}-${Math.random().toString(36).substring(7)}`;
    const newStep: WorkflowStep = {
      id,
      type,
      title: STEP_METADATA[type].description,
      status: 'idle',
      config: {},
    };
    setSteps(prev => [...prev, newStep]);
    setActiveStepId(id);
    toast.success(`Đã thêm bước: ${STEP_METADATA[type].description}`);
  }, []);

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter(s => s.id !== id);
    setSteps(newSteps);
    if (activeStepId === id) {
      setActiveStepId(newSteps[newSteps.length - 1].id);
    }
  };

  const runWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentProgress(0);

    const updatedSteps = [...steps];
    
    for (let i = 0; i < updatedSteps.length; i++) {
      const currentStepOutput = getStepOutput(updatedSteps[i]);
      if (updatedSteps[i].type === 'INGEST' && !currentStepOutput) {
        toast.error('Vui lòng chọn ảnh đầu vào');
        setIsRunning(false);
        return;
      }

      updatedSteps[i].status = 'processing';
      setSteps([...updatedSteps]);
      setCurrentProgress(((i + 1) / updatedSteps.length) * 100);

      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      updatedSteps[i].status = 'completed';
      // Pass output to next step if applicable
      if (i < updatedSteps.length - 1) {
        updatedSteps[i+1].output = currentStepOutput;
      }
      setSteps([...updatedSteps]);
    }

    setIsRunning(false);
    toast.success('Workflow hoàn tất!');
    
    // Add final output to history if it's an export step
    const lastStep = updatedSteps[updatedSteps.length - 1];
    const finalOutput = getStepOutput(lastStep);
    if (finalOutput) {
      addToHistory({
        url: finalOutput,
        mode: lastStep.type === 'VIDEO_GEN' ? 'video' : 'image',
        prompt: 'Workflow Output'
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-[#E4E3E0] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
            <Box size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter">AI Pipeline Workflow</h1>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Tự động hóa quy trình sáng tạo chuyên nghiệp</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={runWorkflow}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
              isRunning 
                ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
            }`}
          >
            {isRunning ? <Clock size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? 'Đang xử lý...' : 'Chạy Workflow'}
          </button>
          <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all">
            <Save size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Step Configuration */}
        <aside className="w-80 border-r border-white/10 bg-black/20 flex flex-col shrink-0">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Cấu hình bước</h2>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-xl bg-white/5 ${STEP_METADATA[activeStep.type].color}`}>
                  {React.createElement(STEP_METADATA[activeStep.type].icon, { size: 18 })}
                </div>
                <span className="font-bold text-sm">{activeStep.title}</span>
              </div>
              
              <div className="space-y-4">
                {activeStep.type === 'INGEST' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase">Nguồn ảnh</label>
                    <div className="aspect-square bg-black/40 rounded-xl border border-dashed border-white/20 flex items-center justify-center overflow-hidden group relative">
                      {getStepOutput(activeStep) ? (
                        <img src={getStepOutput(activeStep)} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon size={24} className="mx-auto mb-2 opacity-20" />
                          <p className="text-[8px] uppercase tracking-widest opacity-40">Chọn ảnh từ Workspace hoặc tải lên</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeStep.type === 'REMOVE_BG' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase">Độ chính xác</span>
                      <span className="text-[10px] font-mono text-emerald-400">High</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase">Làm mịn biên</span>
                      <span className="text-[10px] font-mono text-emerald-400">Enabled</span>
                    </div>
                  </div>
                )}

                {activeStep.type === 'FASHION_STUDIO' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase block mb-2">Prompt bối cảnh</span>
                      <textarea 
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] outline-none h-20"
                        placeholder="Mô tả bối cảnh..."
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10">
                  <button 
                    onClick={() => removeStep(activeStep.id)}
                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={12} />
                    Xóa bước này
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Thêm hành động AI</h2>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(STEP_METADATA) as StepType[]).filter(t => t !== 'INGEST').map(type => (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
                >
                  <div className={`p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${STEP_METADATA[type].color}`}>
                    {React.createElement(STEP_METADATA[type].icon, { size: 16 })}
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-bold uppercase tracking-tight">{STEP_METADATA[type].description}</div>
                  </div>
                  <Plus size={14} className="ml-auto opacity-20 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col relative bg-[#0a0a0a]">
          {/* Progress Bar */}
          {isRunning && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-20">
              <motion.div 
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${currentProgress}%` }}
              />
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center p-12 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeStepId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="relative w-full max-w-2xl aspect-[4/3] bg-black/40 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden group"
              >
                {getStepOutput(activeStep) ? (
                  <img src={getStepOutput(activeStep)} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                    <ImageIcon size={64} className="mb-4 opacity-10" />
                    <p className="text-xs font-mono uppercase tracking-widest">Chưa có dữ liệu xem trước</p>
                  </div>
                )}

                {/* Overlay Info */}
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between p-4 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/10 ${STEP_METADATA[activeStep.type].color}`}>
                      {React.createElement(STEP_METADATA[activeStep.type].icon, { size: 14 })}
                    </div>
                    <span className="text-[10px] font-bold uppercase">{activeStep.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Maximize2 size={14} /></button>
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Download size={14} /></button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Timeline Rail */}
          <div className="h-32 border-t border-white/10 bg-black/40 backdrop-blur-xl flex items-center px-8 gap-4 overflow-x-auto no-scrollbar shrink-0">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setActiveStepId(step.id)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all min-w-[100px] ${
                    activeStepId === step.id 
                      ? 'bg-white/10 border border-white/20 scale-105' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-white/5 ${STEP_METADATA[step.type].color} relative`}>
                    {React.createElement(STEP_METADATA[step.type].icon, { size: 16 })}
                    {step.status === 'completed' && (
                      <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-[#0a0a0a]">
                        <CheckCircle2 size={8} />
                      </div>
                    )}
                    {step.status === 'processing' && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-[#0a0a0a] animate-spin">
                        <Clock size={8} />
                      </div>
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${activeStepId === step.id ? 'text-white' : 'text-white/40'}`}>
                    {step.type}
                  </span>
                  
                  {/* Step Number */}
                  <div className="absolute -top-2 -left-2 w-5 h-5 bg-black border border-white/10 rounded-full flex items-center justify-center text-[8px] font-bold text-white/40">
                    0{index + 1}
                  </div>
                </button>
                {index < steps.length - 1 && (
                  <ArrowRight size={14} className="text-white/10 shrink-0" />
                )}
              </React.Fragment>
            ))}
            
            <button 
              onClick={() => addStep('EXPORT')}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 transition-all min-w-[100px] group"
            >
              <div className="p-2 rounded-xl bg-white/5 text-white/20 group-hover:text-white/40">
                <Plus size={16} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40">Thêm bước</span>
            </button>
          </div>
        </div>

        {/* Right Sidebar: History & Assets */}
        <aside className="w-64 border-l border-white/10 bg-black/20 flex flex-col shrink-0">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Thư viện mẫu</h2>
            <div className="space-y-3">
              {[
                { name: 'E-commerce Pro', desc: 'Tách nền + Studio + Upscale', icon: Sparkles },
                { name: 'Social Video', desc: 'Sản phẩm -> Video 5s', icon: Film },
                { name: 'Lookbook AI', desc: 'Thử đồ + Bối cảnh', icon: Shirt },
              ].map((tpl, i) => (
                <button key={i} className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group">
                  <div className="flex items-center gap-2 mb-1">
                    <tpl.icon size={12} className="text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{tpl.name}</span>
                  </div>
                  <p className="text-[8px] text-white/40">{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Lịch sử Workflow</h2>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-white/5 rounded-lg border border-white/10 overflow-hidden hover:border-emerald-500/50 transition-colors cursor-pointer group relative">
                  <img src={`https://picsum.photos/seed/wf${i}/200/200`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-[7px] font-mono uppercase">v1.0.{i}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default WorkflowStudio;
