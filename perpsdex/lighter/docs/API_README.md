# 🚀 Lighter Trading Bot - API Documentation

FastAPI backend để control trading bot trên Lighter DEX

---

## 🔧 **CÁCH CHẠY**

### **Option 1: Script (Đơn giản)**
```bash
cd perpsdex/lighter
./run_api.sh
```

### **Option 2: Manual**
```bash
# Từ thư mục gốc project
source venv/bin/activate
uvicorn perpsdex.lighter.api.main:app --reload --host 0.0.0.0 --port 8000
```

### **Option 3: Python**
```bash
cd perpsdex/lighter/api
python main.py
```

---

## 📍 **ENDPOINTS**

API chạy tại: `http://localhost:8000`

**API Docs (tự động):** http://localhost:8000/docs

### **1. Health Check**
```
GET /
```
**Response:**
```json
{
  "status": "ok",
  "message": "Lighter Trading Bot API",
  "version": "1.0.0"
}
```

---

### **2. Get Price**
```
GET /api/market/price/{symbol}
```

**Example:**
```bash
curl http://localhost:8000/api/market/price/BTC
```

**Response:**
```json
{
  "symbol": "BTC",
  "bid": 111594.80,
  "ask": 111595.40,
  "mid": 111595.10,
  "market_id": 1
}
```

---

### **3. Get Balance**
```
GET /api/market/balance
```

**Example:**
```bash
curl http://localhost:8000/api/market/balance
```

**Response:**
```json
{
  "available": 6.57,
  "collateral": 19.84,
  "total": 11.15
}
```

---

### **4. Get Positions**
```
GET /api/positions
```

**Response:**
```json
{
  "count": 1,
  "positions": [
    {
      "market_id": 1,
      "size": 0.0001,
      "avg_entry_price": 122187.5
    }
  ]
}
```

---

### **5. Place LONG Order**
```
POST /api/orders/long
Content-Type: application/json

{
  "symbol": "ETH",
  "size_usd": 100,
  "leverage": 5,
  "sl_percent": 3,
  "rr_ratio": [1, 2]
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/orders/long \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ETH",
    "size_usd": 100,
    "leverage": 5,
    "sl_percent": 3,
    "rr_ratio": [1, 2]
  }'
```

**Response:**
```json
{
  "success": true,
  "entry": {
    "tx_hash": "0x...",
    "entry_price": 194.11,
    "position_size": 0.515,
    "side": "long"
  },
  "tp_sl": {
    "tp_success": true,
    "sl_success": true,
    "tp_tx_hash": "0x...",
    "sl_tx_hash": "0x..."
  }
}
```

---

### **6. Place SHORT Order**
```
POST /api/orders/short
```
Same body as `/api/orders/long`

---

### **7. Calculate TP/SL (Preview)**
```
POST /api/orders/calculate
Content-Type: application/json

{
  "symbol": "ETH",
  "side": "long",
  "size_usd": 100,
  "leverage": 5,
  "sl_percent": 3,
  "rr_ratio": [1, 2]
}
```

**Response:**
```json
{
  "symbol": "ETH",
  "side": "long",
  "entry_price": 194.11,
  "position_size": 0.515,
  "position_size_usd": 100,
  "leverage": 5,
  "tp_price": 205.75,
  "sl_price": 188.28,
  "risk_amount": 5.82,
  "reward_amount": 11.65,
  "rr_ratio": "1:2.00",
  "sl_valid": true,
  "sl_adjusted": false
}
```

---

### **8. Get API Status**
```
GET /api/status
```

**Response:**
```json
{
  "api_status": "online",
  "connection": "connected",
  "keys_mismatch": false,
  "can_trade": true
}
```

---

## 🎨 **TEST UI**

### **Cách Sử Dụng:**

1. **Chạy API:**
   ```bash
   ./run_api.sh
   ```

2. **Mở UI trong browser:**
   ```bash
   open ui_test.html
   ```
   Hoặc double-click file `ui_test.html`

3. **Test API:**
   - Get Price: Click "Get Price"
   - Get Balance: Click "Refresh Balance"
   - Calculate TP/SL: Fill form → "Calculate"
   - Place Order: Fill form → "LONG" hoặc "SHORT"

