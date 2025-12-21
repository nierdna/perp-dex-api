# 🔗 Redis Integration Guide

> Hướng dẫn tích hợp với PnL Bot qua Redis để các dự án khác có thể đọc dữ liệu real-time.

---

## 📋 Tổng quan

PnL Bot lưu dữ liệu vào Redis với cấu trúc key chuẩn hóa, cho phép:
- Đọc PnL real-time (cập nhật mỗi 30s)
- Tra cứu lịch sử performance (lưu trữ 7 ngày)
- Tránh trùng lặp API calls (cache 10s)
- Khám phá các wallet đang được monitor

---

## 🔑 Redis Key Structure

### 1. Real-time PnL Snapshot

Dữ liệu PnL mới nhất, cập nhật mỗi 30 giây.

```
Key:    hyperliquid:pnl:{wallet}:latest
Type:   JSON String
TTL:    60 seconds
```

**Value Schema:**
```json
{
  "wallet": "0x63a5f92392e64a363f33aa10002624732c0ae2e0",
  "net": "-45.50",
  "realized": "-42.00",
  "fee": "3.50",
  "volume": "15000.00",
  "trades": 12,
  "wins": 5,
  "losses": 7,
  "winrate": "41.7",
  "byCoin": {
    "SOL": "-30.00",
    "BTC": "-12.00",
    "ETH": "+2.50"
  },
  "updatedAt": "2025-12-22T01:30:00.000Z"
}
```

---

### 2. Daily Report History

Báo cáo PnL theo ngày, lưu trữ 7 ngày gần nhất.

```
Key:    hyperliquid:pnl:{wallet}:daily:{YYYY-MM-DD}
Type:   JSON String
TTL:    7 days
```

**Value Schema:**
```json
{
  "wallet": "0x63a5f92392e64a363f33aa10002624732c0ae2e0",
  "date": "2025-12-22",
  "net": "-45.50",
  "realized": "-42.00",
  "fee": "3.50",
  "volume": "15000.00",
  "trades": 12,
  "wins": 5,
  "losses": 7,
  "winrate": "41.7",
  "byCoin": { "SOL": "-30.00", "BTC": "-12.00" },
  "createdAt": "2025-12-22T11:00:00.000Z"
}
```

---

### 3. API Response Cache

Cache kết quả từ Hyperliquid API để tránh rate limiting.

```
Key:    hyperliquid:fills:{wallet}
Type:   JSON String (Array of fills)
TTL:    10 seconds
```

---

### 4. Active Wallets Registry

Danh sách các wallet đang được PnL Bot monitor.

```
Key:    hyperliquid:wallets:active
Type:   Set
TTL:    No expiry
```

---

### 5. Alert Deduplication

Đánh dấu alert đã gửi trong ngày (tránh spam).

```
Key:    pnl:stoploss:alert:{wallet}:{YYYY-MM-DD}
Key:    pnl:happy:alert:{wallet}:{YYYY-MM-DD}
Type:   String ("1")
TTL:    Until midnight UTC
```

---

## 💻 Code Examples

### JavaScript/Node.js (ioredis)

```javascript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
  db: parseInt(process.env.REDIS_DATABASE)
});

// 1. Get real-time PnL for a wallet
async function getCurrentPnL(wallet) {
  const key = `hyperliquid:pnl:${wallet}:latest`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

// 2. Get all active wallets
async function getActiveWallets() {
  return await redis.smembers('hyperliquid:wallets:active');
}

// 3. Get daily report for a specific date
async function getDailyReport(wallet, date) {
  const key = `hyperliquid:pnl:${wallet}:daily:${date}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

// 4. Get last 7 days performance
async function getWeeklyPerformance(wallet) {
  const reports = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const report = await getDailyReport(wallet, dateStr);
    if (report) reports.push(report);
  }
  return reports;
}

