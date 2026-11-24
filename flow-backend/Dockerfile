# ============================================================
# Google Flow Backend — Production Dockerfile (Multi-Arch ARM64/AMD64)
# Tương thích Oracle Cloud Always Free (Ampere A1) & x86_64
# ============================================================
FROM python:3.12-slim-bookworm

WORKDIR /app

# Biến môi trường
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Thư viện hệ thống tối thiểu cho OpenCV, Pillow, Node driver Playwright (libatomic1 trên ARM64) & healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libatomic1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cài đặt Playwright browser Chromium + system deps khớp phiên bản Playwright
RUN playwright install --with-deps chromium

# Copy mã nguồn backend (session/cookie và .env không đóng gói vào image)
COPY . .

# Tạo sẵn các thư mục runtime cần thiết
RUN mkdir -p media_cache temp_uploads .sessions

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

# Khởi động FastAPI hỗ trợ biến ${PORT} linh hoạt
CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
