# 🤖 Hedging Trading Bot - Market Neutral Strategy

Tự động mở vị thế đối xứng trên Lighter và Aster DEX để kiếm lợi từ chênh lệch funding rate.

## 📋 Mục Lục

- [Chiến Lược](#-chiến-lược)
- [Cài Đặt](#-cài-đặt)
- [Cấu Hình](#-cấu-hình)
- [Chạy Bot](#-chạy-bot)
- [Docker](#-docker)
- [Telegram](#-telegram)
- [Lưu Ý](#-lưu-ý)

---

## 🎯 Chiến Lược

### **Market Neutral Hedging**

Bot tự động:
1. **Random LONG/SHORT** cho 2 sàn (đối xứng)
   - Ví dụ: Lighter LONG → Aster SHORT
   - Hoặc: Lighter SHORT → Aster LONG

2. **Đặt lệnh đồng thời** trên cả 2 sàn
   - Nếu 1 lệnh fail → **Tự động cancel lệnh còn lại**
   - Chỉ giữ vị thế khi **CẢ 2 lệnh thành công**

3. **Tự động đóng lệnh** sau khoảng thời gian random
   - Ví dụ: 20, 30, hoặc 60 phút
   - Đóng qua TP/SL đã đặt sẵn

4. **Thông báo Telegram** cho mọi sự kiện
   - Mở vị thế thành công
   - Lỗi khi mở vị thế
   - Đóng vị thế

### **Lợi Nhuận Từ Đâu?**

1. **Funding Rate Arbitrage**:
   - Lighter funding: +0.05%
   - Aster funding: -0.03%
   - **Lợi nhuận**: +0.08% mỗi 8h

2. **Market Neutral**:
   - Không lo giá tăng/giảm
   - LONG + SHORT = 0 exposure

3. **Leverage Efficiency**:
   - Dùng leverage 5x → lợi nhuận x5

---

## 🚀 Cài Đặt

### **1. Clone Repository**

```bash
git clone <your-repo-url>
cd point-dex
```

### **2. Cài Đặt Dependencies**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### **3. Tạo File `.env`**

```bash
cp env.example.new .env
```

Sau đó chỉnh sửa `.env` với thông tin của bạn.

---

## ⚙️ Cấu Hình

### **File `.env`**

```bash
# ============================================
# LIGHTER DEX
# ============================================
LIGHTER_API_URL=https://api.lighter.xyz
LIGHTER_PRIVATE_KEY=your_private_key_here

# ============================================
# ASTER DEX
# ============================================
ASTER_API_URL=https://fapi.asterdex.com
ASTER_API_KEY=your_aster_api_key_here
ASTER_SECRET_KEY=your_aster_secret_key_here

# ============================================
# TRADING CONFIGURATION
# ============================================
TRADE_TOKEN=BTC                    # BTC, ETH, SOL, BNB, PUMP, etc.
POSITION_SIZE=200                  # Total USD (split across 2 exchanges)
LEVERAGE=5                         # Leverage for both exchanges
SL_PERCENT=3                       # Stop Loss percentage
RR_RATIO=1,2                       # Risk:Reward ratio [risk, reward]
TIME_OPEN_CLOSE=20,30,60           # Random time options (minutes)

# ============================================
# TELEGRAM NOTIFICATIONS
# ============================================
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# ============================================
# BOT CONFIGURATION
# ============================================
BOT_ENABLED=true                   # Enable/disable bot
TELEGRAM_ENABLED=true              # Enable/disable Telegram
AUTO_RESTART=false                 # Auto-restart after closing positions
```

### **Giải Thích Các Tham Số**

| Tham số | Mô tả | Ví dụ |
|---------|-------|-------|
| `TRADE_TOKEN` | Coin muốn trade | `BTC`, `SOL`, `PUMP` |
| `POSITION_SIZE` | Tổng volume (USD) | `200` = $100 mỗi sàn |
| `LEVERAGE` | Đòn bẩy | `5` = 5x |
| `SL_PERCENT` | Stop Loss (%) | `3` = -3% |
| `RR_RATIO` | Risk:Reward | `1,2` = 1:2 |
| `TIME_OPEN_CLOSE` | Thời gian giữ lệnh (phút) | `20,30,60` = random 20-60 phút |
| `AUTO_RESTART` | Tự động chạy lại sau khi đóng | `true` hoặc `false` |

---

## 🏃 Chạy Bot

### **Chạy Trực Tiếp (Development)**

```bash
# Terminal 1: Lighter API
cd perpsdex/lighter
source ../../venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Aster API
cd perpsdex/aster
source ../../venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 8001

# Terminal 3: Hedging Bot
source venv/bin/activate
python main.py
```

### **Chạy Với Docker (Production)**

```bash
# Build và chạy tất cả services
docker-compose up -d

# Xem logs
docker-compose logs -f hedging-bot

# Dừng bot
docker-compose down
```

---

## 🐳 Docker

### **Docker Services**

1. **lighter-api**: Lighter DEX API server (port 8000)
2. **aster-api**: Aster DEX API server (port 8001)
3. **hedging-bot**: Main hedging bot

### **Docker Commands**

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f hedging-bot

# Stop all services
docker-compose down

# Restart a service
docker-compose restart hedging-bot

# View running containers
docker-compose ps
```

---

## 📱 Telegram

### **1. Tạo Bot**

1. Mở Telegram, tìm `@BotFather`
2. Gửi `/newbot`
3. Đặt tên bot
4. Copy `TELEGRAM_BOT_TOKEN`

### **2. Lấy Chat ID**

1. Mở Telegram, tìm `@userinfobot`
2. Gửi `/start`
3. Copy `TELEGRAM_CHAT_ID`

### **3. Cấu Hình**

Thêm vào `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=987654321
TELEGRAM_ENABLED=true
```

### **4. Test**

```bash
# Chạy bot và kiểm tra Telegram
python main.py
```

Bạn sẽ nhận được thông báo:
- 🤖 Bot started
- ✅ Opened hedged position
- 🔄 Closing positions
- 🛑 Bot stopped

---

## ⚠️ Lưu Ý

### **1. Rủi Ro**

- **Slippage**: Giá có thể trượt khi đặt lệnh
- **Funding Rate**: Có thể thay đổi theo thời gian
- **Liquidation**: Nếu giá biến động mạnh
- **API Errors**: Lỗi kết nối có thể gây mất cân bằng hedge

### **2. Khuyến Nghị**

- ✅ **Bắt đầu với volume nhỏ** ($50-100)
- ✅ **Test trên testnet** trước khi dùng mainnet
- ✅ **Bật Telegram notifications** để theo dõi
- ✅ **Kiểm tra balance** thường xuyên
- ✅ **Set `AUTO_RESTART=false`** khi mới bắt đầu

### **3. Troubleshooting**

**Bot không chạy:**
```bash
# Kiểm tra .env
cat .env

# Kiểm tra API servers
curl http://localhost:8000/api/status
curl http://localhost:8001/api/status

# Xem logs
docker-compose logs -f
```

**Lệnh không đặt được:**
```bash
# Kiểm tra balance
curl http://localhost:8000/api/market/balance
curl http://localhost:8001/api/market/balance

# Kiểm tra API keys
# Lighter: Check private key
# Aster: Check API key + secret
```

**Telegram không gửi:**
```bash
# Test Telegram API
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/sendMessage" \
  -d "chat_id=<YOUR_CHAT_ID>" \
  -d "text=Test message"
```

---

## 📊 Monitoring

### **Xem Vị Thế Hiện Tại**

```bash
# Lighter positions
curl http://localhost:8000/api/positions

# Aster positions
curl http://localhost:8001/api/positions
```

### **Xem Balance**

```bash
# Lighter balance
curl http://localhost:8000/api/market/balance

# Aster balance
curl http://localhost:8001/api/market/balance
```

### **Xem Lịch Sử Orders**

```bash
# Lighter orders
curl http://localhost:8000/api/orders/history

# Aster orders
curl http://localhost:8001/api/orders/history
```

---

## 🔧 Advanced Configuration

### **Chạy Multiple Bots**

Bạn có thể chạy nhiều bots với các token khác nhau:

```bash
# Bot 1: BTC
TRADE_TOKEN=BTC POSITION_SIZE=200 python main.py

# Bot 2: SOL
TRADE_TOKEN=SOL POSITION_SIZE=100 python main.py

# Bot 3: PUMP
TRADE_TOKEN=PUMP POSITION_SIZE=50 python main.py
```

### **Custom Time Schedule**

```bash
# Đóng lệnh sau 10-15 phút
TIME_OPEN_CLOSE=10,12,15

# Đóng lệnh sau 1-2 giờ
TIME_OPEN_CLOSE=60,90,120
```

---

## 📝 License

MIT License

---

## 🤝 Support

Nếu có vấn đề, vui lòng:
1. Kiểm tra logs: `docker-compose logs -f`
2. Kiểm tra `.env` configuration
3. Test API endpoints manually
4. Check Telegram notifications

---

**Happy Trading! 🚀**

