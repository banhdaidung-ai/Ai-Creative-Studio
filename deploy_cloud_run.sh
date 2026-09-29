#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOW_BACKEND_DIR="$SCRIPT_DIR/flow-backend"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "ai-creative-studio-2026")
SERVICE_NAME="flow-backend"
REGION="asia-southeast1"

echo "=== Đang build và deploy Google Flow Backend lên Google Cloud Run ==="
echo "Project ID: ${PROJECT_ID}"
echo "Region:     ${REGION}"

# 1. Kiểm tra và đọc session cookies hiện tại để inject vào Cloud Run
SESSION_FILE="$FLOW_BACKEND_DIR/.sessions/google_flow_session.json"
ENV_VARS_ARG=""

if [ -f "$SESSION_FILE" ]; then
    echo "🍪 Tìm thấy session cookies tại $SESSION_FILE, đang đóng gói vào biến môi trường..."
    SESSION_B64=$(base64 -i "$SESSION_FILE" | tr -d '\n')
    ENV_VARS_ARG="--set-env-vars GOOGLE_FLOW_SESSION_B64=${SESSION_B64}"
fi

# 2. Build image bằng Cloud Build từ thư mục flow-backend
echo "📦 Đang build container image từ flow-backend/..."
gcloud builds submit "$FLOW_BACKEND_DIR" --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# 3. Deploy lên Cloud Run: cấu hình 2Gi RAM và 2 CPU cho Playwright Chromium
echo "🚀 Đang triển khai lên Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  ${ENV_VARS_ARG}

# 4. Lấy URL Public sau khi deploy
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format 'value(status.url)')

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Deploy Cloud Run thành công!                                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Backend URL: ${SERVICE_URL}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Vui lòng cập nhật vào file .env ở frontend:"
echo "VITE_FLOW_BACKEND_URL=${SERVICE_URL}"