---

## 📊 **REQUEST BODY SCHEMAS**

### **OrderRequest**
```typescript
{
  symbol: string;          // 'BTC', 'ETH'
  size_usd: number;        // Position size USD
  leverage: number;        // 1-10
  sl_percent?: number;     // SL distance %, optional
  rr_ratio?: [number, number]; // [risk, reward], optional
}
```

### **BracketOrderRequest**
```typescript
{
  symbol: string;
  side: 'long' | 'short';
  size_usd: number;
  leverage: number;
  sl_percent: number;      // Default: 3.0
  rr_ratio: [number, number]; // Default: [1, 2]
}
```

---

## 🔐 **AUTHENTICATION**

API sử dụng LIGHTER_PRIVATE_KEY từ `.env` file.

**Setup:**
```bash
# .env
LIGHTER_PRIVATE_KEY=your_private_key
ACCOUNT_INDEX=0
```

**Keys Mismatch:**
- Nếu API keys không khớp → API vẫn chạy nhưng KHÔNG thể place orders
- Check status: `GET /api/status`

---

## 🛠️ **DEVELOPMENT**

### **Auto-reload khi code thay đổi:**
```bash
uvicorn perpsdex.lighter.api.main:app --reload
```

### **API Docs (Swagger):**
- http://localhost:8000/docs
- http://localhost:8000/redoc

### **CORS:**
- Đã enable cho tất cả origins
- Frontend có thể gọi từ bất kỳ domain

---

## 🧪 **TESTING**

### **Test với curl:**

```bash
# Health check
curl http://localhost:8000/

# Get BTC price
curl http://localhost:8000/api/market/price/BTC

# Get balance
curl http://localhost:8000/api/market/balance

# Calculate order
curl -X POST http://localhost:8000/api/orders/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ETH",
    "side": "long",
    "size_usd": 100,
    "leverage": 5,
    "sl_percent": 3,
    "rr_ratio": [1, 2]
  }'
```

### **Test với Python:**

```python
import requests

API_URL = "http://localhost:8000/api"

# Get price
response = requests.get(f"{API_URL}/market/price/BTC")
print(response.json())

# Calculate order
response = requests.post(f"{API_URL}/orders/calculate", json={
    "symbol": "ETH",
    "side": "long",
    "size_usd": 100,
    "leverage": 5,
    "sl_percent": 3,
    "rr_ratio": [1, 2]
})
print(response.json())

# Place LONG order (CAREFUL!)
response = requests.post(f"{API_URL}/orders/long", json={
    "symbol": "ETH",
    "size_usd": 10,  # Small amount for test
    "leverage": 1,
    "sl_percent": 3,
    "rr_ratio": [1, 2]
})
print(response.json())
```

---

## 📦 **REQUIREMENTS**

```
fastapi==0.115.0
uvicorn==0.32.0
python-dotenv
lighter-sdk
```

**Install:**
```bash
pip install fastapi uvicorn
```

---

## 🚨 **SECURITY WARNINGS**

1. **KHÔNG expose API ra internet** (chỉ localhost)
2. **Private keys** trong `.env` KHÔNG commit lên Git
3. **Test với số tiền nhỏ** trước
4. **Confirm** trước khi place order thật

---

## 🐛 **TROUBLESHOOTING**

### **Port 8000 đã được sử dụng:**
```bash
# Kill process trên port 8000
lsof -ti:8000 | xargs kill -9

# Hoặc dùng port khác
uvicorn perpsdex.lighter.api.main:app --port 8001
```

### **API không connect được Lighter:**
```bash
# Check .env file
cat .env | grep LIGHTER

# Check API status
curl http://localhost:8000/api/status
```

### **Keys mismatch:**
- Fix API keys trên Lighter UI
- Hoặc enable auto_fix trong code

---

## 📞 **SUPPORT**

- API Docs: http://localhost:8000/docs
- Test UI: `ui_test.html`
- Main README: `../README.md`

**Happy Trading! 🚀💰**

