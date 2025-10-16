# 🚀 QUICK START - Lighter Trading Bot API & UI

## ✅ **ĐÃ TẠO XONG**

### **1. FastAPI Backend** (`api/main.py`)
- ✅ 8 endpoints đầy đủ
- ✅ CORS enabled
- ✅ Auto docs tại `/docs`

### **2. Test UI** (`ui_test.html`)
- ✅ Giao diện web đơn giản
- ✅ Test tất cả API endpoints
- ✅ Real-time updates

### **3. Documentation**
- ✅ `API_README.md` - API docs đầy đủ
- ✅ `run_api.sh` - Script chạy nhanh

---

## 🔥 **CHẠY NGAY (3 BƯỚC)**

### **Bước 1: Chạy API**
```bash
cd /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex
source venv/bin/activate
uvicorn perpsdex.lighter.api.main:app --reload --host 0.0.0.0 --port 8000
```

**Output sẽ là:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### **Bước 2: Mở UI Test**
```bash
# Option 1: Mở file
open perpsdex/lighter/ui_test.html

# Option 2: Command line
python -m http.server 8080 --directory perpsdex/lighter &
open http://localhost:8080/ui_test.html
```

### **Bước 3: Test API**

**Test 1: Health Check**
```bash
curl http://localhost:8000/
```

**Test 2: Get BTC Price**
```bash
curl http://localhost:8000/api/market/price/BTC
```

**Test 3: Calculate Order**
```bash
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

---

## 📊 **API ENDPOINTS**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/market/price/{symbol}` | Get price (BTC, ETH) |
| GET | `/api/market/balance` | Get account balance |
| GET | `/api/positions` | Get open positions |
| POST | `/api/orders/calculate` | Calculate TP/SL preview |
| POST | `/api/orders/long` | Place LONG order |
| POST | `/api/orders/short` | Place SHORT order |
| GET | `/api/status` | Check API status |

---

## 🎨 **UI FEATURES**

### **Market Data Card**
- Select symbol (BTC/ETH)
- Get real-time price (Bid/Ask/Mid)

### **Balance Card**
- View available balance
- View collateral
- View total assets

### **Positions Card**
- View open positions
- Real-time updates

### **Calculate Card**
- Preview TP/SL without placing order
- Input: Symbol, Side, Size, Leverage, SL%, R:R
- Output: Entry, TP, SL, Risk/Reward amounts

### **Place Order Card**
- Place real LONG/SHORT orders
- Confirmation required
- Auto calculate TP/SL from R:R ratio

---

## 📸 **SCREENSHOTS**

### **UI Layout:**
```
┌─────────────────────────────────────────────┐
│  🚀 Lighter Trading Bot - Test UI           │
│  Status: ✅ Online & Ready                   │
└─────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ Market   │ Balance  │ Positions│ Calculate│
│ Data     │          │          │          │
├──────────┼──────────┼──────────┼──────────┤
│ [BTC ▼]  │ Get      │ Refresh  │ Symbol   │
│ Get Price│ Balance  │ Positions│ [ETH ▼]  │
│          │          │          │          │
│ Bid: $X  │ Avail: $Y│ 1 open   │ Side:    │
│ Ask: $X  │ Coll: $Y │ BTC: ... │ ○ LONG   │
│ Mid: $X  │ Total: $Y│          │ ○ SHORT  │
└──────────┴──────────┴──────────┴──────────┘

┌─────────────────────────────────────────────┐
│ Place Order                                 │
│ Symbol: [ETH ▼]  Size: [100] Leverage: [5x]│
│ [🟢 LONG]  [🔴 SHORT]                       │
└─────────────────────────────────────────────┘
```

---

## 🧪 **TEST FLOW**

### **Test 1: View Market Data**
1. Mở UI → Market Data card
2. Select "BTC" hoặc "ETH"
3. Click "Get Price"
4. ✅ Thấy Bid/Ask/Mid price

### **Test 2: Check Balance**
1. Balance card
2. Click "Refresh Balance"
3. ✅ Thấy Available/Collateral/Total

### **Test 3: Calculate TP/SL**
1. Calculate card
2. Fill form:
   - Symbol: ETH
   - Side: LONG
   - Size USD: 100
   - Leverage: 5
   - SL%: 3
   - R:R: 1, 2
3. Click "Calculate"
4. ✅ Thấy Entry, TP, SL, Risk/Reward

### **Test 4: Place Order (Careful!)**
1. Place Order card
2. Fill form (nhỏ để test, VD: $10)
3. Click "LONG" hoặc "SHORT"
4. Confirm popup
5. ✅ Order placed, nhận TX hash

---

## 🔗 **IMPORTANT LINKS**

| Resource | URL |
|----------|-----|
| API Server | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |
| Test UI | `file:///.../ui_test.html` |
| API README | `API_README.md` |

---

## ⚠️ **WARNINGS**

1. **Keys Mismatch**: API sẽ báo nếu keys không khớp
   - GET `/api/status` để check
   - Fix keys trước khi trade

2. **Test với số tiền nhỏ**: 
   - Dùng $5-10 để test
   - Confirm kỹ trước khi place

3. **CORS**: 
   - UI phải mở qua HTTP (không phải file://)
   - Hoặc dùng `python -m http.server`

---

## 🐛 **TROUBLESHOOTING**

### **API không chạy:**
```bash
# Check port
lsof -i:8000

# Kill process
lsof -ti:8000 | xargs kill -9

# Chạy lại
uvicorn perpsdex.lighter.api.main:app --reload
```

### **UI không connect API:**
1. Check API đang chạy: `curl http://localhost:8000/`
2. Check CORS headers
3. Open Console (F12) xem lỗi

### **Keys mismatch:**
```bash
# Check status
curl http://localhost:8000/api/status

# Output:
{
  "can_trade": false,  # ← nếu false
  "keys_mismatch": true  # ← cần fix keys
}
```

---

## 📊 **MODULES SUMMARY**

```
perpsdex/lighter/
├── api/
│   ├── __init__.py
│   └── main.py          ✅ FastAPI app (450+ lines)
├── core/
│   ├── client.py        ✅ Connection
│   ├── market.py        ✅ Market data
│   ├── order.py         ✅ Place orders
│   └── risk.py          ✅ TP/SL management
├── utils/
│   ├── calculator.py    ✅ Pure calculations
│   └── config.py        ✅ Config loader
├── ui_test.html         ✅ Test UI (400+ lines)
├── run_api.sh           ✅ Start script
├── API_README.md        ✅ API docs
└── QUICK_START.md       ✅ This file
```

---

## ✅ **NEXT STEPS**

1. ✅ Chạy API: `uvicorn perpsdex.lighter.api.main:app --reload`
2. ✅ Mở UI: `open ui_test.html`
3. ✅ Test endpoints
4. ✅ Calculate TP/SL
5. ⚠️  Place order (với tiền nhỏ!)

---

**Tất cả đã sẵn sàng! Chạy thử ngay! 🚀💰**

