# 📖 Hướng Dẫn Sử Dụng - Hyperliquid Paper Trader

## 🎯 Tổng Quan

**Hyperliquid Paper Trader** là hệ thống giao dịch giả lập (paper trading) cho phép bạn test chiến lược giao dịch mà không rủi ro vốn thật. Hệ thống kết nối WebSocket realtime với Hyperliquid và mô phỏng việc đặt lệnh, quản lý vốn, và tính PnL.

---

## 🚀 Bắt Đầu

### 1. Khởi Tạo Strategy Wallet

Mỗi Strategy là một ví giao dịch độc lập với vốn riêng.

**Cách làm:**
1. Vào tab **🏠 Home**
2. Nhấn nút **"+ Init Strategy"**
3. Nhập:
   - **Strategy ID**: Tên duy nhất (VD: `SCALP_01`, `SWING_BTC`)
   - **Initial Capital**: Vốn ban đầu (VD: `1000`)
4. Nhấn **Create**

✅ Strategy đã sẵn sàng để giao dịch!

---

## 💰 Quản Lý Vốn & Risk

### Risk Management (Quản Lý Rủi Ro)

Bảo vệ vốn là ưu tiên số 1! Hệ thống có 3 công cụ quản lý rủi ro:

#### 🛡️ Thiết Lập Risk Settings

**Cách vào:**
1. Click vào Strategy để xem chi tiết
2. Nhấn nút **"🛡️ Risk Settings"**
3. Cài đặt các giới hạn:

---

### 1️⃣ **Max Daily Loss Limit (%)** 
**Mục đích:** Giới hạn tổng lỗ tối đa trong 1 ngày

**Ví dụ:**
- Current Balance: $1000
- Max Daily Loss: **5%** → Limit = $50
- Nếu tổng lỗ trong ngày (Realized + Unrealized) **> $50**:
  - ❌ Tự động đóng hết lệnh
  - 🔒 Khóa trading đến hết ngày (UTC)

**Lưu ý:** 
- Tính từ **Current Balance** (vốn hiện tại), không phải vốn ban đầu
- Kiểm tra mỗi 5 giây (throttled)
- Set **0** để tắt

---

### 2️⃣ **Max Position Size (%)**
**Mục đích:** Giới hạn kích thước tối đa cho 1 lệnh đơn

**Ví dụ:**
- Current Balance: $500
- Max Position Size: **10%** → Max = $50/lệnh
- Nếu cố đặt lệnh $60 → ❌ Bị chặn

**Tại sao cần:**
- Tránh all-in 1 lệnh
- Phân tán rủi ro
- Bảo vệ vốn khi bị drawdown

---

### 3️⃣ **Max Open Positions**
**Mục đích:** Giới hạn số lượng lệnh được mở cùng lúc

**Ví dụ:**
- Max Open Positions: **3**
- Đang có 3 lệnh mở → Không thể mở lệnh thứ 4
- Phải đóng 1 lệnh cũ thì mới mở được lệnh mới

**Tại sao cần:**
- Dễ quản lý, theo dõi từng lệnh kỹ
- Không bị quá tải
- Tập trung vào chất lượng thay vì số lượng

---

## 📊 Đặt Lệnh

### Quick Trade

**Cách đặt lệnh:**
1. Vào chi tiết Strategy
2. Nhấn **"⚡ Quick Trade"**
3. Nhập thông tin:
   - **Symbol**: Coin (VD: `BTC`, `ETH`)
   - **Side**: `LONG` hoặc `SHORT`
   - **Size**: Khối lượng USD (VD: `100`)
   - **Stop Loss (SL)**: Giá cắt lỗ (optional)
   - **Take Profit (TP)**: Giá chốt lời (optional)
4. Nhấn **Place Order**

**Hệ thống sẽ kiểm tra:**
- ✅ Đủ vốn khả dụng?
- ✅ Không vượt Max Position Size?
- ✅ Không vượt Max Open Positions?
- ✅ Không bị khóa do Daily Loss Limit?

---

## 🔄 Quản Lý Lệnh

### Active Positions (Lệnh Đang Mở)

Hiển thị tất cả lệnh đang mở của Strategy hiện tại.

**Thao tác:**
- **📝 Edit TP/SL**: Click biểu tượng bút chì → Cập nhật giá TP/SL
- **❌ Close**: Đóng lệnh thủ công ngay lập tức
- **❌ Close All**: Đóng tất cả lệnh của Strategy

---

### Trade History (Lịch Sử Giao Dịch)

Hiển thị lịch sử các lệnh đã đóng.

