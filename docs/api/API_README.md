# 🚀 Trading API Server - Documentation

API Server cho phép bên thứ 3 gọi để đặt lệnh trên Lighter và Aster DEX.

---

## 🎯 MỤC ĐÍCH

- **Bảo vệ IP**: User không cần expose IP của mình khi trading
- **Đơn giản**: Chỉ cần call API, không cần cài đặt môi trường
- **Linh hoạt**: Support nhiều user, nhiều accounts
- **Bảo mật**: Keys được truyền qua request body (không lưu trên server)

---

## 🏃 CÁCH CHẠY

### **1. Cấu hình `.env`**

```bash
# Enable API server
IS_API=1
IS_WORKER=0

# Port (default: 8080)
API_PORT=8080

# Optional: Default keys (nếu user không truyền keys)
LIGHTER_PRIVATE_KEY=0x...
ACCOUNT_INDEX=198336
ASTER_API_KEY=...
ASTER_SECRET_KEY=...
```

### **2. Khởi động server**

```bash
# Option 1: Direct
python main.py

# Option 2: Uvicorn (có reload)
uvicorn api_server:app --host 0.0.0.0 --port 8080 --reload
```

### **3. Kiểm tra server**

```bash
# Health check
curl http://localhost:8080/api/status

# API docs
open http://localhost:8080/docs
```

---

## 📋 API ENDPOINTS

### **1. POST /api/order/market** - Đặt lệnh MARKET

**Request Body:**
```json
{
  // Trading params (Required)
  "exchange": "lighter",          // "lighter" hoặc "aster"
  "symbol": "BTC",                 // BTC, ETH, SOL, DOGE, etc
  "side": "long",                  // "long" hoặc "short"
  "size_usd": 200,                 // Size USD
  "leverage": 5,                   // Leverage (1-100)
  
  // TP/SL (Optional - nếu không có sẽ chỉ đặt entry order)
  "tp_price": 110000,              // Take profit price (optional)
  "sl_price": 100000               // Stop loss price (optional)
}
```

**Với custom keys:**
```json
{
  "keys": {
    "lighter_private_key": "0x...",
    "lighter_account_index": 198336
  },
  "exchange": "lighter",
  "symbol": "BTC",
  "side": "long",
  "size_usd": 200,
  "leverage": 5
}
```

**Response:**
```json
{
  "success": true,
  "exchange": "lighter",
  "symbol": "BTC",
  "side": "long",
  "order_id": "123456",
  "entry_price": 108500.0,
  "position_size": 0.00184,
  "size_usd": 200,
  "leverage": 5,
  "tp_sl_placed": false  // true nếu có TP/SL, false nếu chỉ entry order
}
```

**cURL Example:**
```bash
# Lighter LONG BTC (using ENV keys)
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 200,
    "leverage": 5
  }'

# Aster SHORT ETH (with custom keys)
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "keys": {
      "aster_api_key": "...",
      "aster_secret_key": "..."
    },
    "exchange": "aster",
    "symbol": "ETH",
    "side": "short",
    "size_usd": 100,
    "leverage": 3
  }'
```

---

### **2. POST /api/order/limit** - Đặt lệnh LIMIT

⚠️ **Coming soon** - Hiện tại chưa support đầy đủ

**Request Body:**
```json
{
  "exchange": "aster",
  "symbol": "BTC",
  "side": "long",
  "size_usd": 200,
  "leverage": 5,
  "limit_price": 108000,           // Entry price
  "tp_price": 110000,
  "sl_price": 106000
}
```

---

### **3. POST /api/order/close** - Đóng position

**Request Body:**
```json
{
  "exchange": "lighter",
  "symbol": "BTC"
}
```

**Với custom keys:**
```json
{
  "keys": {
    "lighter_private_key": "0x...",
    "lighter_account_index": 198336
  },
  "exchange": "lighter",
  "symbol": "BTC"
}
```

**Response:**
```json
{
  "success": true,
  "exchange": "lighter",
  "symbol": "BTC",
  "pnl_percent": 5.23,
  "message": "Position closed successfully"
}
```

**cURL Example:**
```bash
# Using ENV keys
curl -X POST http://localhost:8080/api/order/close \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC"
  }'
```

---

## 🔐 BẢO MẬT

### **1. Keys Handling**

**Option A**: Truyền keys trong mỗi request (RECOMMENDED)
```json
{
  "lighter_private_key": "0x...",
  "symbol": "BTC",
  ...
}
```
- ✅ **An toàn nhất**: Keys không lưu trên server
- ✅ **Multi-user**: Mỗi user dùng keys riêng
- ❌ **Phải truyền mỗi lần**: Hơi dài request

