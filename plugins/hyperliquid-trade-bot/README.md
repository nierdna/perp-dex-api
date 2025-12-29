# Hyperliquid AI Alert Bot (Multi-Strategy Architecture)

Bot AI tự động theo dõi thị trường Hyperliquid 24/7, sử dụng **DeepSeek AI** để phân tích kỹ thuật và gửi tín hiệu Scalping chất lượng cao qua Telegram.

Hệ thống được thiết kế theo kiến trúc **Multi-Strategy**, cho phép chạy song song nhiều chiến thuật khác nhau trên cùng một danh sách coin.

---

## 🚀 Tính năng nổi bật

*   **Đa Chiến Thuật (Multi-Strategy)**: Chạy đồng thời nhiều logic trading khác nhau (EMA Cross, Trend Follow, Reversal...).
*   **AI Analysis**: Sử dụng DeepSeek LLM để phân tích bối cảnh thị trường (Market Structure) và tin tức (News) trước khi ra quyết định.
*   **Data Realtime**: Dữ liệu nến và giá được lấy trực tiếp từ Hyperliquid API.
*   **Quản lý rủi ro**: Tự động tính toán Entry, Stoploss, Take Profit (Dynamic Risk với ATR).
*   **Backtest System**: Hệ thống backtest mạnh mẽ hỗ trợ News Caching và AI Simulation.
*   **Tracking**: Theo dõi kết quả trade (Win/Loss) real-time qua WebSocket và lưu lịch sử vào Database.

---

## 🧠 Các Chiến Thuật (Strategies)

Hiện tại bot hỗ trợ các strategy sau:

### 1. SCALP_01 (Classic Scalping)
*   **Logic**: Dựa trên sự hội tụ của 3 khung thời gian (15m, 5m, 1m).
*   **Entry**: EMA Cross (9/26) hoặc RSI Reversal tại khung 1m.
*   **Risk**: Stoploss/TP cố định theo % (~0.6% / 0.9%).
*   **Phù hợp**: Thị trường có biến động mạnh, sóng rõ ràng.

### 2. SCALP_02 (Trend Continuation)
*   **Logic**: Đánh thuận xu hướng lớn (Trend Following).
*   **Entry**: Bắt điểm kết thúc của sóng điều chỉnh (Pullback) trong một xu hướng mạnh (15m Trend -> 5m Pullback -> 1m Trigger).
*   **Risk**: Dynamic Risk dựa trên ATR (Volatility).
    *   SL = Entry +/- 1.5 * ATR
    *   TP = Entry +/- 2.5 * ATR
*   **Phù hợp**: Thị trường có xu hướng mạnh (Trending Market).

---

## 🛠 Cài đặt & Cấu hình

### 1. Cài đặt dependency
```bash
npm install
```

### 2. Cấu hình môi trường (.env)
Copy file `.env.example` thành `.env` và điền thông tin:

```bash
# API Key AI
DEEPSEEK_API_KEY=sk-xxxx

# Telegram (để nhận báo kèo)
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx

# Target Coins
SYMBOL=BTC,ETH,SOL,HYPE

# Database (Lưu lịch sử trade)
DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperliquid_bot

# Chạy song song cả 2 chiến thuật
ACTIVE_STRATEGIES=SCALP_01,SCALP_02
```

### 3. Chạy Server
```bash
# Chế độ phát triển (Auto reload)
npm run dev

# Chạy Backtest
npm run backtest
```

---

## 🌐 API & Dashboard

*   **Swagger API**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
*   **Manual Trigger**: Bạn có thể gọi API để ép bot phân tích ngay lập tức cho 1 coin + 1 strategy cụ thể:
    *   `GET /ai-scalp?symbol=ETH&strategy=SCALP_02`

---

## 📂 Cấu trúc dự án (Architecture)

Dự án được tổ chức theo hướng Modular để dễ dàng mở rộng thêm SCALP_03, SCALP_04...

```text
src/
├── strategies/           # Chứa logic từng chiến thuật
│   ├── BaseStrategy.js   # Class cha (Abstract)
│   ├── Scalp01.js        # Logic SCALP_01
│   └── Scalp02.js        # Logic SCALP_02
│   └── index.js          # Registry
├── core/
│   └── strategyExecutor.js # Engine điều phối chung (Data -> Logic -> AI -> Alert)
├── data/                 # Market Data & News Collector
├── ai/                   # DeepSeek Integration
├── risk/                 # Validate Signal & Risk Rules
└── server.js             # API Server
```

---

## ⚠️ Lưu ý rủi ro

*   Đây là công cụ hỗ trợ phân tích, **KHÔNG PHẢI LỜI KHUYÊN TÀI CHÍNH**.
*   Bot không tự động vào lệnh trên sàn (Non-custodial). Bạn cần tự quyết định dựa trên tín hiệu bot gửi.
*   Hãy backtest kỹ trước khi tin dùng bất kỳ chiến thuật nào.

---
**Made with ❤️ by LYNX AI Solution**