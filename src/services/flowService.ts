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
  modelImageBase64?: string;
  modelImageMime?: string;
  referenceImagesBase64?: string[];
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

/**
 * Chuyển đổi an toàn từ data URI, base64 thô hoặc URL sang đối tượng File.
 * Không bị crash khi gặp chuỗi có chứa ký tự đặc biệt, URL ảnh mẫu hoặc định dạng khác.
 */
async function safeImageToFile(imageInput: string, mime = 'image/jpeg', filename = 'reference.jpg'): Promise<File> {
  const trimmed = imageInput.trim();

  // 1. Nếu là URL (http, https, blob hoặc relative path web)
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('/9j/'))
  ) {
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      return new File([blob], filename, { type: blob.type || mime });
    } catch (e) {
      console.warn('Cannot fetch image URL, attempting fallback:', e);
    }
  }

  // 2. Tách MIME và data từ prefix data: nếu có
  let detectedMime = mime;
  let rawBase64 = trimmed;
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1];
      rawBase64 = match[2];
    } else {
      rawBase64 = trimmed.split(',')[1] || '';
    }
  }

  // 3. Chuẩn hóa chuỗi base64 (loại bỏ khoảng trắng, xuống dòng)
  rawBase64 = rawBase64.replace(/\s+/g, '');
  while (rawBase64.length % 4 !== 0) {
    rawBase64 += '=';
  }

  try {
    const byteString = atob(rawBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new File([ab], filename, { type: detectedMime });
  } catch (err) {
    console.warn('safeImageToFile conversion fallback:', err);
    return new File([], filename, { type: detectedMime });
  }
}

// ── URL & Host Detection ──────────────────────────────────────────────────────

let detectedWorkingBase: string | null = null;

export function setDetectedWorkingBase(url: string | null) {
  detectedWorkingBase = url;
}

export function isLanOrLocalHostname(hostname?: string): boolean {
  if (!hostname) return true;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
  );
}

/**
 * Thêm cờ targetAddressSpace: 'loopback' theo chuẩn Chromium Local Network Access
 * khi trang web chạy trên HTTPS public (ví dụ *.web.app) gọi về 127.0.0.1 / localhost.
 */
function withLoopbackInit(url: string, init: RequestInit = {}): RequestInit {
  if (typeof window !== 'undefined' && !isLanOrLocalHostname(window.location.hostname)) {
    if (url.includes('127.0.0.1') || url.includes('localhost')) {
      return { ...init, targetAddressSpace: 'loopback' } as RequestInit;
    }
  }
  return init;
}

export function buildFlowUnavailableMessage(): string {
  const isLocal = typeof window === 'undefined' || isLanOrLocalHostname(window.location.hostname);
  if (!isLocal) {
    return (
      'FLOW_BACKEND_UNAVAILABLE: Trang web online chưa kết nối được tới Google Flow Backend. ' +
      'Để dùng Google Flow: (1) Nếu đang dùng trên máy Mac chạy backend, hãy mở bản Local tại http://localhost:3000 hoặc bật quyền "Local network access = Allow" trên biểu tượng ổ khóa thanh địa chỉ Chrome; ' +
      '(2) Hoặc nhập URL Cloud Run / Tunnel trong Cấu hình Google Flow; ' +
      '(3) Hoặc nhập Gemini API Key để tạo ảnh trực tiếp trên web.'
    );
  }
  return (
    'FLOW_BACKEND_UNAVAILABLE: Google Flow Backend chưa chạy trên máy (cổng 8000). ' +
    'Vui lòng bấm nút "💻 Bật Local Backend" bên dưới, chạy `npm run dev`, hoặc nhập Gemini API Key.'
  );
}

export function getFlowApiUrl(endpoint: string): string {
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('flow_backend_url')?.trim() : undefined;
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FLOW_BACKEND_URL ? import.meta.env.VITE_FLOW_BACKEND_URL : undefined;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  let targetBase = customUrl || envUrl || detectedWorkingBase;

  // Nếu không cấu hình thủ công:
  // - Khi truy cập qua localhost hoặc mạng LAN (máy khác trong cùng Wi-Fi truy cập IP 192.168.x.x:3000):
  //   DÙNG PROXY CHUẨN FLOW_PROXY_BASE (/api/flow)!
  //   Vì máy chủ Node/Vite trên Mac đã có sẵn reverse proxy sang port 8000.
  //   TUYỆT ĐỐI KHÔNG ép targetBase = 127.0.0.1:8000 ở đây vì máy khác sẽ tự gọi localhost của chính nó và thất bại!
  // - Chỉ khi chạy trên môi trường hosting public từ xa (Firebase Hosting / Vercel, tức hostname không phải LAN):
  //   Nếu người dùng đang mở trên chính máy Mac có chạy python backend, thử gán 'http://127.0.0.1:8000'.
  if (!targetBase && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (!isLanOrLocalHostname(hostname)) {
      targetBase = 'http://127.0.0.1:8000';
    }
  }

  if (targetBase) {
    const base = targetBase.replace(/\/+$/, '');
    if (cleanEndpoint === '/health' || cleanEndpoint === '/api/health') {
      return `${base}/health`;
    }
    return `${base}/api${cleanEndpoint.replace(/^\/api/, '')}`;
  }

  return `${FLOW_PROXY_BASE}${cleanEndpoint}`;
}

