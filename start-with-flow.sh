#!/bin/bash
# ============================================================
# AI Creative Studio — Khởi động đầy đủ với Google Flow
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOW_BACKEND="$SCRIPT_DIR/flow-backend"

echo "🚀 Khởi động AI Creative Studio..."

# Kiểm tra Python venv
if [ ! -d "$FLOW_BACKEND/.venv" ]; then
    echo "📦 Cài đặt Python dependencies cho flow-backend..."
    cd "$FLOW_BACKEND"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    playwright install chromium
    echo "✅ Cài đặt xong!"
    cd "$SCRIPT_DIR"
fi

# Kiểm tra .env
if [ ! -f "$FLOW_BACKEND/.env" ]; then
    echo "⚠️  Chưa có file flow-backend/.env"
    echo "   Đang copy từ .env.example..."
    cp "$FLOW_BACKEND/.env.example" "$FLOW_BACKEND/.env"
    echo "   📝 Vui lòng điền GOOGLE_EMAIL và GOOGLE_PASSWORD vào: $FLOW_BACKEND/.env"
fi

# Khởi động Python backend (background)
echo "🐍 Khởi động Google Flow backend trên port 8000..."
cd "$FLOW_BACKEND"
source .venv/bin/activate
"$FLOW_BACKEND/.venv/bin/python3" -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload &
FLOW_PID=$!
echo "   PID: $FLOW_PID"
cd "$SCRIPT_DIR"

# Chờ backend sẵn sàng
echo "⏳ Chờ backend khởi động..."
for i in $(seq 1 10); do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Flow backend sẵn sàng!"
        break
    fi
    sleep 1
done

# Khởi động Node frontend
echo "⚛️  Khởi động Frontend trên port 3000..."
npm run dev &
NODE_PID=$!

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  AI Creative Studio — Đang chạy           ║"
echo "╠════════════════════════════════════════════╣"
echo "║  Frontend:      http://localhost:3000      ║"
echo "║  Flow Backend:  http://localhost:8000      ║"
echo "║  Flow API Docs: http://localhost:8000/docs ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Bấm Ctrl+C để dừng tất cả."

# Dọn dẹp khi thoát
trap "echo '🛑 Đang tắt...'; kill $FLOW_PID $NODE_PID 2>/dev/null; exit 0" INT TERM
wait
