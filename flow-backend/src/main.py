"""
AI Creator Studio — FastAPI Backend v2.0
Tương tác Google Flow qua Playwright Automation (không cần API key)
"""

import asyncio
import base64
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# ── Ensure src/ modules are importable ───────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import Google Flow automation module
from google_flow_client import (
    close_browser,
    enhance_prompt_simple,
    generate_image_on_flow,
    generate_video_on_flow,
)
from session_manager import has_valid_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Thư mục lưu media tạm ────────────────────────────────────────────────────
MEDIA_DIR = Path(__file__).parent.parent / "media_cache"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
TEMP_UPLOAD_DIR = Path(__file__).parent.parent / "temp_uploads"
TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ── In-memory job store ───────────────────────────────────────────────────────
job_store: dict[str, dict] = {}


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AI Creator Studio Backend v2.0 khởi động (Google Flow Playwright Mode)")
    logger.info(f"📂 Session đã lưu: {'✅ Có' if has_valid_session() else '❌ Chưa có (cần login lần đầu)'}")
    yield
    logger.info("🛑 Đang tắt server, dọn dẹp browser...")
    await close_browser()


app = FastAPI(
    title="AI Creator Studio API",
    description="Backend tương tác Google Flow qua Playwright — không cần API key",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ai-creative-studio-2026.web.app",
        "https://ai-creative-studio-2026.firebaseapp.com",
        "https://ai.yody.io",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)

# Mount media directory for serving generated assets
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


# ── Pydantic Models ───────────────────────────────────────────────────────────
class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class GeneratedImage(BaseModel):
    url: str
    width: int = 1024
    height: int = 1024
    mime_type: str = "image/png"


class GenerateResponse(BaseModel):
    mode: str
    images: Optional[list[GeneratedImage]] = None
    video_url: Optional[str] = None
    prompt_used: str
    model_used: str
    created_at: str


class EnhancePromptRequest(BaseModel):
    prompt: str
    mode: str = "image"


class EnhancePromptResponse(BaseModel):
    enhanced_prompt: str
    original_prompt: str


# ── Progress callback helper ──────────────────────────────────────────────────
async def update_job_progress(job_id: str, progress: int, message: str = ""):
    """Cập nhật tiến độ job — được gọi từ google_flow_client."""
    if job_id in job_store:
        job_store[job_id]["progress"] = progress
        if message:
            job_store[job_id]["message"] = message
        logger.debug(f"Job {job_id[:8]}: {progress}% — {message}")


# ── Background job workers ────────────────────────────────────────────────────
async def run_image_generation_job(
    job_id: str,
    prompt: str,
    aspect_ratio: str,
    num_images: int,
    reference_image_path: Optional[str],
    model: str = "google-flow-nano-banana-pro",
):
    """Background task: tạo ảnh qua Google Flow."""
    job_store[job_id]["status"] = JobStatus.processing
    job_store[job_id]["message"] = f"Đang khởi động Google Flow automation ({model})..."

    try:
        images_raw = await generate_image_on_flow(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            num_images=num_images,
            reference_image_path=reference_image_path,
            job_id=job_id,
            model=model,
            progress_callback=update_job_progress,
        )

        if not images_raw:
            raise RuntimeError("Google Flow không trả về ảnh nào.")

        result = GenerateResponse(
            mode="image",
            images=[GeneratedImage(**img) for img in images_raw],
            prompt_used=prompt,
            model_used=f"{model} (Google Flow)",
            created_at=datetime.utcnow().isoformat() + "Z",
        )

        job_store[job_id].update({
            "status": JobStatus.completed,
            "progress": 100,
            "message": f"✅ Đã tạo xong {len(images_raw)} ảnh với {model}!",
            "result": result.model_dump(),
            "completed_at": time.time(),
        })

    except Exception as exc:
        logger.error(f"Image job {job_id} failed: {exc}", exc_info=True)
        job_store[job_id].update({
            "status": JobStatus.failed,
            "progress": 0,
            "error": str(exc),
            "message": f"❌ Lỗi: {str(exc)}",
            "completed_at": time.time(),
        })
    finally:
        # Dọn file upload tạm
        if reference_image_path and Path(reference_image_path).exists():
            try:
                Path(reference_image_path).unlink()
            except Exception:
                pass


