# 📚 Scripts Documentation Index

Chào mừng đến với thư mục scripts quản lý Lighter API Server!

---

## 🚀 Quick Start

**Khởi động server ngay:**
```bash
sh scripts/start_lighter_bg.sh
```

**Kiểm tra status:**
```bash
sh scripts/check_lighter.sh
```

---

## 📂 Danh Sách Scripts

| Script | Mô Tả | Use Case |
|--------|-------|----------|
| `start_lighter.sh` | Khởi động server (foreground) | Development, Debug |
| `start_lighter_bg.sh` | Khởi động server (background) | Production |
| `start_lighter_with_logs.sh` | Khởi động server với logs | Monitoring, Debug |
| `stop_lighter.sh` | Dừng server | Maintenance |
| `check_lighter.sh` | Kiểm tra status | Health check |
| `view_logs.sh` | Xem logs | Troubleshooting |

---

## 📖 Tài Liệu

### **1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md)** ⚡
**Tham khảo nhanh - 1 trang**
- Lệnh thường dùng
- Status indicators
- Quick troubleshooting

**Dành cho:** Ai cần reference nhanh

---

### **2. [README.md](README.md)** 📘
**Hướng dẫn đầy đủ - 15K+ words**
- Chi tiết từng script
- Troubleshooting đầy đủ
- Tips & best practices
- Alias setup
- Production deployment

**Dành cho:** Đọc kỹ lần đầu, reference chi tiết

---

### **3. [LOGS_GUIDE.md](LOGS_GUIDE.md)** 📖
**Hướng dẫn chuyên sâu về Logs**
- 3 cách xem logs
- Script `view_logs.sh` chi tiết
- Command line trực tiếp
- Log management
- Backup & cleanup
- Use cases thực tế
- Pro tips

**Dành cho:** Debugging, monitoring, troubleshooting

---

## 🎯 Workflow Gợi Ý

### **Lần Đầu Setup:**
```bash
# 1. Đọc README
cat scripts/README.md

# 2. Khởi động server với logs
sh scripts/start_lighter_with_logs.sh

# 3. Kiểm tra
sh scripts/check_lighter.sh

# 4. Follow logs
sh scripts/view_logs.sh follow
```

### **Hàng Ngày:**
```bash
# Morning: Check status
sh scripts/check_lighter.sh

# Xem logs nếu có issue
sh scripts/view_logs.sh 100 | grep -i error

# Evening: Clean old logs
find logs/ -name "lighter_*.log" -mtime +7 -delete
```

### **Khi Debug:**
```bash
# 1. Dừng server
sh scripts/stop_lighter.sh

# 2. Chạy foreground để xem logs
sh scripts/start_lighter.sh

# 3. Reproduce issue và xem logs

# 4. Ctrl+C để dừng
```

---

## 📊 So Sánh Scripts

| Feature | `start_lighter.sh` | `start_lighter_bg.sh` | `start_lighter_with_logs.sh` |
|---------|-------------------|----------------------|----------------------------|
| **Server Mode** | Foreground | Background | Background |
| **Logs** | Terminal real-time | ❌ Ẩn | ✅ File |
| **Terminal Block** | ✅ Yes | ❌ No | ❌ No |
| **Production** | ❌ No | ✅ Yes | ✅ Yes |
| **Debug** | ✅ Best | ❌ Hard | ✅ Good |
| **Use Case** | Development | Production (no logs) | Production (with logs) |

---

## 🔗 Links Nhanh

- **Hướng dẫn nhanh:** [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Hướng dẫn đầy đủ:** [README.md](README.md)
- **Hướng dẫn logs:** [LOGS_GUIDE.md](LOGS_GUIDE.md)
- **Project README:** [../README.md](../README.md)

---

## 💡 Tips

### **Tạo Alias:**
```bash
# Thêm vào ~/.zshrc
alias lighter-start='sh /path/to/scripts/start_lighter_bg.sh'
alias lighter-check='sh /path/to/scripts/check_lighter.sh'
alias lighter-logs='sh /path/to/scripts/view_logs.sh follow'
alias lighter-stop='sh /path/to/scripts/stop_lighter.sh'
```

### **Keyboard Shortcuts:**
- `Ctrl+C` - Dừng foreground server hoặc thoát follow logs
- `Ctrl+D` - Thoát terminal

---

## ❓ Cần Giúp?

1. **Server không start?**
   ```bash
   sh scripts/start_lighter.sh
   # Xem error message
   ```

2. **Keys mismatch?**
   - Check `.env` file
   - Update keys
   - Restart: `sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh`

3. **Cần xem logs?**
   ```bash
   sh scripts/view_logs.sh follow
   ```

4. **Đọc troubleshooting:**
   - [README.md#troubleshooting](README.md#-troubleshooting)
   - [LOGS_GUIDE.md#use-cases](LOGS_GUIDE.md#-use-cases-thực-tế)

---

**Happy Scripting! 🚀**

*Để biết thêm chi tiết, đọc [README.md](README.md)*