/**
 * Tự động kiểm tra và khởi động Google Flow Local Backend nếu chưa chạy.
 */
export async function ensureFlowBackendReady(
  onProgress?: (progress: number, message: string) => void
): Promise<boolean> {
  let isReady = await isFlowBackendAvailable();
  if (isReady) return true;

  // Chỉ gọi /api/start-flow-backend khi đang chạy ở môi trường Local/LAN có Node server
  if (typeof window !== 'undefined' && isLanOrLocalHostname(window.location.hostname)) {
    try {
      if (onProgress) {
        onProgress(8, 'Đang tự động khởi động Google Flow Backend...');
      }
      await fetch('/api/start-flow-backend', { method: 'POST' }).catch(() => null);

      // Chờ tối đa 8 giây để backend khởi động xong
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        isReady = await isFlowBackendAvailable(true);
        if (isReady) {
          if (onProgress) onProgress(12, 'Google Flow Backend đã sẵn sàng!');
          return true;
        }
      }
    } catch {
      // Ignored
    }
  }

  return isReady;
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
  const url = getFlowApiUrl(`/job/${jobId}`);
  const res = await fetch(url, withLoopbackInit(url));
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

  // 1. Ảnh người mẫu chính (nếu có)
  if (options.modelImageBase64) {
    const mime = options.modelImageMime || 'image/jpeg';
    const file = await safeImageToFile(options.modelImageBase64, mime, 'model.jpg');
    if (file && file.size > 0) {
      formData.append('model_image', file);
    }
  }

  // 2. Danh sách ảnh tham chiếu (bối cảnh, chi tiết, trang phục...)
  if (options.referenceImagesBase64 && options.referenceImagesBase64.length > 0) {
    for (let i = 0; i < options.referenceImagesBase64.length; i++) {
      const imgBase64 = options.referenceImagesBase64[i];
      if (imgBase64) {
        const file = await safeImageToFile(imgBase64, 'image/jpeg', `ref_${i}.jpg`);
        if (file && file.size > 0) {
          formData.append('reference_images', file);
        }
      }
    }
  }

  // 3. Fallback đơn ảnh tham chiếu (tương thích ngược)
  if (options.referenceImageBase64) {
    const mime = options.referenceImageMime || 'image/jpeg';
    const file = await safeImageToFile(options.referenceImageBase64, mime, 'reference.jpg');
    if (file && file.size > 0) {
      formData.append('reference_image', file);
    }
  }

  const submitUrl = getFlowApiUrl('/generate-image');
  const res = await fetch(
    submitUrl,
    withLoopbackInit(submitUrl, {
      method: 'POST',
      body: formData,
    })
  );

  const data = await parseJsonResponse<{ job_id: string }>(res, 'Tạo ảnh qua Google Flow');
  return data.job_id;
}

export async function generateImageViaFlow(
  options: FlowGenerateImageOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<string | undefined> {
  if (onProgress) {
    onProgress(5, 'Đang chuẩn bị kết nối Google Flow...');
  }

  // Tự động kiểm tra và bật backend nếu chưa sẵn sàng
  const ready = await ensureFlowBackendReady(onProgress);
  if (!ready) {
    throw new Error(buildFlowUnavailableMessage());
  }

  if (onProgress) {
    onProgress(15, 'Đang gửi yêu cầu tạo ảnh đến server...');
  }

  try {
    const jobId = await submitFlowImageJob(options);

    const status = await pollFlowJob(jobId, onProgress);

    if (status.status === 'completed') {
      if (status.result?.images && status.result.images.length > 0) {
        return status.result.images[0].url;
      }
      if (status.images && status.images.length > 0) {
        return status.images[0].url;
      }
      if (status.image_url) return status.image_url;
    }

    throw new Error(status.error || 'Server không trả về URL ảnh hợp lệ.');
  } catch (err: any) {
    console.warn('Backend flow fail', err);
    const msg = err.message || '';
    if (msg.includes('thất bại') || msg.includes('Google Flow Backend chưa khả dụng') || msg.includes('FLOW_BACKEND_UNAVAILABLE')) {
      throw err;
    }
    throw new Error(err.message || 'Lỗi khi tạo ảnh qua Google Flow.', { cause: err });
  }
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
    const file = await safeImageToFile(options.referenceImageBase64, mime, 'reference.jpg');
    if (file && file.size > 0) {
      formData.append('reference_image', file);
    }
  }

  const submitUrl = getFlowApiUrl('/generate-video');
  const res = await fetch(
    submitUrl,
    withLoopbackInit(submitUrl, {
      method: 'POST',
      body: formData,
    })
  );

  const data = await parseJsonResponse<{ job_id: string }>(res, 'Tạo video qua Google Flow');
  return data.job_id;
}

