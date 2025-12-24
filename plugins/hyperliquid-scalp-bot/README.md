# Hyperliquid AI Alert Bot (Node.js MVP)

## 🌐 API & Swagger
Bot có sẵn API server để bạn trigger thủ công:
- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Manual Trigger**: `POST http://localhost:3000/run-scalp`
- **Port**: Mặc định 3000 (Chỉnh trong file server.js nếu cần)

## 🎯 Mục tiêu
Bot tự động theo dõi thị trường ETH/USD trên Hyperliquid 24/7. Nó sử dụng **DeepSeek AI** để phân tích các chỉ báo kỹ thuật và gửi **tín hiệu (Alert)** qua Telegram khi thấy cơ hội tốt.
**Bot KHÔNG tự động vào lệnh**, chỉ báo kèo để bạn quyết định.

---

## 🔄 Flow hoạt động (Cách bot chạy)

Bot chạy một vòng lặp vô tận, cứ **mỗi 60 giây** sẽ thực hiện các bước sau:

1.  **🔍 Thu thập dữ liệu (Market Collector)**
    *   Gọi API Hyperliquid lấy nến (Candles) 15m mới nhất.
    *   Lấy giá hiện tại (Mark Price) và Funding Rate.

2.  **🧮 Tính toán Indicator**
    *   Từ nến nhận được, tính toán các chỉ số:
        *   **RSI (14)**: Xác định quá mua/quá bán.
        *   **EMA Trend**: So sánh EMA 50 và EMA 200 để xác định xu hướng (Bullish/Bearish).
        *   **ATR**: Đo lường độ biến động thị trường.

3.  **🧠 AI Phân tích (DeepSeek Brain)**
    *   Gửi toàn bộ data trên cho DeepSeek AI.
    *   AI đóng vai một Trader chuyên nghiệp, phân tích và trả về kết quả:
        *   `Action`: LONG / SHORT / NO_TRADE
        *   `Confidence`: Độ tự tin (0.0 - 1.0)
        *   `Plan`: Entry, Stoploss, Take Profit.

4.  **📢 Thông báo (Alert)**
    *   Lọc tín hiệu: Chỉ các tín hiệu có **Confidence >= 0.7** (70%) mới được duyệt.
    *   Nếu đạt chuẩn -> Gửi tin nhắn về Telegram của bạn ngay lập tức.
    *   Nếu không -> Im lặng, đợi 60s sau quét tiếp.

---

## 🖥️ Bạn cần làm gì?

**Việc của bạn là:**
1.  Bật bot lên (`npm run dev`) và treo máy (hoặc chạy trên VPS).
2.  Đi làm việc khác.
3.  Khi điện thoại ting ting tin nhắn Telegram -> Mở app lên xem kèo -> Tự vào lệnh tay trên sàn.

**Console Log giải thích:**
- `🚀 Scalp bot started`: Bot bắt đầu chạy.
- `📢 Processing alert: LONG`: AI tìm thấy kèo Long ngon.
- `✅ Telegram alert sent`: Đã gửi tin nhắn cho bạn thành công.
- (Nếu không thấy gì thêm tức là thị trường đang xấu, AI chọn NO_TRADE, bot đang âm thầm chạy).

---

## ✅ Tính năng kỹ thuật
- **Real-time Data**: Lấy dữ liệu thật từ Hyperliquid (không fake).
- **Real Indicators**: Dùng thư viện `technicalindicators` chuẩn.
- **AI Logic**: Prompt chuyên sâu cho DeepSeek để tìm điểm vào lệnh theo Market Structure.
- **Rate Limit**: Tần suất 1 phút/lần để tránh spam API.

## 🚀 Cách cài đặt & Chạy
1. **Cài đặt**:
   ```bash
   npm install
   ```
2. **Cấu hình**:
   Tạo file `.env` và điền các biến sau:
   - `DEEPSEEK_API_KEY`: Key AI.
   - `TELEGRAM_BOT_TOKEN`: Token bot Tele.
   - `TELEGRAM_CHAT_ID`: ID chat của bạn.
   - `SYMBOL`: Token cần theo dõi (Ví dụ: BTC, ETH, SOL - mặc định ETH).
   - `TIMEFRAME`: Khung thời gian (Ví dụ: 15m, 1h, 4h - mặc định 15m).
   - `DATABASE_URL`: Connection string PostgreSQL (Format: `postgresql://username:password@host:port/database`)
     - Ví dụ: `DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperliquid_bot`
     - Với SSL: `DATABASE_URL=postgresql://postgres:password@host:5432/db?sslmode=require`
     - Hoặc dùng các biến riêng lẻ: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
3. **Chạy**:
   ```bash
   npm run dev
   ```

## ⚠️ Lưu ý
- Đây là công cụ hỗ trợ, **không phải lời khuyên tài chính**.
- Luôn kiểm tra lại chart trước khi vào lệnh theo AI.