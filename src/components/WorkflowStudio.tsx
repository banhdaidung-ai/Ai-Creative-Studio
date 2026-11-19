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
  Upload,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { geminiService } from '../services/gemini';
import {
  isFlowBackendAvailable,
  generateImageViaFlow,
  generateVideoViaFlow,
  FLOW_MODEL_IDS,
} from '../services/flowService';
import {
  getMuseReadyStatus,
  generateImageViaMuse,
  generateVideoViaMuse,
} from '../services/museService';
import { resizeImage, formatImageSrc } from '../utils/image';
import { toast } from 'sonner';

type StepType = 'INGEST' | 'REMOVE_BG' | 'FASHION_STUDIO' | 'VIDEO_GEN' | 'UPSCALE' | 'EXPORT';

interface WorkflowStep {
  id: string;
  type: StepType;
  title: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  config: {
    prompt?: string;
    tier?: 'standard' | 'pro';
    targetSize?: '2K' | '4K';
    aspectRatio?: string;
    duration?: number;
    engine?: 'auto' | 'flow' | 'muse' | 'gemini';
  };
  output?: string;
  outputType?: 'image' | 'video';
}

const WORKFLOW_STORAGE_KEY = 'yody_saved_workflow_v2';

const STEP_METADATA: Record<StepType, { icon: React.ComponentType<{ size?: number }>; color: string; description: string }> = {
  INGEST: { icon: ImageIcon, color: 'text-blue-400', description: 'Tải ảnh đầu vào' },
  REMOVE_BG: { icon: Eraser, color: 'text-pink-400', description: 'Tách nền AI' },
  FASHION_STUDIO: { icon: Shirt, color: 'text-purple-400', description: 'Biến đổi Studio / Bối cảnh' },
  VIDEO_GEN: { icon: Film, color: 'text-red-400', description: 'Tạo video từ ảnh' },
  UPSCALE: { icon: Sparkles, color: 'text-yellow-400', description: 'Nâng cấp 2K / 4K' },
  EXPORT: { icon: Download, color: 'text-emerald-400', description: 'Xuất & Lưu lịch sử' },
};

const WORKFLOW_TEMPLATES: Array<{
  name: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  steps: Array<{ type: StepType; config?: WorkflowStep['config'] }>;
}> = [
  {
    name: 'E-commerce Pro',
    desc: 'Tách nền + Studio + Upscale',
    icon: Sparkles,
    steps: [
      { type: 'REMOVE_BG', config: { tier: 'pro' } },
      { type: 'FASHION_STUDIO', config: { prompt: 'Clean minimalist e-commerce studio background, soft commercial flash lighting, crisp product shadows', engine: 'auto' } },
      { type: 'UPSCALE', config: { targetSize: '2K' } },
      { type: 'EXPORT' },
    ],
  },
  {
    name: 'Social Video',
    desc: 'Sản phẩm → Video 5s',
    icon: Film,
    steps: [
      { type: 'FASHION_STUDIO', config: { prompt: 'High-fashion editorial lighting, cinematic depth of field, magazine cover aesthetic', engine: 'auto' } },
      { type: 'VIDEO_GEN', config: { prompt: 'Smooth slow-motion fashion lookbook camera pan, fabric gently swaying, studio lighting', duration: 5, aspectRatio: '9:16', engine: 'auto' } },
      { type: 'EXPORT' },
    ],
  },
  {
    name: 'Lookbook AI',
    desc: 'Bối cảnh ngoài trời + Xuất ảnh',
    icon: Shirt,
    steps: [
      { type: 'FASHION_STUDIO', config: { prompt: 'Parisian street style fashion photography, golden hour sunlight, blurred architecture background, 8k photorealistic', engine: 'auto' } },
      { type: 'EXPORT' },
    ],
  },
];

