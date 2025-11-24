# 🚀 Quick Reference - Lighter Server Scripts

## ⚡ Lệnh Thường Dùng

```bash
# Khởi động server (background) - KHUYẾN NGHỊ
sh scripts/start_lighter_bg.sh

# Khởi động server với logs
sh scripts/start_lighter_with_logs.sh

# Kiểm tra trạng thái
sh scripts/check_lighter.sh

# Xem logs
sh scripts/view_logs.sh           # 50 dòng cuối
sh scripts/view_logs.sh follow    # Follow real-time
sh scripts/view_logs.sh 100       # 100 dòng cuối

# Dừng server
sh scripts/stop_lighter.sh

# Restart server
sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh
```

---

## 📊 Status Indicators

### ✅ Server Đang Chạy:
```json
{
  "api_status": "online",
  "connection": "connected",
  "keys_mismatch": false,  // ✅ Keys OK
  "can_trade": true        // ✅ Ready to trade
}
```

### ⚠️ Keys Mismatch:
```json
{
  "api_status": "online",
  "connection": "connected",
  "keys_mismatch": true,   // ❌ Keys không khớp
  "can_trade": false       // ❌ Không thể trade
}
```

**Fix:** Cập nhật `.env` và restart:
```bash
sh scripts/stop_lighter.sh && sh scripts/start_lighter_bg.sh
```

---

## 🔧 Troubleshooting

| Vấn Đề | Giải Pháp |
|--------|-----------|
| Port 8000 đang dùng | `sh scripts/stop_lighter.sh` |
| Keys mismatch | Update `.env` → restart server |
| Server không start | Check logs: `sh scripts/start_lighter.sh` |
| Can't trade | Verify keys in `.env` |

---

## 📝 Notes

- ✅ Background mode: Server chạy liên tục
- ✅ Auto kill: Scripts tự động dừng process cũ
- ✅ Virtual env: Tự động kích hoạt
- 📖 Chi tiết: [scripts/README.md](README.md)

---

**Quick Access:** `cat scripts/QUICK_REFERENCE.md`

