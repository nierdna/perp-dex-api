# 🚀 Quick Start - Hedging Bot

## 1️⃣ Setup (5 phút)

```bash
# Clone và cài đặt
git clone <repo>
cd point-dex
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Tạo .env
cp env.example.new .env
nano .env  # Chỉnh sửa với thông tin của bạn
```

## 2️⃣ Cấu Hình `.env`

```bash
# LIGHTER
LIGHTER_PRIVATE_KEY=0x...

# ASTER
ASTER_API_KEY=...
ASTER_SECRET_KEY=...

# TRADING
TRADE_TOKEN=BTC
POSITION_SIZE=200
LEVERAGE=5
SL_PERCENT=3
RR_RATIO=1,2
TIME_OPEN_CLOSE=20,30,60

# TELEGRAM
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_ENABLED=true

# BOT
BOT_ENABLED=true
AUTO_RESTART=false
```

## 3️⃣ Test Setup

```bash
./test_bot.sh
```

## 4️⃣ Chạy Bot

### **Option A: Manual (Development)**

```bash
# Terminal 1: Lighter API
cd perpsdex/lighter
source ../../venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Aster API
cd perpsdex/aster
source ../../venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 8001

# Terminal 3: Bot
source venv/bin/activate
python main.py
```

### **Option B: Docker (Production)**

```bash
docker-compose up -d
docker-compose logs -f hedging-bot
```

## 5️⃣ Monitor

```bash
# Xem logs
docker-compose logs -f hedging-bot

# Xem positions
curl http://localhost:8000/api/positions  # Lighter
curl http://localhost:8001/api/positions  # Aster

# Xem balance
curl http://localhost:8000/api/market/balance
curl http://localhost:8001/api/market/balance
```

## 6️⃣ Stop Bot

```bash
# Manual
Ctrl+C

# Docker
docker-compose down
```

---

## 📱 Telegram Setup

1. Tìm `@BotFather` → `/newbot` → Copy token
2. Tìm `@userinfobot` → `/start` → Copy chat ID
3. Thêm vào `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABC...
   TELEGRAM_CHAT_ID=987654321
   ```

---

## ⚠️ Lưu Ý

- ✅ **Bắt đầu với volume nhỏ** ($50-100)
- ✅ **Set `AUTO_RESTART=false`** lần đầu
- ✅ **Bật Telegram** để theo dõi
- ✅ **Kiểm tra balance** trước khi chạy

---

## 🆘 Troubleshooting

**Bot không chạy:**
```bash
./test_bot.sh  # Kiểm tra setup
```

**API không kết nối:**
```bash
curl http://localhost:8000/api/status
curl http://localhost:8001/api/status
```

**Telegram không gửi:**
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>" \
  -d "text=Test"
```

---

**Đọc thêm**: [HEDGING_BOT_README.md](HEDGING_BOT_README.md)

