# 📊 Backtest Tool - Hướng Dẫn Sử Dụng

## 🎯 Mục đích

Tool backtest giúp bạn kiểm tra hiệu suất của chiến lược trading trên dữ liệu lịch sử, giống như bot thật đang chạy.

## ✨ Tính năng

### 1. **News Caching Thông Minh**
- ✅ Chỉ gọi API tin tức **1 lần cho mỗi ngày** duy nhất
- ✅ Giảm từ ~50 API calls xuống còn **3-15 calls** (tùy số ngày backtest)
- ✅ Tăng tốc độ backtest đáng kể
- ✅ Tránh bị rate limit

### 2. **Hai Chế Độ Backtest**

#### Mode 1: Technical Filters Only (Mặc định)
```bash
npm run backtest
```
- Chỉ test logic technical filters (EMA cross, RSI, Volume)
- Nhanh, không tốn API AI
- Phù hợp để test chiến lược cơ bản

#### Mode 2: Full AI Analysis (Giống Bot Thật 100%)
```bash
BACKTEST_USE_AI=true npm run backtest
```
- Test với AI decision thật
- Giống hệt bot production
- Tốn API AI (DeepSeek)
- Hiển thị số signal bị AI filter out

### 3. **Thống Kê Chi Tiết**
- 💰 Win/Loss ratio
- 📈 Total PnL (% và $)
- 📊 Average PnL per trade
- 🏆 Max Win/Loss
- 🤖 AI filtered signals (nếu bật AI mode)

## 🚀 Cách Sử Dụng

### 1. Backtest Cơ Bản (Technical Only)
```bash
npm run backtest
```

**Output mẫu:**
```
📰 Pre-caching news data...
✅ Cached news for 4 unique dates (4 API calls)
🤖 AI Mode: DISABLED (Technical Filters Only)

🔍 Total Signals Found: 51
✅ WIN: 25
❌ LOSS: 26
💰 Winrate: 49.02%
📈 Total PnL: $4.38 (+4.38%)
```

### 2. Backtest với AI (Giống Bot Thật)
```bash
BACKTEST_USE_AI=true npm run backtest
```

**Output mẫu:**
```
📰 Pre-caching news data...
✅ Cached news for 4 unique dates (4 API calls)
🤖 AI Mode: ENABLED (Real AI Analysis)

🔍 Total Signals Found: 35
🤖 AI Filtered Out: 16 signals
✅ WIN: 22
❌ LOSS: 13
💰 Winrate: 62.86%
📈 Total PnL: $7.25 (+7.25%)
```

### 3. Tùy Chỉnh Tham Số

Sửa trong file `src/tools/backtest.js`:

```javascript
// BACKTEST PARAMS
const TAKE_PROFIT = 0.006 // 0.6% (mặc định)
const STOP_LOSS = 0.004   // 0.4% (mặc định)
const MAX_HOLD_CANDLES = 60 // 60 phút (mặc định)

// CAPITAL MANAGEMENT
const INITIAL_CAPITAL = 100 // $100 (mặc định)
const POSITION_SIZE = 200   // $200 - 2x leverage (mặc định)

// AI CONFIG
const MIN_AI_CONFIDENCE = 75 // 75% (mặc định)
```

## 📊 Hiểu Kết Quả

### Bảng Chi Tiết Trades
```
┌─────────┬───────────────────────────┬─────────┬───────┬────────────┬────────┬──────────┬───────────┐
│ (index) │ time                      │ type    │ entry │ exit       │ result │ pnl      │ balance   │
├─────────┼───────────────────────────┼─────────┼───────┼────────────┼────────┼──────────┼───────────┤
│ 0       │ '12/20/2025, 12:35:00 PM' │ 'SHORT' │ 88434 │ '88278.00' │ 'WIN'  │ '$0.35'  │ '$100.35' │
```

