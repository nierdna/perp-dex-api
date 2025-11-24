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

---

### 7. Ghi chú riêng cho từng sàn (hiện trạng & TODO)

#### 7.1. Aster

- **Market + Limit + TP/SL**:
  - Aster hỗ trợ đặt TP/SL dưới dạng các lệnh `STOP_MARKET` / `TAKE_PROFIT_MARKET` độc lập.
  - Flow hiện tại:
    - Entry (MARKET hoặc LIMIT) được gửi.
    - TP/SL được gửi ngay sau đó bằng `AsterRiskManager`, và có thể hiển thị như lệnh riêng trên UI Aster.
- **Trạng thái**:  
  - Unified API cho Aster **đã hoạt động đúng** với cả MARKET/LIMIT + TP/SL theo giá.

#### 7.2. Lighter

- **Market + TP/SL**:
  - Entry MARKET dùng limit “aggressive” với `max_slippage_percent` để cố gắng fill ngay.
  - TP/SL được đặt qua `LighterRiskManager` dưới dạng lệnh đóng vị thế (reduce-only).
  - Flow này hoạt động ổn hơn vì sau entry MARKET thường đã mở position.

- **Limit + TP/SL (hiện tại)**:
  - Unified API vẫn cho phép gửi `tp_price` / `sl_price` kèm LIMIT.
  - Adapter sẽ:
    - Submit LIMIT entry lên Lighter.
    - Gửi luôn TP/SL ngay sau đó.
  - Tuy nhiên, do cách Lighter xử lý lệnh reduce-only / TP/SL:
    - TP/SL **không được đảm bảo** sẽ được accept nếu tại thời điểm đó **chưa có position**.
    - Do đó có thể **không thấy TP/SL xuất hiện trên UI Lighter**, dù unified API đã cố gắng đặt.

- **Kết luận hiện trạng**:
  - MARKET + TP/SL trên Lighter: **được support tốt hơn**, phù hợp với spec.
  - LIMIT + TP/SL trên Lighter: **chưa đạt trải nghiệm “bracket order” giống Aster** (entry + TP + SL đều hiển thị rõ trên UI).

- **TODO (roadmap)**:
  - Thiết kế lại flow cho Lighter LIMIT:
    - Theo dõi fill của LIMIT (positions / fills).
    - Chỉ gửi TP/SL **sau khi** entry LIMIT thực sự được khớp (đã mở position).
  - Bổ sung cơ chế đồng bộ/truy vấn TP/SL từ Lighter để:
    - Xác nhận lệnh TP/SL nào đã được accept.
    - Hiển thị trạng thái TP/SL nhất quán với UI Lighter.

---

### 8. Order logging & Database (internal design)

> Mục tiêu: Mỗi request `POST /api/order` đều được lưu lại vào DB (nếu cấu hình `DB_URL`) dưới dạng 1 bản ghi “order”, phục vụ audit, thống kê, và đồng bộ với trạng thái thực tế trên sàn.

#### 8.1. Cấu hình DB

- ENV:
  - `DB_URL`: chuỗi kết nối SQLAlchemy, ví dụ:
    - SQLite local: `sqlite:///orders.db`
    - PostgreSQL: `postgresql+psycopg2://user:pass@host:5432/dbname`
- Nếu **không cấu hình `DB_URL`**:
  - Server vẫn chạy bình thường.
  - Layer DB ở `db.py` sẽ chạy chế độ **no-op** (chỉ log cảnh báo, không lưu gì).

#### 8.2. Bảng `orders` (đơn giản hoá)

Mỗi lệnh entry (LONG/SHORT, MARKET/LIMIT) tương ứng 1 row trong bảng `orders`.

- **Nhóm nhận diện:**
  - `id`: int, PK, auto-increment.
  - `exchange`: `"lighter"` hoặc `"aster"`.
  - `exchange_order_id`: nullable, `order_id` do sàn trả về.

