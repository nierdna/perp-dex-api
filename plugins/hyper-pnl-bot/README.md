# 📊 Hyperliquid PnL Telegram Bot

Bot này tự động theo dõi **Hiệu suất giao dịch (PnL)** của nhiều wallet Hyperliquid và gửi báo cáo định kỳ lên Telegram.

---

## ✨ Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 📊 **Daily Report** | Báo cáo PnL hàng ngày vào giờ cố định (UTC) |
| 🚀 **Happy Alert** | Cảnh báo khi lãi vượt ngưỡng (ví dụ: > 100 USDC) |
| 🛑 **Stop Loss Alert** | Cảnh báo khi lỗ vượt ngưỡng (ví dụ: < -40 USDC) |
| 🔄 **Real-time Monitor** | Kiểm tra PnL mỗi 30 giây |
| 🔒 **Singleton Lock** | Đảm bảo chỉ 1 instance bot chạy (tránh spam) |
| 📝 **Redis Dedup** | Mỗi loại alert chỉ gửi 1 lần/ngày |
| 🔗 **Cross-Project Redis** | Dữ liệu PnL được lưu vào Redis để các dự án khác đọc → [Xem hướng dẫn](./docs/REDIS_INTEGRATION.md) |

---

## 🚀 Cài đặt

### 1. Clone và cài đặt dependencies

```bash
cd hyper-pnl-bot
npm install
```

### 2. Cấu hình `.env`

Copy file `.env.example` thành `.env` và điền thông tin:

```bash
cp .env.example .env
```

### 3. Chạy bot

```bash
npm run start
```

---

## ⚙️ Cấu hình `.env`

```bash
# Wallet addresses (comma-separated for multiple wallets)
WALLETS=0x63a5f92392e64a363f33aa10002624732c0ae2e0

# ═══════════════════════════════════════════════════════
# DAILY REPORT SETTINGS
# ═══════════════════════════════════════════════════════

# Time to run daily report (Format: HH:MM in UTC)
# Example: 00:00 UTC = 07:00 AM Vietnam
# Example: 11:00 UTC = 18:00 PM Vietnam
PNL_INTERVAL_TIME=11:00

# Lookback window for PnL calculation
PNL_WINDOW=24h

# Set to 1 to run immediately on startup, 0 to wait for schedule
ALERT_INIT=0

# ═══════════════════════════════════════════════════════
# TELEGRAM SETTINGS
# ═══════════════════════════════════════════════════════

TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here

# ═══════════════════════════════════════════════════════
# ALERT THRESHOLDS (Real-time monitoring every 30s)
# ═══════════════════════════════════════════════════════

# Happy Alert: Send alert if PnL (24h) > this value
# Set to 0 to disable
HAPPY_PNL=100

# Stop Loss Alert: Send alert if PnL (24h) < this value
# Set to 0 to disable
# Example: -40 means alert when losing more than 40 USDC
STOP_LOSS_PNL=-40

# ═══════════════════════════════════════════════════════
# REDIS SETTINGS (Required for alert deduplication)
# ═══════════════════════════════════════════════════════

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USERNAME=default
REDIS_DATABASE=0
REDIS_FAMILY=0
```

---

## 📦 Redis Key Structure (Cross-Project Compatible)

Bot lưu dữ liệu vào Redis để **các dự án khác có thể đọc và sử dụng**.

### 1. Real-time PnL Snapshot
```
Key:    hyperliquid:pnl:{wallet}:latest
Type:   JSON String
TTL:    60 seconds (auto-refresh every 30s)
```

**Value Example:**
```json
{
  "wallet": "0x63a5f...",
  "net": "-45.50",
  "realized": "-42.00",
  "fee": "3.50",
  "volume": "15000.00",
  "trades": 12,
  "wins": 5,
  "losses": 7,
  "winrate": "41.7",
  "byCoin": { "SOL": "-30.00", "BTC": "-12.00" },
  "updatedAt": "2025-12-22T01:30:00.000Z"
}
```

### 2. Daily Report History
```
Key:    hyperliquid:pnl:{wallet}:daily:{YYYY-MM-DD}
Type:   JSON String
TTL:    7 days
```

### 3. API Response Cache
```
Key:    hyperliquid:fills:{wallet}
Type:   JSON String (array of fills)
TTL:    10 seconds
```

### 4. Active Wallets Registry
```
Key:    hyperliquid:wallets:active
Type:   Set
TTL:    No expiry
```

