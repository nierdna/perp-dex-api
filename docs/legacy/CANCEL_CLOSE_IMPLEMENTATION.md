# 🔧 CANCEL & CLOSE ENDPOINTS IMPLEMENTATION

**Date**: 2025-10-25  
**Status**: ✅ COMPLETED

---

## 📋 SUMMARY

Đã implement **Cancel Order** và **Close Position** endpoints cho cả **Lighter** và **Aster** DEX, và integrate vào `main.py` hedging bot.

---

## ✅ COMPLETED

### **1. Lighter API - Cancel Order** 
**File**: `perpsdex/lighter/api/main.py`

#### Endpoints:
- `POST /api/orders/cancel` - Cancel một order cụ thể
- `POST /api/orders/cancel-all` - Cancel tất cả orders

#### Usage:
```bash
# Cancel specific order
curl -X POST 'http://localhost:8000/api/orders/cancel' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC", "order_index": 123456789}'

# Cancel all orders
curl -X POST 'http://localhost:8000/api/orders/cancel-all' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC", "time_in_force": "immediate"}'
```

#### Features:
- ✅ Dùng Lighter SDK `cancel_order()` method
- ✅ Hỗ trợ cancel theo `market_id` hoặc `symbol`
- ✅ Cancel all với 3 modes: immediate, scheduled, abort
- ✅ Error handling đầy đủ

---

### **2. Lighter API - Close Position**
**File**: `perpsdex/lighter/api/main.py`

#### Endpoint:
- `POST /api/positions/close` - Close position (full hoặc partial)

#### Usage:
```bash
# Close 100% position
curl -X POST 'http://localhost:8000/api/positions/close' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC"}'

# Close 50% position
curl -X POST 'http://localhost:8000/api/positions/close' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC", "percentage": 50}'
```

#### Response:
```json
{
  "success": true,
  "tx_hash": "...",
  "market_id": 1,
  "symbol": "BTC",
  "side": "long",
  "position_size": 0.0002,
  "close_size": 0.0002,
  "close_percentage": 100,
  "entry_price": 108544.7,
  "close_price": 108600.0,
  "pnl_percent": 0.05
}
```

#### Logic:
1. Get current position từ Lighter API
2. Determine side (LONG/SHORT) dựa vào position size (+/-)
3. Place **reverse order** với `reduce_only=True`:
   - LONG position → SELL order
   - SHORT position → BUY order
4. Use aggressive limit price (3% slippage) để fill ngay
5. Return với P&L calculation

---

### **3. Aster API - Cancel Order**
**File**: `perpsdex/aster/api/main.py`

#### Endpoint:
- `POST /api/orders/cancel` - Cancel order trên Aster

#### Usage:
```bash
curl -X POST 'http://localhost:8001/api/orders/cancel' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC-USDT", "order_id": "123456"}'
```

#### Features:
- ✅ Dùng Aster client `cancel_order()` method
- ✅ Error handling
- ✅ Consistent với Lighter API format

---

### **4. Aster API - Close Position**
**File**: `perpsdex/aster/api/main.py`

#### Endpoint:
- `POST /api/positions/close` - Close position trên Aster

#### Usage:
```bash
# Close 100% position
curl -X POST 'http://localhost:8001/api/positions/close' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC-USDT"}'

# Close 50% position
curl -X POST 'http://localhost:8001/api/positions/close' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC-USDT", "percentage": 50}'
```

#### Logic:
1. Get position từ Aster API
2. Determine side từ `positionAmt` (+/-)
3. Place reverse market order với `reduce_only=True`
4. Return với P&L

---

### **5. Main Bot Integration**
**File**: `main.py`

#### Updated Methods:

**`cancel_order(exchange, order_id, symbol)`**
```python
# Tự động gọi đúng API endpoint dựa vào exchange
await bot.cancel_order('lighter', order_id, 'BTC')  # → Lighter API
await bot.cancel_order('aster', order_id, 'BTC')    # → Aster API
```

**`close_positions()`**
```python
# Close positions trên cả 2 sàn đồng thời
success = await bot.close_positions()

# Internal methods:
# - close_lighter_position()
# - close_aster_position()
```

**`close_lighter_position()`** - Gọi Lighter `/api/positions/close`

**`close_aster_position()`** - Gọi Aster `/api/positions/close`

#### Features:
- ✅ Simultaneous close (dùng `asyncio.gather`)
- ✅ P&L tracking cho mỗi position
- ✅ Telegram notifications với P&L
- ✅ Error handling cho từng exchange riêng biệt

---

## 🔄 COMPLETE FLOW

### **Hedging Cycle với Cancel/Close**

