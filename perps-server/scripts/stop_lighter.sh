#!/bin/bash

# 🛑 Script dừng Lighter API Server
# Sử dụng: sh scripts/stop_lighter.sh

echo "🛑 Stopping Lighter API Server..."
echo "================================"

# Kiểm tra xem có process nào đang chạy trên port 8000 không
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "🔍 Found process running on port 8000"
    
    # Lấy PID
    PID=$(lsof -ti:8000)
    echo "📋 Process ID: $PID"
    
    # Kill process
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 1
    
    # Kiểm tra lại
    if lsof -ti:8000 > /dev/null 2>&1; then
        echo "❌ Failed to stop server"
    else
        echo "✅ Server stopped successfully!"
    fi
else
    echo "ℹ️  No server running on port 8000"
fi

