# 📖 Hướng Dẫn Chi Tiết Về Logs - Lighter API Server

## 🎯 Tổng Quan

Có **3 cách chính** để xem logs của Lighter API Server:

1. **Foreground Mode** - Xem logs trực tiếp trong terminal
2. **Background với Logs File** - Server chạy background, logs ghi vào file ⭐ **KHUYẾN NGHỊ**
3. **Background không logs** - Server chạy background, không logs (phù hợp production)

---

## 📊 Cách 1: Foreground Mode (Real-time Logs)

### **Khi nào dùng:**
- ✅ Development và debugging
- ✅ Cần xem logs ngay lập tức
- ✅ Test nhanh một tính năng

### **Cách sử dụng:**

```bash
# Dừng server cũ
sh scripts/stop_lighter.sh

# Chạy foreground
sh scripts/start_lighter.sh
```

### **Output:**
```
🚀 Starting Uvicorn server on http://0.0.0.0:8000...
================================

INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
DEBUG:root:Detected ARM architecture on macOS.
✅ Kết nối thành công đến Lighter DEX
INFO:     Application startup complete.
INFO:     127.0.0.1:53880 - "GET /api/status HTTP/1.1" 200 OK
```

### **Ưu điểm:**
- ✅ Xem logs real-time
- ✅ Màu sắc rõ ràng
- ✅ Debug dễ dàng

### **Nhược điểm:**
- ❌ Terminal bị block
- ❌ Đóng terminal = server dừng
- ❌ Không lưu logs

### **Dừng server:**
Nhấn `Ctrl + C`

---

## 📁 Cách 2: Background Với Logs File ⭐ KHUYẾN NGHỊ

### **Khi nào dùng:**
- ✅ Production environment
- ✅ Long-term monitoring
- ✅ Cần review logs sau này
- ✅ Debug issues đã xảy ra trước đó

### **Cách sử dụng:**

**Bước 1: Khởi động server với logs**

```bash
sh scripts/start_lighter_with_logs.sh
```

**Output:**
```
🔧 Starting Lighter API Server (with logs)...
================================
📂 Project directory: /Users/levanmong/Desktop/LYNX_AI SOLUSTION/point-dex
🐍 Activating virtual environment...
🚀 Starting Uvicorn server in background...
📝 Logs will be written to: logs/lighter_20251020_173508.log
✅ Server started successfully!
📊 Process ID: 12345
🌐 API running at: http://localhost:8000
📝 Log file: logs/lighter_20251020_173508.log

📖 To view logs:
   tail -f logs/lighter_20251020_173508.log

To stop server, run: sh scripts/stop_lighter.sh
```

**Bước 2: Xem logs**

```bash
# Xem 50 dòng cuối (mặc định)
sh scripts/view_logs.sh

# Xem 100 dòng cuối
sh scripts/view_logs.sh 100

# Follow logs real-time
sh scripts/view_logs.sh follow

# Xem tất cả logs
sh scripts/view_logs.sh all
```

### **Ưu điểm:**
- ✅ Server chạy background
- ✅ Logs được lưu vào file
- ✅ Có thể review logs bất cứ lúc nào
- ✅ Terminal không bị block
- ✅ Tốt cho production

### **Nhược điểm:**
- ❌ Logs không hiển thị màu
- ❌ Cần thêm 1 bước để xem logs

### **Vị trí logs:**
```
logs/lighter_YYYYMMDD_HHMMSS.log
```

Ví dụ:
```
logs/lighter_20251020_173508.log
logs/lighter_20251020_180215.log
logs/lighter_20251021_093045.log
```

---

## 🔍 Cách 3: Xem Logs Với Script `view_logs.sh`

### **Syntax:**
```bash
sh scripts/view_logs.sh [option]
```

### **Options:**

| Option | Mô Tả | Ví Dụ |
|--------|-------|-------|
| (empty) | Xem 50 dòng cuối | `sh scripts/view_logs.sh` |
| `N` | Xem N dòng cuối | `sh scripts/view_logs.sh 100` |
| `follow` hoặc `f` | Follow logs real-time | `sh scripts/view_logs.sh follow` |
| `all` | Xem tất cả logs | `sh scripts/view_logs.sh all` |

### **Examples:**

**1. Xem logs mặc định (50 dòng cuối):**
```bash
sh scripts/view_logs.sh
```

