# Environment Variables for Hyperliquid Integration

Add these to your `.env` file:

```bash
# Hyperliquid Configuration
HYPERLIQUID_PRIVATE_KEY=0x...
HYPERLIQUID_TESTNET=false  # Set to true for testnet
```

## Complete .env Example

```bash
# Hyperliquid
HYPERLIQUID_PRIVATE_KEY=0x...
HYPERLIQUID_TESTNET=false

# Lighter  
LIGHTER_PRIVATE_KEY=0x...
ACCOUNT_INDEX=0
LIGHTER_API_KEY_INDEX=0

# Aster
ASTER_API_KEY=...
ASTER_SECRET_KEY=...
ASTER_API_URL=https://fapi.asterdex.com

# Database (Optional)
DB_URL=postgresql://user:pass@host:5432/db

# Server
PORT=8080
IS_API=1
```

## Getting Started

1. **Get your Hyperliquid Private Key**
   - Use your existing wallet private key
   - OR create an Agent Wallet (recommended for bots)

2. **Add to .env**
   ```bash
   HYPERLIQUID_PRIVATE_KEY=0x1234...
   ```

3. **Test**
   ```bash
   curl -X POST http://localhost:8080/api/order \
     -H "Content-Type: application/json" \
     -d '{
       "exchange": "hyperliquid",
       "symbol": "BTC",
       "side": "long",
       "order_type": "market",
       "size_usd": 10,
       "leverage": 5
     }'
   ```

## Security Note

- **MAINNET**: Real money! Be careful
- **TESTNET**: Use `HYPERLIQUID_TESTNET=true` for testing
- **Agent Wallets**: Create dedicated API wallet with limited permissions
