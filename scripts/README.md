# 🚀 Lighter API Server Management Scripts

Scripts quản lý Lighter API Server một cách đơn giản và hiệu quả.

---

## 📂 Cấu Trúc

```
scripts/
├── start_lighter.sh            # Khởi động server (foreground)
├── start_lighter_bg.sh         # Khởi động server (background) ⭐ KHUYẾN NGHỊ
├── start_lighter_with_logs.sh  # 🆕 Khởi động server với logs vào file
├── stop_lighter.sh             # Dừng server
├── check_lighter.sh            # Kiểm tra trạng thái
├── view_logs.sh                # 🆕 Xem logs dễ dàng
├── README.md                   # Tài liệu này
└── QUICK_REFERENCE.md          # Tham khảo nhanh
```

---

## 🎯 Hướng Dẫn Sử Dụng

### **Điều kiện tiên quyết:**
- Đã cài đặt Python 3
- Đã cài đặt dependencies: `pip install -r requirements.txt`
- Đã cấu hình file `.env` với API keys

---

## 📖 Chi Tiết Các Lệnh

### 1️⃣ Khởi Động Server (Foreground)

**Chạy server trực tiếp trên terminal, hiển thị logs real-time:**

```bash
sh scripts/start_lighter.sh
```

**Hoặc:**

```bash
./scripts/start_lighter.sh
```

**Ưu điểm:**
- ✅ Thấy logs trực tiếp
- ✅ Dễ debug

**Nhược điểm:**
- ❌ Terminal bị block
- ❌ Đóng terminal = server dừng

**Để dừng:** Nhấn `Ctrl + C`

**Output mẫu:**
```
🔧 Starting Lighter API Server...
================================
📂 Project directory: /Users/levanmong/Desktop/LYNX_AI SOLUSTION/point-dex
🐍 Activating virtual environment...
🚀 Starting Uvicorn server on http://0.0.0.0:8000...
================================

INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

### 2️⃣ Khởi Động Server (Background) ⭐ KHUYẾN NGHỊ

**Chạy server ở nền, terminal vẫn sử dụng được bình thường:**

```bash
sh scripts/start_lighter_bg.sh
```

**Hoặc:**

```bash
./scripts/start_lighter_bg.sh
```

**Ưu điểm:**
- ✅ Terminal không bị block
- ✅ Server chạy liên tục
- ✅ Đóng terminal server vẫn chạy

**Nhược điểm:**
- ❌ Không thấy logs trực tiếp

**Output mẫu:**
```
🔧 Starting Lighter API Server (Background)...
================================
📂 Project directory: /Users/levanmong/Desktop/LYNX_AI SOLUSTION/point-dex
🐍 Activating virtual environment...
🚀 Starting Uvicorn server in background on http://0.0.0.0:8000...
✅ Server started successfully!
📊 Process ID: 12345
🌐 API running at: http://localhost:8000
📋 Check status: curl http://localhost:8000/api/status

To stop server, run: sh scripts/stop_lighter.sh
```

---

### 3️⃣ Kiểm Tra Trạng Thái Server

**Kiểm tra xem server có đang chạy không:**

```bash
sh scripts/check_lighter.sh
```

**Hoặc:**

```bash
./scripts/check_lighter.sh
```

**Output khi server ĐANG CHẠY:**
```
📊 Checking Lighter API Server Status...
================================
✅ Server is running
📋 Process ID: 12345
🌐 Port: 8000

🔍 Testing API endpoint...
✅ API is responding (HTTP 200)

📋 API Status:
{
    "api_status": "online",
    "connection": "connected",
    "keys_mismatch": false,
    "can_trade": true
}
```

**Output khi server KHÔNG CHẠY:**
```
📊 Checking Lighter API Server Status...
================================
❌ Server is NOT running

To start server:
  - Foreground: sh scripts/start_lighter.sh
  - Background: sh scripts/start_lighter_bg.sh
