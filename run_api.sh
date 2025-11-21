#!/usr/bin/env bash

# Simple helper script to start the Trading API server
# Usage: ./run_api.sh

set -e

# cd về thư mục chứa script
cd "$(dirname "$0")"

# Port có thể override bằng biến môi trường bên ngoài, mặc định 8080
: "${API_PORT:=8080}"

# Nếu có venv trong project thì tự động activate (Cách 1)
if [ -d "venv" ]; then
  # shellcheck disable=SC1091
  source "venv/bin/activate"
fi

echo "Starting Trading API Server on port ${API_PORT}..."
echo "Docs:   http://localhost:${API_PORT}/docs"
echo "Status: http://localhost:${API_PORT}/api/status"

API_PORT="${API_PORT}" python3 api_server.py
