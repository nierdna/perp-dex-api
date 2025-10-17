#!/bin/bash

# Aster DEX Trading Bot - API Server Startup Script

echo "🚀 Starting Aster DEX Trading Bot API..."
echo "📍 Port: 8001"
echo "🌐 UI: http://localhost:8001/ui_test.html"
echo ""

# Activate virtual environment if exists
if [ -d "../../venv" ]; then
    echo "✅ Activating virtual environment..."
    source ../../venv/bin/activate
fi

# Check if required packages are installed
python3 -c "import fastapi" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ FastAPI not found! Installing dependencies..."
    pip install fastapi uvicorn python-dotenv aiohttp
fi

# Load environment variables
if [ -f "../../.env" ]; then
    echo "✅ Loading environment variables from .env"
    export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Start Uvicorn server
echo ""
echo "🎯 Starting Uvicorn server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$(dirname "$0")"
uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload

# Note: Port 8001 to avoid conflict with Lighter (8000)