async def run_video_generation_job(
    job_id: str,
    prompt: str,
    aspect_ratio: str,
    duration: int,
    reference_image_path: Optional[str],
    model: str = "google-flow-veo-quality",
):
    """Background task: tạo video qua Google Flow (Veo / Omni)."""
    job_store[job_id]["status"] = JobStatus.processing
    job_store[job_id]["message"] = f"Đang khởi động Google Flow automation ({model})..."

    try:
        video_url = await generate_video_on_flow(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            duration=duration,
            reference_image_path=reference_image_path,
            job_id=job_id,
            model=model,
            progress_callback=update_job_progress,
        )

        if not video_url:
            raise RuntimeError("Google Flow không trả về video.")

        result = GenerateResponse(
            mode="video",
            video_url=video_url,
            prompt_used=prompt,
            model_used=f"{model} (Google Flow)",
            created_at=datetime.utcnow().isoformat() + "Z",
        )

        job_store[job_id].update({
            "status": JobStatus.completed,
            "progress": 100,
            "message": f"✅ Video đã tạo xong với {model}!",
            "result": result.model_dump(),
            "completed_at": time.time(),
        })

    except Exception as exc:
        logger.error(f"Video job {job_id} failed: {exc}", exc_info=True)
        job_store[job_id].update({
            "status": JobStatus.failed,
            "progress": 0,
            "error": str(exc),
            "message": f"❌ Lỗi: {str(exc)}",
            "completed_at": time.time(),
        })
    finally:
        if reference_image_path and Path(reference_image_path).exists():
            try:
                Path(reference_image_path).unlink()
            except Exception:
                pass


# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "AI Creator Studio API",
        "version": "2.0.0",
        "mode": "Google Flow Playwright Automation",
        "status": "running",
        "session_ready": has_valid_session(),
    }


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "session_ready": has_valid_session(),
        "active_jobs": len([j for j in job_store.values() if j["status"] == "processing"]),
    }


@app.get("/api/session-status", tags=["Auth"])
async def session_status():
    """Kiểm tra trạng thái session Google Flow."""
    return {
        "has_session": has_valid_session(),
        "message": (
            "Session hợp lệ — sẵn sàng tạo nội dung"
            if has_valid_session()
            else "Chưa có session. Cần cấu hình GOOGLE_EMAIL và GOOGLE_PASSWORD trong .env"
        ),
    }


@app.post("/api/enhance-prompt", response_model=EnhancePromptResponse, tags=["AI"])
async def enhance_prompt(request: EnhancePromptRequest):
    """Tối ưu prompt (dùng Gemini nếu có key, không thì rule-based)."""
    enhanced = await enhance_prompt_simple(request.prompt, request.mode)
    return EnhancePromptResponse(enhanced_prompt=enhanced, original_prompt=request.prompt)


def format_job_response(job: dict) -> dict:
    """Đảm bảo format trả về khớp cả cấu trúc frontend Next.js lẫn client /api/tasks."""
    result = job.get("result") or {}
    images = result.get("images") if isinstance(result, dict) else None
    video_url = result.get("video_url") if isinstance(result, dict) else None
    image_url = None
    if images and len(images) > 0 and isinstance(images[0], dict):
        image_url = images[0].get("url")

    return {
        "task_id": job["job_id"],
        "job_id": job["job_id"],
        "status": job["status"],
        "progress": job.get("progress", 0),
        "message": job.get("message", ""),
        "result": result if result else None,
        "error": job.get("error"),
        # Top-level direct helpers
        "images": images,
        "image_url": image_url,
        "video_url": video_url,
        "mode": job.get("mode"),
        "created_at": job.get("created_at"),
    }


