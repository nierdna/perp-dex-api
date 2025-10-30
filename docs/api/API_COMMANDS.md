# ⚡ API Server - Quick Commands

## 🚀 **KHỞI ĐỘNG**

```bash
# Start API server
sh start_api.sh

# Hoặc manual
source venv/bin/activate
python3 main.py
```

---

## 🛑 **DỪNG SERVER**

```bash
# Stop API server
sh stop_api.sh

# Hoặc Ctrl+C trong terminal đang chạy
```

---

## 🧪 **TEST API**

```bash
# Health check
curl http://localhost:8080/api/status

# Chạy test script
sh test_api.sh

# Xem API docs (browser)
open http://localhost:8080/docs
```

---

## 📝 **ĐẶT LỆNH NHANH**

### **1. LONG BTC trên Lighter**

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

### **2. SHORT ETH trên Aster (với custom keys)**

```bash
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "keys": {
      "aster_api_key": "YOUR_KEY",
      "aster_secret_key": "YOUR_SECRET"
    },
    "exchange": "aster",
    "symbol": "ETH",
    "side": "short",
    "size_usd": 150,
    "leverage": 3
  }'
```

### **3. CLOSE position**

```bash
curl -X POST http://localhost:8080/api/order/close \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC"
  }'
```

---

## 🔍 **KIỂM TRA**

```bash
# Check xem server có chạy không
lsof -i :8080

# Xem logs (nếu chạy bằng script)
tail -f nohup.out

# Test connection
curl -I http://localhost:8080/api/status
```

---

## 🐛 **TROUBLESHOOTING**

### **Port 8080 đang được dùng?**

```bash
# Tìm process
lsof -i :8080

# Kill process
kill -9 <PID>
```

### **Server không start?**

```bash
# Check Python version
python3 --version

# Check venv
ls venv/

# Reinstall dependencies
source venv/bin/activate
pip install -r requirements.txt
```

### **API trả về error?**

```bash
# Check keys trong .env
cat .env | grep -E "LIGHTER|ASTER"

# Test với Swagger UI
open http://localhost:8080/docs
```

---

## 📚 **DOCUMENTATION**

- 📖 **Full API Docs**: [API_README.md](API_README.md)
- ⚡ **Quick Start**: [QUICK_START_API.md](QUICK_START_API.md)
- 🌐 **Swagger UI**: http://localhost:8080/docs
- 📊 **ReDoc**: http://localhost:8080/redoc

---

## 🎯 **MODES**

### **API Mode Only** (cho bên thứ 3)
```bash
# .env
IS_API=1
IS_WORKER=0
```

### **Worker Mode Only** (auto-hedging)
```bash
# .env
IS_API=0
IS_WORKER=1
```

### **Hybrid Mode** (cả 2)
```bash
# .env
IS_API=1
IS_WORKER=1
```

---

## 🔐 **KEYS**

### **Option 1: Từ ENV** (mặc định)
```bash
# .env
LIGHTER_PRIVATE_KEY=0x...
ACCOUNT_INDEX=198336
ASTER_API_KEY=...
ASTER_SECRET_KEY=...
```

### **Option 2: Từ Request** (bảo mật hơn)
```json
{
  "lighter_private_key": "0x...",
  "lighter_account_index": 198336,
  "exchange": "lighter",
  "symbol": "BTC",
  ...
}
```

---

**Server đang chạy tại:** `http://localhost:8080` ✅

