#!/bin/bash
# Start API Server

cd "$(dirname "$0")"

echo "🚀 Starting Trading API Server..."

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start server
python3 main.py