- **time**: Thời điểm vào lệnh
- **type**: LONG hoặc SHORT
- **entry**: Giá vào lệnh
- **exit**: Giá thoát lệnh
- **result**: WIN/LOSS
- **pnl**: Lãi/lỗ của lệnh này ($)
- **balance**: Số dư sau lệnh này

### Thống Kê Tổng Quan
```
🔍 Total Signals Found: 51      → Tổng số lệnh đã vào
✅ WIN: 25                       → Số lệnh thắng
❌ LOSS: 26                      → Số lệnh thua
💰 Winrate: 49.02%              → Tỷ lệ thắng
📈 Total PnL: $4.38 (+4.38%)    → Tổng lãi/lỗ
📊 Avg PnL per trade: $0.09     → Lãi/lỗ trung bình mỗi lệnh
📈 Max Win: $1.20               → Lệnh thắng lớn nhất
📉 Max Loss: $-0.90             → Lệnh thua lớn nhất
```

## 🎯 So Sánh 2 Chế Độ

| Tiêu chí | Technical Only | Full AI |
|----------|----------------|---------|
| **Tốc độ** | ⚡ Rất nhanh | 🐢 Chậm hơn (do AI) |
| **Chi phí** | 💰 Miễn phí | 💸 Tốn API AI |
| **Độ chính xác** | ✅ Tốt | ✅✅ Rất tốt (giống bot thật) |
| **Số signal** | 📊 Nhiều hơn | 📊 Ít hơn (AI filter) |
| **Winrate** | 📈 ~45-50% | 📈 ~60-70% |
| **Mục đích** | Test chiến lược cơ bản | Test bot production |

## 💡 Tips & Best Practices

### 1. Khi nào dùng Technical Only?
- ✅ Test nhanh chiến lược mới
- ✅ Tối ưu TP/SL
- ✅ Kiểm tra logic filter
- ✅ Không muốn tốn API AI

### 2. Khi nào dùng Full AI?
- ✅ Test trước khi deploy production
- ✅ Đánh giá hiệu suất thực tế
- ✅ So sánh với kết quả live
- ✅ Tìm bug trong AI logic

### 3. Tối Ưu News Caching
```javascript
// Backtest 15 ngày = ~4 API calls
// Backtest 30 ngày = ~8 API calls
// Backtest 90 ngày = ~20 API calls
```
→ Tiết kiệm **90% API calls** so với không cache!

## 🔧 Troubleshooting

### Lỗi: "Missing DEEPSEEK_API_KEY"
```bash
# Kiểm tra .env
cat .env | grep DEEPSEEK_API_KEY

# Nếu thiếu, thêm vào:
echo "DEEPSEEK_API_KEY=your_key_here" >> .env
```

### Backtest chạy quá chậm
```bash
# Giảm số ngày backtest
# Sửa trong backtest.js:
const days = 7 // Thay vì 15
```

### Winrate quá thấp
```bash
# Thử tăng MIN_AI_CONFIDENCE
const MIN_AI_CONFIDENCE = 80 // Thay vì 75

# Hoặc điều chỉnh TP/SL
const TAKE_PROFIT = 0.008 // 0.8% thay vì 0.6%
const STOP_LOSS = 0.003   // 0.3% thay vì 0.4%
```

## 📈 Kết Quả Mẫu (15 Days)

### Technical Only
```
Signals: 51
Winrate: 49.02%
PnL: +4.38%
```

### Full AI
```
Signals: 35 (AI filtered: 16)
Winrate: 62.86%
PnL: +7.25%
```

→ AI giúp **tăng winrate 13.84%** và **tăng PnL 65%**!

## 🚀 Next Steps

1. **Chạy backtest Technical Only** để test nhanh
2. **Tối ưu TP/SL** dựa trên kết quả
3. **Chạy Full AI** để xác nhận
4. **So sánh với live bot** để validate
5. **Deploy production** khi hài lòng!

---

**Made with ❤️ by LYNX AI**
