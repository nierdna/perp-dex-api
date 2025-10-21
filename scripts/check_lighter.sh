#!/bin/bash

# 📊 Script kiểm tra trạng thái Lighter API Server
# Sử dụng: sh scripts/check_lighter.sh

echo "📊 Checking Lighter API Server Status..."
echo "================================"

# Kiểm tra port 8000
if lsof -ti:8000 > /dev/null 2>&1; then
    PID=$(lsof -ti:8000)
    echo "✅ Server is running"
    echo "📋 Process ID: $PID"
    echo "🌐 Port: 8000"
    echo ""
    
    # Kiểm tra API response
    echo "🔍 Testing API endpoint..."
    if command -v curl > /dev/null 2>&1; then
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/status 2>/dev/null)
        if [ "$RESPONSE" = "200" ]; then
            echo "✅ API is responding (HTTP $RESPONSE)"
            echo ""
            echo "📋 API Status:"
            curl -s http://localhost:8000/api/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/api/status
        else
            echo "⚠️  API not responding properly (HTTP $RESPONSE)"
        fi
    else
        echo "⚠️  curl not available, cannot test API"
    fi
else
    echo "❌ Server is NOT running"
    echo ""
    echo "To start server:"
    echo "  - Foreground: sh scripts/start_lighter.sh"
    echo "  - Background: sh scripts/start_lighter_bg.sh"
fi

