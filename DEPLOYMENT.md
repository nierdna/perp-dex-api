# 🚀 DEPLOYMENT GUIDE

## 📦 Image đã publish tại:
```
docker.io/mongker/hedging-bot:latest
```

---

## 🎯 DEPLOY TRÊN SERVER MỚI

### **Option 1: Docker Run (Simple)**

```bash
# Step 1: Pull image
docker pull mongker/hedging-bot:latest

# Step 2: Tạo .env
nano .env
```

**Nội dung .env:**
```bash
# LIGHTER
LIGHTER_PRIVATE_KEY=0x...
LIGHTER_PUBLIC_KEY=0x...
ACCOUNT_INDEX=123456

# ASTER
ASTER_API_KEY=...
ASTER_SECRET_KEY=...

# TRADING
TRADE_TOKENS=SOL,DOGE,BNB
POSITION_SIZE=200
LEVERAGE=5
SL_PERCENT=0
TIME_OPEN_CLOSE=1,2,3
AUTO_RESTART=true

# TELEGRAM
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

```bash
# Step 3: Run
docker run -d \
  --name hedging-bot \
  --env-file .env \
  --restart unless-stopped \
  mongker/hedging-bot:latest

# Step 4: View logs
docker logs -f hedging-bot
```

---

### **Option 2: Docker Compose (Recommended)**

```bash
# Step 1: Tạo docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  hedging-bot:
    image: mongker/hedging-bot:latest
    container_name: hedging-bot
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "pgrep", "-f", "main.py"]
      interval: 60s
      timeout: 10s
      retries: 5
EOF

# Step 2: Tạo .env (same as above)
nano .env

# Step 3: Start
docker-compose up -d

# Step 4: Logs
docker-compose logs -f hedging-bot

# Step 5: Stop
docker-compose down
```

---

## 🔄 UPDATE IMAGE

```bash
# Pull latest version
docker pull mongker/hedging-bot:latest

# Restart container
docker-compose down
docker-compose up -d

# Or với docker run:
docker stop hedging-bot
docker rm hedging-bot
docker run -d --name hedging-bot --env-file .env --restart unless-stopped mongker/hedging-bot:latest
```

---

## 📊 MONITORING

### View logs
```bash
# Real-time
docker logs -f hedging-bot

# Last 100 lines
docker logs --tail=100 hedging-bot

# Save to file
docker logs hedging-bot > bot.log
```

### Check status
```bash
# Container status
docker ps | grep hedging-bot

# Resource usage
docker stats hedging-bot

# Health check
docker inspect hedging-bot | grep -A 10 Health
```

---

## 🛑 STOP & RESTART

### Stop
```bash
docker stop hedging-bot
# Bot will try to close positions before exit
```

### Restart
```bash
docker restart hedging-bot
```

### Remove
```bash
docker stop hedging-bot
docker rm hedging-bot
```

---

## 🔧 TROUBLESHOOTING

### Bot không start
```bash
# Check logs
docker logs hedging-bot

# Check env
docker exec hedging-bot env | grep LIGHTER

# Enter container
docker exec -it hedging-bot bash
cd /app
python3 main.py
```

### Update credentials
```bash
# Edit .env
nano .env

# Restart
docker restart hedging-bot
```

---

## 📝 EXAMPLE PRODUCTION SETUP

```bash
# On VPS/Server:
cd /opt/hedging-bot
nano .env  # Configure credentials

docker-compose up -d
docker-compose logs -f

# Setup auto-start on reboot
# Add to crontab:
@reboot cd /opt/hedging-bot && docker-compose up -d
```

---

## 🎯 FULL EXAMPLE

```bash
# 1. Install Docker (Ubuntu)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl start docker
systemctl enable docker

# 2. Setup bot
mkdir -p /opt/hedging-bot
cd /opt/hedging-bot

# 3. Create .env
cat > .env << 'EOF'
LIGHTER_PRIVATE_KEY=0x...
LIGHTER_PUBLIC_KEY=0x...
ACCOUNT_INDEX=123456
ASTER_API_KEY=...
ASTER_SECRET_KEY=...
TRADE_TOKENS=SOL,DOGE,BNB
POSITION_SIZE=200
LEVERAGE=5
AUTO_RESTART=true
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
EOF

# 4. Run
docker pull mongker/hedging-bot:latest
docker run -d \
  --name hedging-bot \
  --env-file .env \
  --restart unless-stopped \
  mongker/hedging-bot:latest

# 5. Monitor
docker logs -f hedging-bot
```

---

## ✅ ADVANTAGES

- ✅ **One-command deploy**: Pull & run
- ✅ **No setup needed**: Dependencies included
- ✅ **Auto-restart**: Unless stopped manually
- ✅ **Portable**: Run anywhere Docker exists
- ✅ **Isolated**: Safe environment

---

## 📌 NOTES

- Image size: ~500MB
- Platform: linux/amd64
- Python: 3.11-slim
- Includes: All dependencies (lighter-sdk, aiohttp, etc.)

