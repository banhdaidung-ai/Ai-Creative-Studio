/**
 * museService.ts — Muse.ai Integration via muse2api
 *
 * Giao tiếp với dịch vụ Muse2API qua proxy Node server (/api/muse).
 * Hỗ trợ:
 * - Tạo ảnh / chỉnh sửa ảnh (muse-image) theo cơ chế Async Task Polling (v1.5.2+) + Idempotency-Key
 * - Tạo video (muse-video - 5s/6s/8s/10s, Text-to-Video & Image-to-Video)
 * - Chat / Tối ưu hóa Prompt (muse-spark) qua OpenAI-compatible /v1/chat/completions
 */

const MUSE_PROXY_BASE = '/api/muse';

export interface SystemInfoResponse {
  lanIp?: string | null;
  port?: number;
  localUrl?: string;
  networkUrl?: string | null;
  museAdminUrl?: string;
  museProxyAdminUrl?: string;
  hasServerGeminiKey?: boolean;
}

// Cached system info & health status (deduplicated across components)
let cachedSystemInfo: SystemInfoResponse | null = null;
let systemInfoPromise: Promise<SystemInfoResponse | null> | null = null;
let cachedMuseAdminUrl: string | null = null;

const MUSE_STATUS_TTL_ONLINE_MS = 30_000;
const MUSE_STATUS_TTL_OFFLINE_MS = 15_000;
let cachedMuseStatus: { value: MuseReadyStatus; checkedAt: number } | null = null;
let inFlightMuseCheck: Promise<MuseReadyStatus> | null = null;

// ── Model IDs ─────────────────────────────────────────────────────────────────
export const MUSE_MODEL_IDS = {
  IMAGE: 'muse-image',
  VIDEO: 'muse-video',
  SPARK: 'muse-spark',
} as const;

export const MUSE_MODEL_OPTIONS = [
  {
    id: MUSE_MODEL_IDS.IMAGE,
    name: '🎨 Muse Image (muse.ai)',
    desc: 'Tạo ảnh và chỉnh sửa ảnh thông minh từ ảnh tham chiếu, hỗ trợ nhiều tỉ lệ.',
    tier: 'muse' as const,
    type: 'image' as const,
  },
  {
    id: MUSE_MODEL_IDS.VIDEO,
    name: '🎬 Muse Video (muse.ai)',
    desc: 'Tạo video điện ảnh chất lượng cao 5s - 10s (Text-to-Video & Image-to-Video).',
    tier: 'muse' as const,
    type: 'video' as const,
  },
  {
    id: MUSE_MODEL_IDS.SPARK,
    name: '💬 Muse Spark (muse.ai)',
    desc: 'Mô hình ngôn ngữ đàm thoại, viết và tối ưu hóa Prompt đa phong cách.',
    tier: 'muse' as const,
    type: 'chat' as const,
  },
];

export function isMuseModel(modelId?: string): boolean {
  if (!modelId) return false;
  return (
    modelId === MUSE_MODEL_IDS.IMAGE ||
    modelId === MUSE_MODEL_IDS.VIDEO ||
    modelId === MUSE_MODEL_IDS.SPARK ||
    modelId.startsWith('muse-')
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MuseTaskStatus {
  id: string;
  task_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'succeeded';
  progress?: number;
  url?: string;
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  video?: { url: string };
  result?: { url: string; filename?: string; bytes?: number; kind?: string };
  error?: string;
  elapsed?: number;
}

export interface MuseReadyStatus {
  status: string; // 'ready' | 'no_account' | 'offline'
  accounts: number;
  browser_running: boolean;
  available: boolean;
}

export interface MuseImageOptions {
  prompt: string;
  aspectRatio?: string; // "1:1", "16:9", "9:16", "4:3", "3:4"
  referenceImage?: string; // Data URL hoặc HTTP URL
  model?: string;
}

export interface MuseVideoOptions {
  prompt: string;
  duration?: number; // 5, 6, 8, 10
  aspectRatio?: string; // "16:9", "9:16"
  referenceImage?: string; // Data URL hoặc HTTP URL (cho Image-to-Video)
  model?: string;
}

export interface MuseChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MuseCreativePrompt {
  title_vn: string;
  title_en: string;
  description_vn: string;
  prompt_en: string;
  prompt_vn: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMuseApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${MUSE_PROXY_BASE}${cleanEndpoint}`;
}

function getDefaultMuseAdminUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:18610/admin';
  return `${window.location.protocol}//${window.location.hostname}:18610/admin`;
}

export async function fetchSystemInfo(): Promise<SystemInfoResponse | null> {
  if (cachedSystemInfo) return cachedSystemInfo;
  if (!systemInfoPromise) {
    systemInfoPromise = fetch('/api/system/info', {
      signal: AbortSignal.timeout(2000),
      cache: 'no-cache',
    })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return null;
        return (await res.json()) as SystemInfoResponse;
      })
      .then((info) => {
        if (info) {
          cachedSystemInfo = info;
          if (info.museAdminUrl) {
            cachedMuseAdminUrl = info.museAdminUrl;
          }
        }
        return info;
      })
      .catch(() => null)
      .finally(() => {
        if (!cachedSystemInfo) {
          // Cho phép thử lại sau nếu lần đầu fail tạm thời, nhưng không spam liên tục
          setTimeout(() => {
            systemInfoPromise = null;
          }, 15_000);
        }
      });
  }
  return systemInfoPromise;
}

