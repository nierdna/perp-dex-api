#!/bin/bash
# Script để chạy FastAPI server

echo "🚀 Starting Lighter Trading Bot API..."
echo "================================================"
echo ""
echo "📍 API will run at: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo "🎨 Test UI: Open ui_test.html in browser"
echo ""
echo "Press Ctrl+C to stop"
echo "================================================"
echo ""

cd "$(dirname "$0")/../../.."
source venv/bin/activate

# Install FastAPI if not installed
pip install -q fastapi uvicorn 2>/dev/null

# Run API
uvicorn perpsdex.lighter.api.main:app --reload --host 0.0.0.0 --port 8000

