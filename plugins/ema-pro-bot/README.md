# 🚀 EMA PRO BOT — Hyperliquid EMA Cross Alert System  
**Realtime + Official Candle + EMA9/26 + Volume Spike + Multi-Timeframe + Multi-Token**

Bot này được thiết kế để theo dõi **EMA Cross chuyên nghiệp** trên Hyperliquid futures, bao gồm:

- EMA9 & EMA26 (dynamic + official candle)
- Alert 3 loại tín hiệu:
  - **A – Confirmed Cross** (candle close → tín hiệu chuẩn nhất)
  - **B – Near Cross** (EMA9 ≈ EMA26 realtime)
  - **C – Volume Spike Cross** (đột biến volume realtime)
- Multi-token (BTC, ETH, SOL…)
- Multi-timeframe (1m, 5m, 15m, 1h, 4h, 8h)
- Anti-spam logic
- Bắn alert tự động về Telegram

Đây là bản PRO, hoạt động rất nhanh và chính xác nhờ **kết hợp data realtime + data candle**.

---

# 📦 1. Cài đặt

```
npm install
```

---

# ⚙️ 2. Cấu hình ENV

```
TOKENS=BTC,ETH,SOL
TIMEFRAMES=1m,5m,15m,1h,4h,8h

TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID=YOUR_CHAT_ID
TELEGRAM_TOPIC=OPTIONAL
```

---

# ▶️ 3. Chạy bot

```
npm start
```

---

# 🧠 4. Cách bot hoạt động

### Realtime Layer  
- Nhận trades realtime  
- Update EMA9 & EMA26  
- Detect Near Cross (B)  
- Detect Momentum Spike (C)

### Candle Layer  
- Fetch nến theo timeframe  
- Tính EMA official  
- Detect Confirmed Cross (A)

---

# 🔔 5. Các loại Alert

(Full details as provided earlier)
