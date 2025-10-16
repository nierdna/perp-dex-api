# 📦 Lighter Trading Modules - Documentation

Code đã được **REFACTOR** thành các modules nhỏ, độc lập, tái sử dụng được!

---

## 🎯 **PHILOSOPHY: INPUT → PROCESS → OUTPUT**

Mỗi module:
- ✅ **Input rõ ràng**: Parameters truyền vào, không hardcode
- ✅ **Process độc lập**: Không phụ thuộc vào config hay state toàn cục
- ✅ **Output có cấu trúc**: Return dict với `success`, `error`, data

**Config chỉ là 1 INPUT OPTION - KHÔNG BẮT BUỘC!**

---

## 📂 **CẤU TRÚC THƯ MỤC**

```
perpsdex/lighter/
├── core/
│   ├── __init__.py
│   ├── client.py          # LighterClient - Connection & Keys
│   ├── market.py          # MarketData - Price, Balance, Positions
│   ├── order.py           # OrderExecutor - Place Orders
│   └── risk.py            # RiskManager - TP/SL Management
├── utils/
│   ├── __init__.py
│   ├── calculator.py      # Calculator - Pure calculation functions
│   └── config.py          # ConfigLoader - Load & parse config
├── trading_sdk.py         # Legacy wrapper (backward compatible)
├── example_usage.py       # Examples: Cách dùng modules
└── MODULES_README.md      # File này
```

---

## 📚 **MODULES REFERENCE**

### 1️⃣ **core/client.py - LighterClient**

**Chức năng**: Quản lý connection đến Lighter DEX, xử lý API keys

**Input:**
```python
LighterClient(
    private_key: str,           # API private key
    api_key_index: int = 0,     # Index của API key
    account_index: int = 0,     # Index của account
    url: str = "...",           # Lighter API URL
    auto_fix_keys: bool = False,  # Tự động fix key mismatch
    l1_private_key: str = None  # L1 key để auto-fix
)
```

**Methods:**
- `async connect() -> dict`
- `async close()`
- `get_signer_client() -> SignerClient`
- `get_order_api() -> OrderApi`
- `get_account_api() -> AccountApi`
- `has_keys_mismatch() -> bool`

**Output Example:**
```python
{
    'success': True,
    'keys_mismatch': False,
    'error': None  # nếu có lỗi
}
```

---

### 2️⃣ **core/market.py - MarketData**

**Chức năng**: Lấy dữ liệu thị trường (giá, balance, positions)

**Input:**
```python
MarketData(order_api, account_api)
```

**Methods:**

#### `async get_price(market_id, symbol=None) -> dict`
```python
# Input
market_id: int        # 1=BTC, 2=ETH, ...
symbol: str           # 'BTC', 'ETH' (để hiển thị)

# Output
{
    'success': True,
    'bid': 65123.00,
    'ask': 65156.00,
    'mid': 65139.50
}
```

#### `async get_account_balance(account_index) -> dict`
```python
# Output
{
    'success': True,
    'available': 5234.56,
    'collateral': 1200.00,
    'total': 6434.56
}
```

#### `async get_positions(account_index) -> dict`
```python
# Output
{
    'success': True,
    'positions': [
        {'market_id': 1, 'size': 0.001, 'avg_entry_price': 65000}
    ],
    'count': 1
}
```

---

### 3️⃣ **core/order.py - OrderExecutor**

**Chức năng**: Đặt lệnh entry (LONG/SHORT)

**Input:**
```python
OrderExecutor(signer_client, order_api)
```

**Methods:**

#### `async place_order(...) -> dict`
```python
# Input
side: str                    # 'long' hoặc 'short'
entry_price: float           # Giá entry
position_size_usd: float     # Size USD
market_id: int               # ID market
symbol: str = None           # Symbol (optional)
leverage: float = 1.0        # Đòn bẩy

# Output
{
    'success': True,
    'order_id': 1234567890,
    'tx_hash': '0x...',
    'entry_price': 65156.00,
    'position_size': 0.00153,
    'side': 'long'
}
```

---

### 4️⃣ **core/risk.py - RiskManager**

**Chức năng**: Đặt TP/SL orders

**Input:**
```python
RiskManager(signer_client, order_api)
```

**Methods:**

#### `async place_tp_sl_orders(...) -> dict`
```python
# Input
entry_price: float           # Giá entry
position_size: float         # Size (số lượng coin)
side: str                    # 'long' hoặc 'short'
tp_price: float              # Giá TP
sl_price: float              # Giá SL
market_id: int               # ID market
symbol: str = None           # Symbol (optional)
validate_sl: bool = True     # Validate SL không
max_sl_percent: float = 5.0  # % SL tối đa

# Output
{
    'success': True,
    'tp_success': True,
    'sl_success': True,
    'tp_tx_hash': '0x...',
    'sl_tx_hash': '0x...',
    'results': [...]
}
```

---

### 5️⃣ **utils/calculator.py - Calculator**