```

---

### 4️⃣ Dừng Server

**Dừng server đang chạy:**

```bash
sh scripts/stop_lighter.sh
```

**Hoặc:**

```bash
./scripts/stop_lighter.sh
```

**Output mẫu:**
```
🛑 Stopping Lighter API Server...
================================
🔍 Found process running on port 8000
📋 Process ID: 12345
✅ Server stopped successfully!
```

---

## 🔄 Workflow Thông Thường

### **Lần đầu khởi động:**
```bash
cd /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex
sh scripts/start_lighter_bg.sh
```

### **Kiểm tra server:**
```bash
sh scripts/check_lighter.sh
```

### **Restart server:**
```bash
sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh
```

**Hoặc viết ngắn gọn:**
```bash
# Từ thư mục gốc project
sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh
```

---

## 📖 Xem Logs

Có **3 cách** để xem logs của Lighter API Server:

### **5️⃣ Chạy Server Với Logs (Khuyến nghị cho debugging) ⭐**

**Khởi động server và ghi logs vào file:**

```bash
sh scripts/start_lighter_with_logs.sh
```

**Output:**
```
🚀 Starting Uvicorn server in background...
📝 Logs will be written to: logs/lighter_20251020_173508.log
✅ Server started successfully!
📊 Process ID: 12345
🌐 API running at: http://localhost:8000
📝 Log file: logs/lighter_20251020_173508.log

📖 To view logs:
   tail -f logs/lighter_20251020_173508.log
```

**Ưu điểm:**
- ✅ Server chạy background (không block terminal)
- ✅ Logs được lưu vào file với timestamp
- ✅ Có thể xem lại logs bất cứ lúc nào
- ✅ Tiện cho debug và troubleshooting

**Logs được lưu tại:**
```
logs/lighter_YYYYMMDD_HHMMSS.log
```

---

### **6️⃣ Xem Logs Với Script**

**Script `view_logs.sh` giúp xem logs dễ dàng:**

```bash
# Xem 50 dòng cuối (mặc định)
sh scripts/view_logs.sh

# Xem 100 dòng cuối
sh scripts/view_logs.sh 100

# Follow logs real-time (giống tail -f)
sh scripts/view_logs.sh follow

# Xem toàn bộ logs
sh scripts/view_logs.sh all
```

**Output mẫu:**
```
📖 Viewing logs from: logs/lighter_20251020_173508.log
================================

📋 Last 50 lines:

INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
✅ Kết nối thành công đến Lighter DEX
INFO:     127.0.0.1:53880 - "GET /api/status HTTP/1.1" 200 OK
INFO:     127.0.0.1:53881 - "POST /api/orders/long HTTP/1.1" 200 OK

ℹ️  To follow logs: sh scripts/view_logs.sh follow
ℹ️  To view all logs: sh scripts/view_logs.sh all
```

**Follow logs real-time:**
```bash
sh scripts/view_logs.sh follow
```
**Nhấn `Ctrl+C` để thoát**

---

### **7️⃣ Xem Logs Trực Tiếp**

**Nếu bạn quen với command line:**

```bash
# Xem log file mới nhất
tail -f logs/lighter_*.log

# Xem 100 dòng cuối
tail -100 logs/lighter_*.log

# Xem toàn bộ logs
cat logs/lighter_*.log

# Tìm kiếm trong logs
grep "error" logs/lighter_*.log
grep "success" logs/lighter_*.log
grep "POST" logs/lighter_*.log

# Đếm số lượng error
grep -c "error" logs/lighter_*.log

# Xem logs có màu (nếu có cài highlight)
tail -f logs/lighter_*.log | grep --color=always -E "error|success|$"
```

---

### **8️⃣ So Sánh Các Cách Xem Logs**

| Phương Pháp | Server Mode | Xem Logs | Use Case |
|-------------|-------------|----------|----------|
| `start_lighter.sh` | Foreground | Real-time trong terminal | Quick debug, development |
| `start_lighter_with_logs.sh` | Background | Lưu vào file | Production, long-term monitoring |
| `view_logs.sh` | - | Xem file logs | Review logs sau này |
| Direct commands | - | Xem file logs | Advanced users |

---

### **9️⃣ Log Rotation & Cleanup**

**Logs có thể chiếm dung lượng theo thời gian. Để dọn dẹp:**

```bash
# Xem dung lượng thư mục logs
du -sh logs/

# Liệt kê tất cả log files
ls -lh logs/

