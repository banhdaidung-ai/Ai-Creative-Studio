#!/usr/bin/env bash
# ==============================================================================
# Oracle Cloud Always Free (Ubuntu ARM64/AMD64) — 1-Click Deploy Google Flow
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN_OVERRIDE="${FLOW_DOMAIN:-}"
TOKEN_OVERRIDE="${FLOW_ACCESS_TOKEN:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN_OVERRIDE="${2:-}"
      shift 2
      ;;
    --token)
      TOKEN_OVERRIDE="${2:-}"
      shift 2
      ;;
    -h|--help)
      echo "Cách dùng: ./deploy-oracle.sh [--domain <ten-mien-hoac-sslip.io>] [--token <ma-bao-mat>]"
      exit 0
      ;;
    *)
      echo "❌ Tham số không hợp lệ: $1"
      exit 1
      ;;
  esac
done

echo "======================================================================"
echo "🚀 TRIỂN KHAI GOOGLE FLOW BACKEND LÊN ORACLE CLOUD (DOCKER + CADDY SSL)"
echo "======================================================================"

# 1. Cài đặt Docker & Docker Compose nếu chưa có
if ! command -v docker >/dev/null 2>&1; then
  echo "📦 Đang cài đặt Docker Engine..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

if docker info >/dev/null 2>&1; then
  DOCKER_CMD=(docker)
else
  DOCKER_CMD=(sudo docker)
fi

if ! "${DOCKER_CMD[@]}" compose version >/dev/null 2>&1; then
  echo "📦 Đang cài đặt Docker Compose plugin..."
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
fi

# 2. Mở cổng tường lửa Linux (80/443) trên Ubuntu Oracle Cloud
echo "🔥 Đang kiểm tra & mở cổng 80/443 trên tường lửa Ubuntu..."
if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -qi "Status: active"; then
  sudo ufw allow 80/tcp >/dev/null
  sudo ufw allow 443/tcp >/dev/null
  sudo ufw allow 443/udp >/dev/null
  echo "✅ Đã mở cổng 80/443 trên UFW."
fi

if command -v iptables >/dev/null 2>&1; then
  REJECT_LINE="$(sudo iptables -L INPUT --line-numbers -n 2>/dev/null | awk '/REJECT/ {print $1; exit}' || true)"
  for port in 80 443; do
    if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT >/dev/null 2>&1; then
      if [[ -n "$REJECT_LINE" ]]; then
        sudo iptables -I INPUT "$REJECT_LINE" -p tcp -m state --state NEW --dport "$port" -j ACCEPT
      else
        sudo iptables -A INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT
      fi
    fi
  done
  if ! sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT >/dev/null 2>&1; then
    if [[ -n "$REJECT_LINE" ]]; then
      sudo iptables -I INPUT "$REJECT_LINE" -p udp -m state --state NEW --dport 443 -j ACCEPT
    else
      sudo iptables -A INPUT -p udp -m state --state NEW --dport 443 -j ACCEPT
    fi
  fi
  if command -v netfilter-persistent >/dev/null 2>&1; then
    sudo netfilter-persistent save >/dev/null 2>&1 || true
  fi
  echo "✅ Đã cấu hình iptables cho phép HTTP (80) & HTTPS (443)."
fi

# 3. Chuẩn bị file .env, domain sslip.io & FLOW_ACCESS_TOKEN
mkdir -p .sessions media_cache temp_uploads

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
  else
    touch .env
  fi
fi

set_env_var() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" .env; then
    python3 - "$key" "$val" <<'PY'
import sys
from pathlib import Path

key, val = sys.argv[1], sys.argv[2]
p = Path(".env")
lines = p.read_text(encoding="utf-8").splitlines()
out = []
replaced = False
for line in lines:
    if line.startswith(f"{key}="):
        out.append(f"{key}={val}")
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(f"{key}={val}")
p.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
  else
    echo "${key}=${val}" >> .env
  fi
}

get_env_var() {
  local key="$1"
  grep -E "^${key}=" .env | tail -n 1 | cut -d'=' -f2- | tr -d '"\r' || true
}

CURRENT_DOMAIN="$(get_env_var FLOW_DOMAIN)"
FLOW_DOMAIN="${DOMAIN_OVERRIDE:-$CURRENT_DOMAIN}"