**Output:**
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
ℹ️  To view N lines: sh scripts/view_logs.sh N
```

**2. Follow logs real-time:**
```bash
sh scripts/view_logs.sh follow
```

**Output:**
```
📖 Viewing logs from: logs/lighter_20251020_173508.log
================================
📡 Following logs (Ctrl+C to stop)...

INFO:     127.0.0.1:53882 - "GET /api/market/balance HTTP/1.1" 200 OK
INFO:     127.0.0.1:53883 - "GET /api/positions HTTP/1.1" 200 OK
INFO:     127.0.0.1:53884 - "POST /api/orders/long HTTP/1.1" 200 OK
^C
```

**Nhấn `Ctrl+C` để thoát**

**3. Xem 200 dòng cuối:**
```bash
sh scripts/view_logs.sh 200
```

**4. Xem tất cả logs:**
```bash
sh scripts/view_logs.sh all
```

---

## 🛠️ Lệnh Command Line Trực Tiếp

Nếu bạn quen với command line, có thể dùng trực tiếp:

### **Xem logs:**

```bash
# Xem log file mới nhất (50 dòng cuối)
tail -50 logs/lighter_*.log

# Xem log file mới nhất (100 dòng cuối)
tail -100 logs/lighter_*.log

# Follow logs real-time
tail -f logs/lighter_*.log

# Xem toàn bộ logs
cat logs/lighter_*.log

# Xem log file cụ thể
tail -f logs/lighter_20251020_173508.log
```

### **Tìm kiếm trong logs:**

```bash
# Tìm tất cả errors
grep "error" logs/lighter_*.log

# Tìm errors (không phân biệt hoa thường)
grep -i "error" logs/lighter_*.log

# Tìm success messages
grep "success" logs/lighter_*.log

# Tìm POST requests
grep "POST" logs/lighter_*.log

# Tìm order placement
grep "POST.*order" logs/lighter_*.log

# Tìm theo ngày
grep "2025-10-20" logs/lighter_*.log

# Tìm và hiển thị số dòng
grep -n "error" logs/lighter_*.log
```

### **Đếm số lượng:**

```bash
# Đếm số lượng errors
grep -c "error" logs/lighter_*.log

# Đếm số lượng requests
grep -c "HTTP" logs/lighter_*.log

# Đếm số lượng POST requests
grep -c "POST" logs/lighter_*.log
```

### **Filter và format:**

```bash
# Chỉ xem INFO logs
grep "INFO:" logs/lighter_*.log

# Chỉ xem ERROR logs
grep "ERROR:" logs/lighter_*.log

# Xem logs với màu
tail -f logs/lighter_*.log | grep --color=always -E "error|success|$"

# Xem logs và highlight keywords
tail -f logs/lighter_*.log | grep --color=always -E "error|success|POST|GET|$"
```

### **Kết hợp nhiều lệnh:**

```bash
# Tìm errors và hiển thị 5 dòng context xung quanh
grep -C 5 "error" logs/lighter_*.log

# Tìm errors trong 100 dòng cuối
tail -100 logs/lighter_*.log | grep "error"

# Đếm số lượng requests theo endpoint
grep "POST" logs/lighter_*.log | cut -d'"' -f2 | sort | uniq -c

# Top 10 endpoints được gọi nhiều nhất
grep "HTTP" logs/lighter_*.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -10
```

---

## 🗂️ Quản Lý Log Files

### **Xem thông tin logs:**

```bash
# Liệt kê tất cả log files
ls -lh logs/

# Xem dung lượng thư mục logs
du -sh logs/

# Xem log file mới nhất
ls -t logs/lighter_*.log | head -1

# Đếm số lượng log files
ls logs/lighter_*.log | wc -l
```

### **Dọn dẹp logs:**

```bash
# Xóa logs cũ hơn 7 ngày
find logs/ -name "lighter_*.log" -mtime +7 -delete

# Xóa logs cũ hơn 30 ngày
find logs/ -name "lighter_*.log" -mtime +30 -delete

# Chỉ giữ 10 file logs mới nhất
ls -t logs/lighter_*.log | tail -n +11 | xargs rm -f

# Chỉ giữ 5 file logs mới nhất
ls -t logs/lighter_*.log | tail -n +6 | xargs rm -f

