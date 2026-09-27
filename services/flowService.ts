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
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteString = atob(cleanBase64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: mime });
}

export function getFlowApiUrl(endpoint: string): string {
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('flow_backend_url')?.trim() : undefined;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (customUrl) {
    const base = customUrl.replace(/\/+$/, '');
    if (cleanEndpoint === '/health') {
      return `${base}/health`;
    }
    return `${base}/api${cleanEndpoint.replace(/^\/api/, '')}`;
  }

  return `${FLOW_PROXY_BASE}${cleanEndpoint}`;
}

/**
 * An toàn parse JSON từ Google Flow backend proxy.
 * Phát hiện và chặn lỗi khi backend trả về HTML (ví dụ: static hosting rewrite về index.html).
 */
async function parseJsonResponse<T = any>(res: Response, endpointDesc: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';

  // Khi chạy trên hosting tĩnh (Firebase Hosting, GitHub Pages) hoặc khi chưa bật server,
  // server thường rewrite URL về /index.html (bắt đầu bằng <!DOCTYPE html>).
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (text.includes('<!DOCTYPE') || text.includes('<html') || contentType.includes('text/html')) {
      throw new Error(
        'FLOW_BACKEND_UNAVAILABLE: Google Flow Backend chưa khả dụng trên môi trường web này. ' +
        'Để tạo ảnh/video bằng mô hình Google Flow, vui lòng chạy backend ở máy local: `npm run dev:flow` ' +
        'hoặc chuyển sang mô hình Gemini API (trong mục AI Model Engine).'
      );
    }
    throw new Error(`${endpointDesc} thất bại: Máy chủ không phản hồi định dạng JSON (${res.status} ${res.statusText}).`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}: ${res.statusText}` }));
    throw new Error(err.detail || err.error || `${endpointDesc} thất bại (HTTP ${res.status})`);
  }

  return await res.json();
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function checkFlowSession(): Promise<FlowSessionStatus> {
  const res = await fetch(getFlowApiUrl('/session-status'));
  return parseJsonResponse<FlowSessionStatus>(res, 'Kiểm tra phiên đăng nhập Flow');
}

export async function clearFlowSession(): Promise<void> {
  const res = await fetch(getFlowApiUrl('/clear-session'), { method: 'POST' });
  return parseJsonResponse(res, 'Xóa phiên Flow');
}

// ── Job Polling ───────────────────────────────────────────────────────────────

export async function getFlowJobStatus(jobId: string): Promise<FlowJobStatus> {
  const res = await fetch(getFlowApiUrl(`/job/${jobId}`));
  return parseJsonResponse<FlowJobStatus>(res, `Kiểm tra trạng thái job ${jobId}`);
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

  const res = await fetch(getFlowApiUrl('/generate-image'), {
    method: 'POST',
    body: formData,
  });

  const data = await parseJsonResponse<{ job_id: string }>(res, 'Tạo ảnh qua Google Flow');
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

  const res = await fetch(getFlowApiUrl('/generate-video'), {
    method: 'POST',
    body: formData,
  });

  const data = await parseJsonResponse<{ job_id: string }>(res, 'Tạo video qua Google Flow');
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
  try {
    const res = await fetch(getFlowApiUrl('/enhance-prompt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode }),
    });

    const data = await parseJsonResponse<{ enhanced_prompt?: string }>(res, 'Tối ưu prompt');
    return data.enhanced_prompt || prompt;
  } catch {
    return prompt;
  }
}

// ── Backend Health Check ──────────────────────────────────────────────────────

export async function isFlowBackendAvailable(): Promise<boolean> {
  try {
    const res = await fetch(getFlowApiUrl('/health'), { signal: AbortSignal.timeout(3000) });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return false;
    }
    return true;
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

/**
 * Bản đồ chuyển tiếp tự động từ mô hình Google Flow sang mô hình Cloud Gemini API tương ứng.
 * Giúp người dùng trên web bình thường (không chạy local python backend) vẫn tạo ảnh/video mượt mà!
 */
export const FLOW_TO_GEMINI_MAP: Record<string, string> = {
  [FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO]: 'gemini-3-pro-image',     // Nano Banana Pro
  [FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2]: 'gemini-3.1-flash-image',   // Nano Banana 2
  [FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2_LITE]: 'gemini-3.1-flash-lite-image', // Nano Banana Lite
  [FLOW_MODEL_IDS.VIDEO_VEO_QUALITY]: 'veo',
  [FLOW_MODEL_IDS.VIDEO_VEO_FAST]: 'veo',
  [FLOW_MODEL_IDS.VIDEO_VEO_LITE]: 'veo',
  [FLOW_MODEL_IDS.VIDEO_OMNI_FLASH]: 'veo',
};
