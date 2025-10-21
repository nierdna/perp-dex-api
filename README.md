# 🤖 Hedging Trading Bot - Market Neutral Strategy

Bot tự động mở vị thế đối xứng trên **Lighter** và **Aster DEX** để kiếm lợi từ chênh lệch funding rate.

---

## 🎯 Chiến Lược

### **Market Neutral Hedging**

- **Random LONG/SHORT** cho 2 sàn (đối xứng)
- **Đặt lệnh đồng thời** với rollback tự động
- **Tự động đóng lệnh** sau khoảng thời gian random
- **Telegram notifications** cho mọi sự kiện

### **Lợi Nhuận Từ Đâu?**

- **Funding Rate Arbitrage**: Kiếm lợi từ chênh lệch funding rate giữa 2 sàn
- **Market Neutral**: LONG + SHORT = 0 exposure, không lo giá tăng/giảm
- **Leverage Efficiency**: Dùng leverage để tăng lợi nhuận

---

## 📚 Documentation

- 🚀 **[Quick Start Guide](docs/QUICK_START.md)** - Hướng dẫn nhanh 5 phút
- 📖 **[Full Documentation](docs/HEDGING_BOT_README.md)** - Hướng dẫn chi tiết đầy đủ
- 📋 **[Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)** - Tóm tắt kỹ thuật

---

## 🚀 Quick Start

### **1. Setup**

```bash
# Clone và cài đặt
git clone <repo>
cd point-dex
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Cấu hình
cp env.example.new .env
nano .env  # Chỉnh sửa với thông tin của bạn
```

### **2. Cấu Hình `.env`**

```bash
# LIGHTER DEX
LIGHTER_PRIVATE_KEY=0x...

# ASTER DEX
ASTER_API_KEY=...
ASTER_SECRET_KEY=...

# TRADING
TRADE_TOKEN=BTC
POSITION_SIZE=200
LEVERAGE=5
SL_PERCENT=3
RR_RATIO=1,2
TIME_OPEN_CLOSE=20,30,60

# TELEGRAM
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_ENABLED=true

# BOT
BOT_ENABLED=true
AUTO_RESTART=false
```

### **3. Chạy Bot**

#### **Option A: Docker (Khuyến nghị)**

```bash
docker-compose up -d
docker-compose logs -f hedging-bot
```

#### **Option B: Manual**

```bash
# Terminal 1: Lighter API (dùng script)
sh scripts/start_lighter_bg.sh

# Terminal 2: Aster API
cd perpsdex/aster && source ../../venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 8001

# Terminal 3: Bot
source venv/bin/activate
python main.py
```

**Hoặc khởi động từng service riêng lẻ với scripts:**

```bash
# Lighter API (Background)
sh scripts/start_lighter_bg.sh

# Kiểm tra Lighter API
sh scripts/check_lighter.sh

# Dừng Lighter API
sh scripts/stop_lighter.sh
```

> 💡 Xem chi tiết trong [scripts/README.md](scripts/README.md)

---

## 🏗️ Kiến Trúc

```
point-dex/
├── main.py                      # Main hedging bot
├── docker-compose.yml           # Docker orchestration
├── Dockerfile                   # Docker image
├── test_bot.sh                  # Test script
├── requirements.txt             # Dependencies
├── env.example.new              # ENV template
├── docs/                        # Documentation
│   ├── QUICK_START.md           # Quick start guide
│   ├── HEDGING_BOT_README.md    # Full documentation
│   └── IMPLEMENTATION_SUMMARY.md # Technical summary
├── scripts/                     # 🆕 Management scripts
│   ├── README.md                # Scripts documentation
│   ├── start_lighter.sh         # Start Lighter (foreground)
│   ├── start_lighter_bg.sh      # Start Lighter (background)
│   ├── stop_lighter.sh          # Stop Lighter
│   └── check_lighter.sh         # Check Lighter status
└── perpsdex/
    ├── lighter/                 # Lighter DEX
    │   ├── api/
    │   │   └── main.py          # Lighter API server
    │   └── core/                # Lighter modules
    └── aster/                   # Aster DEX
        ├── api/
        │   └── main.py          # Aster API server
        └── core/                # Aster modules
```

