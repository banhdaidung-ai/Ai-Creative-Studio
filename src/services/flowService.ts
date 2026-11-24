/**
 * flowService.ts — Google Flow Integration
 *
 * Giao tiếp với Python FastAPI backend (flow-backend) qua proxy Node server.
 * Hỗ trợ tạo ảnh (Nano Banana Pro) và video (Veo) không cần API key,
 * sử dụng tài khoản Google Flow của người dùng.
 */

import { auth } from '../lib/firebase';

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
  thinkingLevel?: 'low' | 'medium' | 'high';
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
  mode?: 'standard' | 'interpolation' | 'ingredients';
  resolution?: '360p' | '720p';
  referenceImageBase64?: string;
  referenceImageMime?: string;
  endFrameBase64?: string;
  endFrameMime?: string;
  referenceImagesBase64?: string[];
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

export function getDefaultCloudFlowUrl(): string {
  return typeof import.meta !== 'undefined' && import.meta.env
    ? String((import.meta.env as Record<string, any>).VITE_FLOW_BACKEND_URL || '').trim()
    : '';
}

export function getFlowAccessToken(): string {
  const localToken =
    typeof window !== 'undefined' ? localStorage.getItem('flow_access_token')?.trim() : '';
  const envToken =
    typeof import.meta !== 'undefined' && import.meta.env
      ? String((import.meta.env as Record<string, any>).VITE_FLOW_ACCESS_TOKEN || '').trim()
      : '';
  return localToken || envToken || '';
}

async function getFirebaseIdToken(): Promise<string> {
  try {
    if (!auth.currentUser && typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    const currentUser = auth.currentUser;
    if (!currentUser) return '';
    const token = await currentUser.getIdToken();
    return token && token !== 'demo-token' ? token : '';
  } catch {
    return '';
  }
}

async function buildFlowRequestInit(url: string, init: RequestInit = {}): Promise<RequestInit> {
  const baseInit = withLoopbackInit(url, init);
  const accessToken = getFlowAccessToken();
  const firebaseToken = await getFirebaseIdToken();

  if (!accessToken && !firebaseToken) {
    return baseInit;
  }

  const headers = new Headers(baseInit.headers || {});
  if (accessToken && !headers.has('X-Flow-Token')) {
    headers.set('X-Flow-Token', accessToken);
  }
  if (firebaseToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${firebaseToken}`);
  }
  return {
    ...baseInit,
    headers,
  };
}

export function buildFlowUnavailableMessage(): string {
  const isLocal = typeof window === 'undefined' || isLanOrLocalHostname(window.location.hostname);
  if (!isLocal) {
    return (
      'FLOW_BACKEND_UNAVAILABLE: Trang web online chưa kết nối được tới Google Flow Backend. ' +
      'Để dùng Google Flow: (1) Vui lòng Đăng nhập Google trên web để tự động kết nối máy chủ Cloud 24/7; ' +
      '(2) Hoặc nhập URL + Access Token thủ công trong Cấu hình Google Flow; ' +
      '(3) Hoặc nhập Gemini API Key để tạo ảnh trực tiếp.'
    );
  }
  return (
    'FLOW_BACKEND_UNAVAILABLE: Google Flow Backend chưa chạy trên máy (cổng 8000). ' +
    'Vui lòng bấm nút "💻 Bật Local Backend" bên dưới, chạy `npm run dev`, hoặc nhập Gemini API Key.'
  );
}

export function getFlowApiUrl(endpoint: string): string {
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('flow_backend_url')?.trim() : undefined;
  const envUrl = getDefaultCloudFlowUrl() || undefined;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const isLocalOrLan = typeof window === 'undefined' || isLanOrLocalHostname(window.location.hostname);
  let targetBase = isLocalOrLan
    ? (customUrl || detectedWorkingBase)
    : (customUrl || envUrl || detectedWorkingBase);

  // Chỉ tự thử http://127.0.0.1:8000 khi chạy web public mà chưa có envUrl / customUrl
  if (!targetBase && !isLocalOrLan) {
    targetBase = 'http://127.0.0.1:8000';
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
    if (res.status === 401) {
      if (!auth.currentUser && !getFlowAccessToken()) {
        throw new Error(
          'FLOW_UNAUTHORIZED: Vui lòng Đăng nhập Google để tự động kết nối Google Flow 24/7 miễn phí (chế độ Khách không hỗ trợ Cloud Flow).'
        );
      }
      throw new Error(
        'FLOW_UNAUTHORIZED: Phiên Đăng nhập Google đã hết hạn hoặc Mã bảo mật chưa đúng. Vui lòng đăng nhập lại hoặc kiểm tra trong Cấu hình Google Flow.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        'FLOW_FORBIDDEN: Tài khoản Google của bạn chưa được cấp quyền sử dụng máy chủ Google Flow này.'
      );
    }
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}: ${res.statusText}` }));
    throw new Error(err.detail || err.error || `${endpointDesc} thất bại (HTTP ${res.status})`);
  }

  return await res.json();
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function checkFlowSession(): Promise<FlowSessionStatus> {
  const url = getFlowApiUrl('/session-status');
  const res = await fetch(url, await buildFlowRequestInit(url));
  return parseJsonResponse<FlowSessionStatus>(res, 'Kiểm tra phiên đăng nhập Flow');
}