### 5. Alert Deduplication
```
Key:    pnl:stoploss:alert:{wallet}:{YYYY-MM-DD}
Key:    pnl:happy:alert:{wallet}:{YYYY-MM-DD}
Type:   String ("1")
TTL:    Until midnight UTC
```

### Cách đọc từ dự án khác (Example):
```javascript
import Redis from 'ioredis';

const redis = new Redis({ host: 'your-redis-host', port: 6379, password: '...' });

// Get real-time PnL
const pnlData = await redis.get('hyperliquid:pnl:0x63a5f...:latest');
const pnl = JSON.parse(pnlData);
console.log('Current PnL:', pnl.net, 'USDC');

// Get all active wallets
const wallets = await redis.smembers('hyperliquid:wallets:active');
console.log('Active wallets:', wallets);
```

---

## 📱 Tin nhắn Telegram

### 📊 Daily Report
```
📊 Hyperliquid PnL Report
0x63a5f92392e64a363f33aa10002624732c0ae2e0

🏆 Win Rate: 53.6%
• Trades: 28
• W/L: 15W - 13L

💰 PnL Summary
• Realized: +4.37 USDC 🟢
• Fees: -11.30 USDC
• Volume: 32,400 USDC
• Net PnL: -6.93 USDC 🔴

💎 By Coin
• SOL: +2.50 USDC
• BTC: -9.43 USDC
```

### 🚀 Happy Alert
```
🚀 BIG WIN ALERT! 🚀
0x63a5f...

🎉 PnL (24h): +150.00 USDC
✅ Target: > 100 USDC

Keep it up! 💰💰💰
```

### 🛑 Stop Loss Alert
```
🛑 STOP LOSS ALERT! 🛑
0x63a5f...

⚠️ PnL (24h): -45.00 USDC
🚫 Ngưỡng dừng: -40 USDC

❌ Nghỉ ngơi đi bạn ơi! Đừng trade nữa hôm nay.
💡 Hãy xem lại chiến thuật và quay lại ngày mai.
```

---

## 🏗️ Cấu trúc thư mục

```
hyper-pnl-bot/
├── index.js              # Entry point + Singleton Lock (Port 3333)
├── src/
│   ├── config.js         # Đọc và validate .env
│   ├── hyperApi.js       # Gọi API Hyperliquid
│   ├── pnlEngine.js      # Tính toán PnL, Winrate, Volume
│   ├── redis.js          # Redis helpers (deduplication)
│   ├── scheduler.js      # Lập lịch Daily Report + PnL Monitor
│   └── telegram.js       # Gửi tin nhắn Telegram
├── .env.example          # Template cấu hình
├── package.json
└── README.md
```

---

## 🔧 Cách hoạt động

### 1. Daily Report (Báo cáo hàng ngày)
- Chạy đúng giờ được cài trong `PNL_INTERVAL_TIME` (UTC)
- Quét PnL của `PNL_WINDOW` (mặc định 24h) gần nhất
- Gửi báo cáo đầy đủ lên Telegram

### 2. PnL Monitor (Giám sát real-time)
- Kiểm tra PnL mỗi **30 giây**
- Nếu PnL > `HAPPY_PNL` → Gửi Happy Alert (1 lần/ngày)
- Nếu PnL < `STOP_LOSS_PNL` → Gửi Stop Loss Alert (1 lần/ngày)
- Sử dụng Redis để tránh spam (key tự hết hạn lúc 00:00 UTC)

### 3. Singleton Lock
- Bot chiếm dụng Port 3333 khi khởi động
- Nếu chạy thêm 1 instance khác → Tự động tắt với lỗi:
  ```
  ❌ FATAL ERROR: Port 3333 is already in use!
  ⚠️ A PnL Bot instance is ALREADY RUNNING.
  ```

---

## 📝 Ghi chú

### Chuyển đổi múi giờ
- Bot sử dụng giờ **UTC**
- Việt Nam = UTC + 7
- Ví dụ: Muốn báo cáo lúc **18:00 VN** → Cài `PNL_INTERVAL_TIME=11:00`

### Yêu cầu Redis
- Redis là **bắt buộc** để tính năng deduplication hoạt động
- Nếu không có Redis, bot sẽ spam alert mỗi 30 giây!

---

## 📚 Tài liệu bổ sung

| File | Mô tả |
|------|-------|
| [docs/REDIS_INTEGRATION.md](./docs/REDIS_INTEGRATION.md) | Hướng dẫn tích hợp Redis cho các dự án khác |
| [.env.example](./.env.example) | Template cấu hình môi trường |

---

## 📄 License

MIT License
