# 🚀 Quick Start - API Server

Hướng dẫn nhanh để chạy API Server cho bên thứ 3.

---

## ⚡ 5 PHÚT SETUP

### **1. Cài đặt (nếu chưa có)**

```bash
cd point-dex
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

### **2. Cấu hình `.env`**

```bash
cp env.example.new .env
nano .env
```

**Chỉnh sửa:**
```bash
# Enable API mode
IS_API=1
IS_WORKER=0

# Port
API_PORT=8080

# Optional: Default keys (nếu user không truyền)
LIGHTER_PRIVATE_KEY=0x...
ACCOUNT_INDEX=198336
ASTER_API_KEY=...
ASTER_SECRET_KEY=...
```

### **3. Khởi động server**

```bash
# Option 1: Dùng script (RECOMMENDED)
sh start_api.sh

# Option 2: Manual
source venv/bin/activate
python3 main.py
```

✅ Server chạy tại: `http://localhost:8080`

**Dừng server:**
```bash
# Option 1: Ctrl+C trong terminal đang chạy
# Option 2: Dùng script
sh stop_api.sh
```

### **4. Test API**

```bash
# Terminal 2: Test
sh test_api.sh

# Hoặc test manual
curl http://localhost:8080/api/status
```

### **5. Xem API Docs**

Mở browser: `http://localhost:8080/docs`

---

## 📝 EXAMPLE: Đặt lệnh MARKET

### **cURL:**

```bash
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 100,
    "leverage": 5
  }'
```

### **Python:**

```python
import requests

url = "http://localhost:8080/api/order/market"

payload = {
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 100,
    "leverage": 5
}

response = requests.post(url, json=payload)
print(response.json())
```

### **JavaScript:**

```javascript
const url = "http://localhost:8080/api/order/market";

const payload = {
  exchange: "lighter",
  symbol: "BTC",
  side: "long",
  size_usd: 100,
  leverage: 5
};

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 🔐 WITH CUSTOM KEYS

Nếu muốn dùng keys riêng (không dùng ENV):

```bash
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "keys": {
      "lighter_private_key": "0x...",
      "lighter_account_index": 198336
    },
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 100,
    "leverage": 5
  }'
```

---

## 📋 AVAILABLE ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Health check |
| `/api/order/market` | POST | Place market order |
| `/api/order/limit` | POST | Place limit order (TODO) |
| `/api/order/close` | POST | Close position |

---

## 🎯 COMMON USE CASES

### **1. LONG BTC on Lighter**

```json
{
  "exchange": "lighter",
  "symbol": "BTC",
  "side": "long",
  "size_usd": 200,
  "leverage": 5
}
```

### **2. SHORT ETH on Aster**

```json
{
  "keys": {
    "aster_api_key": "...",
    "aster_secret_key": "..."
  },
  "exchange": "aster",
  "symbol": "ETH",
  "side": "short",
  "size_usd": 150,
  "leverage": 3
}
```

### **3. Close BTC position**

```json
{
  "exchange": "lighter",
  "symbol": "BTC"
}
```

---

## 🐛 TROUBLESHOOTING

### **Server không start?**

```bash
# Check port
lsof -i :8080

# Kill process
kill -9 <PID>
```

### **API trả về error?**

- Check logs trong terminal
- Verify keys còn valid
- Check balance trên exchange
- Test với Swagger UI: `http://localhost:8080/docs`

---

## 📚 FULL DOCUMENTATION

👉 **[API_README.md](API_README.md)** - Chi tiết đầy đủ

---

**Happy Trading! 🚀**