export async function clearFlowSession(): Promise<void> {
  const url = getFlowApiUrl('/clear-session');
  const res = await fetch(url, await buildFlowRequestInit(url, { method: 'POST' }));
  return parseJsonResponse(res, 'Xóa phiên Flow');
}

// ── Job Polling ───────────────────────────────────────────────────────────────

export async function getFlowJobStatus(jobId: string): Promise<FlowJobStatus> {
  const url = getFlowApiUrl(`/job/${jobId}`);
  const res = await fetch(url, await buildFlowRequestInit(url));
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
  if (options.thinkingLevel) {
    formData.append('thinking_level', options.thinkingLevel);
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
    await buildFlowRequestInit(submitUrl, {
      method: 'POST',
      body: formData,
    })
  );

  const data = await parseJsonResponse<{ job_id: string }>(res, 'Tạo ảnh qua Google Flow');
  return data.job_id;
}

export async function generateImagesBatchViaFlow(
  options: FlowGenerateImageOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<string[]> {
  if (onProgress) {
    onProgress(5, 'Đang chuẩn bị kết nối Google Flow...');
  }

  const ready = await ensureFlowBackendReady(onProgress);
  if (!ready) {
    throw new Error(buildFlowUnavailableMessage());
  }

  if (onProgress) {
    onProgress(15, `Đang gửi yêu cầu tạo ${options.numImages || 1} phương án đến Google Flow...`);
  }

  const jobId = await submitFlowImageJob(options);
  const status = await pollFlowJob(jobId, onProgress);

  if (status.status === 'completed') {
    if (status.result?.images && status.result.images.length > 0) {
      return status.result.images.map((i) => i.url).filter(Boolean);
    }
    if (status.images && status.images.length > 0) {
      return status.images.map((i) => i.url).filter(Boolean);
    }
    if (status.image_url) return [status.image_url];
  }

  throw new Error(status.error || 'Server không trả về URL ảnh hợp lệ.');
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
    if (
      msg.includes('thất bại') ||
      msg.includes('Google Flow Backend chưa khả dụng') ||
      msg.includes('FLOW_BACKEND_UNAVAILABLE') ||
      msg.includes('FLOW_UNAUTHORIZED') ||
      msg.includes('FLOW_FORBIDDEN')
    ) {
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
  formData.append('duration', String(options.duration || 8));
  if (options.model) {
    formData.append('model', options.model);
  }
  if (options.mode) {
    formData.append('video_mode', options.mode);
  }
  if (options.resolution) {
    formData.append('resolution', options.resolution);
  }

  if (options.referenceImageBase64) {
    const mime = options.referenceImageMime || 'image/jpeg';
    const file = await safeImageToFile(options.referenceImageBase64, mime, 'reference.jpg');
    if (file && file.size > 0) {
      formData.append('reference_image', file);
    }
  }

  if (options.endFrameBase64) {
    const mime = options.endFrameMime || 'image/jpeg';
    const file = await safeImageToFile(options.endFrameBase64, mime, 'end_frame.jpg');
    if (file && file.size > 0) {
      formData.append('end_frame_image', file);
    }
  }

  if (options.referenceImagesBase64 && options.referenceImagesBase64.length > 0) {
    for (let i = 0; i < options.referenceImagesBase64.slice(0, 6).length; i++) {
      const imgBase64 = options.referenceImagesBase64[i];
      if (imgBase64) {
        const file = await safeImageToFile(imgBase64, 'image/jpeg', `ingredient_${i}.jpg`);
        if (file && file.size > 0) {
          formData.append('reference_images', file);
        }
      }
    }
  }

  const submitUrl = getFlowApiUrl('/generate-video');
  const res = await fetch(
    submitUrl,
    await buildFlowRequestInit(submitUrl, {
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
    if (
      msg.includes('thất bại') ||
      msg.includes('Google Flow Backend chưa khả dụng') ||
      msg.includes('FLOW_BACKEND_UNAVAILABLE') ||
      msg.includes('FLOW_UNAUTHORIZED') ||
      msg.includes('FLOW_FORBIDDEN')
    ) {
      throw err;
    }
    throw new Error(err.message || 'Lỗi khi tạo video qua Google Flow.', { cause: err });
  }
}

// ── Prompt Enhancement ────────────────────────────────────────────────────────

export async function enhancePromptViaFlow(prompt: string, mode: 'image' | 'video' = 'image'): Promise<string> {
  try {
    const url = getFlowApiUrl('/enhance-prompt');
    const res = await fetch(
      url,
      await buildFlowRequestInit(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      })
    );

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
    const primaryTimeoutMs = primaryUrl.startsWith('https://') ? 4000 : 1500;

    // 1. Thử URL chính nhanh trước (4s cho HTTPS Cloud, 1.5s cho Local)
    try {
      await probeFlowHealthUrl(primaryUrl, primaryTimeoutMs);
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

export interface FlowConnectionDiagnostic {
  connected: boolean;
  authRequired: boolean;
  authorized: boolean;
  hasSession: boolean;
  message: string;
}

/**
 * Kiểm tra đầy đủ kết nối, mã bảo mật X-Flow-Token và trạng thái Cookie Google Flow.
 */
export async function verifyFlowBackendConnection(): Promise<FlowConnectionDiagnostic> {
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('flow_backend_url')?.trim() : '';
  const healthUrl = getFlowApiUrl('/health');
  let healthData: { status?: string; session_ready?: boolean; auth_required?: boolean } | null = null;

  try {
    const res = await fetch(healthUrl, withLoopbackInit(healthUrl, { signal: AbortSignal.timeout(4500) }));
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const json = await res.json().catch(() => null);
      if (json?.status === 'ok') {
        healthData = json;
      }
    }
  } catch {
    healthData = null;
  }

  if (!healthData && !customUrl) {
    const localOk = await isFlowBackendAvailable(true);
    if (localOk) {
      try {
        const retryRes = await fetch(
          getFlowApiUrl('/health'),
          withLoopbackInit(getFlowApiUrl('/health'), { signal: AbortSignal.timeout(2500) })
        );
        if (retryRes.ok) {
          healthData = await retryRes.json().catch(() => null);
        }
      } catch {
        // Ignored
      }
    }
  }

  if (!healthData) {
    cachedFlowStatus = { available: false, checkedAt: Date.now() };
    return {
      connected: false,
      authRequired: false,
      authorized: false,
      hasSession: false,
      message: 'Không thể kết nối đến URL Backend này. Vui lòng kiểm tra tên miền HTTPS, Docker trên Oracle Cloud và cổng 80/443.',
    };
  }

  cachedFlowStatus = { available: true, checkedAt: Date.now() };

  const sessionUrl = getFlowApiUrl('/session-status');
  try {
    const sessionRes = await fetch(
      sessionUrl,
      await buildFlowRequestInit(sessionUrl, { signal: AbortSignal.timeout(4500) })
    );
    const googleEmail = auth.currentUser?.email || '';

    if (sessionRes.status === 401) {
      if (!auth.currentUser && !getFlowAccessToken()) {
        return {
          connected: true,
          authRequired: true,
          authorized: false,
          hasSession: Boolean(healthData.session_ready),
          message: 'Đã thấy Server Oracle Cloud! Vui lòng Đăng nhập Google để tự động kết nối (chế độ Khách chưa được cấp quyền).',
        };
      }
      return {
        connected: true,
        authRequired: true,
        authorized: false,
        hasSession: Boolean(healthData.session_ready),
        message: 'Đã thấy Server nhưng Phiên đăng nhập hoặc Mã bảo mật (Access Token) chưa hợp lệ.',
      };
    }
    if (sessionRes.status === 403) {
      return {
        connected: true,
        authRequired: true,
        authorized: false,
        hasSession: Boolean(healthData.session_ready),
        message: `Tài khoản ${googleEmail || 'của bạn'} chưa nằm trong danh sách được phép trên máy chủ Google Flow này.`,
      };
    }
    if (!sessionRes.ok) {
      return {
        connected: true,
        authRequired: Boolean(healthData.auth_required),
        authorized: false,
        hasSession: Boolean(healthData.session_ready),
        message: `Kết nối Server thành công nhưng kiểm tra phiên thất bại (HTTP ${sessionRes.status}).`,
      };
    }

    const sessionJson = await sessionRes.json().catch(() => ({ has_session: healthData?.session_ready }));
    const hasSession = Boolean(sessionJson?.has_session);
    if (!hasSession) {
      return {
        connected: true,
        authRequired: Boolean(healthData.auth_required),
        authorized: true,
        hasSession: false,
        message: 'Đã kết nối & xác thực Oracle Backend thành công, nhưng Server chưa có Cookie Google Flow. Vui lòng chạy sync_session_to_cloud.py trên Mac!',
      };
    }

    return {
      connected: true,
      authRequired: Boolean(healthData.auth_required),
      authorized: true,
      hasSession: true,
      message: googleEmail
        ? `Đã tự động kết nối Google Flow 24/7 bằng tài khoản Google (${googleEmail})!`
        : 'Đã kết nối thành công đến Google Flow Backend (Sẵn sàng tạo ảnh/video 24/7)!',
    };
  } catch {
    return {
      connected: true,
      authRequired: Boolean(healthData.auth_required),
      authorized: !healthData.auth_required,
      hasSession: Boolean(healthData.session_ready),
      message: healthData.auth_required
        ? 'Không thể xác thực Token với Server (kiểm tra cấu hình CORS ALLOWED_ORIGINS).'
        : 'Đã kết nối thành công đến Google Flow Backend!',
    };
  }
}

// ── Model IDs ─────────────────────────────────────────────────────────────────

export const FLOW_MODEL_IDS = {
  // Image Models trên Google Flow (Cập nhật 11/2026)
  IMAGE_NANO_BANANA_PRO: 'google-flow-nano-banana-pro',
  IMAGE_NANO_BANANA_2_1: 'google-flow-nano-banana-2.1',
  IMAGE_NANO_BANANA_2: 'google-flow-nano-banana-2.1', // Backward-compatible alias -> 2.1
  IMAGE_NANO_BANANA_2_LITE: 'google-flow-nano-banana-2-lite',

  // Video Models trên Google Flow (Cập nhật trước đợt đóng model cũ 05/12/2026)
  VIDEO_OMNI_1_2_FLASH: 'google-flow-omni-1.2-flash',
  VIDEO_VEO_LITE: 'google-flow-veo-lite',

  // Legacy Video aliases (Tự động điều hướng an toàn sang Omni 1.2 Flash)
  VIDEO_OMNI_FLASH: 'google-flow-omni-1.2-flash',
  VIDEO_VEO_QUALITY: 'google-flow-omni-1.2-flash',
  VIDEO_VEO_FAST: 'google-flow-omni-1.2-flash',

  // Backward compatibility alias
  IMAGE: 'google-flow-nano-banana-pro',
  VIDEO: 'google-flow-omni-1.2-flash',
} as const;

export type FlowModelId = (typeof FLOW_MODEL_IDS)[keyof typeof FLOW_MODEL_IDS];

export function isFlowModel(modelId?: string): boolean {
  if (!modelId) return false;
  return modelId.startsWith('google-flow-');
}

/**
 * Bản đồ chuyển tiếp tự động từ mô hình Google Flow sang mô hình Cloud Gemini API tương ứng.
 */
export const FLOW_TO_GEMINI_MAP: Record<string, string> = {
  [FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO]: 'gemini-3-pro-image',
  [FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2_1]: 'gemini-nano-banana-2.1',
  'google-flow-nano-banana-2': 'gemini-nano-banana-2.1',
  [FLOW_MODEL_IDS.IMAGE_NANO_BANANA_2_LITE]: 'gemini-3.1-flash-lite-image',
  [FLOW_MODEL_IDS.VIDEO_OMNI_1_2_FLASH]: 'gemini-omni-1.2-flash',
  [FLOW_MODEL_IDS.VIDEO_VEO_LITE]: 'veo-3.1-lite-generate-preview',
  'google-flow-omni-flash': 'gemini-omni-1.2-flash',
  'google-flow-veo-quality': 'gemini-omni-1.2-flash',
  'google-flow-veo-fast': 'gemini-omni-1.2-flash',
};
