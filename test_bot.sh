#!/bin/bash

# Test Hedging Bot Setup
# This script verifies all components are working before running the bot

set -e

echo "=========================================="
echo "🧪 TESTING HEDGING BOT SETUP"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check .env file
echo ""
echo "1️⃣ Checking .env file..."
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Check required variables
    required_vars=(
        "LIGHTER_PRIVATE_KEY"
        "ASTER_API_KEY"
        "ASTER_SECRET_KEY"
        "TRADE_TOKEN"
        "POSITION_SIZE"
        "TELEGRAM_BOT_TOKEN"
        "TELEGRAM_CHAT_ID"
    )
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" .env && ! grep -q "^${var}=your_" .env; then
            echo -e "${GREEN}  ✅ ${var} is set${NC}"
        else
            echo -e "${RED}  ❌ ${var} is missing or not configured${NC}"
        fi
    done
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env from env.example.new"
    exit 1
fi

# Check Python environment
echo ""
echo "2️⃣ Checking Python environment..."
if [ -d "venv" ]; then
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
    source venv/bin/activate
    
    # Check Python version
    python_version=$(python --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}  Python version: ${python_version}${NC}"
    
    # Check required packages
    required_packages=("aiohttp" "fastapi" "uvicorn" "python-dotenv")
    for package in "${required_packages[@]}"; do
        if pip show "$package" > /dev/null 2>&1; then
            echo -e "${GREEN}  ✅ ${package} installed${NC}"
        else
            echo -e "${RED}  ❌ ${package} not installed${NC}"
            echo "Run: pip install -r requirements.txt"
        fi
    done
else
    echo -e "${RED}❌ Virtual environment not found${NC}"
    echo "Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Test Lighter API
echo ""
echo "3️⃣ Testing Lighter API..."
if curl -s -f http://localhost:8000/api/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Lighter API is running${NC}"
else
    echo -e "${YELLOW}⚠️  Lighter API is not running${NC}"
    echo "Start with: cd perpsdex/lighter && python -m uvicorn api.main:app --host 0.0.0.0 --port 8000"
fi

# Test Aster API
echo ""
echo "4️⃣ Testing Aster API..."
if curl -s -f http://localhost:8001/api/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Aster API is running${NC}"
else
    echo -e "${YELLOW}⚠️  Aster API is not running${NC}"
    echo "Start with: cd perpsdex/aster && python -m uvicorn api.main:app --host 0.0.0.0 --port 8001"
fi

# Test Telegram
echo ""
echo "5️⃣ Testing Telegram..."
source .env
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ] && [ "$TELEGRAM_BOT_TOKEN" != "your_telegram_bot_token_here" ]; then
    echo "Sending test message to Telegram..."
    response=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=🧪 Test message from Hedging Bot")
    
    if echo "$response" | grep -q '"ok":true'; then
        echo -e "${GREEN}✅ Telegram is working${NC}"
    else
        echo -e "${RED}❌ Telegram test failed${NC}"
        echo "Response: $response"
    fi
else
    echo -e "${YELLOW}⚠️  Telegram not configured${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ = Ready${NC}"
echo -e "${YELLOW}⚠️  = Warning (optional)${NC}"
echo -e "${RED}❌ = Error (must fix)${NC}"
echo ""
echo "If all checks pass, you can run the bot with:"
echo "  python main.py"
echo ""
echo "Or with Docker:"
echo "  docker-compose up -d"
echo ""

