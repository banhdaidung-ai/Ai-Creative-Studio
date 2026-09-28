#!/usr/bin/env bash
set -e

PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="flow-backend"
REGION="asia-southeast1"

echo "=== Đang build và deploy Backend lên Google Cloud Run (Free Tier) ==="

# Build image bằng Cloud Build
gcloud builds submit backend/ --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest

# Deploy lên Cloud Run với cấu hình Min Instances = 0 (Hoàn toàn không tốn phí khi idle)
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars GOOGLE_FLOW_API_KEY="DIEN_API_KEY_VAO_DAY"

# Lấy URL Public sau khi deploy
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')

echo "=== Deploy thành công! ==="
echo "Backend URL: ${SERVICE_URL}"
echo "Vui lòng cập nhật vào file .env ở frontend:"
echo "VITE_FLOW_BACKEND_URL=${SERVICE_URL}"