```
1. OPEN POSITIONS
   ├─→ Lighter: LONG BTC
   └─→ Aster: SHORT BTC
   
2. HOLD (random time: 20-60 phút)
   ⏳ Wait...
   
3. CLOSE POSITIONS
   ├─→ close_lighter_position()
   │   └─→ POST /api/positions/close
   │       └─→ Place SELL order (reduce_only)
   │
   └─→ close_aster_position()
       └─→ POST /api/positions/close
           └─→ Place BUY order (reduce_only)
   
4. P&L CALCULATION & NOTIFICATION
   ✅ Lighter: +0.5%
   ✅ Aster: -0.3%
   📱 Send Telegram
```

### **Rollback Flow (nếu 1 sàn fail)**

```
1. TRY OPEN BOTH
   ├─→ Lighter: ✅ SUCCESS
   └─→ Aster: ❌ FAILED
   
2. ROLLBACK
   ├─→ cancel_order('lighter', lighter_order_id)
   │   └─→ POST /api/orders/cancel
   │
   └─→ Telegram notification: "❌ Hedge failed"
```

---

## 📊 API COMPARISON

| Feature | Lighter | Aster |
|---------|---------|-------|
| **Cancel Order** | ✅ `order_index` | ✅ `order_id` |
| **Cancel All** | ✅ 3 modes | ❌ Not implemented |
| **Close Position** | ✅ By symbol/market_id | ✅ By symbol |
| **Partial Close** | ✅ percentage param | ✅ percentage param |
| **P&L Calculation** | ✅ From avg_entry_price | ✅ From entryPrice |
| **Method** | Reverse LIMIT (reduce_only) | Reverse MARKET (reduce_only) |

---

## 🎯 KEY DIFFERENCES

### **Lighter**
- Order index: `client_order_index` (timestamp-based)
- Close method: **LIMIT order** với 3% slippage
- Position from: `account_balance.positions`
- P&L from: `avg_entry_price`

### **Aster**
- Order ID: String từ Aster API
- Close method: **MARKET order** với `reduce_only`
- Position from: `market_data.get_position()`
- P&L from: `entryPrice` và `markPrice`

---

## 🧪 TESTING

### **Test Cancel Order**
```bash
# 1. Place order
curl -X POST 'http://localhost:8000/api/orders/long' \
  -d '{"symbol":"BTC","size_usd":5,"leverage":5,"sl_percent":3,"rr_ratio":[1,2]}'

# Get order_index from response

# 2. Cancel it
curl -X POST 'http://localhost:8000/api/orders/cancel' \
  -d '{"symbol":"BTC","order_index":1729861234000}'
```

### **Test Close Position**
```bash
# 1. Place order (creates position)
curl -X POST 'http://localhost:8000/api/orders/short' \
  -d '{"symbol":"BTC","size_usd":5,"leverage":5,"sl_percent":3,"rr_ratio":[1,2]}'

# 2. Wait for position to open (check /api/positions)

# 3. Close it
curl -X POST 'http://localhost:8000/api/positions/close' \
  -d '{"symbol":"BTC"}'

# 4. Verify position closed
curl 'http://localhost:8000/api/positions'
```

### **Test Full Bot Cycle**
```bash
# Setup .env với short timeout
TIME_OPEN_CLOSE=1,2,3  # 1-3 minutes for testing

# Run bot
python3 main.py

# Bot will:
# 1. Open hedged positions
# 2. Hold for 1-3 minutes
# 3. Close both positions automatically
# 4. Send Telegram with P&L
```

---

## 📝 FILES MODIFIED

```
✅ perpsdex/lighter/api/main.py
   + /api/orders/cancel
   + /api/orders/cancel-all
   + /api/positions/close

✅ perpsdex/aster/api/main.py
   + /api/orders/cancel
   + /api/positions/close

✅ main.py
   ~ cancel_order() - Now calls API endpoints
   ~ close_positions() - Now calls API endpoints
   + close_lighter_position()
   + close_aster_position()
```

---

## 🚀 NEXT STEPS

### **Remaining TODOs:**
1. ⏳ Test full cycle với real positions
2. ⏳ Test rollback logic
3. ⏳ Docker setup
4. ⏳ Health checks & monitoring

### **Optional Enhancements:**
- Add `/api/positions/close-all` để close tất cả positions
- Add retry logic cho close failures
- Add position history tracking
- Add more detailed P&L metrics (fees, funding, etc.)

---

## 💡 NOTES

### **Cancel vs Close**
- **Cancel**: Hủy order CHƯA FILL (pending order)
- **Close**: Đóng position ĐÃ MỞ (open position)

### **Reduce Only**
- `reduce_only=True` đảm bảo order CHỈ đóng position hiện tại
- Không mở position mới hoặc flip position

### **Slippage Protection**
- Lighter: 3% slippage với LIMIT order
- Aster: MARKET order (chấp nhận slippage)

### **P&L Calculation**
```python
if is_long:
    pnl_percent = ((close_price - entry_price) / entry_price) * 100
else:  # short
    pnl_percent = ((entry_price - close_price) / entry_price) * 100
```

---

**Status**: ✅ All cancel & close endpoints IMPLEMENTED and INTEGRATED  
**Ready for**: Testing và production deployment

