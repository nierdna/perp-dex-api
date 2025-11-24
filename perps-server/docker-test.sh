#!/bin/bash
# Script để build và test Docker image trên local

set -e

echo "🐳 Building Docker image..."
docker build -t perp-dex-api:latest .

echo ""
echo "✅ Build thành công!"
echo ""
echo "🚀 Để chạy container, sử dụng lệnh sau:"
echo ""
echo "docker run -d \\"
echo "  --name perp-dex-api \\"
echo "  -p 8080:8080 \\"
echo "  --env-file .env \\"
echo "  perp-dex-api:latest"
echo ""
echo "📝 Hoặc chạy với PORT tùy chỉnh:"
echo ""
echo "docker run -d \\"
echo "  --name perp-dex-api \\"
echo "  -p 3000:3000 \\"
echo "  -e PORT=3000 \\"
echo "  --env-file .env \\"
echo "  perp-dex-api:latest"
echo ""
echo "🔍 Xem logs:"
echo "docker logs -f perp-dex-api"
echo ""
echo "🛑 Dừng container:"
echo "docker stop perp-dex-api"
echo ""
echo "🗑️  Xóa container:"
echo "docker rm perp-dex-api"