if [[ -z "$FLOW_DOMAIN" ]]; then
  echo "🌐 Đang tự động dò Public IPv4 của VM Oracle..."
  PUBLIC_IP="$(curl -4 -fsS --max-time 6 https://api.ipify.org || curl -4 -fsS --max-time 6 https://ifconfig.me || true)"
  if [[ -z "$PUBLIC_IP" ]]; then
    echo "❌ Không thể tự dò Public IPv4. Vui lòng truyền --domain <ip-hoac-domain>."
    exit 1
  fi
  DASH_IP="${PUBLIC_IP//./-}"
  FLOW_DOMAIN="${DASH_IP}.sslip.io"
  echo "✅ Đã tạo domain HTTPS miễn phí: ${FLOW_DOMAIN}"
fi
set_env_var "FLOW_DOMAIN" "$FLOW_DOMAIN"

CURRENT_TOKEN="$(get_env_var FLOW_ACCESS_TOKEN)"
FLOW_ACCESS_TOKEN="${TOKEN_OVERRIDE:-$CURRENT_TOKEN}"
if [[ -z "$FLOW_ACCESS_TOKEN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    FLOW_ACCESS_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  else
    FLOW_ACCESS_TOKEN="$(openssl rand -hex 24)"
  fi
  echo "🔐 Đã tự sinh mã bảo mật FLOW_ACCESS_TOKEN ngẫu nhiên."
fi
set_env_var "FLOW_ACCESS_TOKEN" "$FLOW_ACCESS_TOKEN"

CURRENT_ORIGINS="$(get_env_var ALLOWED_ORIGINS)"
if [[ -z "$CURRENT_ORIGINS" ]]; then
  set_env_var "ALLOWED_ORIGINS" "https://ai-creative-studio-2026.web.app,https://ai-creative-studio-2026.firebaseapp.com,http://localhost:3000"
fi
set_env_var "ALLOW_SESSION_EXPORT" "false"
set_env_var "PORT" "8000"

# 4. Build & khởi chạy Docker Compose (flow-backend + Caddy)
echo "🐳 Đang build image & khởi chạy container (lần đầu tải Chromium mất ~3-5 phút)..."
"${DOCKER_CMD[@]}" compose -f docker-compose.oracle.yml up -d --build

# 5. Chờ container nội bộ và HTTPS sẵn sàng
echo "⏳ Đang kiểm tra sức khoẻ server..."
INTERNAL_OK=0
for _ in $(seq 1 15); do
  if "${DOCKER_CMD[@]}" exec flow-backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    INTERNAL_OK=1
    break
  fi
  sleep 2
done

HTTPS_URL="https://${FLOW_DOMAIN}"
HTTPS_OK=0
for _ in $(seq 1 15); do
  if curl -fsS --max-time 5 "${HTTPS_URL}/health" >/dev/null 2>&1; then
    HTTPS_OK=1
    break
  fi
  sleep 3
done

echo ""
echo "======================================================================"
if [[ "$HTTPS_OK" -eq 1 ]]; then
  echo "🎉 TRIỂN KHAI HOÀN TẤT & HTTPS ĐÃ HOẠT ĐỘNG!"
elif [[ "$INTERNAL_OK" -eq 1 ]]; then
  echo "⚠️  Backend nội bộ đã chạy, nhưng HTTPS công khai chưa thông."
  echo "   👉 Kiểm tra Oracle Cloud VCN Security List đã mở Ingress TCP 80 & 443 (0.0.0.0/0) chưa,"
  echo "      rồi chờ 30 giây để Caddy hoàn tất cấp chứng chỉ SSL."
else
  echo "⚠️  Container vừa khởi động, chạy lệnh sau để xem log:"
  echo "   ${DOCKER_CMD[*]} compose -f docker-compose.oracle.yml logs -f"
fi
echo "======================================================================"
echo "🔗 Backend HTTPS URL : ${HTTPS_URL}"
echo "🔑 FLOW_ACCESS_TOKEN : ${FLOW_ACCESS_TOKEN}"
echo ""
echo "📋 BƯỚC TIẾP THEO (CHẠY TRÊN MÁY MAC CỦA ANH):"
echo "   1. Đẩy cookie Google Flow lên máy chủ Oracle:"
echo "      python3 sync_session_to_cloud.py --url ${HTTPS_URL} --token ${FLOW_ACCESS_TOKEN}"
echo ""
echo "   2. Mở web https://ai-creative-studio-2026.web.app -> Biểu tượng Cài đặt/PRO"
echo "      -> Tab 'Google Flow' -> dán URL & Access Token ở trên -> Lưu & Kiểm tra!"
echo "======================================================================"