# Xóa logs cũ hơn 7 ngày
find logs/ -name "lighter_*.log" -mtime +7 -delete

# Chỉ giữ 10 file logs mới nhất
ls -t logs/lighter_*.log | tail -n +11 | xargs rm -f

# Xóa tất cả logs (cẩn thận!)
rm -f logs/lighter_*.log
```

---

## 🌐 Truy Cập API

Sau khi server chạy thành công:

### **1. Web UI (Khuyến nghị cho testing)**

Mở file trong browser:
```
perpsdex/lighter/ui_test.html
```

Hoặc dùng VS Code Live Server:
1. Chuột phải vào `ui_test.html`
2. Chọn "Open with Live Server"

### **2. cURL Commands**

```bash
# Kiểm tra status
curl http://localhost:8000/api/status

# Lấy balance
curl http://localhost:8000/api/market/balance

# Lấy positions
curl http://localhost:8000/api/positions

# Lấy giá BTC
curl http://localhost:8000/api/market/BTC/price

# Đặt lệnh LONG
curl -X POST http://localhost:8000/api/orders/long \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "size_usd": 10,
    "leverage": 5,
    "sl_percent": 3,
    "rr_ratio": [1, 2]
  }'
```

### **3. Python**

```python
import requests

# Check status
response = requests.get('http://localhost:8000/api/status')
print(response.json())

# Get balance
balance = requests.get('http://localhost:8000/api/market/balance')
print(balance.json())

# Place LONG order
order = requests.post('http://localhost:8000/api/orders/long', json={
    "symbol": "BTC",
    "size_usd": 10,
    "leverage": 5,
    "sl_percent": 3,
    "rr_ratio": [1, 2]
})
print(order.json())
```

---

## ⚠️ Troubleshooting

### **Lỗi: "command not found: python"**

**Nguyên nhân:** Hệ thống dùng `python3` thay vì `python`

**Giải pháp:** Scripts đã được cập nhật dùng `python3`. Nếu vẫn lỗi:

```bash
# Kiểm tra Python version
python3 --version

# Nếu không có python3, cài đặt:
brew install python3
```

---

### **Lỗi: "Port 8000 already in use"**

**Nguyên nhân:** Server cũ vẫn đang chạy hoặc port bị chiếm bởi ứng dụng khác

**Giải pháp 1 - Dùng script (Khuyến nghị):**
```bash
sh scripts/stop_lighter.sh
sh scripts/start_lighter_bg.sh
```

**Giải pháp 2 - Thủ công:**
```bash
# Tìm process đang dùng port 8000
lsof -i:8000

# Kill process
lsof -ti:8000 | xargs kill -9
```

---

### **Lỗi: "keys_mismatch: true" hoặc "can_trade: false"**

**Nguyên nhân:** API keys trong `.env` không đúng hoặc không khớp với Lighter server

**Giải pháp:**

1. **Kiểm tra file `.env`:**
```bash
cat .env | grep LIGHTER
```

2. **Cập nhật keys:**
```env
LIGHTER_PUBLIC_KEY=your_public_key_here
LIGHTER_PRIVATE_KEY=your_private_key_here
ACCOUNT_INDEX=198336
LIGHTER_API_KEY_INDEX=0
```

3. **Lấy keys mới từ Lighter Dashboard:**
   - Vào https://lighter.xyz
   - Settings → API Keys
   - Tạo hoặc refresh API key

4. **Restart server:**
```bash
sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh
```

5. **Kiểm tra lại:**
```bash
sh scripts/check_lighter.sh
```

---

### **Lỗi: "Virtual environment not found"**

**Nguyên nhân:** Chưa tạo virtual environment

**Giải pháp:**
```bash
cd /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex

# Tạo virtual environment
python3 -m venv venv

# Kích hoạt
source venv/bin/activate

# Cài dependencies
pip install -r requirements.txt

# Chạy server
sh scripts/start_lighter_bg.sh
```

---

### **Lỗi: "Module not found" khi chạy server**

**Nguyên nhân:** Thiếu dependencies

**Giải pháp:**
```bash
cd /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex
source venv/bin/activate
pip install -r requirements.txt
sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh
```

---

## 📊 Logs và Debug

### **Xem logs của Lighter Server:**

**✅ Khuyến nghị: Dùng script có sẵn**

```bash
# 1. Khởi động server với logs
sh scripts/start_lighter_with_logs.sh

