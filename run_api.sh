#!/usr/bin/env bash

# Simple helper script to start the Trading API server
# Usage: ./run_api.sh

set -e

# cd về thư mục chứa script
cd "$(dirname "$0")"

# Port có thể override bằng biến môi trường bên ngoài, mặc định 8080
: "${API_PORT:=8080}"

# Nếu chưa có venv thì tạo, sau đó luôn activate
if [ ! -d "venv" ]; then
  echo "[SETUP] Creating Python virtualenv..."
  python3 -m venv venv
fi

# shellcheck disable=SC1091
source "venv/bin/activate"

# Đảm bảo đã cài đủ dependencies (chỉ chạy nếu thiếu sqlalchemy đơn giản nhất)
if ! python3 -c "import sqlalchemy" >/dev/null 2>&1; then
  echo "[SETUP] Installing Python dependencies from requirements.txt..."
  pip install -r requirements.txt
fi

echo "Starting Trading API Server on port ${API_PORT}..."
echo "Docs:   http://localhost:${API_PORT}/docs"
echo "Status: http://localhost:${API_PORT}/api/status"

API_PORT="${API_PORT}" python3 api_server.py
