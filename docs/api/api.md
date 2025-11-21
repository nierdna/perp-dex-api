## Trading Order API (Unified)

API đặt lệnh duy nhất cho tất cả các sàn (Lighter, Aster).

- Hỗ trợ: **long / short**, **market / limit**
- TP/SL: **truyền trực tiếp theo giá** (không dùng `rr_ratio`)
- Symbol: **chuẩn thống nhất** – luôn dùng base token (`"BTC"`, `"ETH"`, …), server tự convert cho từng sàn.

---

### 1. Endpoint

- **Method**: `POST`
- **Path**: `/api/order`
- **Mục đích**: Tạo lệnh long/short trên Lighter hoặc Aster với các tuỳ chọn market/limit, TP/SL.

---

### 2. Chuẩn symbol

- Phía client **luôn** gửi `symbol` là **base token**, ví dụ:
  - `"BTC"`, `"ETH"`, `"SOL"`, `"DOGE"`, …
- API sẽ tự xử lý chuyển đổi theo sàn:
  - **Aster**: `"BTC"` → `"BTC-USDT"`, `"ETH"` → `"ETH-USDT"`, …
  - **Lighter**:
    - Dùng `"BTC"` để tra `market_id` tương ứng với `"BTC-USDT"` trong config (`lighter_markets.json`).

Nếu `symbol` không được hỗ trợ, API trả lỗi 400 với message mô tả rõ.

> **Quy ước:** Client **không** gửi `"BTC-USDT"` hoặc các format khác. Tất cả logic convert sang pair thực tế được xử lý nội bộ trong server.

---

### 3. Request body

#### 3.1. Trường bắt buộc

```jsonc
{
  "exchange": "lighter",      // "lighter" | "aster"
  "symbol": "BTC",            // base token, VD: "BTC", "ETH", "SOL"
  "side": "long",             // "long" | "short"
  "order_type": "market",     // "market" | "limit"
  "size_usd": 200,            // số tiền USD muốn vào lệnh
  "leverage": 5               // đòn bẩy
}
```

- **`exchange`**: `"lighter"` | `"aster"`
  - Chọn sàn giao dịch.
- **`symbol`**: string
  - Base token, ví dụ `"BTC"`, `"SOL"`, `"PEPE"`.
  - Nội bộ:
    - Aster: `"BTC"` → `"BTC-USDT"`
    - Lighter: `"BTC"` → tìm `market_id` của `"BTC-USDT"`.
- **`side`**: `"long"` | `"short"`
  - `long` = mở vị thế mua.
  - `short` = mở vị thế bán.
- **`order_type`**: `"market"` | `"limit"`
  - `market`: khớp theo giá thị trường.
  - `limit`: khớp theo giá giới hạn (`limit_price`).
- **`size_usd`**: number > 0
  - Khối lượng vào lệnh, tính theo USD (không tính đòn bẩy).
- **`leverage`**: number ≥ 1
  - Đòn bẩy sử dụng. Có thể là int/float, tuỳ sàn, nhưng nên nằm trong khoảng cho phép (ví dụ 1–100).

#### 3.2. Trường bắt buộc khi `order_type = "limit"`

```jsonc
{
  "limit_price": 98000        // bắt buộc với lệnh limit
}
```

- **`limit_price`**: number > 0  
  - Mức giá mà user muốn đặt lệnh LIMIT.
  - Bắt buộc **chỉ khi** `order_type = "limit"`.

#### 3.3. TP / SL theo giá (tuỳ chọn)

```jsonc
{
  "tp_price": 105000,         // giá Take Profit (optional)
  "sl_price": 95000           // giá Stop Loss (optional)
}
```

- **`tp_price`**: number > 0 (optional)
  - Giá Take Profit.
- **`sl_price`**: number > 0 (optional)
  - Giá Stop Loss.

**Rule khuyến nghị / validate:**

- Nếu `side = "long"`:
  - `sl_price` < entry_price (hoặc `limit_price` với lệnh limit)
  - `tp_price` > entry_price
- Nếu `side = "short"`:
  - `tp_price` < entry_price
  - `sl_price` > entry_price

Nếu vi phạm rule (ví dụ long nhưng `sl_price` > `tp_price`), API nên trả lỗi 400 với message rõ ràng.  
Nếu không gửi `tp_price` hoặc `sl_price` → hiểu là **không đặt TP/SL** cho lệnh đó.

#### 3.4. Trường quản lý lệnh (tuỳ chọn)

```jsonc
{
  "max_slippage_percent": 1.0,     // chỉ áp dụng cho market
  "client_order_id": "my-ord-001", // id phía client để idempotent / tracking
  "tag": "strategy_A"              // nhãn chiến lược / nguồn lệnh
}
```

