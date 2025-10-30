#!/bin/bash
# Test Trading API Server

API_URL="http://localhost:8080"

echo "=============================================="
echo "🧪 TESTING TRADING API SERVER"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Health Check
echo ""
echo "${YELLOW}1. Testing Health Check...${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/status")

if [ "$response" = "200" ]; then
    echo "${GREEN}✅ API Server is online${NC}"
    curl -s "$API_URL/api/status" | jq .
else
    echo "${RED}❌ API Server is offline (HTTP $response)${NC}"
    exit 1
fi

# 2. Test Market Order (with keys from ENV)
echo ""
echo "${YELLOW}2. Testing Market Order (using ENV keys)...${NC}"
echo "   Exchange: lighter"
echo "   Symbol: DOGE"
echo "   Side: long"
echo "   Size: 5 USD"
echo ""

read -p "Do you want to place a REAL order? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    echo "${YELLOW}Placing order...${NC}"
    
    curl -X POST "$API_URL/api/order/market" \
      -H "Content-Type: application/json" \
      -d '{
        "exchange": "lighter",
        "symbol": "DOGE",
        "side": "long",
        "size_usd": 5,
        "leverage": 5,
        "sl_percent": 10,
        "rr_ratio": [1, 2]
      }' | jq .
    
    echo ""
    echo "${GREEN}✅ Order test completed${NC}"
else
    echo "${YELLOW}⏭️  Skipped real order test${NC}"
fi

# 3. Test with custom keys (dry run)
echo ""
echo "${YELLOW}3. Testing with custom keys (dry run)...${NC}"
echo "   This will fail (invalid keys) - just checking request format"
echo ""

curl -X POST "$API_URL/api/order/market" \
  -H "Content-Type: application/json" \
  -d '{
    "lighter_private_key": "0x0000000000000000000000000000000000000000000000000000000000000001",
    "lighter_account_index": 0,
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 10,
    "leverage": 2
  }' 2>&1 | head -n 20

echo ""
echo "${YELLOW}Expected to fail (invalid keys)${NC}"

# 4. Test Limit Order
echo ""
echo "${YELLOW}4. Testing Limit Order...${NC}"

curl -X POST "$API_URL/api/order/limit" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 100,
    "leverage": 5,
    "limit_price": 108000
  }' 2>&1 | head -n 10

echo ""
echo "${YELLOW}Expected: Not implemented yet${NC}"

# 5. API Docs
echo ""
echo "${YELLOW}5. API Documentation${NC}"
echo "   📖 Swagger UI: ${API_URL}/docs"
echo "   📖 ReDoc: ${API_URL}/redoc"

# Summary
echo ""
echo "=============================================="
echo "${GREEN}✅ API TESTS COMPLETED${NC}"
echo "=============================================="
echo ""
echo "📚 Full documentation: API_README.md"
echo "🌐 API Docs: ${API_URL}/docs"
echo ""
echo "Example usage:"
echo ""
echo "# Market order (LONG BTC)"
echo "curl -X POST ${API_URL}/api/order/market \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"exchange\": \"lighter\","
echo "    \"symbol\": \"BTC\","
echo "    \"side\": \"long\","
echo "    \"size_usd\": 100,"
echo "    \"leverage\": 5,"
echo "    \"sl_percent\": 10,"
echo "    \"rr_ratio\": [1, 2]"
echo "  }'"
echo ""