export async function fetchMuseAdminUrl(): Promise<string> {
  if (cachedMuseAdminUrl) return cachedMuseAdminUrl;
  const info = await fetchSystemInfo();
  const url = info?.museAdminUrl || getDefaultMuseAdminUrl();
  cachedMuseAdminUrl = url;
  return url;
}

export function getMuseAdminUrl(): string {
  return cachedMuseAdminUrl || getDefaultMuseAdminUrl();
}

function normalizeMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith('/v1/media/')) {
    return `${MUSE_PROXY_BASE}${rawUrl}`;
  }
  if (rawUrl.includes(':18610/v1/media/')) {
    const filename = rawUrl.split('/v1/media/')[1];
    return `${MUSE_PROXY_BASE}/v1/media/${filename}`;
  }
  return rawUrl;
}

function formatMuseError(message: string, fallback: string): Error {
  if (message.includes('没有可用账号') || message.toLowerCase().includes('no available account')) {
    return new Error(
      'Chưa có tài khoản Muse khả dụng. Vui lòng mở trang Quản lý Cookie Muse để nhập cookie tài khoản muse.ai.'
    );
  }
  return new Error(`${fallback}: ${message}`);
}

function generateIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

// ── Status & Health (Cached + Deduplicated) ───────────────────────────────────

export function invalidateMuseStatusCache(): void {
  cachedMuseStatus = null;
}

export async function isMuseBackendAvailable(): Promise<boolean> {
  const st = await getMuseReadyStatus();
  return st.available;
}