# Xóa tất cả logs (CẨN THẬN!)
rm -f logs/lighter_*.log
```

### **Backup logs:**

```bash
# Backup logs vào thư mục khác
cp -r logs/ logs_backup_$(date +%Y%m%d)/

# Nén logs cũ
tar -czf logs_archive_$(date +%Y%m%d).tar.gz logs/

# Backup và xóa logs cũ
tar -czf logs_archive_$(date +%Y%m%d).tar.gz logs/*.log && rm -f logs/*.log
```

---

## 🎯 Use Cases Thực Tế

### **1. Debug server không start:**

```bash
# Chạy foreground để xem lỗi
sh scripts/stop_lighter.sh
sh scripts/start_lighter.sh
```

### **2. Xem lỗi khi đặt lệnh:**

```bash
# Terminal 1: Follow logs
sh scripts/view_logs.sh follow

# Terminal 2: Đặt lệnh
curl -X POST http://localhost:8000/api/orders/long \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTC","size_usd":10,...}'
```

### **3. Kiểm tra keys mismatch:**

```bash
# Xem logs khởi động
sh scripts/view_logs.sh 20 | grep -i "key"
```

### **4. Monitor production:**

```bash
# Khởi động với logs
sh scripts/start_lighter_with_logs.sh

# Follow logs real-time
sh scripts/view_logs.sh follow
```

### **5. Review lỗi đã xảy ra:**

```bash
# Tìm tất cả errors trong logs
grep -i "error" logs/lighter_*.log

# Xem context xung quanh error
grep -C 10 "error" logs/lighter_*.log
```

### **6. Phân tích performance:**

```bash
# Đếm số requests
grep -c "HTTP" logs/lighter_*.log

# Xem response time (nếu có log)
grep "HTTP" logs/lighter_*.log | grep -oP '\d+ms'

# Top endpoints
grep "HTTP" logs/lighter_*.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

---

## 📋 Checklist Hàng Ngày

### **Morning:**
```bash
# 1. Check server status
sh scripts/check_lighter.sh

# 2. Review errors từ đêm qua
grep "$(date -d yesterday +%Y-%m-%d)" logs/lighter_*.log | grep -i error

# 3. Check disk space
du -sh logs/
```

### **Evening:**
```bash
# 1. Backup logs
tar -czf logs_backup_$(date +%Y%m%d).tar.gz logs/

# 2. Clean old logs
find logs/ -name "lighter_*.log" -mtime +7 -delete

# 3. Check server still running
sh scripts/check_lighter.sh
```

---

## 💡 Pro Tips

### **1. Tạo alias cho logs:**

Thêm vào `~/.zshrc`:
```bash
alias lighter-logs='sh /path/to/scripts/view_logs.sh'
alias lighter-logs-follow='sh /path/to/scripts/view_logs.sh follow'
alias lighter-logs-error='grep -i error /path/to/logs/lighter_*.log'
alias lighter-logs-clean='find /path/to/logs/ -name "lighter_*.log" -mtime +7 -delete'
```

### **2. Watch logs trong tmux/screen:**

```bash
# Tạo session mới
tmux new -s lighter-logs

# Follow logs
sh scripts/view_logs.sh follow

# Detach: Ctrl+B, D
# Attach lại: tmux attach -t lighter-logs
```

### **3. Notification khi có error:**

```bash
# Monitor logs và alert khi có error
tail -f logs/lighter_*.log | grep --line-buffered -i error | while read line; do
    echo "🚨 ERROR DETECTED: $line"
    # Có thể gửi notification, telegram, email...
done
```

---

## ❓ FAQ

**Q: Logs bị mất sau khi restart server?**  
A: Không, mỗi lần start tạo file log mới với timestamp. Logs cũ vẫn giữ nguyên.

**Q: Logs chiếm bao nhiêu dung lượng?**  
A: Tùy traffic, thường 1-10MB/ngày. Check bằng `du -sh logs/`

**Q: Làm sao để logs có màu?**  
A: Dùng foreground mode hoặc pipe qua grep với `--color=always`

**Q: Có thể gửi logs qua email không?**  
A: Có, dùng `mail` command hoặc script Python

**Q: Log format có thể customize không?**  
A: Có, edit uvicorn logging config trong code

---

**Happy Logging! 📖✨**

