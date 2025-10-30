# 🐳 Docker Deployment Guide

## 📋 Prerequisites

- Docker & Docker Compose installed
- `.env` file configured
- Docker Hub account (for publishing)

---

## 📦 Publishing to Docker Hub

### Method 1: Manual Push

```bash
# Step 1: Login to Docker Hub
docker login
# Enter your Docker Hub username & password

# Step 2: Set your Docker Hub username
export DOCKER_USERNAME=your-dockerhub-username

# Step 3: Run publish script
sh scripts/docker_publish.sh

# Or manual:
docker build --platform linux/amd64 -t $DOCKER_USERNAME/hedging-bot:latest .
docker push $DOCKER_USERNAME/hedging-bot:latest
```

### Method 2: GitHub Actions (Auto)

1. **Push code to GitHub**
```bash
git add .
git commit -m "Release v1.0.0"
git push origin main
```

2. **GitHub Actions auto build & push to GHCR**
   - Image: `ghcr.io/your-username/point-dex:latest`
   - Auto-triggered on push to main

3. **Pull from GHCR**
```bash
docker pull ghcr.io/your-username/point-dex:latest
```

---

## 📥 Using Published Image

### Pull & Run

```bash
# Pull image
docker pull your-username/hedging-bot:latest

# Create .env
cp env.example.new .env
nano .env

# Run
docker run -d \
  --name hedging-bot \
  --env-file .env \
  --restart unless-stopped \
  your-username/hedging-bot:latest

# View logs
docker logs -f hedging-bot
```

---

## 📋 Prerequisites

- Docker & Docker Compose installed
- `.env` file configured

---

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy example env
cp env.example.new .env

# Edit with your credentials
nano .env
```

**Required variables:**
```bash
# Lighter
LIGHTER_PRIVATE_KEY=...
LIGHTER_PUBLIC_KEY=...
ACCOUNT_INDEX=...

# Aster
ASTER_API_KEY=...
ASTER_SECRET_KEY=...

# Trading
TRADE_TOKENS=SOL,DOGE,BNB
POSITION_SIZE=200
LEVERAGE=5
SL_PERCENT=0
TIME_OPEN_CLOSE=1,2,3
AUTO_RESTART=true

# Telegram (optional)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

### 2. Build & Run

```bash
# Build image
docker-compose build

# Start bot
docker-compose up -d

# View logs
docker-compose logs -f hedging-bot

# Stop bot
docker-compose down
```

---

## 📊 Commands

### View Logs
```bash
# Real-time logs
docker-compose logs -f hedging-bot

# Last 100 lines
docker-compose logs --tail=100 hedging-bot

# Save logs to file
docker-compose logs hedging-bot > bot.log
```

### Restart
```bash
# Restart bot
docker-compose restart hedging-bot

# Rebuild & restart
docker-compose up -d --build hedging-bot
```

### Stop
```bash
# Stop (keep container)
docker-compose stop hedging-bot

# Stop & remove
docker-compose down
```

---

## 🔍 Debugging

### Check Status
```bash
# Container status
docker-compose ps

# Resource usage
docker stats hedging-bot

# Enter container
docker exec -it hedging-bot bash
```

### Check Logs
```bash
# Check if bot is running
docker-compose logs hedging-bot | grep "HEDGING BOT"

# Check for errors
docker-compose logs hedging-bot | grep "❌\|ERROR\|Failed"

# Check positions
docker-compose logs hedging-bot | grep "Positions opened"
```

---

## ⚠️ Important Notes

### 1. **No API Servers Needed**
Bot uses **direct SDK calls** → No Lighter/Aster API servers!

### 2. **Environment Variables**
Make sure `.env` is properly configured before building!

### 3. **Restart Policy**
`restart: unless-stopped` → Bot auto-restarts if crashes

### 4. **Health Checks**
Docker checks if `main.py` process is running every 60s

---

## 🎯 Production Deployment

### 1. Update `.env`
```bash
AUTO_RESTART=true
TRADE_TOKENS=SOL,DOGE,BNB
POSITION_SIZE=200
```

### 2. Start in background
```bash
docker-compose up -d
```

### 3. Monitor
```bash
# Watch logs
docker-compose logs -f hedging-bot

# Check Telegram notifications
```

### 4. Stop safely
```bash
# Stop bot (will try to close positions)
docker-compose down

# Or send SIGTERM
docker stop hedging-bot
```

---

## 🛠️ Troubleshooting

### Bot not starting
```bash
# Check logs
docker-compose logs hedging-bot

# Check .env
docker exec hedging-bot env | grep LIGHTER

# Rebuild
docker-compose down
docker-compose up -d --build
```

### Positions not closing
```bash
# Check if bot is running
docker-compose ps

# Manual close via script
docker exec hedging-bot python3 -c "..."
```

---

## 📝 Architecture

```
┌─────────────────────────────────────┐
│       Docker Container              │
│                                     │
│  ┌──────────────────────────────┐  │
│  │      main.py                 │  │
│  │         ↓                    │  │
│  │      bot/bot.py              │  │
│  │       ↙    ↘                 │  │
│  │  lighter_trader  aster_trader│  │
│  │       ↓              ↓        │  │
│  │  Lighter SDK   Aster SDK     │  │
│  └──────────────────────────────┘  │
│              ↓        ↓             │
└──────────────┼────────┼─────────────┘
               ↓        ↓
        Lighter DEX  Aster DEX
```

**Direct SDK calls - Simple & Fast!** ✅

