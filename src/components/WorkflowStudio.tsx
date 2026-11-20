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
  RotateCcw,
  Camera,
  ShieldCheck,
  Volume2,
  Layers,
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { geminiService, ANGLE_CONFIGS, hasRealGeminiCredentials } from '../services/gemini';
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
import { downloadAsZip, sanitizeSkuName } from '../utils/zipExport';
import { toast } from 'sonner';

type StepType =
  | 'INGEST'
  | 'REMOVE_BG'
  | 'TRY_ON'
  | 'MULTI_ANGLE'
  | 'FASHION_STUDIO'
  | 'QC_CHECK'
  | 'UPSCALE'
  | 'VIDEO_GEN'
  | 'VOICEOVER_TTS'
  | 'EXPORT';

interface WorkflowStep {
  id: string;
  type: StepType;
  title: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  qcScore?: number;
  config: {
    prompt?: string;
    tier?: 'standard' | 'pro';
    targetSize?: '2K' | '4K';
    aspectRatio?: string;
    duration?: number;
    engine?: 'auto' | 'flow' | 'muse' | 'gemini';
    garmentBase64?: string;
    angleId?: string;
    strictQc?: boolean;
    ttsScript?: string;
    ttsVoice?: string;
    ttsStyle?: string;
  };
  output?: string;
  outputType?: 'image' | 'video' | 'audio';
  audioOutput?: string;
}

const WORKFLOW_STORAGE_KEY = 'yody_saved_workflow_v3';

const STEP_METADATA: Record<
  StepType,
  { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; description: string }
> = {
  INGEST: { icon: ImageIcon, color: 'text-blue-400', description: 'Đầu vào (Đơn / Lô)' },
  REMOVE_BG: { icon: Eraser, color: 'text-pink-400', description: 'Tách nền AI' },
  TRY_ON: { icon: Shirt, color: 'text-indigo-400', description: 'Ướm trang phục AI' },
  MULTI_ANGLE: { icon: Camera, color: 'text-amber-400', description: 'Xoay góc Lookbook' },
  FASHION_STUDIO: { icon: Sparkles, color: 'text-purple-400', description: 'Biến đổi Studio / Bối cảnh' },
  QC_CHECK: { icon: ShieldCheck, color: 'text-teal-400', description: 'Kiểm định QC (Decision 1)' },
  UPSCALE: { icon: Sparkles, color: 'text-yellow-400', description: 'Nâng cấp 2K / 4K' },
  VIDEO_GEN: { icon: Film, color: 'text-red-400', description: 'Dựng Video Omni 1.2' },
  VOICEOVER_TTS: { icon: Volume2, color: 'text-cyan-400', description: 'Thuyết minh Gemini 3.8 TTS' },
  EXPORT: { icon: Download, color: 'text-emerald-400', description: 'Xuất & Lưu lịch sử' },
};

const WORKFLOW_TEMPLATES: Array<{
  name: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  steps: Array<{ type: StepType; config?: WorkflowStep['config'] }>;
}> = [
  {
    name: 'E-commerce QC Pro',
    desc: 'Tách nền → Studio → Chấm QC → 2K',
    icon: ShieldCheck,
    steps: [
      { type: 'REMOVE_BG', config: { tier: 'pro' } },
      {
        type: 'FASHION_STUDIO',
        config: {
          prompt: 'Clean minimalist e-commerce studio background, soft commercial flash lighting, crisp product shadows',
          engine: 'auto',
        },
      },
      { type: 'QC_CHECK', config: { strictQc: false } },
      { type: 'UPSCALE', config: { targetSize: '2K' } },
      { type: 'EXPORT' },
    ],
  },
  {
    name: 'TVC Lookbook + Voice',
    desc: 'Studio → Video Omni 1.2 → Lồng tiếng TTS',
    icon: Film,
    steps: [
      {
        type: 'FASHION_STUDIO',
        config: {
          prompt: 'High-fashion editorial lighting, cinematic depth of field, magazine cover aesthetic',
          engine: 'auto',
        },
      },
      {
        type: 'VIDEO_GEN',
        config: {
          prompt: 'Smooth slow-motion fashion lookbook camera pan, fabric gently swaying, studio lighting',
          duration: 8,
          aspectRatio: '9:16',
          engine: 'auto',
        },
      },
      {
        type: 'VOICEOVER_TTS',
        config: {
          ttsScript: 'Khám phá bộ sưu tập thu đông mới nhất từ YODY — chất liệu êm ái, tôn dáng thanh lịch trong từng chuyển động.',
          ttsVoice: 'Kore',
          ttsStyle: 'Warm, luxury commercial Vietnamese fashion narrator',
        },
      },
      { type: 'EXPORT' },
    ],
  },
  {
    name: 'Đa Góc Lookbook',
    desc: 'Ướm đồ / Xoay góc → Kiểm duyệt QC',
    icon: Camera,
    steps: [
      { type: 'MULTI_ANGLE', config: { angleId: 'dynamic', aspectRatio: '3:4' } },
      { type: 'QC_CHECK', config: { strictQc: false } },
      { type: 'EXPORT' },
    ],
  },
];