export async function getMuseReadyStatus(forceRefresh = false): Promise<MuseReadyStatus> {
  if (!forceRefresh && cachedMuseStatus) {
    const ttl = cachedMuseStatus.value.available ? MUSE_STATUS_TTL_ONLINE_MS : MUSE_STATUS_TTL_OFFLINE_MS;
    if (Date.now() - cachedMuseStatus.checkedAt < ttl) {
      return cachedMuseStatus.value;
    }
  }

  if (!forceRefresh && inFlightMuseCheck) {
    return inFlightMuseCheck;
  }

  const runCheck = async (): Promise<MuseReadyStatus> => {
    const offline: MuseReadyStatus = { status: 'offline', accounts: 0, browser_running: false, available: false };
    try {
      const res = await fetch(getMuseApiUrl('/readyz'), {
        signal: AbortSignal.timeout(1800),
        cache: 'no-cache',
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        cachedMuseStatus = { value: offline, checkedAt: Date.now() };
        return offline;
      }
      const data = await res.json();
      const result: MuseReadyStatus = {
        status: data.status || 'unknown',
        accounts: data.accounts || 0,
        browser_running: !!data.browser_running,
        available: true,
      };
      cachedMuseStatus = { value: result, checkedAt: Date.now() };
      return result;
    } catch {
      cachedMuseStatus = { value: offline, checkedAt: Date.now() };
      return offline;
    }
  };

  inFlightMuseCheck = runCheck().finally(() => {
    inFlightMuseCheck = null;
  });

  return inFlightMuseCheck;
}

// ── Image Generation (Async Task Polling with Sync Fallback) ──────────────────

async function pollMuseImageTask(
  taskId: string,
  onProgress?: (progress: number, message: string) => void,
  intervalMs = 2500,
  timeoutMs = 300000
): Promise<string> {
  const startTime = Date.now();
  let transientErrors = 0;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(getMuseApiUrl(`/v1/images/tasks/${taskId}`), {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      transientErrors = 0;
      const task: MuseTaskStatus = await res.json();

      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const prog = task.progress || Math.min(92, 20 + elapsedSec * 2);
      const msg =
        task.status === 'processing'
          ? `Muse đang tổng hợp ảnh (${prog}%)...`
          : task.status === 'queued'
          ? 'Tác vụ ảnh đang xếp hàng trên Muse...'
          : 'Đang hoàn thiện...';

      if (onProgress) onProgress(prog, msg);

      if (task.status === 'completed' || task.status === 'succeeded') {
        const rawUrl = task.data?.[0]?.url || task.url || task.result?.url;
        if (rawUrl) {
          if (onProgress) onProgress(100, 'Hoàn thành!');
          return normalizeMediaUrl(rawUrl);
        }
        throw new Error('Muse hoàn thành nhưng không trả về URL ảnh.');
      }

      if (task.status === 'failed') {
        throw formatMuseError(task.error || 'Lỗi không xác định', 'Muse tạo ảnh thất bại');
      }
    } catch (err: any) {
      // Chỉ retry khi lỗi mạng tạm thời; lỗi nghiệp vụ thì ném thẳng
      if (err.message?.includes('Muse') || err.message?.includes('tài khoản')) {
        throw err;
      }
      transientErrors++;
      if (transientErrors >= 5) {
        throw new Error(`Mất kết nối khi kiểm tra tiến độ ảnh Muse: ${err.message}`, { cause: err });
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('Muse tạo ảnh quá thời gian cho phép (timeout 5 phút).');
}

export async function generateImageViaMuse(
  options: MuseImageOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  if (onProgress) {
    onProgress(10, 'Đang gửi yêu cầu tạo ảnh tới Muse...');
  }

  const payload: Record<string, any> = {
    model: options.model || MUSE_MODEL_IDS.IMAGE,
    prompt: options.prompt,
    size: options.aspectRatio || '1:1',
    aspect_ratio: options.aspectRatio || '1:1',
    response_format: 'url',
  };

  if (options.referenceImage) {
    payload.reference_image = options.referenceImage;
  }

  // Ưu tiên cơ chế Async Task Polling (v1.5.2+) để tránh timeout proxy/trình duyệt
  const taskRes = await fetch(getMuseApiUrl('/v1/images/tasks'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': generateIdempotencyKey('img'),
    },
    body: JSON.stringify(payload),
  });

  if (taskRes.ok) {
    const taskJson = await taskRes.json();
    const taskId = taskJson.id || taskJson.task_id;
    if (taskId) {
      if (onProgress) onProgress(20, 'Tác vụ ảnh đã vào hàng đợi Muse...');
      return await pollMuseImageTask(taskId, onProgress);
    }
  } else if (taskRes.status !== 404 && taskRes.status !== 405) {
    const errData = await taskRes.json().catch(() => ({}));
    const message = errData?.error?.message || errData?.detail || `HTTP ${taskRes.status}`;
    throw formatMuseError(message, 'Muse tạo ảnh thất bại');
  }

  // Fallback đồng bộ nếu server Muse bản cũ chưa có /v1/images/tasks
  if (onProgress) {
    onProgress(35, 'Muse đang tổng hợp ánh sáng và chi tiết...');
  }

  const res = await fetch(getMuseApiUrl('/v1/images/generations'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || errData?.detail || `HTTP ${res.status}`;
    throw formatMuseError(message, 'Muse tạo ảnh thất bại');
  }

  const json = await res.json();
  const rawUrl = json.data?.[0]?.url;
  if (!rawUrl) {
    throw new Error('Muse không trả về URL hình ảnh.');
  }

  if (onProgress) {
    onProgress(100, 'Hoàn thành!');
  }

  return normalizeMediaUrl(rawUrl);
}

// ── Video Generation ──────────────────────────────────────────────────────────

export async function submitMuseVideoTask(options: MuseVideoOptions): Promise<string> {
  const payload: Record<string, any> = {
    model: options.model || MUSE_MODEL_IDS.VIDEO,
    prompt: options.prompt,
    duration: options.duration || 5,
    size: options.aspectRatio || '16:9',
  };

  if (options.referenceImage) {
    payload.reference_image = options.referenceImage;
  }

  const res = await fetch(getMuseApiUrl('/v1/videos'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || errData?.detail || `HTTP ${res.status}`;
    throw formatMuseError(message, 'Khởi tạo tác vụ video thất bại');
  }

  const json = await res.json();
  const taskId = json.id || json.task_id;
  if (!taskId) {
    throw new Error('Muse không trả về mã tác vụ (task_id).');
  }

  return taskId;
}

export async function getMuseVideoTaskStatus(taskId: string): Promise<MuseTaskStatus> {
  const res = await fetch(getMuseApiUrl(`/v1/videos/${taskId}`), {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Kiểm tra tiến độ video thất bại (HTTP ${res.status})`);
  }

  return await res.json();
}

export async function pollMuseVideo(
  taskId: string,
  onProgress?: (progress: number, message: string) => void,
  intervalMs = 2500,
  timeoutMs = 600000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const task = await getMuseVideoTaskStatus(taskId);

    const prog = task.progress || 10;
    const msg =
      task.status === 'processing'
        ? `Muse đang render video (${prog}%)...`
        : task.status === 'queued'
        ? 'Tác vụ đang trong hàng đợi của Muse...'
        : 'Đang xử lý...';

    if (onProgress) {
      onProgress(prog, msg);
    }

    if (task.status === 'completed' || task.status === 'succeeded') {
      const finalUrl = task.url || task.result?.url || task.video?.url;
      if (finalUrl) {
        return normalizeMediaUrl(finalUrl);
      }
      throw new Error('Tác vụ hoàn thành nhưng không tìm thấy URL video.');
    }

    if (task.status === 'failed') {
      throw new Error(task.error || 'Muse tạo video thất bại.');
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('Muse tạo video quá thời gian cho phép (timeout 10 phút).');
}

export async function generateVideoViaMuse(
  options: MuseVideoOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  if (onProgress) {
    onProgress(5, 'Đang gửi tác vụ tạo video tới Muse...');
  }

  const taskId = await submitMuseVideoTask(options);

  if (onProgress) {
    onProgress(15, 'Tác vụ đã được tạo, bắt đầu render...');
  }

  return await pollMuseVideo(taskId, onProgress);
}

// ── Chat / Prompt Generation via Muse Spark ───────────────────────────────────

export async function chatViaMuseSpark(
  messages: MuseChatMessage[],
  temperature = 0.7
): Promise<string> {
  const res = await fetch(getMuseApiUrl('/v1/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MUSE_MODEL_IDS.SPARK,
      messages,
      temperature,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || errData?.detail || `HTTP ${res.status}`;
    throw formatMuseError(message, 'Muse Spark phản hồi lỗi');
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Muse Spark không trả về nội dung.');
  }
  return content;
}

export async function generateCreativePromptsViaMuse(
  ideaDescription: string
): Promise<MuseCreativePrompt[]> {
  const systemPrompt =
    'Bạn là Giám đốc Sáng tạo Thời trang (Fashion Creative Director) chuyên viết Prompt AI tạo ảnh chuyên nghiệp. ' +
    'Hãy trả về DUY NHẤT một mảng JSON hợp lệ gồm 3 phương án prompt sáng tạo (không kèm giải thích ngoài JSON). ' +
    'Mỗi phần tử có đúng 5 khóa: "title_vn", "title_en", "description_vn", "prompt_en", "prompt_vn".';

  const rawText = await chatViaMuseSpark([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Tạo 3 ý tưởng prompt nhiếp ảnh thời trang cao cấp từ mô tả sau: "${ideaDescription}"`,
    },
  ]);

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          title_vn: item.title_vn || 'Phong cách Muse Spark',
          title_en: item.title_en || 'Muse Spark Concept',
          description_vn: item.description_vn || 'Gợi ý sáng tạo từ Muse Spark.',
          prompt_en: item.prompt_en || rawText,
          prompt_vn: item.prompt_vn || ideaDescription,
        }));
      }
    } catch {
      // Fallback below
    }
  }

  return [
    {
      title_vn: 'Phong cách Muse Spark (Tối ưu tự động)',
      title_en: 'Muse Spark Studio Concept',
      description_vn: 'Prompt chi tiết do Muse Spark biên soạn.',
      prompt_en: rawText.trim(),
      prompt_vn: ideaDescription,
    },
  ];
}