- **`max_slippage_percent`**: number ≥ 0 (optional, **chỉ áp dụng cho `order_type = "market"`**)  
  - Giới hạn trượt giá tối đa so với giá thị trường (đơn vị: %).  
  - Ví dụ: `1.0` nghĩa là nếu khớp giá lệch > 1% so với giá lúc lấy, lệnh có thể bị reject.
- **`client_order_id`**: string (optional)
  - ID phía client tự sinh, dùng cho:
    - idempotent (tránh double-order khi retry).
    - tracking/log/debug.
- **`tag`** / **`strategy_id`**: string (optional)
  - Nhãn chiến lược, nguồn lệnh (web/frontend/bot XYZ), giúp thống kê & phân tích.

#### 3.5. Trường authentication (tuỳ chọn)

```jsonc
{
  "keys": {
    "lighter_private_key": "0x...",
    "lighter_account_index": 0,
    "lighter_api_key_index": 0,
    "aster_api_key": "YOUR_API_KEY",
    "aster_secret_key": "YOUR_SECRET_KEY"
  }
}
```

- **`keys`**: object (optional)
  - Nếu **không cung cấp** → API dùng key từ ENV server.
  - Nếu cung cấp, cấu trúc đề xuất:
    - **Dùng cho Lighter**:
      - `lighter_private_key`: string
      - `lighter_account_index`: int
      - `lighter_api_key_index`: int
    - **Dùng cho Aster**:
      - `aster_api_key`: string
      - `aster_secret_key`: string

Mỗi `exchange` chỉ cần tập con các field liên quan, phần còn lại có thể bỏ qua.

---

### 4. Ví dụ request

#### 4.1. Lệnh MARKET LONG BTC trên Lighter, không TP/SL

```json
POST /api/order
{
  "exchange": "lighter",
  "symbol": "BTC",
  "side": "long",
  "order_type": "market",
  "size_usd": 200,
  "leverage": 5
}
```

#### 4.2. Lệnh MARKET SHORT BTC trên Aster, có TP/SL

```json
POST /api/order
{
  "exchange": "aster",
  "symbol": "BTC",
  "side": "short",
  "order_type": "market",
  "size_usd": 100,
  "leverage": 3,
  "tp_price": 95000,
  "sl_price": 105000,
  "max_slippage_percent": 1.0
}
```

#### 4.3. Lệnh LIMIT LONG BTC trên Aster, có TP/SL

```json
POST /api/order
{
  "exchange": "aster",
  "symbol": "BTC",
  "side": "long",
  "order_type": "limit",
  "size_usd": 150,
  "leverage": 5,
  "limit_price": 98000,
  "tp_price": 105000,
  "sl_price": 95000,
  "client_order_id": "limit-long-btc-001",
  "tag": "grid_strategy"
}
```

---

### 5. Response (gợi ý format)

Ví dụ response chuẩn hoá:

```json
{
  "success": true,
  "exchange": "aster",
  "symbol": "BTC",
  "side": "long",
  "order_type": "limit",
  "order_id": "1234567890",
  "client_order_id": "limit-long-btc-001",
  "entry_price": 98000,
  "position_size": 0.0015,
  "size_usd": 150,
  "leverage": 5,
  "tp_price": 105000,
  "sl_price": 95000
}
```

- **`success`**: bool
- **`exchange`, `symbol`, `side`, `order_type`**: echo lại input.
- **`order_id`**: ID lệnh trên sàn.
- **`client_order_id`**: nếu client có gửi.
- **`entry_price`**:
  - Market: giá thực tế được khớp (hoặc giá trung bình nếu nhiều fill).
  - Limit: `limit_price` hoặc giá khớp thực tế (tuỳ logic).
- **`position_size`**: số lượng token (BTC, ETH, …).
- **`size_usd`**, **`leverage`**: echo lại input.
- **`tp_price`, `sl_price`**: nếu TP/SL được đặt.

Khi lỗi, API nên trả:

```json
{
  "success": false,
  "error": "Insufficient balance. Available: $50.00, Required: $200.00"
}
```

---

### 6. Ghi chú thiết kế nội bộ

- API client (user) **chỉ cần làm việc với**:
  - `symbol` (base), `side`, `order_type`, `size_usd`, `leverage`, (tp/sl price).
- Tất cả các chi tiết:
  - Convert symbol → pair / `market_id`.
  - Mapping BUY/SELL vs long/short từng sàn.
  - Tạo TP/SL Orders.
  - Kiểm soát slippage, TIF, v.v.

được xử lý ở **layer adapter cho từng sàn**, không lộ ra ngoài API contract.


