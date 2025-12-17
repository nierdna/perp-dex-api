# Hyperliquid DEX Integration

## Overview

Tích hợp Hyperliquid DEX vào perps-server, hỗ trợ:
- ✅ Market/Limit orders
- ✅ Long/Short positions
- ✅ Take Profit / Stop Loss
- ✅ Real-time market data
- ✅ Position management

## Hyperliquid Features

### Ưu điểm
- **Native TP/SL**: Hỗ trợ trigger orders tốt
- **Symbol đơn giản**: Dùng `BTC`, `ETH` (không cần `-USDT`)
- **High performance**: Onchain DEX với tốc độ cao
- **Leverage cao**: Hỗ trợ đến 50x leverage
- **Zero gas fees**: Không tốn gas cho trading

### SDK
Sử dụng `hyperliquid-python-sdk` official:
```bash
pip install hyperliquid-python-sdk
```

## Configuration

### Environment Variables

```bash
# Hyperliquid
HYPERLIQUID_PRIVATE_KEY=0x...
HYPERLIQUID_TESTNET=false  # true cho testnet
```

### API Keys
Hyperliquid sử dụng wallet private key để authenticate.

**Note**: Có thể tạo Agent Wallet (API wallet) riêng cho trading automation, không có quyền withdraw.

## Usage

### 1. Place Market Order

```json
POST /api/order
{
  "exchange": "hyperliquid",
  "symbol": "BTC",
  "side": "long",
  "order_type": "market",
  "size_usd": 100,
  "leverage": 10,
  "tp_price": 105000,
  "sl_price": 95000
}
```

### 2. Place Limit Order

```json
POST /api/order
{
  "exchange": "hyperliquid",
  "symbol": "ETH",
  "side": "short",
  "order_type": "limit",
  "size_usd": 200,
  "limit_price": 3500,
  "leverage": 5,
  "tp_price": 3300,
  "sl_price": 3700  
}
```

### 3. Close Position

```json
POST /api/order/close
{
  "exchange": "hyperliquid",
  "symbol": "BTC",
  "percentage": 100
}
```

### 4. Get Positions

```bash
GET /api/orders/positions?exchange=hyperliquid
```

### 5. Get Balance

```bash
GET /api/balance?exchange=hyperliquid
```

## Architecture

```
perpsdex/hyperliquid/
├── core/
│   ├── client.py       # HyperliquidClient - Connection management
│   ├── market.py       # Market data (price, positions, orders)
│   ├── order.py        # Order execution (market/limit)
│   └── risk.py         # TP/SL management
├── utils/
│   └── helpers.py      # Helper functions
└── hyperliquid_markets.json  # Supported symbols
```

## Technical Details

### Symbol Format
- Hyperliquid: `BTC`, `ETH`, `SOL`
- No need for `-USDT` suffix

### Order Types
- **Market**: IOC (Immediate or Cancel) với limit price cho slippage control
- **Limit**: Post-only hoặc regular limit orders
- **TP/SL**: Trigger orders với reduce_only flag

### Slippage Control
- Default: 1% slippage cho market orders
- Có thể customize qua `max_slippage_percent`

### Position Side
- **Long**: `is_buy = True`
- **Short**: `is_buy = False`

### TP/SL Logic
- **Long TP**: Sell limit @ tp_price
- **Long SL**: Sell stop @ sl_price  
- **Short TP**: Buy limit @ tp_price
- **Short SL**: Buy stop @ sl_price

## API Response Format

### Success Response
```json
{
  "success": true,
  "exchange": "hyperliquid",
  "symbol": "BTC",
  "side": "long",
  "order_type": "market",
  "order_id": "...",
  "entry_price": 98500.5,
  "position_size": 0.001015,
  "size_usd": 100,
  "leverage": 10,
  "tp_price": 105000,
  "sl_price": 95000
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Testing

### Testnet
Set `HYPERLIQUID_TESTNET=true` để test trên testnet.

**Testnet URL**: https://app.hyperliquid-testnet.xyz

### Get Testnet Funds
Visit: https://app.hyperliquid-testnet.xyz/faucet

## Resources

- **Official Docs**: https://hyperliquid.gitbook.io/hyperliquid-docs/
- **Python SDK**: https://github.com/hyperliquid-dex/hyperliquid-python-sdk
- **API Reference**: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- **Discord**: https://discord.gg/hyperliquid

## Notes

### Updates từ SDK
- SDK tự động handle signing
- Không cần manage nonce manually
- WebSocket support cho real-time data (có thể implement sau)

### Best Practices
1. **Agent Wallets**: Dùng agent wallet riêng cho bot, không dùng main wallet
2. **Risk Management**: Luôn set TP/SL
3. **Position Sizing**: Kích thước hợp lý với account size
4. **Slippage**: Kiểm tra slippage trước khi đặt lệnh lớn

## Troubleshooting

### Common Issues

1. **"Insufficient balance"**
   - Check account value: `GET /api/balance?exchange=hyperliquid`
   - Reduce position size hoặc leverage

2. **"Invalid symbol"**
   - Check supported symbols trong `hyperliquid_markets.json`
   - Symbol phải viết HOA: `BTC` không phải `btc`

3. **"TP/SL failed"**
   - Validate TP/SL prices theo side
   - Long: SL < entry < TP
   - Short: TP < entry < SL

4. **Connection timeout**
   - Check network connection
   - Verify API endpoint (mainnet vs testnet)