// 5. Check if alert was sent today
async function wasAlertSentToday(wallet, type = 'stoploss') {
  const today = new Date().toISOString().split('T')[0];
  const key = `pnl:${type}:alert:${wallet}:${today}`;
  return (await redis.exists(key)) === 1;
}

// Usage example
const pnl = await getCurrentPnL('0x63a5f92392e64a363f33aa10002624732c0ae2e0');
if (pnl) {
  console.log(`Current PnL: ${pnl.net} USDC`);
  console.log(`Win Rate: ${pnl.winrate}%`);
  console.log(`Updated: ${pnl.updatedAt}`);
}
```

### Python (redis-py)

```python
import redis
import json
from datetime import datetime, timedelta

r = redis.Redis(
    host='your-redis-host',
    port=6379,
    password='your-password',
    db=0,
    decode_responses=True
)

def get_current_pnl(wallet: str) -> dict | None:
    """Get real-time PnL for a wallet"""
    key = f"hyperliquid:pnl:{wallet}:latest"
    data = r.get(key)
    return json.loads(data) if data else None

def get_active_wallets() -> list:
    """Get all wallets being monitored"""
    return list(r.smembers('hyperliquid:wallets:active'))

def get_daily_report(wallet: str, date: str = None) -> dict | None:
    """Get daily report for a specific date (YYYY-MM-DD)"""
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')
    key = f"hyperliquid:pnl:{wallet}:daily:{date}"
    data = r.get(key)
    return json.loads(data) if data else None

def get_weekly_performance(wallet: str) -> list:
    """Get last 7 days performance"""
    reports = []
    for i in range(7):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        report = get_daily_report(wallet, date)
        if report:
            reports.append(report)
    return reports

# Usage
pnl = get_current_pnl('0x63a5f92392e64a363f33aa10002624732c0ae2e0')
if pnl:
    print(f"Current PnL: {pnl['net']} USDC")
    print(f"Win Rate: {pnl['winrate']}%")
```

---

## 🔧 Redis Configuration

Các dự án cần cấu hình Redis giống với PnL Bot:

```bash
REDIS_HOST=shinkansen.proxy.rlwy.net
REDIS_PORT=43764
REDIS_PASSWORD=vUhjwNmoIHabPxWwlHHTvzEHFOcoDWfq
REDIS_USERNAME=default
REDIS_DATABASE=1
REDIS_FAMILY=0
```

---

## 📊 Data Flow Diagram

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Hyperliquid    │────▶│   PnL Bot    │────▶│     Redis       │
│      API        │     │  (Producer)  │     │   (Storage)     │
└─────────────────┘     └──────────────┘     └────────┬────────┘
                                                      │
                        ┌─────────────────────────────┴─────────────────────────────┐
                        │                             │                             │
                        ▼                             ▼                             ▼
                 ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
                 │  Dashboard   │            │  Alert Bot   │            │  Analytics   │
                 │  (Consumer)  │            │  (Consumer)  │            │  (Consumer)  │
                 └──────────────┘            └──────────────┘            └──────────────┘
```

---

## ⚠️ Lưu ý quan trọng

1. **TTL Management**: Dữ liệu real-time có TTL 60s, nếu PnL Bot dừng hoạt động, key sẽ tự hết hạn.

2. **Rate Limiting**: PnL Bot đã cache API response 10s, nên nếu bạn cần data mới hơn, hãy chờ cache hết hạn.

3. **Timezone**: Tất cả timestamp đều là **UTC**. Daily key format là `YYYY-MM-DD` theo UTC.

4. **Connection Pooling**: Nên sử dụng connection pool nếu đọc Redis từ nhiều nơi cùng lúc.

---

## 📚 Tài liệu liên quan

- [README.md](./README.md) - Hướng dẫn cài đặt và sử dụng PnL Bot
- [.env.example](./.env.example) - Template cấu hình

---

## 📞 Support

Nếu cần hỗ trợ tích hợp, liên hệ team LYNX AI Solution.