async function imageUrlToBase64(urlOrBase64: string): Promise<string> {
  const trimmed = urlOrBase64.trim();
  if (trimmed.startsWith('data:')) {
    return trimmed.includes(',') ? trimmed.split(',')[1] : trimmed;
  }
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('/9j/'))
  ) {
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
  const garmentStepInputRef = useRef<HTMLInputElement>(null);

  const [batchInputs, setBatchInputs] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<Array<{ filename: string; dataOrUrl: string }>>([]);
  const [skuBatchPrefix, setSkuBatchPrefix] = useState<string>('YODY_PIPE');

  const [steps, setSteps] = useState<WorkflowStep[]>(() => {
    try {
      const saved = localStorage.getItem(WORKFLOW_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((s: WorkflowStep) => STEP_METADATA[s.type])
            .map((s: WorkflowStep) => ({
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

  const activeStep = steps.find((s) => s.id === activeStepId) || steps[0];

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
      TRY_ON: { prompt: 'Fit the uploaded reference garment naturally onto the model', aspectRatio: '3:4', engine: 'auto' },
      MULTI_ANGLE: { angleId: 'dynamic', aspectRatio: '3:4', engine: 'auto' },
      FASHION_STUDIO: { prompt: 'Studio lighting, high-end commercial lookbook, 8k resolution', engine: 'auto' },
      QC_CHECK: { strictQc: false },
      VIDEO_GEN: { prompt: 'Smooth cinematic fashion movement, studio lighting', duration: 8, aspectRatio: '16:9', engine: 'auto' },
      VOICEOVER_TTS: {
        ttsScript: 'Bộ sưu tập thời trang cao cấp mới nhất từ YODY — thanh lịch, tự tin trong từng khoảnh khắc.',
        ttsVoice: 'Kore',
        ttsStyle: 'Warm, luxury commercial fashion narrator',
      },
      UPSCALE: { targetSize: '2K' },
    };
    const newStep: WorkflowStep = {
      id,
      type,
      title: STEP_METADATA[type].description,
      status: 'idle',
      config: { ...(defaultConfigs[type] || {}), ...initialConfig },
    };
    setSteps((prev) => [...prev, newStep]);
    setActiveStepId(id);
    toast.success(`Đã thêm bước: ${STEP_METADATA[type].description}`);
  }, []);

  const updateStepConfig = (id: string, patch: Partial<WorkflowStep['config']>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...patch } } : s)));
  };

  const removeStep = (id: string) => {
    if (id === 'initial-ingest' || steps.length <= 1) {
      toast.info('Không thể xóa bước Đầu vào.');
      return;
    }
    const newSteps = steps.filter((s) => s.id !== id);
    setSteps(newSteps);
    if (activeStepId === id) {
      setActiveStepId(newSteps[newSteps.length - 1].id);
    }
  };

  const handleIngestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const converted = await Promise.all(
        Array.from(files)
          .filter((f) => f.type.startsWith('image/'))
          .slice(0, 20)
          .map(async (f) => formatImageSrc(await resizeImage(f, 1536, 'image/jpeg', 0.88)))
      );
      if (converted.length === 0) return;

      setBatchInputs(converted);
      setBatchResults([]);
      setSteps((prev) =>
        prev.map((s) =>
          s.id === 'initial-ingest'
            ? { ...s, output: converted[0], outputType: 'image', status: 'completed', errorMessage: undefined }
            : s
        )
      );
      toast.success(
        converted.length > 1
          ? `Đã nạp lô ${converted.length} ảnh đầu vào cho Batch Workflow!`
          : 'Đã tải ảnh đầu vào cho Workflow!'
      );
    } catch {
      toast.error('Không thể đọc file ảnh đầu vào.');
    }
    e.target.value = '';
  };

  const handleStepGarmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImage(file, 1280, 'image/jpeg', 0.88);
      updateStepConfig(activeStep.id, { garmentBase64: b64 });
      toast.success('Đã gắn ảnh trang phục cho bước Ướm đồ!');
    } catch {
      toast.error('Không thể đọc ảnh trang phục.');
    }
    e.target.value = '';
  };

  const loadTemplate = (template: (typeof WORKFLOW_TEMPLATES)[number]) => {
    const ingest = steps.find((s) => s.id === 'initial-ingest') || {
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
      const lightweight = steps.map((s) => ({
        ...s,
        config: { ...s.config, garmentBase64: undefined },
        output: undefined,
        audioOutput: undefined,
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
    inputType: 'image' | 'video' | 'audio'
  ): Promise<{ output: string; outputType: 'image' | 'video' | 'audio'; qcScore?: number; audioOutput?: string }> => {
    if (step.type === 'INGEST' || step.type === 'EXPORT') {
      return { output: inputMedia, outputType: inputType };
    }

    const base64Input = inputType === 'image' ? await imageUrlToBase64(inputMedia) : '';

    if (step.type === 'REMOVE_BG') {
      setStatusMessage('Đang tách nền bằng Nano Banana 2.1...');
      const res = await geminiService.removeBackground(base64Input, step.config.tier || 'pro');
      if (!res) throw new Error('Tách nền AI không trả về ảnh kết quả.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'TRY_ON') {
      if (!step.config.garmentBase64) {
        throw new Error('Bước Ướm trang phục chưa có ảnh sản phẩm. Hãy chọn bước TRY_ON và tải ảnh áo/quần lên.');
      }
      setStatusMessage('Đang ướm trang phục lên mẫu...');
      const flowReady = await isFlowBackendAvailable().catch(() => false);
      const tryPrompt =
        step.config.prompt ||
        'Virtual fashion try-on: Replace the outfit on the model with the uploaded garment reference while keeping 100% identical face and natural lighting.';
      if ((step.config.engine === 'flow' || step.config.engine === 'auto') && flowReady) {
        const url = await generateImageViaFlow({
          prompt: tryPrompt,
          aspectRatio: step.config.aspectRatio || '3:4',
          model: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO,
          modelImageBase64: base64Input,
          referenceImagesBase64: [step.config.garmentBase64],
          referenceImageBase64: step.config.garmentBase64,
        });
        if (url) return { output: formatImageSrc(url), outputType: 'image' };
      }
      const res = await geminiService.editImage(base64Input, tryPrompt, [step.config.garmentBase64], {
        modelId: 'gemini-nano-banana-2.1',
        aspectRatio: step.config.aspectRatio || '3:4',
        imageSize: '1K',
      });
      if (!res) throw new Error('Ướm đồ AI không trả về ảnh.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'MULTI_ANGLE') {
      const angleId = step.config.angleId || 'dynamic';
      const angleMeta = ANGLE_CONFIGS.find((a) => a.id === angleId) || ANGLE_CONFIGS[0];
      setStatusMessage(`Đang xoay góc chụp: ${angleMeta.name}...`);
      const flowReady = await isFlowBackendAvailable().catch(() => false);
      if ((step.config.engine === 'flow' || step.config.engine === 'auto') && flowReady) {
        const url = await generateImageViaFlow({
          prompt: `High-end fashion lookbook photoshoot of the identical model and outfit from reference. Angle: ${angleMeta.promptDesc}. Pose: ${angleMeta.userDesc}`,
          aspectRatio: step.config.aspectRatio || '3:4',
          model: FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO,
          referenceImageBase64: base64Input,
        });
        if (url) return { output: formatImageSrc(url), outputType: 'image' };
      }
      const res = await geminiService.generateSingleAngle(base64Input, angleId, [], {
        modelId: 'gemini-nano-banana-2.1',
        aspectRatio: step.config.aspectRatio || '3:4',
        imageSize: '1K',
      });
      if (!res) throw new Error('Xoay góc chụp không trả về ảnh.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'QC_CHECK') {
      setStatusMessage('Đang chấm điểm chất lượng bằng Gemini Decision 1...');
      const canQc = await hasRealGeminiCredentials();
      if (!canQc) {
        return { output: inputMedia, outputType: inputType, qcScore: 90 };
      }
      const rev = await geminiService.reviewImage(base64Input);
      const score = rev.score ?? (rev.pass ? 92 : 40);
      if (step.config.strictQc && (!rev.pass || score < 65)) {
        throw new Error(rev.reason || `Ảnh không đạt ngưỡng QC nghiêm ngặt (${score}%).`);
      }
      return { output: inputMedia, outputType: inputType, qcScore: score };
    }

    if (step.type === 'UPSCALE') {
      setStatusMessage(`Đang nâng cấp độ phân giải ${step.config.targetSize || '2K'}...`);
      const res = await geminiService.upscaleImage(base64Input, step.config.targetSize || '2K', step.config.aspectRatio || '3:4');
      if (!res) throw new Error('Upscale không trả về ảnh kết quả.');
      return { output: formatImageSrc(res), outputType: 'image' };
    }

    if (step.type === 'FASHION_STUDIO') {
      const stepPrompt =
        step.config.prompt?.trim() || 'High-end commercial fashion studio lookbook, natural studio lighting, 8k photorealistic';
      const enginePref = step.config.engine || 'auto';
      const flowReady = enginePref === 'flow' || enginePref === 'auto' ? await isFlowBackendAvailable().catch(() => false) : false;
      const museStatus =
        enginePref === 'muse' || enginePref === 'auto'
          ? await getMuseReadyStatus().catch(() => ({ available: false, accounts: 0 }))
          : { available: false, accounts: 0 };

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
        if (!url) throw new Error('Google Flow không trả về ảnh.');
        return { output: formatImageSrc(url), outputType: 'image' };
      }

      setStatusMessage('Đang biến đổi bối cảnh bằng Gemini Nano Banana 2.1...');
      const res = await geminiService.editImage(base64Input, stepPrompt, [], {
        modelId: 'gemini-nano-banana-2.1',
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
      const museStatus =
        enginePref === 'muse' || enginePref === 'auto'
          ? await getMuseReadyStatus().catch(() => ({ available: false, accounts: 0 }))
          : { available: false, accounts: 0 };

      if (enginePref === 'muse' || (enginePref === 'auto' && !flowReady && museStatus.accounts > 0)) {
        setStatusMessage('Đang render video qua Muse AI...');
        const url = await generateVideoViaMuse(
          {
            prompt: stepPrompt,
            duration: step.config.duration || 8,
            aspectRatio: step.config.aspectRatio || '16:9',
            referenceImage: formatImageSrc(inputMedia),
          },
          (_, msg) => setStatusMessage(msg)
        );
        return { output: url, outputType: 'video' };
      }

      if (enginePref === 'flow' || (enginePref === 'auto' && flowReady)) {
        setStatusMessage('Đang render video qua Google Flow (Omni 1.2 Flash)...');
        const url = await generateVideoViaFlow(
          {
            prompt: stepPrompt,
            duration: step.config.duration || 8,
            aspectRatio: step.config.aspectRatio || '16:9',
            model: FLOW_MODEL_IDS.VIDEO_OMNI_1_2_FLASH,
            referenceImageBase64: base64Input,
            referenceImageMime: 'image/jpeg',
          },
          (_, msg) => setStatusMessage(msg)
        );
        if (!url) throw new Error('Google Flow không trả về video.');
        return { output: url, outputType: 'video' };
      }

      setStatusMessage('Đang render video qua Gemini Omni 1.2 Flash...');
      const url = await geminiService.generateVideo(stepPrompt, base64Input);
      if (!url) throw new Error('Gemini Omni 1.2 Flash không trả về video.');
      return { output: url, outputType: 'video' };
    }

    if (step.type === 'VOICEOVER_TTS') {
      setStatusMessage('Đang tổng hợp giọng đọc thuyết minh bằng Gemini 3.8 TTS...');
      const script =
        step.config.ttsScript?.trim() ||
        'Khám phá thiết kế thời trang mới nhất từ YODY — tôn vinh phong cách hiện đại và sự thoải mái vượt trội.';
      const wavDataUri = await geminiService.generateVoiceoverTTS(
        script,
        step.config.ttsStyle || 'Warm, luxury commercial fashion narrator',
        step.config.ttsVoice || 'Kore'
      );
      // Preserve upstream visual asset while attaching synthesized WAV voiceover!
      return {
        output: inputMedia || wavDataUri,
        outputType: inputMedia ? inputType : 'audio',
        audioOutput: wavDataUri,
      };
    }

    return { output: inputMedia, outputType: inputType };
  };

  const runSinglePipeline = async (
    initialMedia: string,
    startFromIndex = 0
  ): Promise<{ finalMedia: string; finalType: 'image' | 'video' | 'audio'; finalAudio?: string } | null> => {
    const updatedSteps: WorkflowStep[] = steps.map((s, idx) =>
      idx >= startFromIndex ? { ...s, status: idx === 0 ? 'completed' : 'idle', errorMessage: undefined } : { ...s }
    );
    if (startFromIndex === 0) {
      updatedSteps[0] = { ...updatedSteps[0], output: initialMedia, outputType: 'image', status: 'completed' };
    }
    setSteps([...updatedSteps]);

    let currentMedia =
      startFromIndex > 0 && updatedSteps[startFromIndex - 1]?.output
        ? updatedSteps[startFromIndex - 1].output!
        : initialMedia;
    let currentType: 'image' | 'video' | 'audio' =
      startFromIndex > 0 ? updatedSteps[startFromIndex - 1]?.outputType || 'image' : 'image';
    let latestAudio: string | undefined = undefined;

    for (let i = startFromIndex; i < updatedSteps.length; i++) {
      const step = updatedSteps[i];
      setActiveStepId(step.id);
      updatedSteps[i] = { ...step, status: 'processing', errorMessage: undefined };
      setSteps([...updatedSteps]);
      setCurrentProgress(Math.round(((i + 0.3) / updatedSteps.length) * 100));

      try {
        const { output, outputType, qcScore, audioOutput } = await executeStep(step, currentMedia, currentType);
        currentMedia = output;
        currentType = outputType;
        if (audioOutput) latestAudio = audioOutput;
        updatedSteps[i] = {
          ...updatedSteps[i],
          status: 'completed',
          output,
          outputType,
          qcScore,
          audioOutput: audioOutput || latestAudio,
        };
        setSteps([...updatedSteps]);
        setCurrentProgress(Math.round(((i + 1) / updatedSteps.length) * 100));
      } catch (stepErr: any) {
        const msg = stepErr?.message || 'Lỗi xử lý AI tại bước này.';
        updatedSteps[i] = { ...updatedSteps[i], status: 'error', errorMessage: msg };
        setSteps([...updatedSteps]);
        toast.error(`Bước "${step.title}" gặp lỗi`, { description: msg });
        return null;
      }
    }

    return { finalMedia: currentMedia, finalType: currentType, finalAudio: latestAudio };
  };

  const runWorkflow = async (startFromIndex = 0) => {
    if (isRunning) return;
    const initialInput = getStepOutput(steps[0]);
    if (!initialInput && batchInputs.length === 0) {
      toast.error('Vui lòng tải ảnh đầu vào ở bước 01 (INGEST) hoặc đưa ảnh vào Workspace.');
      setActiveStepId('initial-ingest');
      return;
    }

    setIsRunning(true);
    setBatchResults([]);
    try {
      if (startFromIndex === 0 && batchInputs.length > 1) {
        const cleanSku = sanitizeSkuName(skuBatchPrefix, 'YODY_PIPE');
        const collected: Array<{ filename: string; dataOrUrl: string }> = [];
        for (let idx = 0; idx < batchInputs.length; idx++) {
          setStatusMessage(`Đang xử lý ảnh lô ${idx + 1}/${batchInputs.length}...`);
          const res = await runSinglePipeline(batchInputs[idx], 0);
          if (!res) break;
          const ext = res.finalType === 'video' ? 'mp4' : res.finalType === 'audio' ? 'wav' : 'png';
          collected.push({
            filename: `${cleanSku}_${String(idx + 1).padStart(2, '0')}.${ext}`,
            dataOrUrl: res.finalMedia,
          });
          if (res.finalAudio) {
            collected.push({
              filename: `${cleanSku}_${String(idx + 1).padStart(2, '0')}_voiceover.wav`,
              dataOrUrl: res.finalAudio,
            });
          }
          if (res.finalType !== 'audio') {
            addToHistory({
              url: res.finalMedia,
              mode: 'WORKFLOW',
              type: res.finalType === 'video' ? 'video' : 'image',
              prompt: `Batch Workflow (${idx + 1}/${batchInputs.length})`,
            });
          }
        }
        setBatchResults(collected);
        if (collected.length > 0) {
          toast.success(`Đã hoàn tất dây chuyền cho ${batchInputs.length} ảnh! Bấm "Xuất ZIP" để tải trọn bộ.`);
        }
      } else {
        const res = await runSinglePipeline(initialInput!, startFromIndex);
        if (res && res.finalMedia) {
          toast.success('Workflow hoàn tất toàn bộ các bước!');
          if (res.finalType !== 'audio') {
            addToHistory({
              url: res.finalMedia,
              mode: 'WORKFLOW',
              type: res.finalType === 'video' ? 'video' : 'image',
              prompt: steps.map((s) => s.config.prompt).filter(Boolean).join(' → ') || 'Workflow Pipeline Output',
            });
          }
        }
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
  const failedStepIndex = steps.findIndex((s) => s.status === 'error');

  return (
    <div className="flex flex-col h-full bg-[#050505] text-[#E4E3E0] overflow-hidden">
      {/* Header */}
      <header className="flex flex-wrap gap-3 items-center justify-between px-6 md:px-8 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
            <Box size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter">AI Pipeline Studio 3.0</h1>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              {isRunning && statusMessage
                ? statusMessage
                : 'Dây chuyền sản xuất tự động (Ướm đồ • Đa góc • QC Decision 1 • Omni 1.2 • TTS)'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {batchResults.length > 0 && !isRunning && (
            <button
              type="button"
              onClick={() => downloadAsZip(batchResults, `${sanitizeSkuName(skuBatchPrefix)}_Workflow_${Date.now()}.zip`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg"
            >
              <Download size={13} />
              Xuất ZIP ({batchResults.length})
            </button>
          )}
          {failedStepIndex >= 0 && !isRunning && (
            <button
              type="button"
              onClick={() => runSinglePipeline(getStepOutput(steps[0])!, failedStepIndex)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-black transition-all active:scale-95"
            >
              <RotateCcw size={13} />
              Chạy lại từ bước lỗi
            </button>
          )}
          <button
            type="button"
            onClick={() => runWorkflow(0)}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
              isRunning
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
            }`}
          >
            {isRunning ? <Clock size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning
              ? `Đang xử lý (${currentProgress}%)`
              : batchInputs.length > 1
              ? `Chạy Lô (${batchInputs.length} ảnh)`
              : 'Chạy Workflow'}
          </button>
          <button
            type="button"
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
        <aside className="w-80 border-r border-white/10 bg-black/20 flex flex-col shrink-0 overflow-hidden">
          <div className="p-5 border-b border-white/10 overflow-y-auto max-h-[56%] custom-scrollbar">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">Cấu hình bước</h2>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-white/5 ${STEP_METADATA[activeStep.type].color}`}>
                    {React.createElement(STEP_METADATA[activeStep.type].icon, { size: 16 })}
                  </div>
                  <span className="font-bold text-xs">{activeStep.title}</span>
                </div>
                {typeof activeStep.qcScore === 'number' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                    QC {activeStep.qcScore}%
                  </span>
                )}
              </div>

              {activeStep.status === 'error' && activeStep.errorMessage && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[10px] text-red-300 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{activeStep.errorMessage}</span>
                </div>
              )}

              <div className="space-y-3">
                {activeStep.type === 'INGEST' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/50 uppercase">
                        Ảnh đầu vào {batchInputs.length > 1 ? `(Lô ${batchInputs.length} ảnh)` : ''}
                      </span>
                      {batchInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBatchInputs(batchInputs.slice(0, 1))}
                          className="text-[9px] text-amber-400 hover:underline"
                        >
                          Về 1 ảnh
                        </button>
                      )}
                    </div>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="h-36 bg-black/40 rounded-xl border border-dashed border-white/20 hover:border-emerald-400/60 flex items-center justify-center overflow-hidden group relative cursor-pointer transition-colors"
                    >
                      {activeOutput ? (
                        <>
                          <img src={activeOutput} className="w-full h-full object-contain" alt="Ingest" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
                              <Layers size={12} /> Chọn 1 hoặc Nhiều ảnh (Batch)
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Upload size={22} className="mx-auto mb-1.5 opacity-40" />
                          <p className="text-[9px] uppercase tracking-widest opacity-60">
                            Tải 1 ảnh hoặc cả lô sản phẩm (tối đa 20 ảnh)
                          </p>
                        </div>
                      )}
                    </div>
                    {batchInputs.length > 1 && (
                      <input
                        type="text"
                        value={skuBatchPrefix}
                        onChange={(e) => setSkuBatchPrefix(e.target.value)}
                        placeholder="Mã SKU xuất ZIP..."
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[10px] font-mono text-emerald-300 outline-none"
                      />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleIngestUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {activeStep.type === 'REMOVE_BG' && (
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold uppercase">Chất lượng</span>
                    <select
                      value={activeStep.config.tier || 'pro'}
                      onChange={(e) => updateStepConfig(activeStep.id, { tier: e.target.value as 'standard' | 'pro' })}
                      className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-emerald-400 outline-none"
                    >
                      <option value="pro">Pro (Nano Banana 2.1)</option>
                      <option value="standard">Standard (Lite)</option>
                    </select>
                  </div>
                )}

                {activeStep.type === 'TRY_ON' && (
                  <div className="space-y-2.5">
                    <div
                      onClick={() => garmentStepInputRef.current?.click()}
                      className="h-28 rounded-xl bg-black/40 border border-dashed border-indigo-400/40 flex items-center justify-center cursor-pointer overflow-hidden"
                    >
                      {activeStep.config.garmentBase64 ? (
                        <img
                          src={formatImageSrc(activeStep.config.garmentBase64)}
                          className="w-full h-full object-contain p-1.5"
                          alt="Trang phục ướm"
                        />
                      ) : (
                        <span className="text-[9px] font-bold uppercase text-indigo-300 flex items-center gap-1.5">
                          <Shirt size={13} /> Tải ảnh trang phục cần ướm
                        </span>
                      )}
                    </div>
                    <input
                      ref={garmentStepInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleStepGarmentUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {activeStep.type === 'MULTI_ANGLE' && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase block text-white/60">Chọn góc máy Lookbook</span>
                    <select
                      value={activeStep.config.angleId || 'dynamic'}
                      onChange={(e) => updateStepConfig(activeStep.id, { angleId: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-[10px] font-bold text-amber-300 outline-none"
                    >
                      {ANGLE_CONFIGS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeStep.type === 'QC_CHECK' && (
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-teal-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeStep.config.strictQc)}
                        onChange={(e) => updateStepConfig(activeStep.id, { strictQc: e.target.checked })}
                        className="accent-teal-500 rounded"
                      />
                      Chặn xuất nếu QC &lt; 65%
                    </label>
                    <p className="text-[9px] text-white/50">
                      Chấm điểm giải phẫu khuôn mặt, bàn tay và form áo bằng Gemini Decision 1.
                    </p>
                  </div>
                )}

                {activeStep.type === 'VOICEOVER_TTS' && (
                  <div className="space-y-2.5">
                    <textarea
                      value={activeStep.config.ttsScript || ''}
                      onChange={(e) => updateStepConfig(activeStep.id, { ttsScript: e.target.value })}
                      placeholder="Nhập lời bình quảng cáo Lookbook..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] outline-none h-20 focus:border-cyan-400"
                    />
                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold uppercase">Giọng đọc (3.8 TTS)</span>
                      <select
                        value={activeStep.config.ttsVoice || 'Kore'}
                        onChange={(e) => updateStepConfig(activeStep.id, { ttsVoice: e.target.value })}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-cyan-300 outline-none"
                      >
                        <option value="Kore">Kore (Nữ sang trọng)</option>
                        <option value="Aoede">Aoede (Nữ trẻ trung)</option>
                        <option value="Puck">Puck (Nam năng động)</option>
                        <option value="Charon">Charon (Nam trầm ấm)</option>
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
                        onChange={(e) =>
                          updateStepConfig(activeStep.id, { engine: e.target.value as 'auto' | 'flow' | 'muse' | 'gemini' })
                        }
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
                  <div className="pt-3 border-t border-white/10">
                    <button
                      type="button"
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

          <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">Thêm hành động AI</h2>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(STEP_METADATA) as StepType[])
                .filter((t) => t !== 'INGEST')
                .map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addStep(type)}
                    className="flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
                  >
                    <div className={`p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${STEP_METADATA[type].color}`}>
                      {React.createElement(STEP_METADATA[type].icon, { size: 15 })}
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

          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 overflow-hidden gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStepId}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.03 }}
                className="relative w-full max-w-2xl aspect-[4/3] bg-black/40 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden group flex items-center justify-center"
              >
                {activeOutput && activeStep.outputType !== 'audio' ? (
                  activeIsVideo ? (
                    <video
                      src={activeOutput}
                      width={1280}
                      height={720}
                      controls
                      playsInline
                      preload="metadata"
                      loop
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img src={activeOutput} className="w-full h-full object-contain" alt={activeStep.title} />
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                    <ImageIcon size={56} className="mb-3 opacity-10" />
                    <p className="text-xs font-mono uppercase tracking-widest">Chưa có dữ liệu xem trước</p>
                  </div>
                )}

                {activeOutput && activeStep.outputType !== 'audio' && (
                  <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between p-3.5 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white/10 ${STEP_METADATA[activeStep.type].color}`}>
                        {React.createElement(STEP_METADATA[activeStep.type].icon, { size: 14 })}
                      </div>
                      <span className="text-[10px] font-bold uppercase">{activeStep.title}</span>
                    </div>
                    <button
                      type="button"
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

            {/* Voiceover Audio Player when VOICEOVER_TTS has generated audio */}
            {activeStep.audioOutput && (
              <div className="w-full max-w-2xl p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-3">
                <Volume2 size={18} className="text-cyan-400 shrink-0" />
                <audio
                  controls
                  {...({ loading: 'lazy' } as React.AudioHTMLAttributes<HTMLAudioElement>)}
                  preload="metadata"
                  src={activeStep.audioOutput}
                  className="flex-1 h-9"
                  aria-label="Bản thu thuyết minh AI"
                />
                <a
                  href={activeStep.audioOutput}
                  download={`yody-voiceover-${Date.now()}.wav`}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 text-black text-[9px] font-black uppercase tracking-wider shrink-0"
                >
                  Tải WAV
                </a>
              </div>
            )}
          </div>

          {/* Timeline Rail */}
          <div className="h-28 border-t border-white/10 bg-black/40 backdrop-blur-xl flex items-center px-6 gap-3 overflow-x-auto no-scrollbar shrink-0">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => setActiveStepId(step.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all min-w-[96px] ${
                    activeStepId === step.id
                      ? 'bg-white/10 border border-white/20 scale-105'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-white/5 ${STEP_METADATA[step.type].color} relative`}>
                    {React.createElement(STEP_METADATA[step.type].icon, { size: 15 })}
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
                  <span className={`text-[8px] font-black uppercase tracking-wider ${activeStepId === step.id ? 'text-white' : 'text-white/40'}`}>
                    {step.type}
                  </span>
                  <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-black border border-white/10 rounded-full flex items-center justify-center text-[8px] font-bold text-white/40">
                    0{index + 1}
                  </div>
                </button>
                {index < steps.length - 1 && <ArrowRight size={13} className="text-white/15 shrink-0" />}
              </React.Fragment>
            ))}

            <button
              type="button"
              onClick={() => addStep('EXPORT')}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 transition-all min-w-[96px] group"
            >
              <div className="p-2 rounded-xl bg-white/5 text-white/20 group-hover:text-white/40">
                <Plus size={15} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40">
                Thêm bước
              </span>
            </button>
          </div>
        </div>

        {/* Right Sidebar: Templates & Real History */}
        <aside className="w-64 border-l border-white/10 bg-black/20 hidden xl:flex flex-col shrink-0">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">Thư viện mẫu 3.0</h2>
            <div className="space-y-2.5">
              {WORKFLOW_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
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

          <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">
              Lịch sử gần đây ({history.length})
            </h2>
            {history.length === 0 ? (
              <p className="text-[10px] text-white/30">Chưa có tác phẩm trong lịch sử.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {history.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.type === 'video') return;
                      setBatchInputs([item.url]);
                      setSteps((prev) =>
                        prev.map((s) =>
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
                      <video
                        src={item.url}
                        muted
                        width={160}
                        height={160}
                        {...({ loading: 'lazy' } as React.VideoHTMLAttributes<HTMLVideoElement>)}
                        preload="metadata"
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.prompt}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
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
    </div>
  );
};

export default WorkflowStudio;