---

## 📊 Tính Năng

### **Core Features**

- ✅ **Dual Exchange Trading**: Lighter + Aster
- ✅ **Market Neutral Strategy**: LONG + SHORT đối xứng
- ✅ **Automatic Rollback**: Tự động cancel nếu 1 lệnh fail
- ✅ **TP/SL Management**: Tự động đặt Take Profit & Stop Loss
- ✅ **Telegram Notifications**: Thông báo real-time
- ✅ **Docker Support**: Easy deployment
- ✅ **Random Timing**: Tránh pattern detection

### **Risk Management**

- 💰 **Position Sizing**: Tự động tính toán theo budget
- 🛡️ **Stop Loss**: Bảo vệ vốn với SL tự động
- ⚖️ **Risk:Reward Ratio**: Cấu hình R:R linh hoạt
- 🔄 **Rollback Logic**: An toàn khi hedge fail

---

## 🧪 Testing

```bash
# Test setup
./test_bot.sh

# Test Lighter API
curl http://localhost:8000/api/status

# Test Aster API
curl http://localhost:8001/api/status
```

---

## 📱 Telegram Setup

1. Tìm `@BotFather` → `/newbot` → Copy token
2. Tìm `@userinfobot` → `/start` → Copy chat ID
3. Thêm vào `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABC...
   TELEGRAM_CHAT_ID=987654321
   ```

---

## 📊 Monitoring

```bash
# Xem logs
docker-compose logs -f hedging-bot

# Xem positions
curl http://localhost:8000/api/positions  # Lighter
curl http://localhost:8001/api/positions  # Aster

# Xem balance
curl http://localhost:8000/api/market/balance
curl http://localhost:8001/api/market/balance
```

---

## ⚠️ Lưu Ý Quan Trọng

### **Risk Disclaimer**

- ⚠️ Trading có rủi ro, có thể mất tiền
- ✅ Chỉ trade với số tiền bạn có thể chấp nhận mất
- ✅ Test kỹ với volume nhỏ trước

### **Best Practices**

- ✅ Bắt đầu với volume nhỏ ($50-100)
- ✅ Set `AUTO_RESTART=false` lúc đầu
- ✅ Bật Telegram để theo dõi
- ✅ Chạy `./test_bot.sh` trước khi start
- ✅ Kiểm tra balance thường xuyên

### **Security**

- 🔐 Không share API keys
- 🔐 Sử dụng `.env` cho sensitive data
- 🔐 Monitor account thường xuyên

---

## 🔮 Roadmap

### **Phase 1: Core Bot ✅**

- [x] Main hedging bot
- [x] Lighter + Aster integration
- [x] Telegram notifications
- [x] Docker support
- [x] Documentation

### **Phase 2: Enhancement (TODO)**

- [ ] Cancel order endpoint
- [ ] Close position endpoint
- [ ] Retry logic cho API failures
- [ ] Health check cho API servers
- [ ] Position monitoring

### **Phase 3: Advanced (Future)**

- [ ] Web UI dashboard
- [ ] Database cho trade history
- [ ] Backtesting
- [ ] Multiple strategies
- [ ] Support thêm DEX

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create Pull Request

---

## 📞 Support

Nếu có vấn đề:

1. Đọc [Full Documentation](docs/HEDGING_BOT_README.md)
2. Chạy `./test_bot.sh`
3. Xem logs: `docker-compose logs -f`
4. Check `.env` configuration
5. Test API endpoints manually

---

## 📄 License

MIT License

---

**Happy Trading! 🚀**

*Built with ❤️ for market neutral arbitrage*
