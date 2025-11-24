# 🚀 Aster Trading Bot - Quick Start

## ⚡ Setup trong 3 bước

### **1️⃣ Tạo API Key trên Aster**

Truy cập: [Aster DEX](https://app.aster.xyz/)

1. Login vào tài khoản
2. Vào **Settings** → **API Management**
3. Click **Create New API Key**
4. **Lưu lại**:
   - `API Key`
   - `Secret Key`
   
⚠️ **Lưu ý:** Mỗi tài khoản có thể tạo tối đa 30 API keys

### **2️⃣ Configure Environment**

Tạo file `.env` ở root project:

```bash
# Aster API credentials
ASTER_API_KEY=your_api_key_here
ASTER_SECRET_KEY=your_secret_key_here
ASTER_API_URL=https://api.aster.xyz
```

### **3️⃣ Start Server**

```bash
cd perpsdex/aster
./run_api.sh
```

Hoặc:

```bash
source venv/bin/activate
uvicorn perpsdex.aster.api.main:app --reload --port 8001
```

### **4️⃣ Open UI**

Mở browser:
```
http://localhost:8001/ui_test.html
```

---

## 🎯 Test Trading

### **Calculate TP/SL:**
1. Chọn Symbol: **BTC-USDT**
2. Side: **LONG**
3. Entry Price: Auto-fill từ market
4. Size: **$100**
5. Leverage: **5x**
6. SL Distance: **3%**
7. R:R Ratio: **[1, 2]**
8. Click **Calculate**

### **Place Market Order:**
1. Order Type: **Market Order**
2. Symbol: **BTC-USDT**
3. Size: **$10**
4. Leverage: **5x**
5. SL: **3%**
6. R:R: **[1, 2]**
7. Click **LONG** hoặc **SHORT**

### **Place Limit Order:**
1. Order Type: **Limit Order**
2. Limit Price: Auto-fill (có thể edit)
3. Symbol: **ETH-USDT** ⭐ (Aster support ETH!)
4. Size: **$10**
5. Click **LONG** hoặc **SHORT**

---

## 📊 Features

### **Trading:**
- ✅ Market Orders (instant fill)
- ✅ Limit Orders (wait for price)
- ✅ Auto TP/SL with R:R ratio
- ⭐ Trailing Stop (Aster native feature - coming soon)
- ⭐ Grid Trading (Aster native feature - coming soon)

### **Risk Management:**
- ✅ Stop Loss with % distance
- ✅ Take Profit with R:R ratio
- ✅ Position size calculator
- ✅ Balance validation

### **UI:**
- ✅ Real-time price data
- ✅ Position viewer
- ✅ Balance display
- ✅ Order history

---

## ⚠️ Current Status

**🟡 IN DEVELOPMENT**

Aster integration đang trong giai đoạn research API.

**Cần làm:**
- [ ] Tìm actual Aster API URL
- [ ] Test authentication
- [ ] Verify endpoints
- [ ] Test real orders

**Hoạt động:**
- [x] Folder structure ✅
- [x] Core modules template ✅
- [x] FastAPI endpoints ✅
- [x] UI interface ✅

---

## 🔗 Resources

- **Aster Website:** https://aster.xyz
- **Aster App:** https://app.aster.xyz
- **Documentation:** https://docs.asterdex.com
- **API Docs:** https://docs.asterdex.com/product/aster-perpetual-pro/api/api-documentation
- **Create API:** https://docs.asterdex.com/product/aster-perpetual-pro/api/how-to-create-an-api

---

## 🆘 Troubleshooting

### **Server không start:**
```bash
# Check Python version
python3 --version  # Should be 3.8+

# Activate venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn python-dotenv aiohttp
```

### **API connection failed:**
```
Kiểm tra:
1. ASTER_API_KEY đúng chưa?
2. ASTER_SECRET_KEY đúng chưa?
3. ASTER_API_URL đúng chưa?
4. Internet connection OK?
```

### **Port 8001 already in use:**
```bash
# Kill process on port 8001
lsof -ti:8001 | xargs kill -9

# Or use different port
uvicorn perpsdex.aster.api.main:app --port 8002
```

---

## 📝 Next Steps

1. **Research API:** Tìm actual Aster API URL và endpoints
2. **Test Connection:** Verify authentication works
3. **Test Orders:** Place test orders
4. **Add Features:** Trailing stop, grid trading
5. **Production:** Deploy và monitor

**Ready to trade! 🚀**

