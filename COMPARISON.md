# 📊 Lighter vs Aster DEX - Comparison

## 🎯 Tổng Quan

| Feature | Lighter DEX | Aster DEX |
|---------|------------|-----------|
| **Chain** | zkSync Era | BNB Chain (multi-chain planned) |
| **Type** | Order Book DEX | Order Book DEX |
| **Leverage** | Up to 20x | Up to 100x |
| **Trading Modes** | 1 mode | 3 modes (Pro/1001x/Spot) |
| **API** | ✅ Official SDK | ✅ REST API |
| **UI** | ✅ Port 8000 | ✅ Port 8001 |

---

## 💰 Supported Assets

### **Lighter DEX:**
- ✅ **66 pairs** (BTC, SOL, BNB, etc.)
- ❌ **No ETH** support
- 🔶 Major: BTC, SOL, BNB
- 💎 DeFi: AAVE, UNI, LINK, GMX
- ⚡ L1/L2: AVAX, ARB, OP, SUI
- 🎭 Meme: DOGE, WIF, PEPE, SHIB

### **Aster DEX:**
- ✅ **All major pairs** (BTC, ETH, SOL, BNB)
- ✅ **ETH support** ⭐
- 🔥 **100+ pairs** expected
- 📈 Perpetual contracts
- 💵 Spot trading
- 🎲 Pre-launch contracts
- 📊 Stock contracts

---

## 🔧 Technical Differences

### **Authentication:**

**Lighter:**
```python
from lighter import SignerClient

client = SignerClient(
    api_url="https://mainnet.zklighter.elliot.ai",
    api_key=API_KEY,
    private_key=PRIVATE_KEY
)
```

**Aster:**
```python
from aster_client import AsterClient

client = AsterClient(
    api_url="https://api.aster.xyz",
    api_key=API_KEY,
    secret_key=SECRET_KEY  # HMAC SHA256
)
```

### **Order Types:**

| Order Type | Lighter | Aster |
|------------|---------|-------|
| Market | ✅ | ✅ |
| Limit | ✅ | ✅ |
| Stop Loss | ✅ (Conditional) | ✅ |
| Take Profit | ✅ (Conditional) | ✅ |
| Trailing Stop | ❌ | ✅ ⭐ |
| Grid Trading | ❌ | ✅ ⭐ |
| Hidden Orders | ❌ | ✅ ⭐ |

---

## 🎨 UI Differences

### **Lighter UI:**
- 🟣 Purple gradient theme
- 📍 Port: 8000
- 🔗 URL: `http://localhost:8000/ui_test.html`

### **Aster UI:**
- 🔴 Red/Orange gradient theme
- 📍 Port: 8001
- 🔗 URL: `http://localhost:8001/ui_test.html`

---

## 📈 Trading Flow Comparison

### **Market Order Flow:**

**Lighter:**
```
1. Get price from orderbook (bid/ask)
2. Place ORDER_TYPE_LIMIT (fills as market)
3. Place TP: ORDER_TYPE_TAKE_PROFIT_LIMIT
4. Place SL: ORDER_TYPE_STOP_LOSS_LIMIT
5. Expiry: 28 days
```

**Aster:**
```
1. Get price from ticker API
2. Place ORDER_TYPE_MARKET
3. Place TP: TAKE_PROFIT order
4. Place SL: STOP_LOSS order
5. Expiry: TBD (need research)
```

---

## 🚀 Features Unique to Each

### **Lighter Only:**
- ✅ zkSync Era integration
- ✅ Official Python SDK
- ✅ Auto-fix API key mismatch

### **Aster Only:**
- ⭐ **Trailing Stop** orders
- ⭐ **Grid Trading** (manual & auto)
- ⭐ **Hidden Orders**
- ⭐ **Hedge Mode**
- ⭐ **Pre-launch contracts**
- ⭐ **Stock contracts**
- ⭐ **1001x mode** (one-click trading)
- ⭐ **Spot trading**
- ✅ **ETH support**

---

## 💡 When to Use Which?

### **Use Lighter DEX when:**
- ✅ Trading on zkSync Era
- ✅ Need BTC, SOL, BNB only (no ETH)
- ✅ Want proven SDK
- ✅ Prefer simple setup

### **Use Aster DEX when:**
- ⭐ Need **ETH trading**
- ⭐ Want **Trailing Stop**
- ⭐ Want **Grid Trading**
- ⭐ Need higher leverage (100x)
- ⭐ Want more pairs (100+)
- ⭐ BNB Chain preferred

---

## 🔄 Switching Between DEXs

### **Config:**
Edit `perpsdex/config.json`:

```json
{
  "dex": "lighter",  // or "aster"
  "pair": "BTC-USDT",
  "size_usd": 100,
  "leverage": 5,
  "sl_percent": 3,
  "rr_ratio": [1, 2]
}
```

### **Start Servers:**

```bash
# Lighter (Port 8000)
cd perpsdex/lighter
./run_api.sh

# Aster (Port 8001)
cd perpsdex/aster
./run_api.sh
```

### **Access UIs:**

- **Lighter:** http://localhost:8000/ui_test.html
- **Aster:** http://localhost:8001/ui_test.html

---

## 📊 Performance Comparison

| Metric | Lighter | Aster |
|--------|---------|-------|
| **Chain Speed** | zkSync (fast) | BNB (very fast) |
| **Gas Fees** | Low | Very low |
| **Liquidity** | Good | Excellent |
| **Max Leverage** | 20x | 100x |
| **Order Expiry** | 28 days | TBD |
| **API Latency** | ~200ms | TBD |

---

## 🎯 Roadmap

### **Lighter:**
- [x] Core modules ✅
- [x] FastAPI backend ✅
- [x] Web UI ✅
- [x] Market/Limit orders ✅
- [x] TP/SL orders ✅
- [x] 66 pairs support ✅

### **Aster:**
- [x] Folder structure ✅
- [x] Core modules template ✅
- [x] FastAPI backend template ✅
- [x] Web UI template ✅
- [ ] Research API URL ⏳
- [ ] Test authentication ⏳
- [ ] Implement real endpoints ⏳
- [ ] Add Trailing Stop ⏳
- [ ] Add Grid Trading ⏳

---

## 🔗 Resources

### **Lighter:**
- Website: https://lighter.xyz
- App: https://app.lighter.xyz
- Docs: (SDK documentation)

### **Aster:**
- Website: https://aster.xyz
- App: https://app.aster.xyz
- Docs: https://docs.asterdex.com
- API: https://docs.asterdex.com/product/aster-perpetual-pro/api/api-documentation

---

**Choose the right DEX for your strategy! 🚀**