**Option B**: Dùng keys mặc định từ ENV
```json
{
  "symbol": "BTC",
  ...
}
```
- ✅ **Đơn giản**: Không cần truyền keys
- ❌ **Single user**: Chỉ 1 account
- ⚠️ **Ít an toàn hơn**: Keys lưu trên server

### **2. HTTPS (Production)**

⚠️ **QUAN TRỌNG**: Khi deploy production, BẮT BUỘC dùng HTTPS!

```bash
# Nginx reverse proxy với SSL
server {
    listen 443 ssl;
    server_name trading-api.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
    }
}
```

### **3. Rate Limiting (TODO)**

Hiện tại chưa có rate limiting. Sẽ implement sau:
- Max 10 requests/minute per IP
- Max 100 requests/hour per IP

---

## ⚙️ SUPPORTED EXCHANGES

### **Lighter DEX**

**Supported:**
- ✅ Market orders (LONG/SHORT)
- ✅ TP/SL orders
- ✅ Close positions
- ✅ Balance check

**Not Supported:**
- ❌ Limit orders (SDK limitation)

**Keys Required:**
- `lighter_private_key`: Private key (Layer 2)
- `lighter_account_index`: Account index (default: 0)

### **Aster DEX**

**Supported:**
- ✅ Market orders (LONG/SHORT)
- ✅ TP/SL orders
- ✅ Close positions
- ✅ Balance check

**Coming Soon:**
- ⏳ Limit orders

**Keys Required:**
- `aster_api_key`: API key
- `aster_secret_key`: Secret key

---

## 📊 SUPPORTED SYMBOLS

### **Lighter:**
- BTC, ETH, SOL, BNB, DOGE, MATIC, AVAX, ARB, OP, etc.

### **Aster:**
- BTC, ETH, SOL, BNB, DOGE, PEPE, WIF, etc.

⚠️ **Lưu ý**: Symbol format là `BTC` (không có `-USDT`)

---

## 🧪 TESTING

### **1. Test với cURL**

```bash
# Test LONG BTC trên Lighter
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 50,
    "leverage": 2,
    "sl_percent": 5,
    "rr_ratio": [1, 2]
  }'
```

### **2. Test với Python**

```python
import requests

url = "http://localhost:8080/api/order/market"

payload = {
    "lighter_private_key": "0x...",
    "lighter_account_index": 198336,
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 100,
    "leverage": 5,
    "sl_percent": 10,
    "rr_ratio": [1, 2]
}

response = requests.post(url, json=payload)
print(response.json())
```

### **3. Test với Postman**

1. Import collection: `POST http://localhost:8080/api/order/market`
2. Set Body → raw → JSON
3. Paste request body
4. Send

---

## 🐛 TROUBLESHOOTING

### **1. Server không start**

```bash
# Check port
lsof -i :8080

# Kill existing process
kill -9 <PID>

# Restart
python main.py
```

### **2. API trả về 400 Bad Request**

**Nguyên nhân**: Thiếu params hoặc sai format

**Giải pháp**:
- Check API docs: `http://localhost:8080/docs`
- Đảm bảo có đủ required fields
- Check keys format (private key phải bắt đầu bằng `0x`)

### **3. API trả về 500 Internal Server Error**

**Nguyên nhân**: Lỗi kết nối đến exchange hoặc keys sai

**Giải pháp**:
- Check server logs
- Verify keys còn valid
- Check balance trên exchange
- Test connection:
  ```bash
  curl http://localhost:8080/api/status
  ```

---

## 🔄 MODES

### **Mode 1: API Only** (Recommended cho production)

```bash
# .env
IS_API=1
IS_WORKER=0
```

### **Mode 2: Worker Only** (Auto-hedging)

```bash
# .env
IS_API=0
IS_WORKER=1
```

### **Mode 3: Hybrid** (Cả 2)

```bash
# .env
IS_API=1
IS_WORKER=1
```

---

## 📞 SUPPORT

Nếu có vấn đề:
1. Check logs: `docker-compose logs -f` hoặc terminal output
2. Test API docs: `http://localhost:8080/docs`
3. Verify keys và balance
4. Check network connection

---

## 🚀 PRODUCTION DEPLOYMENT

### **Docker (Recommended)**

```yaml
# docker-compose.yml
services:
  trading-api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - IS_API=1
      - IS_WORKER=0
      - API_PORT=8080
    restart: unless-stopped
```

```bash
docker-compose up -d
```

### **Systemd Service**

```ini
# /etc/systemd/system/trading-api.service
[Unit]
Description=Trading API Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/point-dex
Environment="IS_API=1"
Environment="IS_WORKER=0"
ExecStart=/path/to/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable trading-api
systemctl start trading-api
systemctl status trading-api
```

---

**Happy Trading! 🚀**

Version: 1.0.0  
Last Updated: 2025-10-30

