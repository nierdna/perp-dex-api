# 🤖 Funding Rate Arbitrage Bot

Bot tự động thực hiện arbitrage funding rate trên các DEX perp để farm points và kiếm profit.

## 🎯 Mục tiêu

- **Farm points** trên Lighter, Paradex, Aster DEX
- **Kiếm profit** từ funding rate arbitrage
- **Risk management** với budget $500 per exchange
- **Automated trading** 24/7

## 🏗️ Kiến trúc

```
point-dex/
├── lighter_module.py     # Lighter DEX integration
├── test_lighter.py       # Test suite
├── main.py              # Main arbitrage bot
├── requirements.txt     # Dependencies
├── env.example          # Environment template
└── README.md           # Documentation
```

## 🚀 Cài đặt

### 1. Clone repository
```bash
git clone <your-repo>
cd point-dex
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Setup environment
```bash
cp env.example .env
# Edit .env với API keys thật của bạn
```

### 4. Cấu hình API keys
```env
# Lighter API Keys
LIGHTER_PUBLIC_KEY=your_lighter_public_key_here
LIGHTER_PRIVATE_KEY=your_lighter_private_key_here

# Trading Configuration
TRADING_BUDGET=500
MAX_POSITION_SIZE=0.01
```

## 🧪 Testing

### Test cơ bản
```bash
python test_lighter.py
```

### Test module riêng lẻ
```bash
python lighter_module.py
```

## 🤖 Chạy Bot

### Chạy bot chính
```bash
python main.py
```

Bot sẽ:
1. ✅ Kết nối với Lighter DEX
2. 📊 Lấy funding rates mỗi 60 giây
3. 🎯 Phân tích arbitrage opportunities
4. 💰 Đặt lệnh tự động
5. 📈 Monitor positions và PnL

## 📊 Tính năng chính

### Lighter Module (`lighter_module.py`)
- ✅ **Authentication** với API keys
- ✅ **Market data** (price, funding rate, spread)
- ✅ **Position management** (get, close positions)
- ✅ **Order management** (place, cancel orders)
- ✅ **Balance checking**
- ✅ **Risk management** (position sizing)

### Main Bot (`main.py`)
- ✅ **Automated trading loop**
- ✅ **Funding rate analysis**
- ✅ **Opportunity detection**
- ✅ **Risk management** (stop loss)
- ✅ **Position monitoring**

### Test Suite (`test_lighter.py`)
- ✅ **Connection testing**
- ✅ **Functionality testing**
- ✅ **Funding arbitrage setup**
- ✅ **Risk assessment**

## 🎯 Strategy

### Funding Rate Arbitrage Logic
1. **High funding rate** (>0.01%) → **LONG** opportunity
2. **Low funding rate** (<-0.01%) → **SHORT** opportunity
3. **Hedge positions** trên multiple exchanges
4. **Collect funding payments** every 8 hours

### Risk Management
- 💰 **Budget**: $500 per exchange
- 📊 **Position size**: Max 0.01 per trade
- 🛑 **Stop loss**: $50 total loss
- ⚖️ **Risk per trade**: 1-2% of balance

## 📈 Monitoring

Bot sẽ hiển thị:
- 📊 Current funding rates
- 💰 Account balance
- 📈 Open positions và PnL
- 🎯 Trading opportunities
- ⚠️ Risk alerts

## 🔧 Configuration

### Environment Variables
```env
TRADING_BUDGET=500              # Budget per exchange
MAX_POSITION_SIZE=0.01          # Max position size
STOP_LOSS_PERCENTAGE=0.02       # Stop loss percentage
REQUEST_TIMEOUT=30              # API timeout
RETRY_ATTEMPTS=3                # Retry attempts
```

### Trading Parameters
- **Check interval**: 60 seconds
- **Funding threshold**: 0.01%
- **Risk per trade**: 1-2%
- **Stop loss**: $50

## 🚨 Lưu ý quan trọng

### ⚠️ Risk Disclaimer
- Trading có rủi ro, có thể mất tiền
- Chỉ trade với số tiền bạn có thể chấp nhận mất
- Test kỹ trước khi deploy real money

### 🔐 Security
- Không share API keys
- Sử dụng API keys với permissions tối thiểu
- Monitor account thường xuyên

### 📊 Performance
- Bot chạy 24/7 để capture opportunities
- Monitor funding rates mỗi 60 giây
- Auto-close positions khi cần thiết

## 🔄 Roadmap

### Phase 1: Lighter DEX ✅
- [x] Lighter module integration
- [x] Basic trading functionality
- [x] Risk management
- [x] Testing suite

### Phase 2: Multi-Exchange (Coming Soon)
- [ ] Paradex module
- [ ] Aster module
- [ ] Cross-exchange arbitrage
- [ ] Advanced hedging

### Phase 3: Advanced Features
- [ ] WebSocket real-time data
- [ ] Dashboard UI
- [ ] Advanced risk management
- [ ] Performance analytics

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

Nếu có vấn đề:
1. Check logs trong console
2. Verify API keys
3. Check network connection
4. Review configuration

## 📄 License

MIT License - Xem LICENSE file để biết thêm chi tiết.

---

**Happy Trading! 🚀💰**