# ── Endpoint: Generate Image (Nano Banana Pro / 2 / 2 Lite) ──────────────────
@app.post("/api/generate-image", tags=["Generation"])
async def generate_image_endpoint(
    background_tasks: BackgroundTasks,
    prompt: str = Form(...),
    aspect_ratio: str = Form("1:1"),
    num_images: int = Form(1),
    model: str = Form("google-flow-nano-banana-pro"),
    reference_image: Optional[UploadFile] = File(None),
):
    """
    Endpoint tạo ảnh chuyên biệt với các mô hình Google Flow (Nano Banana Pro / 2 / 2 Lite).
    Hỗ trợ prompt, tỷ lệ khung hình (aspect_ratio), ảnh tham chiếu (reference_image), model.
    """
    if not prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt không được để trống.")

    reference_image_path: Optional[str] = None
    if reference_image and reference_image.filename:
        suffix = Path(reference_image.filename).suffix or ".jpg"
        temp_path = TEMP_UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
        content = await reference_image.read()
        temp_path.write_bytes(content)
        reference_image_path = str(temp_path)

    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "job_id": job_id,
        "status": JobStatus.queued,
        "progress": 0,
        "result": None,
        "error": None,
        "message": f"Đang xếp hàng tạo ảnh với {model} qua Google Flow...",
        "created_at": time.time(),
        "mode": "image",
    }

    background_tasks.add_task(
        run_image_generation_job,
        job_id=job_id,
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        num_images=min(num_images, 4),
        reference_image_path=reference_image_path,
        model=model,
    )

    logger.info(f"🎨 Image Job {job_id[:8]} [{model}] created for: '{prompt[:50]}...'")
    return {
        "task_id": job_id,
        "job_id": job_id,
        "status": "queued",
        "message": f"Yêu cầu tạo ảnh với {model} đã được gửi và đang xử lý...",
    }


# ── Endpoint: Generate Video (Veo 3.1 / Omni Flash) ───────────────────────────
@app.post("/api/generate-video", tags=["Generation"])
async def generate_video_endpoint(
    background_tasks: BackgroundTasks,
    prompt: str = Form(...),
    aspect_ratio: str = Form("16:9"),
    duration: int = Form(5),
    model: str = Form("google-flow-veo-quality"),
    reference_image: Optional[UploadFile] = File(None),
):
    """
    Endpoint tạo video chuyên biệt với các mô hình Veo / Omni trên Google Flow.
    Hỗ trợ text-to-video (prompt) và image-to-video (reference_image), model.
    """
    if not prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt không được để trống.")

    reference_image_path: Optional[str] = None
    if reference_image and reference_image.filename:
        suffix = Path(reference_image.filename).suffix or ".jpg"
        temp_path = TEMP_UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
        content = await reference_image.read()
        temp_path.write_bytes(content)
        reference_image_path = str(temp_path)

    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "job_id": job_id,
        "status": JobStatus.queued,
        "progress": 0,
        "result": None,
        "error": None,
        "message": f"Đang xếp hàng tạo video với {model} qua Google Flow...",
        "created_at": time.time(),
        "mode": "video",
    }

    background_tasks.add_task(
        run_video_generation_job,
        job_id=job_id,
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        duration=duration,
        reference_image_path=reference_image_path,
        model=model,
    )

    is_i2v = reference_image_path is not None
    logger.info(f"🎬 Video Job {job_id[:8]} [{model} {'I2V' if is_i2v else 'T2V'}] created: '{prompt[:50]}...'")
    return {
        "task_id": job_id,
        "job_id": job_id,
        "status": "queued",
        "message": f"Yêu cầu tạo video với {model} đã được gửi và đang xử lý...",
    }


