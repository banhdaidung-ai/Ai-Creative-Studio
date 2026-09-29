# ============================================================
# Google Flow Backend — Production Dockerfile
# Base: Official Microsoft Playwright image with Python & Chromium
# ============================================================
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

WORKDIR /app

# Biến môi trường
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Cài đặt thư viện đồ họa hệ thống cho OpenCV và Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cài đặt Playwright browser chromium
RUN playwright install chromium

# Copy toàn bộ mã nguồn backend
COPY . .

# Tạo sẵn các thư mục cache cần thiết
RUN mkdir -p media_cache temp_uploads .sessions

EXPOSE 8000

# Khởi động ứng dụng FastAPI
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