export async function generateVideoViaFlow(
  options: FlowGenerateVideoOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<string | undefined> {
  if (onProgress) {
    onProgress(5, 'Đang chuẩn bị kết nối Google Flow...');
  }

  const ready = await ensureFlowBackendReady(onProgress);
  if (!ready) {
    throw new Error(buildFlowUnavailableMessage());
  }

  if (onProgress) {
    onProgress(15, 'Đang gửi yêu cầu tạo video đến server...');
  }

  try {
    const jobId = await submitFlowVideoJob(options);

    const status = await pollFlowJob(jobId, onProgress);

    if (status.status === 'completed') {
      if (status.result?.video_url) return status.result.video_url;
      if (status.video_url) return status.video_url;
      if (status.image_url) return status.image_url;
    }

    throw new Error(status.error || 'Server không trả về URL video hợp lệ.');
  } catch (err: any) {
    console.warn('Backend flow fail', err);
    const msg = err.message || '';
    if (msg.includes('thất bại') || msg.includes('Google Flow Backend chưa khả dụng') || msg.includes('FLOW_BACKEND_UNAVAILABLE')) {
      throw err;
    }
    throw new Error(err.message || 'Lỗi khi tạo video qua Google Flow.', { cause: err });
  }
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

// ── Backend Health Check (Cached + Deduplicated + Parallel) ──────────────────

const FLOW_HEALTH_TTL_ONLINE_MS = 30_000;
const FLOW_HEALTH_TTL_OFFLINE_MS = 15_000;

let cachedFlowStatus: { available: boolean; checkedAt: number } | null = null;
let inFlightFlowCheck: Promise<boolean> | null = null;

export function invalidateFlowHealthCache(): void {
  cachedFlowStatus = null;
  detectedWorkingBase = null;
}

async function probeFlowHealthUrl(url: string, timeoutMs: number): Promise<boolean> {
  const res = await fetch(url, withLoopbackInit(url, { signal: AbortSignal.timeout(timeoutMs) }));
  const contentType = res.headers.get('content-type') || '';
  if (res.ok && contentType.includes('application/json')) {
    const data = await res.json().catch(() => null);
    if (data?.status === 'ok') return true;
  }
  throw new Error('not-ok');
}

export async function isFlowBackendAvailable(forceRefresh = false): Promise<boolean> {
  if (!forceRefresh && cachedFlowStatus) {
    const ttl = cachedFlowStatus.available ? FLOW_HEALTH_TTL_ONLINE_MS : FLOW_HEALTH_TTL_OFFLINE_MS;
    if (Date.now() - cachedFlowStatus.checkedAt < ttl) {
      return cachedFlowStatus.available;
    }
  }

  if (!forceRefresh && inFlightFlowCheck) {
    return inFlightFlowCheck;
  }

  const runCheck = async (): Promise<boolean> => {
    const primaryUrl = getFlowApiUrl('/health');

    // 1. Thử URL chính nhanh trước (1.5s timeout)
    try {
      await probeFlowHealthUrl(primaryUrl, 1500);
      cachedFlowStatus = { available: true, checkedAt: Date.now() };
      return true;
    } catch {
      // Tiếp tục thử fallback song song nếu ở local/LAN
    }

    // 2. Fallback song song (chỉ chạy thêm khi có ứng viên khác primaryUrl)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalOrLan = isLanOrLocalHostname(hostname);
      const candidates: string[] = [];

      if (isLocalOrLan) {
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          candidates.push(`http://${hostname}:8000`);
        }
        candidates.push('http://127.0.0.1:8000');
      } else if (!primaryUrl.startsWith('http://127.0.0.1:8000')) {
        candidates.push('http://127.0.0.1:8000');
      }

      const uniqueCandidates = candidates.filter((base) => `${base}/health` !== primaryUrl);
      if (uniqueCandidates.length > 0) {
        try {
          const workingBase = await Promise.any(
            uniqueCandidates.map(async (base) => {
              await probeFlowHealthUrl(`${base}/health`, 1200);
              return base;
            })
          );
          detectedWorkingBase = workingBase;
          cachedFlowStatus = { available: true, checkedAt: Date.now() };
          return true;
        } catch {
          // Tất cả ứng viên đều không phản hồi
        }
      }
    }

    cachedFlowStatus = { available: false, checkedAt: Date.now() };
    return false;
  };

  inFlightFlowCheck = runCheck().finally(() => {
    inFlightFlowCheck = null;
  });

  return inFlightFlowCheck;
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
