# ✅ FIXED - TP/SL Optional

**Date:** 2025-10-30  
**Issue:** API luôn đặt TP/SL dù user không muốn  
**Status:** ✅ **FIXED**

---

## 🐛 **VẤN ĐỀ**

**Trước khi fix:**
```bash
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "BTC",
    "side": "long",
    "size_usd": 200,
    "leverage": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "tp_sl_placed": true  ← ❌ Luôn true dù không có TP/SL
}
```

**Vấn đề:** API force đặt TP/SL với default values (10% SL, 1:2 RR) ngay cả khi user không muốn.

---

## ✅ **GIẢI PHÁP**

### **1. Updated Logic:**
- ✅ Chỉ đặt TP/SL khi user truyền `tp_price` VÀ `sl_price`
- ✅ Nếu không có → chỉ đặt entry order
- ✅ `tp_sl_placed` phản ánh đúng trạng thái

### **2. Code Changes:**
```python
# Before (force TP/SL)
sl_percent = 10  # Default 10%
rr_ratio = [1, 2]  # Default 1:2

# After (optional TP/SL)
if order.tp_price and order.sl_price:
    sl_percent = 10
    rr_ratio = [1, 2]
else:
    sl_percent = None  # No TP/SL
    rr_ratio = None
```

### **3. Response Update:**
```python
"tp_sl_placed": bool(order.tp_price and order.sl_price)
```

---

## 🧪 **TEST RESULTS**

### **Test 1: Không có TP/SL**
```bash
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "DOGE",
    "side": "long",
    "size_usd": 5,
    "leverage": 2
  }'
```

**Response:**
```json
{
  "success": true,
  "exchange": "lighter",
  "symbol": "DOGE",
  "side": "long",
  "order_id": 1761811276172,
  "entry_price": 0.19223,
  "position_size": 26.01050825,
  "size_usd": 5.0,
  "leverage": 2,
  "tp_sl_placed": false  ← ✅ Chỉ entry order
}
```

### **Test 2: Có TP/SL**
```bash
curl -X POST http://localhost:8080/api/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "lighter",
    "symbol": "DOGE",
    "side": "short",
    "size_usd": 5,
    "leverage": 2,
    "tp_price": 0.20,
    "sl_price": 0.18
  }'
```

**Response:**
```json
{
  "success": true,
  "exchange": "lighter",
  "symbol": "DOGE",
  "side": "short",
  "order_id": 1761811282253,
  "entry_price": 0.192204,
  "position_size": 26.01402676,
  "size_usd": 5.0,
  "leverage": 2,
  "tp_sl_placed": true  ← ✅ Có TP/SL
}
```

---

## 📋 **BEHAVIOR**

| Request | TP/SL Placed | Response |
|---------|--------------|----------|
| Không có `tp_price`, `sl_price` | ❌ No | `tp_sl_placed: false` |
| Có `tp_price` VÀ `sl_price` | ✅ Yes | `tp_sl_placed: true` |
| Chỉ có `tp_price` | ❌ No | `tp_sl_placed: false` |
| Chỉ có `sl_price` | ❌ No | `tp_sl_placed: false` |

---

## 🎯 **LỢI ÍCH**

1. **User Control**: User quyết định có muốn TP/SL hay không
2. **Clean Orders**: Chỉ đặt entry order khi không cần TP/SL
3. **Accurate Response**: `tp_sl_placed` phản ánh đúng thực tế
4. **Flexible**: Support cả 2 use cases

---

## 📝 **USAGE EXAMPLES**

### **Entry Order Only (No TP/SL):**
```json
{
  "exchange": "lighter",
  "symbol": "BTC",
  "side": "long",
  "size_usd": 200,
  "leverage": 5
}
```
→ Chỉ đặt entry order, không có TP/SL

### **Entry + TP/SL:**
```json
{
  "exchange": "lighter",
  "symbol": "BTC",
  "side": "long",
  "size_usd": 200,
  "leverage": 5,
  "tp_price": 110000,
  "sl_price": 100000
}
```
→ Đặt entry order + TP/SL orders

---

## ✅ **VERIFICATION**

- ✅ Không có TP/SL → `tp_sl_placed: false`
- ✅ Có TP/SL → `tp_sl_placed: true`
- ✅ Entry order luôn được đặt
- ✅ TP/SL chỉ đặt khi có đủ `tp_price` và `sl_price`
- ✅ Response chính xác

---

## 📚 **DOCUMENTATION UPDATED**

- ✅ `API_README.md` - Updated examples
- ✅ Response format clarified
- ✅ Usage examples added

---

**🎉 Issue fixed! TP/SL is now truly optional!**

*Last updated: 2025-10-30*
