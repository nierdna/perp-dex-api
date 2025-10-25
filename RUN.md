# 🚀 QUICK RUN GUIDE

## ⚡ CÁCH CHẠY NHANH NHẤT

```bash
sh scripts/run_bot.sh
```

**Xong!** Script sẽ tự động:
1. ✅ Check prerequisites
2. ✅ Start Lighter API
3. ✅ Run bot

---

## ⚙️ TEST CONFIG (cho lần đầu)

Edit `.env`:

```bash
# Test với size nhỏ và timeout ngắn
TRADE_TOKEN=BTC
POSITION_SIZE=5              # $5 mỗi sàn
LEVERAGE=5
SL_PERCENT=3
RR_RATIO=1,2
TIME_OPEN_CLOSE=1,2,3        # ⚠️ 1-3 PHÚT cho test
AUTO_RESTART=false           # ⚠️ Stop sau 1 cycle
BOT_ENABLED=true
TELEGRAM_ENABLED=true
```

---

## 📊 BOT SẼ LÀM GÌ?

```
1. 🎲 Random: Lighter LONG + Aster SHORT
2. ⚡ Mở positions đồng thời
3. ⏰ Hold 1-3 phút (random)
4. 🔄 Đóng tự động
5. 📱 Telegram notification
6. ✅ Done!
```

---

## 🛑 DỪNG BOT

```bash
Ctrl+C
```

---

## 📖 CHI TIẾT HƠN

Xem: `docs/HOW_TO_RUN.md`

---

## ⚠️ LƯU Ý

1. **Bot chỉ đóng positions của mình** - An toàn!
2. **Cần balance trên cả 2 sàn** - Ít nhất $2 mỗi sàn
3. **Test trước với size nhỏ** - $5-10 để verify
4. **Telegram RECOMMEND** - Để nhận alerts!

---

**🎉 CHÚC MAY MẮN!**

