#!/bin/bash

# 📖 Script xem logs của Lighter API Server
# Sử dụng: sh scripts/view_logs.sh [lines]

# Lấy đường dẫn thư mục project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$SCRIPT_DIR"

# Kiểm tra thư mục logs
if [ ! -d "logs" ]; then
    echo "❌ Logs directory not found"
    echo "ℹ️  Start server with logs: sh scripts/start_lighter_with_logs.sh"
    exit 1
fi

# Tìm file log mới nhất
LATEST_LOG=$(ls -t logs/lighter_*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "❌ No log files found"
    echo "ℹ️  Start server with logs: sh scripts/start_lighter_with_logs.sh"
    exit 1
fi

echo "📖 Viewing logs from: $LATEST_LOG"
echo "================================"
echo ""

# Số dòng muốn xem (mặc định 50, hoặc tham số đầu vào)
LINES=${1:-50}

if [ "$LINES" = "all" ]; then
    cat "$LATEST_LOG"
elif [ "$LINES" = "follow" ] || [ "$LINES" = "f" ]; then
    echo "📡 Following logs (Ctrl+C to stop)..."
    echo ""
    tail -f "$LATEST_LOG"
else
    echo "📋 Last $LINES lines:"
    echo ""
    tail -n "$LINES" "$LATEST_LOG"
    echo ""
    echo "ℹ️  To follow logs: sh scripts/view_logs.sh follow"
    echo "ℹ️  To view all logs: sh scripts/view_logs.sh all"
    echo "ℹ️  To view N lines: sh scripts/view_logs.sh N"
fi