**Chức năng**: Tính toán thuần túy (pure functions)

**Methods:** (Tất cả là `@staticmethod`)

#### `calculate_position_size(usd_amount, price, decimals=8) -> float`
```python
Calculator.calculate_position_size(100, 65000)
# Output: 0.00153846
```

#### `calculate_tp_sl_from_percent(...) -> dict`
```python
Calculator.calculate_tp_sl_from_percent(
    entry_price=65000,
    side='long',
    tp_percent=50,    # +50% ROI
    sl_percent=20,    # -20% ROI
    leverage=5
)
# Output: {'tp_price': 71500, 'sl_price': 62400, ...}
```

#### `calculate_tp_sl_from_rr_ratio(...) -> dict`
```python
Calculator.calculate_tp_sl_from_rr_ratio(
    entry_price=65000,
    side='long',
    sl_price=63000,
    rr_ratio=[1, 2]  # Mất 1, Ăn 2
)
# Output: {'tp_price': 69000, 'risk_amount': 2000, 'reward_amount': 4000}
```

#### `calculate_sl_from_percent(entry_price, side, sl_percent) -> float`
```python
Calculator.calculate_sl_from_percent(65000, 'long', 3)
# Output: 63050
```

#### `validate_sl_price(...) -> dict`
```python
Calculator.validate_sl_price(60000, 65000, 'long', max_percent=5)
# Output: {'valid': False, 'adjusted_price': 61750, ...}
```

#### `scale_to_int(value, decimals) -> int`
```python
Calculator.scale_to_int(0.00153, 8)
# Output: 153000
```

#### `calculate_rr_ratio(entry_price, tp_price, sl_price) -> float`
```python
Calculator.calculate_rr_ratio(65000, 69000, 63000)
# Output: 2.0
```

---

### 6️⃣ **utils/config.py - ConfigLoader**

**Chức năng**: Load và parse config từ JSON (optional)

**Methods:** (Tất cả là `@staticmethod`)

#### `load_from_file(file_path) -> dict`
```python
config = ConfigLoader.load_from_file('perpsdex/config.json')
# Output: {...} hoặc {} nếu lỗi
```

#### `parse_trading_params(config) -> dict`
```python
params = ConfigLoader.parse_trading_params(config)
# Output: {
#     'pair': 'ETH-USDT',
#     'symbol': 'ETH',
#     'market_id': 2,
#     'size_usd': 100.0,
#     'leverage': 5.0,
#     'order_type': 'market',
#     'limit_price': None
# }
```

#### `parse_risk_params(config) -> dict`
```python
risk = ConfigLoader.parse_risk_params(config)
# Output: {
#     'rr_ratio': [1, 2],
#     'tp_percent': None,
#     'sl_percent': None,
#     'use_rr_ratio': True
# }
```

#### `get_market_id_for_pair(pair) -> int`
```python
market_id = ConfigLoader.get_market_id_for_pair('ETH-USDT')
# Output: 2
```

---

## 🚀 **USAGE EXAMPLES**

### Example 1: Đặt Lệnh Đơn Giản (Không Cần Config)

```python
from core.client import LighterClient
from core.market import MarketData
from core.order import OrderExecutor

# Step 1: Connect
client = LighterClient(
    private_key="your_key",
    account_index=0
)
await client.connect()

# Step 2: Get price
market = MarketData(client.get_order_api(), client.get_account_api())
price = await market.get_price(market_id=1, symbol='BTC')

# Step 3: Place order
order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
result = await order_executor.place_order(
    side='long',
    entry_price=price['ask'],
    position_size_usd=100,
    market_id=1,
    symbol='BTC'
)

print(f"Order: {result['tx_hash']}")
await client.close()
```

---

### Example 2: Bracket Order (Entry + TP + SL với R:R)

```python
from core.client import LighterClient
from core.market import MarketData
from core.order import OrderExecutor
from core.risk import RiskManager
from utils.calculator import Calculator

# Connect
client = LighterClient(private_key="your_key")
await client.connect()

# Get price
market = MarketData(client.get_order_api(), client.get_account_api())
price = await market.get_price(market_id=1, symbol='BTC')
entry_price = price['ask']

# Calculate TP/SL từ R:R ratio [1, 2]
sl_price = Calculator.calculate_sl_from_percent(entry_price, 'long', 3)  # 3% SL
tp_sl = Calculator.calculate_tp_sl_from_rr_ratio(
    entry_price=entry_price,
    side='long',
    sl_price=sl_price,
    rr_ratio=[1, 2]
)
tp_price = tp_sl['tp_price']

# Place entry order
order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
entry = await order_executor.place_order(
    side='long',
    entry_price=entry_price,
    position_size_usd=100,
    market_id=1,
    symbol='BTC'
)

# Place TP/SL
risk = RiskManager(client.get_signer_client(), client.get_order_api())
tp_sl_result = await risk.place_tp_sl_orders(
    entry_price=entry_price,
    position_size=entry['position_size'],
    side='long',
    tp_price=tp_price,
    sl_price=sl_price,
    market_id=1,
    symbol='BTC'
)

print(f"✅ Bracket order: Entry={entry['tx_hash']}, TP={tp_sl_result['tp_success']}, SL={tp_sl_result['sl_success']}")
await client.close()
```

