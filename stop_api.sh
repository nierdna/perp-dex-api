#!/bin/bash
# Stop API Server

echo "🛑 Stopping Trading API Server..."

# Find and kill python process on port 8080
PID=$(lsof -ti:8080)

if [ -z "$PID" ]; then
    echo "⚠️  No process found on port 8080"
else
    echo "📍 Found process: $PID"
    kill -9 $PID
    echo "✅ API Server stopped"
fi

