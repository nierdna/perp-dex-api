#!/bin/bash

# 🚀 Script khởi động Lighter API Server với Logs
# Sử dụng: sh scripts/start_lighter_with_logs.sh

echo "🔧 Starting Lighter API Server (with logs)..."
echo "================================"

# Lấy đường dẫn thư mục project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$SCRIPT_DIR"

echo "📂 Project directory: $SCRIPT_DIR"

# Tạo thư mục logs nếu chưa có
mkdir -p logs

# Kiểm tra và dừng server cũ
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is in use. Killing old process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Kích hoạt virtual environment
echo "🐍 Activating virtual environment..."
source venv/bin/activate

# Di chuyển vào thư mục lighter
cd perpsdex/lighter

# Chạy server với logs
LOG_FILE="../../logs/lighter_$(date +%Y%m%d_%H%M%S).log"
echo "🚀 Starting Uvicorn server in background..."
echo "📝 Logs will be written to: $LOG_FILE"
nohup python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_FILE" 2>&1 &

# Lấy PID
SERVER_PID=$!
sleep 2

# Kiểm tra server
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "✅ Server started successfully!"
    echo "📊 Process ID: $SERVER_PID"
    echo "🌐 API running at: http://localhost:8000"
    echo "📝 Log file: $LOG_FILE"
    echo ""
    echo "📖 To view logs:"
    echo "   tail -f $LOG_FILE"
    echo ""
    echo "To stop server, run: sh scripts/stop_lighter.sh"
else
    echo "❌ Failed to start server"
    echo "📝 Check logs: cat $LOG_FILE"
fi

