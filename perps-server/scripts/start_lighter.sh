#!/bin/bash

# 🚀 Script tự động khởi động Lighter API Server
# Sử dụng: sh scripts/start_lighter.sh

echo "🔧 Starting Lighter API Server..."
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

# Kích hoạt virtual environment
echo "🐍 Activating virtual environment..."
source venv/bin/activate

# Di chuyển vào thư mục lighter
cd perpsdex/lighter

# Chạy server
echo "🚀 Starting Uvicorn server on http://0.0.0.0:8000..."
echo "================================"
echo ""
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

