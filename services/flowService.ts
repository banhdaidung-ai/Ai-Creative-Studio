/**
 * flowService.ts — Google Flow Integration
 *
 * Giao tiếp với Python FastAPI backend (flow-backend) qua proxy Node server.
 * Hỗ trợ tạo ảnh (Nano Banana Pro) và video (Veo) không cần API key,
 * sử dụng tài khoản Google Flow của người dùng.
 */

const FLOW_PROXY_BASE = '/api/flow';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlowJobStatus {
  job_id: string;
  task_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
  result?: {
    mode: string;
    images?: Array<{ url: string; width: number; height: number; mime_type: string }>;
    video_url?: string;
    prompt_used: string;
    model_used: string;
    created_at: string;
  };
  images?: Array<{ url: string; width: number; height: number; mime_type: string }>;
  image_url?: string;
  video_url?: string;
  mode?: string;
  created_at?: string;
}

export interface FlowSessionStatus {
  has_session: boolean;
  message: string;
}

export interface FlowGenerateImageOptions {
  prompt: string;
  aspectRatio?: string;
  numImages?: number;
  model?: string;
  referenceImageBase64?: string;
  referenceImageMime?: string;
}

export interface FlowGenerateVideoOptions {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  model?: string;
  referenceImageBase64?: string;
  referenceImageMime?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64ToFile(base64: string, mime: string, filename: string): File {
  const arr = base64.split(',');
  const bstr = atob(arr.length > 1 ? arr[1] : arr[0]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function checkFlowSession(): Promise<FlowSessionStatus> {
  const res = await fetch(`${FLOW_PROXY_BASE}/session-status`);
  if (!res.ok) throw new Error('Flow backend không phản hồi');
  return res.json();
}

export async function clearFlowSession(): Promise<void> {
  await fetch(`${FLOW_PROXY_BASE}/clear-session`, { method: 'POST' });
}

// ── Job Polling ───────────────────────────────────────────────────────────────

export async function getFlowJobStatus(jobId: string): Promise<FlowJobStatus> {
  const res = await fetch(`${FLOW_PROXY_BASE}/job/${jobId}`);
  if (!res.ok) throw new Error(`Không tìm thấy job: ${jobId}`);
  return res.json();
}

export async function pollFlowJob(
  jobId: string,
  onProgress?: (progress: number, message: string) => void,
  intervalMs = 2000,
  timeoutMs = 360000,
): Promise<FlowJobStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await getFlowJobStatus(jobId);

    if (onProgress) {
      onProgress(status.progress, status.message);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Google Flow timeout: quá trình tạo vượt quá thời gian cho phép.');
}

// ── Image Generation ──────────────────────────────────────────────────────────

export async function submitFlowImageJob(options: FlowGenerateImageOptions): Promise<string> {
  const formData = new FormData();
  formData.append('prompt', options.prompt);
  formData.append('aspect_ratio', options.aspectRatio || '1:1');
  formData.append('num_images', String(options.numImages || 1));
  if (options.model) {
    formData.append('model', options.model);
  }

  if (options.referenceImageBase64) {
    const mime = options.referenceImageMime || 'image/jpeg';
    const file = base64ToFile(options.referenceImageBase64, mime, 'reference.jpg');
    formData.append('reference_image', file);
  }

  const res = await fetch(`${FLOW_PROXY_BASE}/generate-image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi không xác định' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.job_id;
}

export async function generateImageViaFlow(
  options: FlowGenerateImageOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<string | undefined> {
  const jobId = await submitFlowImageJob(options);
  const result = await pollFlowJob(jobId, onProgress);

  if (result.status === 'failed') {
    throw new Error(result.error || 'Google Flow thất bại khi tạo ảnh.');
  }

  const images = result.images || result.result?.images;
  if (images && images.length > 0) {
    return images[0].url;
  }

  return undefined;
}

// ── Video Generation ──────────────────────────────────────────────────────────

export async function submitFlowVideoJob(options: FlowGenerateVideoOptions): Promise<string> {
  const formData = new FormData();
  formData.append('prompt', options.prompt);
  formData.append('aspect_ratio', options.aspectRatio || '16:9');
  formData.append('duration', String(options.duration || 5));
  if (options.model) {
    formData.append('model', options.model);
  }

  if (options.referenceImageBase64) {
    const mime = options.referenceImageMime || 'image/jpeg';
    const file = base64ToFile(options.referenceImageBase64, mime, 'reference.jpg');
    formData.append('reference_image', file);
  }

  const res = await fetch(`${FLOW_PROXY_BASE}/generate-video`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi không xác định' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.job_id;
}

export async function generateVideoViaFlow(
  options: FlowGenerateVideoOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<string | undefined> {
  const jobId = await submitFlowVideoJob(options);
  const result = await pollFlowJob(jobId, onProgress, 3000, 400000);

  if (result.status === 'failed') {
    throw new Error(result.error || 'Google Flow thất bại khi tạo video.');
  }

  return result.video_url || result.result?.video_url;
}

// ── Prompt Enhancement ────────────────────────────────────────────────────────

export async function enhancePromptViaFlow(prompt: string, mode: 'image' | 'video' = 'image'): Promise<string> {
  const res = await fetch(`${FLOW_PROXY_BASE}/enhance-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode }),
  });

  if (!res.ok) return prompt;
  const data = await res.json();
  return data.enhanced_prompt || prompt;
}

// ── Backend Health Check ──────────────────────────────────────────────────────

export async function isFlowBackendAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${FLOW_PROXY_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Model IDs ─────────────────────────────────────────────────────────────────

export const FLOW_MODEL_IDS = {
  // Image Models trên Google Flow
  IMAGE_NANO_BANANA_PRO: 'google-flow-nano-banana-pro',
  IMAGE_NANO_BANANA_2: 'google-flow-nano-banana-2',
  IMAGE_NANO_BANANA_2_LITE: 'google-flow-nano-banana-2-lite',

  // Video Models trên Google Flow
  VIDEO_VEO_QUALITY: 'google-flow-veo-quality',
  VIDEO_VEO_FAST: 'google-flow-veo-fast',
  VIDEO_VEO_LITE: 'google-flow-veo-lite',
  VIDEO_OMNI_FLASH: 'google-flow-omni-flash',

  // Backward compatibility alias
  IMAGE: 'google-flow-nano-banana-pro',
  VIDEO: 'google-flow-veo-quality',
} as const;

export type FlowModelId = (typeof FLOW_MODEL_IDS)[keyof typeof FLOW_MODEL_IDS];

export function isFlowModel(modelId?: string): boolean {
  if (!modelId) return false;
  return modelId.startsWith('google-flow-');
}
