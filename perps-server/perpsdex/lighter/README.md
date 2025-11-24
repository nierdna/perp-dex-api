# 🚀 Lighter Trading Bot - Tài Liệu Hướng Dẫn

Bot tự động trading BTC/ETH trên Lighter DEX (zkSync) với hỗ trợ LONG/SHORT, đóng bẫy TP/SL tự động.

---

## 📋 Mục Lục

- [Tính Năng](#-tính-năng)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt](#-cài-đặt)
- [Cấu Hình](#-cấu-hình)
- [Sử Dụng](#-sử-dụng)
- [Flow Hoạt Động](#-flow-hoạt-động)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Tính Năng

### Core Features
- ✅ **LONG/SHORT BTC**: Đặt lệnh mua/bán tự động
- ✅ **Leverage Trading**: Hỗ trợ đòn bẩy 1x-10x
- ✅ **Market & Limit Orders**: Linh hoạt loại lệnh
- ✅ **Auto TP/SL**: Tự động đặt Take Profit & Stop Loss
- ✅ **Bracket Orders**: Đóng bẫy (Entry + TP + SL) cùng lúc
- ✅ **R:R Ratio**: Tính toán tỉ lệ Risk:Reward tự động
- ✅ **Position Management**: Theo dõi vị thế real-time

### Advanced Features
- 🔐 **Auto Key Rotation**: Tự động fix API key mismatch
- 📊 **Market Data**: Lấy giá BTC, order book, balance
- 💰 **Position Sizing**: Tính size theo USD và leverage
- ⚡ **Fast Execution**: Sử dụng Lighter SDK chính thức
- 🛡️ **Safety Limits**: Giới hạn SL tối đa 5% để bảo vệ

---

## 💻 Yêu Cầu Hệ Thống

### Software
```
Python: >= 3.8
pip/pnpm: latest
OS: macOS, Linux, Windows
```

### Dependencies
```
lighter-sdk >= 0.1.4
aiohttp >= 3.12.0
python-dotenv >= 1.0.0
web3 (nếu dùng auto key rotation)
```

---

## 🔧 Cài Đặt

### 1. Clone Repository
```bash
git clone <repo-url>
cd point-dex/perpsdex/lighter
```

### 2. Cài Dependencies
```bash
# Tạo virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# hoặc
venv\Scripts\activate  # Windows

# Cài packages
pip install -r requirements.txt
```

### 3. Setup Environment Variables
Tạo file `.env` trong thư mục gốc:
```bash
# Lighter API Keys
LIGHTER_PUBLIC_KEY=your_public_key_here
LIGHTER_PRIVATE_KEY=your_private_key_here
LIGHTER_API_KEY_INDEX=0

# Account Settings
ACCOUNT_INDEX=0

# Position Settings (optional, có thể dùng config.json)
BTC_POSITION_USD=100.0
BTC_LEVERAGE=5.0

# Auto Key Rotation (optional)
LIGHTER_L1_WALLET=your_eth_private_key
LIGHTER_AUTO_FIX_API_KEY=true
```

### 4. Lấy API Keys từ Lighter

1. Truy cập: https://lighter.xyz
2. Connect wallet (MetaMask/WalletConnect)
3. Vào **Settings** → **API Keys**
4. Generate new API key
5. Copy Public Key và Private Key vào `.env`

---

## ⚙️ Cấu Hình

### Config File: `config.json`

```json
{
  "pair": "BTC-USDT",
  "size_usd": 100,
  "leverage": 5,
  "type": "market",
  "set_price_limit": null,
  "percent_take_profit": 50,
  "percent_stop_loss": 20,
  "perpdex": {
    "lighter": "long",
    "paradex": "short"
  }
}
```

### Tham Số Chi Tiết

| Tham số | Kiểu | Mô tả | Ví dụ |
|---------|------|-------|-------|
| `pair` | string | Cặp trading | `"BTC-USDT"`, `"ETH-USDT"` |
| `size_usd` | number | Kích thước vị thế ($USD) | `100`, `500`, `1000` |
| `leverage` | number | Đòn bẩy | `1`, `5`, `10` |
| `type` | string | Loại lệnh | `"market"`, `"limit"` |
| `set_price_limit` | number/null | Giá limit (nếu `type=limit`) | `65000`, `null` |
| `percent_take_profit` | number/null | % lời (ROI) | `50` = +50%, `null` = tắt |
| `percent_stop_loss` | number/null | % lỗ (ROI) | `20` = -20%, `null` = tắt |

### Ví Dụ Config

#### 1. Market Order + Auto TP/SL
```json
{
  "pair": "BTC-USDT",
  "size_usd": 200,
  "leverage": 3,
  "type": "market",
  "set_price_limit": null,
  "percent_take_profit": 30,
  "percent_stop_loss": 15
}
```

#### 2. Limit Order (không TP/SL)
```json
{
  "pair": "BTC-USDT",
  "size_usd": 500,
  "leverage": 5,
  "type": "limit",
  "set_price_limit": 64500,
  "percent_take_profit": null,
  "percent_stop_loss": null
}
```

#### 3. High Leverage Scalping
```json
{
  "pair": "BTC-USDT",
  "size_usd": 50,
  "leverage": 10,
  "type": "market",
  "set_price_limit": null,
  "percent_take_profit": 10,
  "percent_stop_loss": 5
}
```

---

## 🚀 Sử Dụng

### Chạy Bot Standalone

```bash
cd perpsdex/lighter
python trading_sdk.py
```

**Output:**
```
🤖 LIGHTER TRADING BTC BOT (SDK VERSION)
==================================================
🚀 Lighter Trading BTC Bot (SDK Version)
💰 Position Size: $100.0
📊 Leverage: 5.0x
🆔 Account Index: 0
🔑 API Key Index: 0
📈 Order Type: market
🛡️ Stop Loss: 20%
🎯 Take Profit: 50%

🔗 Đang kết nối đến Lighter DEX...
✅ Kết nối thành công đến Lighter DEX

📈 Đang lấy giá BTC...
💰 Giá BTC:
   🟢 Bid: $65,123.00
   🔴 Ask: $65,156.00
   📊 Mid: $65,139.50

💰 Đang lấy account balance...
💰 Account Balance:
   💵 Available: $5,234.56
   🏦 Collateral: $1,200.00
   📊 Total Assets: $6,434.56

❓ Bạn muốn LONG hay SHORT? (long/short)
Nhập 'long' hoặc 'short': long

⚠️  Cảnh báo: Trading có rủi ro!
Nhập 'yes' để xác nhận: yes

🎯 Đang đặt lệnh LONG $100.0 BTC...
...
✅ Đặt lệnh thành công!
📝 Tx Hash: 0x1234...abcd
```

### Sử Dụng Như Module

```python
from perpsdex.lighter.trading_sdk import LighterTradingBotSDK
import asyncio
import json

async def main():
    # Load config
    with open('perpsdex/config.json', 'r') as f:
        config = json.load(f)
    
    # Initialize bot
    bot = LighterTradingBotSDK(config=config)
    
    # Connect
    await bot.connect()
    
    # Get market data
    price_data = await bot.get_btc_price()
    balance = await bot.get_account_balance()
    
    # Place order
    result = await bot.place_long_order(price_data)
    
    if result['success']:
        print(f"✅ Order placed: {result['order_id']}")
        print(f"💰 Entry: ${result['entry_price']}")
        print(f"📊 Size: {result['position_size']} BTC")
    
    # Close connection
    await bot.close()

asyncio.run(main())
```

---

## 🔄 Flow Hoạt Động

### 1️⃣ **Khởi Tạo & Kết Nối**
```
Load .env → Load config.json → Create SignerClient
    ↓
Check API keys với server
    ↓
Auto-fix nếu mismatch (nếu bật)
    ↓
Initialize OrderApi & AccountApi
```

### 2️⃣ **Lấy Dữ Liệu Thị Trường**
```
Order Book → Best Bid/Ask → Mid Price
    ↓
Account Info → Balance, Collateral
    ↓
Market Metadata → Decimals, Min Amount
```

### 3️⃣ **Đặt Lệnh Entry**
```
Xác định giá entry (market/limit)
    ↓
Tính position size (USD → BTC)
    ↓
Scale decimals theo market
    ↓
Create & sign order
    ↓
Submit to blockchain
    ↓
Return tx_hash
```

### 4️⃣ **Đặt TP/SL Tự Động** (nếu config)
```
Tính TP/SL price với leverage adjustment
    ↓
Validate SL (max 5% safety)
    ↓
Place TP order (reduce_only=true)
    ↓
Place SL order (reduce_only=true)
    ↓
Return kết quả
```

### 5️⃣ **Bracket Order Flow** (Đóng Bẫy)
```
Entry Order
    ↓
✅ Success → Place TP
    ↓
✅ TP Success → Place SL
    ↓
Return {entry, tp, sl} results
```

---

## 📚 API Reference

### Class: `LighterTradingBotSDK`

#### Constructor
```python
LighterTradingBotSDK(config=None)
```

**Parameters:**
- `config` (dict, optional): Config từ JSON file

**Attributes:**
- `position_usd` (float): Kích thước vị thế USD
- `leverage` (float): Đòn bẩy
- `order_type` (str): 'market' hoặc 'limit'
- `percent_take_profit` (float/None): % TP
- `percent_stop_loss` (float/None): % SL

---

#### Methods

##### `async connect() -> bool`
Kết nối đến Lighter DEX

**Returns:** `True` nếu thành công

**Example:**
```python
bot = LighterTradingBotSDK()
success = await bot.connect()
```

---

##### `async get_btc_price() -> dict`
Lấy giá BTC từ order book

**Returns:**
```python
{
    'bid': 65123.00,
    'ask': 65156.00,
    'mid': 65139.50
}
```

---

##### `async get_account_balance() -> dict`
Lấy balance của account

**Returns:**
```python
{
    'available': 5234.56,
    'collateral': 1200.00,
    'total': 6434.56
}
```

---

##### `async place_long_order(price_data) -> dict`
Đặt lệnh LONG BTC

**Parameters:**
- `price_data` (dict): Giá từ `get_btc_price()`

**Returns:**
```python
{
    'success': True,
    'order_id': 1234567890,
    'entry_price': 65156.00,
    'position_size': 0.00153,
    'side': 'long',
    'tp_sl': {
        'tp_success': True,
        'sl_success': True,
        'results': [...]
    }
}
```

---

##### `async place_short_order(price_data) -> dict`
Đặt lệnh SHORT BTC (tương tự `place_long_order`)

---

##### `async place_tp_sl_orders(entry_price, position_size, side) -> dict`
Đặt TP/SL orders sau entry

**Parameters:**
- `entry_price` (float): Giá entry
- `position_size` (float): Size BTC
- `side` (str): 'long' hoặc 'short'

**Returns:**
```python
{
    'success': True,
    'tp_sl_placed': True,
    'tp_success': True,
    'sl_success': True,
    'results': [
        {'type': 'tp', 'success': True, 'tx_hash': '0x...'},
        {'type': 'sl', 'success': True, 'tx_hash': '0x...'}
    ]
}
```

---

##### `async check_positions() -> None`
Hiển thị positions đang mở

**Output:**
```
📊 2 positions đang mở:
   - market_id=1 size=0.00153 entry=65156.00
   - market_id=1 size=-0.00075 entry=64980.00
```

---

##### `async close() -> None`
Đóng kết nối

---

## 🧮 Tính Toán TP/SL

### Logic Tính Toán

#### LONG Position
```python
entry_price = 65000
leverage = 5
percent_take_profit = 50  # 50% ROI
percent_stop_loss = 20    # 20% ROI

# Adjust cho leverage
leverage_adj_tp = 50 / 5 = 10%
leverage_adj_sl = 20 / 5 = 4%

# Tính giá
tp_price = 65000 * (1 + 0.10) = $71,500
sl_price = 65000 * (1 - 0.04) = $62,400
```

#### SHORT Position
```python
entry_price = 65000
leverage = 5
percent_take_profit = 50
percent_stop_loss = 20

# Adjust cho leverage
leverage_adj_tp = 50 / 5 = 10%
leverage_adj_sl = 20 / 5 = 4%

# Tính giá (ngược lại LONG)
tp_price = 65000 * (1 - 0.10) = $58,500
sl_price = 65000 * (1 + 0.04) = $67,600
```

### Safety Limits
Bot tự động giới hạn SL để tránh lỗi "accidental price":
- **LONG**: SL không thấp hơn 5% entry price
- **SHORT**: SL không cao hơn 5% entry price

---

## 🛡️ Risk Management

### Khuyến Nghị

| Leverage | Max Position/Balance | TP % | SL % |
|----------|---------------------|------|------|
| 1x | 100% | 20% | 10% |
| 3x | 50% | 30% | 15% |
| 5x | 30% | 50% | 20% |
| 10x | 10% | 100% | 30% |

### Công Thức Position Size
```python
# Method 1: Fixed USD
position_usd = 100
position_btc = 100 / btc_price

# Method 2: % of Balance
balance = 5000
risk_percent = 2  # 2% của balance
position_usd = balance * 0.02
position_btc = position_usd / btc_price

# Method 3: Risk-based (với SL)
risk_usd = 50  # Chấp nhận lỗ $50
sl_percent = 20  # SL ở -20%
# ROI = -20% với leverage 5x = -4% price move
position_usd = risk_usd / 0.04 = $1,250
```

---

## ❗ Troubleshooting

### 1. Keys Mismatch Error
```
⚠️  Warning: API key mismatch with server
```

**Solution:**
```bash
# Thêm vào .env
LIGHTER_L1_WALLET=your_eth_private_key_here
LIGHTER_AUTO_FIX_API_KEY=true

# Chạy lại bot, sẽ tự động rotate key
python trading_sdk.py
```

### 2. Insufficient Balance
```
❌ Đặt lệnh thất bại: Insufficient balance
```

**Solution:**
- Kiểm tra balance: `await bot.get_account_balance()`
- Giảm `size_usd` trong config
- Deposit thêm USDC vào account

### 3. Position Size Too Small
```
⚠️  Size adjusted: $10.00 → $15.23 (min requirement)
```

**Explanation:** Lighter có min order size. Bot tự động adjust.

**Solution:** Tăng `size_usd` trong config

### 4. Accidental Price Error
```
❌ Stop Loss order failed: accidental price
```

**Explanation:** SL quá xa giá hiện tại (Lighter giới hạn)

**Solution:** Bot tự động retry với 2% thay vì config. Hoặc giảm `percent_stop_loss`

### 5. Order Rejected
```
❌ Đặt lệnh thất bại: Order rejected
```

**Possible Causes:**
- Giá limit quá xa market price
- Leverage quá cao
- Account locked/restricted

**Solution:**
- Dùng `type: "market"` thay vì limit
- Giảm leverage
- Check account status trên Lighter UI

---

## 📊 Examples

### Example 1: Simple LONG
```python
import asyncio
from perpsdex.lighter.trading_sdk import LighterTradingBotSDK

async def simple_long():
    config = {
        'size_usd': 100,
        'leverage': 5,
        'type': 'market',
        'percent_take_profit': 50,
        'percent_stop_loss': 20
    }
    
    bot = LighterTradingBotSDK(config)
    await bot.connect()
    
    price = await bot.get_btc_price()
    result = await bot.place_long_order(price)
    
    print(f"Success: {result['success']}")
    
    await bot.close()

asyncio.run(simple_long())
```

### Example 2: Limit Order (no TP/SL)
```python
async def limit_order_no_tpsl():
    config = {
        'size_usd': 200,
        'leverage': 3,
        'type': 'limit',
        'set_price_limit': 64500,
        'percent_take_profit': None,
        'percent_stop_loss': None
    }
    
    bot = LighterTradingBotSDK(config)
    await bot.connect()
    
    price = await bot.get_btc_price()
    result = await bot.place_long_order(price)
    
    if result['success']:
        print(f"Order placed at ${config['set_price_limit']}")
    
    await bot.close()

asyncio.run(limit_order_no_tpsl())
```

### Example 3: Check Positions Before Trade
```python
async def check_then_trade():
    bot = LighterTradingBotSDK()
    await bot.connect()
    
    # Kiểm tra positions hiện tại
    await bot.check_positions()
    
    # Kiểm tra balance
    balance = await bot.get_account_balance()
    if balance['available'] < 100:
        print("❌ Insufficient balance")
        await bot.close()
        return
    
    # Lấy giá
    price = await bot.get_btc_price()
    
    # Place order
    result = await bot.place_short_order(price)
    print(result)
    
    await bot.close()

asyncio.run(check_then_trade())
```

---

## 🔐 Bảo Mật

### ⚠️ Lưu Ý Quan Trọng

1. **KHÔNG** commit `.env` file lên Git
2. **KHÔNG** share API keys với người khác
3. **KHÔNG** dùng API keys production cho test
4. Giữ private keys an toàn, KHÔNG lưu plain text
5. Dùng read-only API keys nếu chỉ monitor (không trade)

### Best Practices
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.key" >> .gitignore

# Set permissions (Linux/macOS)
chmod 600 .env

# Use environment variables trong production
export LIGHTER_PRIVATE_KEY="..."
export LIGHTER_PUBLIC_KEY="..."
```

---

## 📞 Hỗ Trợ

### Lighter Official
- Website: https://lighter.xyz
- Docs: https://docs.lighter.xyz
- Discord: https://discord.gg/lighter
- Twitter: https://twitter.com/lighter_xyz

### Bot Issues
- GitHub Issues: <your-repo-url>/issues
- Telegram: @your_telegram
- Email: support@yourdomain.com

---

## 📄 License

MIT License - Free to use for personal/commercial projects

---

## 🙏 Credits

- **Lighter Team**: Official SDK and DEX platform
- **zkSync**: Layer 2 infrastructure
- **Python Community**: Dependencies and tools

---

## 🔄 Changelog

### v1.0.0 (2025-01-15)
- ✅ Initial release
- ✅ LONG/SHORT support
- ✅ Auto TP/SL
- ✅ Market & Limit orders
- ✅ Bracket orders
- ✅ Auto key rotation

---

**Happy Trading! 🚀💰**

*Disclaimer: Trading cryptocurrencies involves risk. Always do your own research and never invest more than you can afford to lose.*

