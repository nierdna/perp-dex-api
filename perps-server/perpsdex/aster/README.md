# Aster DEX Trading Bot

🚀 **Automated perpetual trading bot for Aster DEX**

## Overview

Aster ($ASTER) is a next-generation decentralized perpetual exchange built for everyone.

This bot integrates with **Aster Perpetual (Pro)** mode:
- ✅ Order book interface with deep liquidity
- ✅ Extremely low trading fees
- ✅ Advanced trading tools (Market/Limit/Trailing Stop)
- ✅ API support for automated trading
- ✅ Multi-chain support

## Features

### Trading
- 📊 **Market Orders** - Instant execution at current price
- 📈 **Limit Orders** - Execute at specific price
- 🎯 **TP/SL Orders** - Automatic Take Profit & Stop Loss
- 🔄 **Trailing Stop** (Aster native feature)
- 📐 **Grid Trading** (optional)

### Risk Management
- 🛡️ **Stop Loss** with % distance
- 💰 **Take Profit** with R:R ratio
- ⚡ **Position size calculator**
- 📊 **Leverage support** (up to 100x)

### UI
- 🎨 **Web interface** for easy testing
- 📱 **Real-time data** (price, balance, positions)
- 🔐 **Secure** API key management

## Project Structure

```
aster/
├── api/
│   └── main.py           # FastAPI backend
├── core/
│   ├── client.py         # Aster client
│   ├── market.py         # Market data
│   ├── order.py          # Order executor
│   └── risk.py           # TP/SL manager
├── utils/
│   ├── calculator.py     # Calculations
│   └── config.py         # Config loader
├── aster_markets.json    # Market metadata
├── ui_test.html          # Web UI
├── run_api.sh            # Start script
└── README.md
```

## Setup

### 1. Environment Variables

Create `.env` file in project root:

```bash
# Aster API credentials (TODO: Get from Aster docs)
ASTER_API_KEY=your_api_key_here
ASTER_SECRET_KEY=your_secret_key_here
ASTER_PRIVATE_KEY=your_private_key_here
```

### 2. Install Dependencies

```bash
cd /path/to/point-dex
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Start API Server

```bash
cd perpsdex/aster
./run_api.sh
```

### 4. Open Web UI

```
http://localhost:8001/ui_test.html
```

## Configuration

Edit `perpsdex/config.json`:

```json
{
  "dex": "aster",
  "pair": "BTC-USDT",
  "size_usd": 100,
  "leverage": 5,
  "sl_percent": 3,
  "rr_ratio": [1, 2]
}
```

## API Endpoints

- `GET /api/status` - Check connection
- `GET /api/market/price/{symbol}` - Get price
- `GET /api/market/balance` - Get balance
- `GET /api/positions` - Get positions
- `POST /api/orders/calculate` - Calculate TP/SL
- `POST /api/orders/long` - Place LONG order
- `POST /api/orders/short` - Place SHORT order
- `POST /api/orders/limit-long` - Place LIMIT LONG
- `POST /api/orders/limit-short` - Place LIMIT SHORT

## Documentation

- 📚 [Aster Docs](https://docs.asterdex.com/)
- 🔧 [API Documentation](https://docs.asterdex.com/product/aster-perpetual-pro/api/api-documentation)
- 💡 [How to create API](https://docs.asterdex.com/product/aster-perpetual-pro/api/how-to-create-an-api)

## Status

⚠️ **IN DEVELOPMENT**

- [x] Folder structure
- [ ] Research Aster API
- [ ] Implement client connection
- [ ] Implement order execution
- [ ] Implement TP/SL logic
- [ ] Create FastAPI endpoints
- [ ] Build web UI
- [ ] Test with real API

## License

MIT