async function imageUrlToBase64(urlOrBase64: string): Promise<string> {
  const trimmed = urlOrBase64.trim();
  if (trimmed.startsWith('data:')) {
    return trimmed.includes(',') ? trimmed.split(',')[1] : trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || (trimmed.startsWith('/') && trimmed.length < 500)) {
    const res = await fetch(trimmed);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return trimmed;
}

const WorkflowStudio: React.FC = () => {
  const { workspaceAsset, addToHistory, history } = useProject();
  const stepCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [steps, setSteps] = useState<WorkflowStep[]>(() => {
    try {
      const saved = localStorage.getItem(WORKFLOW_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: WorkflowStep) => ({
            ...s,
            status: s.type === 'INGEST' && s.output ? 'completed' : 'idle',
            errorMessage: undefined,
          }));
        }
      }
    } catch {
      // Ignore malformed localStorage
    }
    return [
      {
        id: 'initial-ingest',
        type: 'INGEST',
        title: 'Đầu vào',
        status: workspaceAsset?.url ? 'completed' : 'idle',
        config: {},
        output: workspaceAsset?.url,
        outputType: 'image',
      },
    ];
  });

  const [activeStepId, setActiveStepId] = useState<string>('initial-ingest');
  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const activeStep = steps.find(s => s.id === activeStepId) || steps[0];

  const getStepOutput = (step: WorkflowStep) => {
    if (step.id === 'initial-ingest' && !step.output && workspaceAsset?.url) {
      return workspaceAsset.url;
    }
    return step.output;
  };

  const addStep = useCallback((type: StepType, initialConfig: WorkflowStep['config'] = {}) => {
    stepCounter.current += 1;
    const id = `step-${stepCounter.current}-${Math.random().toString(36).substring(2, 7)}`;
    const defaultConfigs: Partial<Record<StepType, WorkflowStep['config']>> = {
      REMOVE_BG: { tier: 'pro' },
      FASHION_STUDIO: { prompt: 'Studio lighting, high-end commercial lookbook, 8k resolution', engine: 'auto' },
      VIDEO_GEN: { prompt: 'Smooth cinematic fashion movement, studio lighting', duration: 5, aspectRatio: '16:9', engine: 'auto' },
      UPSCALE: { targetSize: '2K' },
    };
    const newStep: WorkflowStep = {
      id,
      type,
      title: STEP_METADATA[type].description,
      status: 'idle',
      config: { ...(defaultConfigs[type] || {}), ...initialConfig },
    };
    setSteps(prev => [...prev, newStep]);
    setActiveStepId(id);
    toast.success(`Đã thêm bước: ${STEP_METADATA[type].description}`);
  }, []);

  const updateStepConfig = (id: string, patch: Partial<WorkflowStep['config']>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, config: { ...s.config, ...patch } } : s)));
  };

  const removeStep = (id: string) => {
    if (id === 'initial-ingest' || steps.length <= 1) {
      toast.info('Không thể xóa bước Đầu vào.');
      return;
    }
    const newSteps = steps.filter(s => s.id !== id);
    setSteps(newSteps);
    if (activeStepId === id) {
      setActiveStepId(newSteps[newSteps.length - 1].id);
    }
  };

  const handleIngestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeImage(file, 1536, 'image/jpeg', 0.88);
      const dataUrl = formatImageSrc(base64);
      setSteps(prev =>
        prev.map(s =>
          s.id === 'initial-ingest'
            ? { ...s, output: dataUrl, outputType: 'image', status: 'completed', errorMessage: undefined }
            : s
        )
      );
      toast.success('Đã tải ảnh đầu vào cho Workflow!');
    } catch {
      toast.error('Không thể đọc file ảnh đầu vào.');
    }
  };

  const loadTemplate = (template: (typeof WORKFLOW_TEMPLATES)[number]) => {
    const ingest = steps.find(s => s.id === 'initial-ingest') || {
      id: 'initial-ingest',
      type: 'INGEST' as StepType,
      title: 'Đầu vào',
      status: workspaceAsset?.url ? ('completed' as const) : ('idle' as const),
      config: {},
      output: workspaceAsset?.url,
      outputType: 'image' as const,
    };
    const builtSteps: WorkflowStep[] = [
      ingest,
      ...template.steps.map((t, idx) => ({
        id: `tpl-${Date.now()}-${idx}`,
        type: t.type,
        title: STEP_METADATA[t.type].description,
        status: 'idle' as const,
        config: t.config || {},
      })),
    ];
    setSteps(builtSteps);
    setActiveStepId(builtSteps[1]?.id || 'initial-ingest');
    toast.success(`Đã nạp mẫu Workflow: ${template.name}`);
  };

  const saveWorkflow = () => {
    try {
      // Save pipeline structure & configs (avoid bloating localStorage with large base64 outputs)
      const lightweight = steps.map(s => ({
        ...s,
        output: s.type === 'INGEST' ? undefined : undefined,
        status: 'idle',
      }));
      localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(lightweight));
      toast.success('Đã lưu cấu trúc Workflow hiện tại!');
    } catch {
      toast.error('Không thể lưu Workflow.');
    }
  };

  const executeStep = async (
    step: WorkflowStep,
    inputMedia: string,
    inputType: 'image' | 'video'
  ): Promise<{ output: string; outputType: 'image' | 'video' }> => {
    if (step.type === 'INGEST' || step.type === 'EXPORT') {
      return { output: inputMedia, outputType: inputType };
    }

    const base64Input = inputType === 'image' ? await imageUrlToBase64(inputMedia) : '';

    if (step.type === 'REMOVE_BG') {
      setStatusMessage('Đang tách nền bằng AI...');
      const res = await geminiService.removeBackground(base64Input, step.config.tier || 'pro');
      if (!res) throw new Error('Tách nền AI không trả về ảnh kết quả.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'UPSCALE') {
      setStatusMessage(`Đang nâng cấp độ phân giải ${step.config.targetSize || '2K'}...`);
      const res = await geminiService.upscaleImage(base64Input, step.config.targetSize || '2K', step.config.aspectRatio || '3:4');
      if (!res) throw new Error('Upscale không trả về ảnh kết quả.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'FASHION_STUDIO') {
      const stepPrompt = step.config.prompt?.trim() || 'High-end commercial fashion studio lookbook, natural studio lighting, 8k photorealistic';
      const enginePref = step.config.engine || 'auto';
      const flowReady = enginePref === 'flow' || enginePref === 'auto' ? await isFlowBackendAvailable().catch(() => false) : false;
      const museStatus = enginePref === 'muse' || enginePref === 'auto' ? await getMuseReadyStatus().catch(() => ({ available: false, accounts: 0 })) : { available: false, accounts: 0 };

      if (enginePref === 'muse' || (enginePref === 'auto' && !flowReady && museStatus.accounts > 0)) {
        setStatusMessage('Đang tạo ảnh bối cảnh qua Muse AI...');
        const url = await generateImageViaMuse(
          { prompt: stepPrompt, aspectRatio: step.config.aspectRatio || '3:4', referenceImage: formatImageSrc(inputMedia) },
          (_, msg) => setStatusMessage(msg)
        );
        return { output: formatImageSrc(url), outputType: 'image' };
      }

      if (enginePref === 'flow' || (enginePref === 'auto' && flowReady)) {
        setStatusMessage('Đang xử lý ảnh qua Google Flow...');
        const url = await generateImageViaFlow(
          {
            prompt: stepPrompt,
            aspectRatio: step.config.aspectRatio || '3:4',
            numImages: 1,
            model: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO,
            referenceImageBase64: base64Input,
            referenceImageMime: 'image/jpeg',
          },
          (_, msg) => setStatusMessage(msg)
        );
        return { output: formatImageSrc(url), outputType: 'image' };
      }

      setStatusMessage('Đang biến đổi bối cảnh bằng Gemini API...');
      const res = await geminiService.editImage(base64Input, stepPrompt, [], {
        modelId: 'gemini-3.1-flash-image',
        aspectRatio: step.config.aspectRatio || '3:4',
        imageSize: '1K',
      });
      if (!res) throw new Error('Gemini không trả về ảnh.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'VIDEO_GEN') {
      const stepPrompt = step.config.prompt?.trim() || 'Smooth cinematic fashion motion, professional studio lighting';
      const enginePref = step.config.engine || 'auto';
      const flowReady = enginePref === 'flow' || enginePref === 'auto' ? await isFlowBackendAvailable().catch(() => false) : false;
      const museStatus = enginePref === 'muse' || enginePref === 'auto' ? await getMuseReadyStatus().catch(() => ({ available: false, accounts: 0 })) : { available: false, accounts: 0 };

      if (enginePref === 'muse' || (enginePref === 'auto' && !flowReady && museStatus.accounts > 0)) {
        setStatusMessage('Đang render video qua Muse AI...');
        const url = await generateVideoViaMuse(
          {
            prompt: stepPrompt,
            duration: step.config.duration || 5,
            aspectRatio: step.config.aspectRatio || '16:9',
            referenceImage: formatImageSrc(inputMedia),
          },
          (_, msg) => setStatusMessage(msg)
        );
        return { output: url, outputType: 'video' };
      }

      if (enginePref === 'flow' || (enginePref === 'auto' && flowReady)) {
        setStatusMessage('Đang render video qua Google Flow (Veo)...');
        const url = await generateVideoViaFlow(
          {
            prompt: stepPrompt,
            duration: step.config.duration || 5,
            aspectRatio: step.config.aspectRatio || '16:9',
            model: FLOW_MODEL_IDS.VIDEO_VEO_FAST,
            referenceImageBase64: base64Input,
            referenceImageMime: 'image/jpeg',
          },
          (_, msg) => setStatusMessage(msg)
        );
        return { output: url, outputType: 'video' };
      }

      setStatusMessage('Đang render video qua Gemini Veo...');
      const url = await geminiService.generateVideo(stepPrompt, base64Input);
      if (!url) throw new Error('Gemini Veo không trả về video.');
      return { output: url, outputType: 'video' };
    }

    return { output: inputMedia, outputType: inputType };
  };

  const runWorkflow = async (startFromIndex = 0) => {
    if (isRunning) return;
    const initialInput = getStepOutput(steps[0]);
    if (!initialInput) {
      toast.error('Vui lòng tải ảnh đầu vào ở bước 01 (INGEST) hoặc đưa ảnh vào Workspace.');
      setActiveStepId('initial-ingest');
      return;
    }

    setIsRunning(true);
    setStatusMessage('Đang khởi chạy Pipeline AI...');
    const updatedSteps: WorkflowStep[] = steps.map((s, idx) =>
      idx >= startFromIndex ? { ...s, status: idx === 0 ? 'completed' : 'idle', errorMessage: undefined } : { ...s }
    );
    setSteps([...updatedSteps]);

    let currentMedia = startFromIndex > 0 && updatedSteps[startFromIndex - 1]?.output
      ? updatedSteps[startFromIndex - 1].output!
      : initialInput;
    let currentType: 'image' | 'video' =
      startFromIndex > 0 ? updatedSteps[startFromIndex - 1]?.outputType || 'image' : 'image';

    try {
      for (let i = startFromIndex; i < updatedSteps.length; i++) {
        const step = updatedSteps[i];
        setActiveStepId(step.id);
        updatedSteps[i] = { ...step, status: 'processing', errorMessage: undefined };
        setSteps([...updatedSteps]);
        setCurrentProgress(Math.round(((i + 0.3) / updatedSteps.length) * 100));

        try {
          const { output, outputType } = await executeStep(step, currentMedia, currentType);
          currentMedia = output;
          currentType = outputType;
          updatedSteps[i] = { ...updatedSteps[i], status: 'completed', output, outputType };
          setSteps([...updatedSteps]);
          setCurrentProgress(Math.round(((i + 1) / updatedSteps.length) * 100));
        } catch (stepErr: any) {
          const msg = stepErr?.message || 'Lỗi xử lý AI tại bước này.';
          updatedSteps[i] = { ...updatedSteps[i], status: 'error', errorMessage: msg };
          setSteps([...updatedSteps]);
          toast.error(`Bước "${step.title}" gặp lỗi`, { description: msg });
          return;
        }
      }

      toast.success('Workflow hoàn tất toàn bộ các bước!');
      if (currentMedia) {
        addToHistory({
          url: currentMedia,
          mode: 'WORKFLOW',
          type: currentType,
          prompt: updatedSteps.map(s => s.config.prompt).filter(Boolean).join(' → ') || 'Workflow Pipeline Output',
        });
      }
    } finally {
      setIsRunning(false);
      setStatusMessage('');
    }
  };

  const handleDownloadOutput = () => {
    const out = getStepOutput(activeStep);
    if (!out) return;
    const isVid = activeStep.outputType === 'video' || /\.(mp4|webm)(\?|$)/i.test(out);
    const link = document.createElement('a');
    link.href = out;
    link.download = `yody-workflow-${Date.now()}.${isVid ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeOutput = getStepOutput(activeStep);
  const activeIsVideo =
    activeStep.outputType === 'video' || (!!activeOutput && /\.(mp4|webm|mov)(\?|$)/i.test(activeOutput));

  const failedStepIndex = steps.findIndex(s => s.status === 'error');

  return (
    <div className="flex flex-col h-full bg-[#050505] text-[#E4E3E0] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-8 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
            <Box size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter">AI Pipeline Workflow</h1>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              {isRunning && statusMessage ? statusMessage : 'Tự động hóa quy trình sáng tạo AI thực tế (Flow / Muse / Gemini)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {failedStepIndex >= 0 && !isRunning && (
            <button
              onClick={() => runWorkflow(failedStepIndex)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-black transition-all active:scale-95"
            >
              <RotateCcw size={13} />
              Chạy lại từ bước lỗi
            </button>
          )}
          <button 
            onClick={() => runWorkflow(0)}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
              isRunning 
                ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
            }`}
          >
            {isRunning ? <Clock size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? `Đang xử lý (${currentProgress}%)` : 'Chạy Workflow'}
          </button>
          <button
            onClick={saveWorkflow}
            title="Lưu cấu trúc Workflow"
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all"
          >
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

              {activeStep.status === 'error' && activeStep.errorMessage && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[10px] text-red-300 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{activeStep.errorMessage}</span>
                </div>
              )}
              
              <div className="space-y-4">
                {activeStep.type === 'INGEST' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase">Nguồn ảnh đầu vào</label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square bg-black/40 rounded-xl border border-dashed border-white/20 hover:border-emerald-400/60 flex items-center justify-center overflow-hidden group relative cursor-pointer transition-colors"
                    >
                      {activeOutput ? (
                        <>
                          <img src={activeOutput} className="w-full h-full object-cover" alt="Ingest" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
                              <Upload size={12} /> Đổi ảnh
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Upload size={24} className="mx-auto mb-2 opacity-40" />
                          <p className="text-[9px] uppercase tracking-widest opacity-60">Bấm để tải ảnh hoặc lấy từ Workspace</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleIngestUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {activeStep.type === 'REMOVE_BG' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase">Chất lượng</span>
                      <select
                        value={activeStep.config.tier || 'pro'}
                        onChange={(e) => updateStepConfig(activeStep.id, { tier: e.target.value as 'standard' | 'pro' })}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-emerald-400 outline-none"
                      >
                        <option value="pro">Pro (Cao nhất)</option>
                        <option value="standard">Standard (Nhanh)</option>
                      </select>
                    </div>
                  </div>
                )}

                {(activeStep.type === 'FASHION_STUDIO' || activeStep.type === 'VIDEO_GEN') && (
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase block mb-2">
                        {activeStep.type === 'VIDEO_GEN' ? 'Prompt chuyển động Video' : 'Prompt bối cảnh / phong cách'}
                      </span>
                      <textarea 
                        value={activeStep.config.prompt || ''}
                        onChange={(e) => updateStepConfig(activeStep.id, { prompt: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] outline-none h-20 focus:border-emerald-500/60"
                        placeholder="Mô tả chi tiết mong muốn..."
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase">AI Engine</span>
                      <select
                        value={activeStep.config.engine || 'auto'}
                        onChange={(e) => updateStepConfig(activeStep.id, { engine: e.target.value as 'auto' | 'flow' | 'muse' | 'gemini' })}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-emerald-400 outline-none"
                      >
                        <option value="auto">Tự động</option>
                        <option value="flow">Google Flow</option>
                        <option value="muse">Muse AI</option>
                        <option value="gemini">Gemini API</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeStep.type === 'UPSCALE' && (
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold uppercase">Độ phân giải</span>
                    <select
                      value={activeStep.config.targetSize || '2K'}
                      onChange={(e) => updateStepConfig(activeStep.id, { targetSize: e.target.value as '2K' | '4K' })}
                      className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-yellow-400 outline-none"
                    >
                      <option value="2K">2K Ultra HD</option>
                      <option value="4K">4K Master</option>
                    </select>
                  </div>
                )}

                {activeStep.type !== 'INGEST' && (
                  <div className="pt-4 border-t border-white/10">
                    <button 
                      onClick={() => removeStep(activeStep.id)}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={12} />
                      Xóa bước này
                    </button>
                  </div>
                )}
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
          <div className="flex-1 flex items-center justify-center p-8 md:p-12 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeStepId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="relative w-full max-w-2xl aspect-[4/3] bg-black/40 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden group"
              >
                {activeOutput ? (
                  activeIsVideo ? (
                    <video src={activeOutput} controls autoPlay loop className="w-full h-full object-contain" />
                  ) : (
                    <img src={activeOutput} className="w-full h-full object-contain" alt={activeStep.title} />
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                    <ImageIcon size={64} className="mb-4 opacity-10" />
                    <p className="text-xs font-mono uppercase tracking-widest">Chưa có dữ liệu xem trước</p>
                  </div>
                )}

                {activeOutput && (
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between p-4 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white/10 ${STEP_METADATA[activeStep.type].color}`}>
                        {React.createElement(STEP_METADATA[activeStep.type].icon, { size: 14 })}
                      </div>
                      <span className="text-[10px] font-bold uppercase">{activeStep.title}</span>
                    </div>
                    <button
                      onClick={handleDownloadOutput}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                      title="Tải kết quả bước này"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                )}
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
                    {step.status === 'error' && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-[#0a0a0a]">
                        <AlertCircle size={8} />
                      </div>
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${activeStepId === step.id ? 'text-white' : 'text-white/40'}`}>
                    {step.type}
                  </span>
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

        {/* Right Sidebar: Templates & Real History */}
        <aside className="w-64 border-l border-white/10 bg-black/20 hidden xl:flex flex-col shrink-0">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Thư viện mẫu</h2>
            <div className="space-y-3">
              {WORKFLOW_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => loadTemplate(tpl)}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group"
                >
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
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">
              Lịch sử gần đây ({history.length})
            </h2>
            {history.length === 0 ? (
              <p className="text-[10px] text-white/30">Chưa có tác phẩm trong lịch sử. Bấm vào bước Đầu vào để tải ảnh.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {history.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.type === 'video') return;
                      setSteps(prev =>
                        prev.map(s =>
                          s.id === 'initial-ingest'
                            ? { ...s, output: item.url, outputType: 'image', status: 'completed' }
                            : s
                        )
                      );
                      setActiveStepId('initial-ingest');
                      toast.success('Đã nạp ảnh từ lịch sử làm đầu vào!');
                    }}
                    className="aspect-square bg-white/5 rounded-lg border border-white/10 overflow-hidden hover:border-emerald-500/50 transition-colors cursor-pointer group relative"
                  >
                    {item.type === 'video' ? (
                      <video src={item.url} muted className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <img src={item.url} alt={item.prompt} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                      <span className="text-[7px] font-mono uppercase truncate">{item.mode}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
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