# 2. Xem logs
sh scripts/view_logs.sh follow
```

**Chi tiết đầy đủ về logs:** Xem phần [📖 Xem Logs](#-xem-logs) ở trên.

---

### **Debug Lỗi Thông Qua Logs:**

**1. Server không start được:**
```bash
# Chạy foreground để xem lỗi trực tiếp
sh scripts/stop_lighter.sh
sh scripts/start_lighter.sh
```

**2. Server start nhưng API không hoạt động:**
```bash
# Xem logs để tìm lỗi
sh scripts/view_logs.sh 100 | grep -i error
sh scripts/view_logs.sh 100 | grep -i fail
```

**3. Keys mismatch:**
```bash
# Xem logs xem keys nào đang được dùng
sh scripts/view_logs.sh | grep -i "public\|private\|key"
```

**4. Order placement fails:**
```bash
# Xem chi tiết lỗi khi đặt lệnh
sh scripts/view_logs.sh follow
# Sau đó đặt lệnh và xem logs real-time
```

**5. Tìm kiếm log cụ thể:**
```bash
# Tìm tất cả errors
grep "error" logs/lighter_*.log

# Tìm orders
grep "POST.*order" logs/lighter_*.log

# Tìm theo thời gian
grep "2025-10-20" logs/lighter_*.log
```

---

## 🎓 Tips & Best Practices

### **1. Luôn kiểm tra status trước khi start:**
```bash
sh scripts/check_lighter.sh
sh scripts/start_lighter_bg.sh
```

### **2. Sử dụng background mode cho production:**
```bash
sh scripts/start_lighter_bg.sh
```

### **3. Sử dụng logs mode cho monitoring:**
```bash
sh scripts/start_lighter_with_logs.sh
sh scripts/view_logs.sh follow
```

### **4. Sử dụng foreground mode khi debug:**
```bash
sh scripts/start_lighter.sh
```

### **5. Định kỳ xóa logs cũ:**
```bash
# Xóa logs cũ hơn 7 ngày
find logs/ -name "lighter_*.log" -mtime +7 -delete
```

### **6. Tạo alias để gọi nhanh:**

Thêm vào `~/.zshrc` hoặc `~/.bashrc`:

```bash
alias lighter-start='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/start_lighter_bg.sh'
alias lighter-start-logs='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/start_lighter_with_logs.sh'
alias lighter-stop='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/stop_lighter.sh'
alias lighter-check='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/check_lighter.sh'
alias lighter-logs='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/view_logs.sh'
alias lighter-logs-follow='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/view_logs.sh follow'
alias lighter-restart='sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/stop_lighter.sh && sh /Users/levanmong/Desktop/LYNX_AI\ SOLUSTION/point-dex/scripts/start_lighter_bg.sh'
```

Sau đó reload:
```bash
source ~/.zshrc  # hoặc source ~/.bashrc
```

Bây giờ chỉ cần gõ:
```bash
lighter-start         # Khởi động
lighter-start-logs    # Khởi động với logs
lighter-check         # Kiểm tra
lighter-logs          # Xem logs
lighter-logs-follow   # Follow logs
lighter-stop          # Dừng
lighter-restart       # Restart
```

---

## 📝 Lưu Ý Quan Trọng

1. ✅ **Scripts tự động kích hoạt virtual environment** - không cần làm thủ công
2. ✅ **Scripts tự động kill process cũ** - không cần lo port bị chiếm
3. ✅ **Background mode an toàn** - server vẫn chạy khi đóng terminal
4. ⚠️ **Logs bị ẩn ở background mode** - dùng foreground nếu cần debug
5. ⚠️ **Luôn dừng server trước khi update code** - tránh conflict

---

## 🎉 Kết Luận

Với 4 scripts đơn giản, bạn có thể:
- ✅ Khởi động server chỉ với 1 lệnh
- ✅ Kiểm tra trạng thái dễ dàng
- ✅ Dừng server an toàn
- ✅ Không cần nhớ các lệnh phức tạp

**Happy Trading! 🚀📈**

