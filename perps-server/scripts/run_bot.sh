#!/bin/bash

##############################################
# Hedging Bot Runner Script
# Starts Lighter API and runs the bot
##############################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}🤖 HEDGING BOT RUNNER${NC}"
echo "================================"
echo ""

# Step 1: Check .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo ""
    echo "Please create .env file:"
    echo "  cp env.example.new .env"
    echo "  nano .env"
    exit 1
fi

echo -e "${GREEN}✅ Found .env file${NC}"

# Step 2: Check venv
if [ ! -d venv ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo ""
    echo "Please create venv:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

echo -e "${GREEN}✅ Found virtual environment${NC}"

# Step 3: Verify Lighter credentials
echo ""
echo -e "${BLUE}🔍 Verifying Lighter credentials...${NC}"

source .env 2>/dev/null || true

# Support both LIGHTER_PRIVATE_KEY and LIGHTER_L1_PRIVATE_KEY
LIGHTER_KEY="${LIGHTER_L1_PRIVATE_KEY:-$LIGHTER_PRIVATE_KEY}"

if [ -z "$LIGHTER_KEY" ] || [ -z "$ACCOUNT_INDEX" ]; then
    echo -e "${RED}❌ Lighter credentials not configured!${NC}"
    echo ""
    echo "Required in .env:"
    echo "  LIGHTER_PRIVATE_KEY=... (or LIGHTER_L1_PRIVATE_KEY)"
    echo "  LIGHTER_PUBLIC_KEY=... (or LIGHTER_L1_PUBLIC_KEY)"
    echo "  ACCOUNT_INDEX=123456"
    exit 1
fi

echo -e "${GREEN}✅ Lighter credentials found${NC}"

# Step 4: Check bot config
echo ""
echo -e "${BLUE}📋 Bot Configuration:${NC}"
source .env 2>/dev/null || true
echo "   Token: ${TRADE_TOKEN:-BTC}"
echo "   Size: \$${POSITION_SIZE:-10} per exchange"
echo "   Leverage: ${LEVERAGE:-5}x"
echo "   SL: ${SL_PERCENT:-3}%"
echo "   Time: ${TIME_OPEN_CLOSE:-20,30,60} minutes"
echo "   Auto-restart: ${AUTO_RESTART:-false}"

# Step 5: Info
echo ""
echo -e "${BLUE}ℹ️  Note: Bot now uses DIRECT SDK calls${NC}"
echo "   No need to start API servers separately!"
echo ""

# Step 6: Run bot
echo -e "${BLUE}🚀 Starting Hedging Bot...${NC}"
echo "================================"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Activate venv and run
source venv/bin/activate
python3 main.py