# ── Endpoint: Unified Generate (Backward Compatibility) ──────────────────────
@app.post("/api/generate", tags=["Generation"])
async def generate(
    background_tasks: BackgroundTasks,
    prompt: str = Form(...),
    mode: str = Form("image"),
    model: str = Form("google-flow-nano-banana-pro"),
    aspect_ratio: str = Form("1:1"),
    duration: int = Form(5),
    num_images: int = Form(1),
    reference_image: Optional[UploadFile] = File(None),
):
    """
    Endpoint đa năng tương thích ngược với Frontend Next.js hiện có.
    Chuyển tiếp sang luồng Google Flow với model tương ứng.
    """
    if not prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt không được để trống.")

    if mode not in ("image", "video"):
        raise HTTPException(status_code=422, detail="mode phải là 'image' hoặc 'video'.")

    reference_image_path: Optional[str] = None
    if reference_image and reference_image.filename:
        suffix = Path(reference_image.filename).suffix or ".jpg"
        temp_path = TEMP_UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
        content = await reference_image.read()
        temp_path.write_bytes(content)
        reference_image_path = str(temp_path)

    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "job_id": job_id,
        "status": JobStatus.queued,
        "progress": 0,
        "result": None,
        "error": None,
        "message": f"Job tạo {mode} ({model}) đã được tạo, đang xử lý qua Google Flow...",
        "created_at": time.time(),
        "mode": mode,
    }

    if mode == "image":
        background_tasks.add_task(
            run_image_generation_job,
            job_id=job_id,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            num_images=min(num_images, 4),
            reference_image_path=reference_image_path,
            model=model,
        )
    else:
        background_tasks.add_task(
            run_video_generation_job,
            job_id=job_id,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            duration=duration,
            reference_image_path=reference_image_path,
            model=model,
        )

    logger.info(f"📋 Unified Job {job_id[:8]} created: mode={mode}, prompt='{prompt[:50]}...'")
    return {
        "task_id": job_id,
        "job_id": job_id,
        "status": "queued",
        "message": f"Job tạo {mode} đã được tạo, đang xử lý qua Google Flow...",
    }


# ── Polling Endpoints: /api/tasks/{task_id} & /api/job/{job_id} ──────────────
@app.get("/api/tasks/{task_id}", tags=["Generation"])
async def get_task_status(task_id: str):
    """Poll trạng thái tiến độ và kết quả theo task_id."""
    job = job_store.get(task_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Task {task_id} không tồn tại.")
    return format_job_response(job)


@app.get("/api/job/{job_id}", tags=["Generation"])
async def get_job_status(job_id: str):
    """Poll trạng thái tiến độ và kết quả (tương thích endpoint Frontend)."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} không tồn tại.")
    return format_job_response(job)


@app.delete("/api/job/{job_id}", tags=["Generation"])
@app.delete("/api/tasks/{job_id}", tags=["Generation"])
async def cancel_job(job_id: str):
    """Xoá job/task khỏi store."""
    if job_id in job_store:
        del job_store[job_id]
        return {"message": "Job đã được xoá."}
    raise HTTPException(status_code=404, detail="Job không tồn tại.")


@app.get("/api/models", tags=["Info"])
async def list_models():
    """Danh sách model Google Flow sẵn có."""
    return {
        "image_models": [
            {
                "id": "nano-banana-pro",
                "name": "Nano Banana Pro (Google Flow)",
                "description": "Tạo ảnh chất lượng cao với model Nano Banana Pro qua Google Flow",
            },
        ],
        "video_models": [
            {
                "id": "veo",
                "name": "Veo (Google Flow)",
                "description": "Tạo video AI (Text-to-Video & Image-to-Video) với Veo qua Google Flow",
            },
        ],
        "source": "Google Flow (Playwright Automation / Session Cookie)",
        "requires_api_key": False,
    }


@app.post("/api/clear-session", tags=["Auth"])
async def clear_session():
    """Xoá session đã lưu — dùng khi cần đăng nhập lại."""
    from session_manager import clear_cookies
    from google_flow_client import close_browser
    clear_cookies()
    await close_browser()
    return {"message": "Session đã được xoá. Lần chạy tiếp theo sẽ yêu cầu đăng nhập lại."}