**Thông tin hiển thị:**
- **Result**: WIN (lời) / LOSS (lỗ)
- **Symbol**, **Side**, **Size**
- **Entry**: Giá vào
- **Exit**: Giá ra
- **PnL**: Lời/Lỗ
- **Reason**: Lý do đóng (TP, SL, MANUAL, KILL_SWITCH...)

**Phân trang:**
- Mặc định: 10 lệnh/trang
- Dùng nút **← Previous** / **Next →** để xem thêm

---

## 📈 Thống Kê Strategy

### Dashboard Home

Xem tổng quan tất cả Strategy:
- **Current Balance**: Vốn hiện tại
- **PnL**: Lời/Lỗ tổng
- **ROI**: % lợi nhuận

### Chi Tiết Strategy

- **Current Balance**: Vốn hiện tại
- **PnL**: Tổng lời/lỗ
- **Daily Loss Limit**: Giới hạn lỗ ngày (nếu có set)
- **Active Positions**: Số lệnh đang mở
- **Trade History**: Lịch sử giao dịch

---

## 🤖 Auto Trading Logic

### Netting Mode (One-Way)

Hệ thống sử dụng **Netting Mode** - Mỗi symbol chỉ có 1 position:

**Kịch bản:**

1. **Cùng chiều** (Pyramiding):
   - Đang LONG BTC 100$ → Đặt thêm LONG 50$ → Tổng LONG 150$

2. **Ngược chiều - Giảm** (Reduce):
   - Đang LONG BTC 100$ → Đặt SHORT 30$ → Còn LONG 70$

3. **Ngược chiều - Đóng** (Close):
   - Đang LONG BTC 100$ → Đặt SHORT 100$ → Đóng hết, tính PnL

4. **Ngược chiều - Flip**:
   - Đang LONG BTC 100$ → Đặt SHORT 150$ → Đóng LONG, mở SHORT 50$

---

## ⚡ Kill Switch (Circuit Breaker)

### Khi Nào Kích Hoạt?

Khi **Total Daily PnL < -Max Daily Loss Limit**

**Total Daily PnL = Realized PnL (đã đóng hôm nay) + Unrealized PnL (đang mở)**

### Điều Gì Xảy Ra?

1. 🚨 Log: `KILL SWITCH ACTIVATED for [Strategy]`
2. ❌ Đóng hết tất cả lệnh đang mở
3. 🔒 Chặn đặt lệnh mới đến hết ngày (UTC)

### Reset Khi Nào?

- Tự động reset lúc **00:00 UTC** ngày hôm sau
- Hoặc restart server

---

## 🔧 API Docs

### Swagger UI

Truy cập API documentation đầy đủ tại:

**URL:** `http://localhost:3000/api-docs`

**Endpoints chính:**
- `POST /api/strategies` - Tạo strategy
- `POST /api/order` - Đặt lệnh
- `POST /api/strategies/risk` - Cập nhật risk settings
- `GET /api/strategies/{id}` - Xem chi tiết strategy
- `POST /api/position/close` - Đóng lệnh
- `POST /api/position/update` - Update TP/SL

---

## 💡 Tips & Best Practices

### 1. **Luôn Set Risk Limits**
- Đừng trade không có stop loss!
- Recommend: Max Daily Loss = 3-5%

### 2. **Không Over-Leverage**
- Max Position Size = 5-10% cho newbie
- Max Open Positions = 2-3 để dễ theo dõi

### 3. **Backtest Trước Khi Live**
- Test chiến lược ít nhất 1-2 tuần
- Phân tích Win Rate, Risk/Reward

### 4. **Theo Dõi Thường Xuyên**
- Check PnL hàng ngày
- Xem lại Trade History để rút kinh nghiệm

---

## 🆘 Troubleshooting

### ❌ Lỗi "Trading Locked"
**Nguyên nhân:** Daily Loss Limit đã hit
**Giải pháp:** Chờ đến ngày mai (UTC) hoặc restart server

### ❌ Lỗi "Insufficient balance"
**Nguyên nhân:** Không đủ vốn khả dụng
**Giải pháp:** Đóng bớt lệnh cũ hoặc giảm size lệnh mới

### ❌ Lỗi "Position size exceeds max allowed"
**Nguyên nhân:** Vượt Max Position Size
**Giải pháp:** Giảm size hoặc tăng % trong Risk Settings

### ❌ Lỗi "Max open positions reached"
**Nguyên nhân:** Đã đủ số lệnh tối đa
**Giải pháp:** Đóng 1 lệnh cũ trước khi mở lệnh mới

---

## 📞 Liên Hệ & Hỗ Trợ

**GitHub:** [Hyperliquid Paper Trader](https://github.com/your-repo)
**Version:** 1.0.0
**Last Updated:** 2025-12-31

---

**🎉 Chúc bạn trade thành công! 🚀**
