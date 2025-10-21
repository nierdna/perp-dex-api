#!/bin/bash

# 🚀 Script tự động khởi động Lighter API Server (Background Mode)
# Sử dụng: sh scripts/start_lighter_bg.sh

echo "🔧 Starting Lighter API Server (Background)..."
echo "================================"

# Lấy đường dẫn thư mục project (cha của thư mục scripts)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$SCRIPT_DIR"

echo "📂 Project directory: $SCRIPT_DIR"

# Kiểm tra và dừng server cũ nếu đang chạy
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is in use. Killing old process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Kích hoạt virtual environment và chạy server background
echo "🐍 Activating virtual environment..."
source venv/bin/activate

# Di chuyển vào thư mục lighter
cd perpsdex/lighter

# Chạy server ở background
echo "🚀 Starting Uvicorn server in background on http://0.0.0.0:8000..."
nohup python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload > /dev/null 2>&1 &

# Lấy PID của process
SERVER_PID=$!
sleep 2

# Kiểm tra server đã chạy chưa
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "✅ Server started successfully!"
    echo "📊 Process ID: $SERVER_PID"
    echo "🌐 API running at: http://localhost:8000"
    echo "📋 Check status: curl http://localhost:8000/api/status"
    echo ""
    echo "To stop server, run: sh scripts/stop_lighter.sh"
else
    echo "❌ Failed to start server"
fi