- **Thông tin trading (input):**
  - `symbol_base`: base symbol client gửi, ví dụ `"BTC"`.
  - `symbol_pair`: nullable, có thể dùng cho `"BTC-USDT"` hoặc `"BTCUSDT"` (hiện đang để `None` ở unified layer, có thể mở rộng sau).
  - `side`: `"long"` / `"short"`.
  - `order_type`: `"market"` / `"limit"`.
  - `size_usd`: số tiền USD yêu cầu vào lệnh.
  - `leverage`: đòn bẩy.
  - `limit_price`: nullable.
  - `tp_price`, `sl_price`: nullable.
  - `max_slippage_percent`: nullable.
  - `client_order_id`: nullable.
  - `tag`: nullable (strategy/source tag).

- **Trạng thái & kết quả:**
  - `status`:
    - `"pending"`: vừa nhận request, chưa gọi sàn xong.
    - `"submitted"`: đã gửi sàn thành công (có `exchange_order_id`).
    - `"rejected"`: lỗi logic/400 (VD: validate, not enough margin, invalid signature…).
    - `"error"`: lỗi 500 nội bộ (exception).
  - `entry_price_requested`: giá entry mà backend dùng (market/limit).
  - `entry_price_filled`: hiện tại đang mirror `entry_price` từ kết quả (tương lai có thể dùng giá fill thực tế khi job sync trạng thái).
  - `position_size_asset`: nullable, số lượng asset (BTC, ETH, …) backend nhận được sau khi place order.
  - `exchange_raw_response`: JSON (text), lưu raw response (hoặc thông tin lỗi) từ sàn / unified result để tiện debug.

- **Thời gian:**
  - `created_at`, `updated_at`: UTC.

#### 8.3. Lifecycle trong `/api/order`

1. **Nhận request từ client**
   - FastAPI nhận `UnifiedOrderRequest`, validate.
   - Nếu `DB_URL` được cấu hình và `db.log_order_request` khả dụng:
     - Gọi `log_order_request(...)`:
       - Tạo bản ghi `orders` với `status = "pending"`.
       - Lưu lại các field: exchange, symbol_base, side, order_type, size_usd, leverage, limit_price, TP/SL, max_slippage_percent, client_order_id, tag, cùng bản dump payload request.
       - Hàm trả về `db_order_id` (id trong bảng `orders`) để dùng cho các bước sau.

2. **Gọi adapter theo sàn (Lighter/Aster)**
   - Chuẩn hoá keys (ENV/body).
   - Dispatch:
     - `handle_lighter_order(...)` hoặc
     - `handle_aster_order(...)`.

3. **Khi đặt lệnh THÀNH CÔNG (result `success=True`)**
   - Unified layer in log:
     - `Order ID`, `Entry Price`, `Position Size`, …
   - Nếu `update_order_after_result` khả dụng:
     - Gọi `update_order_after_result(...)` với:
       - `db_order_id`: id đã tạo ở bước 1.
       - `status = "submitted"`.
       - `exchange_order_id = result["order_id"]` (nếu có).
       - `entry_price_requested` / `entry_price_filled` từ `result`.
       - `position_size_asset` từ `result`.
       - `raw_response = result` (full dict trả về cho client).

4. **Khi lỗi HTTP 400/HTTPException (validate hoặc lỗi từ sàn)**
   - Unified layer re-raise `HTTPException` như cũ (client vẫn nhận được JSON `{"detail": ...}`).
   - Nếu có `db_order_id` và `update_order_after_result`:
     - Gọi `update_order_after_result(...)` với:
       - `status = "rejected"` nếu `status_code == 400`, ngược lại `"error"`.
       - `exchange_order_id = None`.
       - `raw_response = {"detail": http_exc.detail}`.

5. **Khi lỗi 500 nội bộ (Exception khác)**
   - In traceback.
   - Nếu có `db_order_id`:
     - Cập nhật `status = "error"`, lưu thông tin exception vào `exchange_raw_response`.
   - Raise `HTTPException(500, detail=str(e))` cho client.

#### 8.4. Ghi chú mở rộng (tương lai)

- Có thể bổ sung:
  - Bảng riêng `order_tp_sl` để track chi tiết từng lệnh TP/SL.
  - Job nền (cron/worker) gọi lại API Aster/Lighter để:
    - Cập nhật `status` thành `filled`/`cancelled`/`partially_filled`.
    - Lưu `filled_price`, `filled_size`, và PnL cơ bản.
- Spec DB đã được thiết kế theo hướng có thể mở rộng mà không phải thay đổi API contract `/api/order`.


