# Aster DEX API Research Notes

## 🔍 Research Status: IN PROGRESS

### Documentation Links
- Main Docs: https://docs.asterdex.com/
- API Docs: https://docs.asterdex.com/product/aster-perpetual-pro/api/api-documentation
- How to Create API: https://docs.asterdex.com/product/aster-perpetual-pro/api/how-to-create-an-api

---

## ❓ Questions to Answer

### 1. API Endpoint URL
- [ ] What is the base URL? (e.g., `https://api.aster.xyz`)
- [ ] Is there testnet/mainnet?
- [ ] Are there different endpoints for different chains?

### 2. Authentication
- [ ] API Key + Secret?
- [ ] Private key signing?
- [ ] OAuth/JWT tokens?
- [ ] How to generate API credentials?

### 3. SDK Availability
- [ ] Is there an official Python SDK?
- [ ] REST API only?
- [ ] WebSocket support for real-time data?
- [ ] GraphQL?

### 4. Supported Markets
- [ ] List of available trading pairs
- [ ] How to get market metadata?
- [ ] Market ID system?

### 5. Order Types
- [x] Market orders ✅
- [x] Limit orders ✅
- [x] Stop loss orders ✅
- [x] Take profit orders ✅
- [ ] Trailing stop (native Aster feature)
- [ ] Grid orders

### 6. Data Endpoints
- [ ] Get price/ticker
- [ ] Get account balance
- [ ] Get positions
- [ ] Get order history
- [ ] Get trade history

### 7. Trading Endpoints
- [ ] Place order
- [ ] Cancel order
- [ ] Modify order
- [ ] Close position
- [ ] Set leverage

### 8. Limitations
- [ ] Rate limits?
- [ ] Min/max position size?
- [ ] Max leverage?
- [ ] Trading fees structure?

---

## 📝 Findings

### From Documentation Website

**Aster Overview:**
- Next-generation decentralized perpetual exchange
- Built for BNB Chain (multi-chain planned)
- Three trading modes:
  1. **Perpetual Mode (Pro)** ⭐ - Our target
  2. 1001x (Simple)
  3. Spot Mode

**Perpetual Mode (Pro) Features:**
- Order book interface
- Deep liquidity
- Extremely low fees
- Advanced tools
- **API support** ✅

**Special Features:**
- Hidden orders
- Trailing stop orders
- Grid trading (manual & auto)
- Hedge mode
- Pre-launch contracts
- Stock contracts

---

## 🎯 Next Steps

1. **Find API Documentation**
   - Search for `/api` or `/developers` page
   - Look for GitHub repo with examples
   - Check Discord/Telegram for dev resources

2. **Identify API Structure**
   - REST vs WebSocket
   - Authentication method
   - Request/response format

3. **Test Connection**
   - Create API key on Aster
   - Test basic endpoints
   - Verify authentication

4. **Map Endpoints**
   - Compare with Lighter SDK
   - Identify equivalent endpoints
   - Note any differences

5. **Implement Client**
   - Create AsterClient class
   - Handle authentication
   - Test connection

---

## 💡 Comparison with Lighter

### Lighter SDK Structure (Reference)
```python
from lighter import SignerClient

client = SignerClient(
    api_url="https://mainnet.zklighter.elliot.ai",
    api_key=API_KEY,
    private_key=PRIVATE_KEY
)

# Get price
orderbook = await client.get_orderbook(market_id)

# Place order
order, response, error = await client.create_order(
    market_id, order_index, amount, price, is_ask, 
    order_type, time_in_force, reduce_only, 
    trigger_price, expiry
)
```

### Expected Aster Structure (TBD)
```python
# TODO: Research and implement

from aster import AsterClient  # Does this exist?

client = AsterClient(
    api_url="???",  # To be determined
    api_key="???",
    secret_key="???"  # Or private key?
)

# Get price
price = await client.get_ticker(symbol)

# Place order
order = await client.create_order(...)
```

---

## 🔗 Useful Resources

- Website: https://aster.xyz (or https://asterdex.com)
- Docs: https://docs.asterdex.com/
- GitHub: https://github.com/AsterDEX (?)
- Discord: (?)
- Telegram: (?)

---

## ⚠️ Blockers

- Need to find actual API endpoint URL
- Need to understand authentication mechanism
- Need API documentation with examples

---

**Last Updated:** [Date]
**Status:** 🔍 Researching API documentation