---

### Example 3: Sử Dụng Config (Config Là Input)

```python
from utils.config import ConfigLoader
from core.client import LighterClient
from core.market import MarketData
from core.order import OrderExecutor

# Load config (optional)
config = ConfigLoader.load_from_file('perpsdex/config.json')
trading_params = ConfigLoader.parse_trading_params(config)

# Connect
client = LighterClient(private_key="your_key")
await client.connect()

# Get price
market = MarketData(client.get_order_api(), client.get_account_api())
price = await market.get_price(
    market_id=trading_params['market_id'],
    symbol=trading_params['symbol']
)

# Place order với params từ config
order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
result = await order_executor.place_order(
    side='long',
    entry_price=price['ask'],
    position_size_usd=trading_params['size_usd'],
    market_id=trading_params['market_id'],
    symbol=trading_params['symbol'],
    leverage=trading_params['leverage']
)

print(f"Order from config: {result['tx_hash']}")
await client.close()
```

---

### Example 4: Calculator Only (Không Cần Connection)

```python
from utils.calculator import Calculator

# Tính position size
size = Calculator.calculate_position_size(100, 65000)
print(f"Size: {size} BTC")

# Tính TP/SL từ %
tp_sl = Calculator.calculate_tp_sl_from_percent(65000, 'long', 50, 20, 5)
print(f"TP: ${tp_sl['tp_price']:,.2f}, SL: ${tp_sl['sl_price']:,.2f}")

# Tính TP từ R:R ratio
tp_rr = Calculator.calculate_tp_sl_from_rr_ratio(65000, 'long', 63000, [1, 2])
print(f"TP from R:R: ${tp_rr['tp_price']:,.2f}")

# Validate SL
validation = Calculator.validate_sl_price(60000, 65000, 'long', 5)
print(f"Valid: {validation['valid']}, Adjusted: ${validation['adjusted_price']:,.2f}")
```

---

## ✅ **ƯU ĐIỂM CỦA REFACTOR**

### 1. **Input/Output Rõ Ràng**
- Mỗi function có input/output được document
- Không hardcode, tất cả là parameters
- Dễ test, dễ debug

### 2. **Tái Sử Dụng**
- Modules độc lập, dùng riêng lẻ được
- Calculator là pure functions, dùng ở đâu cũng được
- Không phụ thuộc vào config hay state toàn cục

### 3. **Dễ Mở Rộng**
- Thêm exchange mới: tạo folder `paradex/` tương tự
- Thêm strategy mới: combine các modules theo cách khác
- Thêm pair mới: `ConfigLoader.add_pair_mapping('SOL-USDT', 3)`

### 4. **Dễ Test**
```python
# Test Calculator (không cần connection)
def test_position_size():
    size = Calculator.calculate_position_size(100, 65000)
    assert size == 0.00153846

# Test với mock data
def test_order():
    mock_client = MockClient()
    executor = OrderExecutor(mock_client, mock_api)
    result = await executor.place_order(...)
    assert result['success']
```

### 5. **Backward Compatible**
- File `trading_sdk.py` cũ vẫn hoạt động
- Có thể migrate dần dần
- Không break existing code

---

## 📝 **CHẠY EXAMPLES**

```bash
# Chạy example file
cd perpsdex/lighter
python example_usage.py

# Hoặc chạy từng example
python -c "from example_usage import example_1_basic_order; import asyncio; asyncio.run(example_1_basic_order())"
```

---

## 🔄 **MIGRATION GUIDE**

### Từ Code Cũ → Code Mới

**Cũ:**
```python
bot = LighterTradingBotSDK(config=config)
await bot.connect()
result = await bot.place_long_order(price_data)
```

**Mới:**
```python
client = LighterClient(private_key="...")
await client.connect()

market = MarketData(client.get_order_api(), client.get_account_api())
price = await market.get_price(market_id=1)

executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
result = await executor.place_order(
    side='long',
    entry_price=price['ask'],
    position_size_usd=100,
    market_id=1
)
```

**Ưu điểm:**
- Rõ ràng hơn: biết đang làm gì ở từng bước
- Linh hoạt hơn: thay đổi parameters dễ dàng
- Tái sử dụng: dùng lại `market`, `executor` cho nhiều orders

---

## 🎯 **KẾT LUẬN**

✅ **Modules đã được refactor hoàn toàn**
✅ **Input/Output rõ ràng, không hardcode**
✅ **Config chỉ là 1 input option, không bắt buộc**
✅ **Tái sử dụng được, dễ test, dễ maintain**
✅ **Có thể combine theo nhiều cách khác nhau**

**Happy Trading! 🚀💰**

