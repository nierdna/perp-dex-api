# 🚀 HƯỚNG DẪN CHẠY HEDGING BOT

**Updated**: 2025-10-25

---

## 📋 CHECKLIST TRƯỚC KHI CHẠY

- [ ] Đã cài đặt dependencies (`pip install -r requirements.txt`)
- [ ] Đã config `.env` với API keys
- [ ] Đã test Lighter API (`sh scripts/check_lighter.sh`)
- [ ] Đã có balance trên cả 2 sàn
- [ ] Đã config Telegram (optional)

---

## ⚙️ BƯỚC 1: CẤU HÌNH `.env`

```bash
# Copy template
cp env.example.new .env

# Edit với thông tin thực
nano .env
```

### **Cấu hình tối thiểu:**

```bash
# ============ LIGHTER API ============
LIGHTER_L1_PRIVATE_KEY=0x...        # ✅ REQUIRED
LIGHTER_L1_PUBLIC_KEY=0x...         # ✅ REQUIRED
ACCOUNT_INDEX=198336                # ✅ REQUIRED
LIGHTER_API_URL=http://localhost:8000

# ============ ASTER API ============
ASTER_API_KEY=...                   # ✅ REQUIRED
ASTER_SECRET_KEY=...                # ✅ REQUIRED
ASTER_API_URL_LOCAL=http://localhost:8001

# ============ TRADING CONFIG ============
TRADE_TOKEN=BTC                     # Token để trade
POSITION_SIZE=10                    # $10 MỖI SÀN (total $20)
LEVERAGE=5                          # 5x leverage
SL_PERCENT=3                        # 3% stop loss
RR_RATIO=1,2                        # TP = 6% (1:2 ratio)
TIME_OPEN_CLOSE=20,30,60           # Random 20-60 phút

# ============ BOT CONTROL ============
BOT_ENABLED=true                    # Enable bot
AUTO_RESTART=true                   # Auto cycle sau khi close

# ============ TELEGRAM ============
TELEGRAM_ENABLED=true               # ✅ HIGHLY RECOMMENDED
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

### **⚠️ QUAN TRỌNG:**

1. **POSITION_SIZE**: Là size **MỖI SÀN**, không phải total
   - VD: `POSITION_SIZE=10` → $10 Lighter + $10 Aster = **$20 total**

2. **LEVERAGE**: Margin cần = `POSITION_SIZE / LEVERAGE`
   - VD: $10 với 5x leverage → cần $2 margin mỗi sàn

3. **TIME_OPEN_CLOSE**: Thời gian giữ positions (phút)
   - VD: `20,30,60` → Random chọn 1 trong 3 values
   - Test: `1,2,3` → 1-3 phút cho testing

---

## 🔧 BƯỚC 2: START LIGHTER API

```bash
# Start Lighter API server
sh scripts/start_lighter_with_logs.sh

# Check status
sh scripts/check_lighter.sh

# View logs (nếu cần)
sh scripts/view_logs.sh follow
```

**Expected Output:**
```
✅ Server started successfully!
📊 Process ID: 12345
🌐 API running at: http://localhost:8000
```

**Test API:**
```bash
curl http://localhost:8000/api/status | jq '.'
```

**Expected Response:**
```json
{
  "api_status": "online",
  "connection": "connected",
  "keys_mismatch": false,
  "can_trade": true
}
```

---

## 🟠 BƯỚC 3: START ASTER API (nếu cần)

```bash
# TODO: Tạo script tương tự cho Aster
cd perpsdex/aster
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload &

# Test
curl http://localhost:8001/api/status | jq '.'
```

---

## 🤖 BƯỚC 4: RUN BOT

### **Option A: Run Foreground (Recommended cho testing)**

```bash
# Activate venv
source venv/bin/activate

# Run bot
python3 main.py
```

**Dừng bot:** `Ctrl+C`

### **Option B: Run Background**

```bash
# Run in background
nohup python3 main.py > logs/bot.log 2>&1 &

# Get process ID
echo $!

# View logs
tail -f logs/bot.log

# Stop bot
kill <PID>
```

### **Option C: Run với Screen (Recommended cho production)**

```bash
# Start screen session
screen -S hedging-bot

# Run bot
python3 main.py

# Detach: Ctrl+A, then D

# Reattach later
screen -r hedging-bot

# List sessions
screen -ls
```

---

## 📊 BƯỚC 5: MONITOR BOT

### **Console Output:**

```
🤖 HEDGING BOT - MARKET NEUTRAL STRATEGY
============================================================
📊 Trading Pair: BTC-USDT
💰 Total Position Size: $20
📈 Leverage: 5x
🛡️ Stop Loss: 3%
⚖️ R:R Ratio: 1:2
⏱️ Time Options: [20, 30, 60] minutes
🔄 Auto Restart: ✅
📱 Telegram: ✅
============================================================

############################################################
# CYCLE 1
############################################################

============================================================
🚀 OPENING HEDGED POSITIONS
============================================================

🎲 Random strategy:
   Lighter: LONG
   Aster: SHORT

⚡ Placing orders simultaneously...
🔵 Placing LONG order on Lighter...
🟠 Placing SHORT order on Aster...
✅ Lighter LONG order placed: 1729861234000
✅ Aster SHORT order placed: 987654321

🎉 ✅ HEDGED POSITION OPENED SUCCESSFULLY!

📊 Lighter (LONG):
   Order ID: 1729861234000
   Market ID: 1
   Entry: $108,000
   Size: 0.0002

📊 Aster (SHORT):
   Order ID: 987654321
   Symbol: BTC-USDT
   Entry: $107,950
   Size: 0.0002

🔐 Position Tracking Enabled:
   Bot will ONLY close these specific positions
   Other positions on same markets will NOT be affected

⏰ Positions will be held for 30 minutes
   Close time: 14:30:00 + 30m

⏳ 30 minutes remaining...
⏳ 29 minutes remaining...
...

⏰ Time's up! Closing positions...

🔄 Closing all positions...
🔵 Closing Lighter position (Market ID: 1)...
✅ Lighter position closed
   Market ID: 1
   Side: long
   P&L: +0.5%

🟠 Closing Aster position (BTC-USDT)...
✅ Aster position closed
   Symbol: BTC-USDT
   Side: short
   P&L: -0.3%

✅ Cycle 1 completed

⏳ Waiting 30 seconds before next cycle...
```

### **Telegram Notifications:**

Bot sẽ gửi notifications cho:
- ✅ Bot started
- ✅ Opened hedged position (với entry prices)
- ✅ Closed positions (với P&L)
- ❌ Failed to open position (với errors)
- 🛑 Bot stopped

---

## 🧪 TESTING

### **Test 1: Short Cycle (1-3 phút)**

```bash
# Edit .env
TIME_OPEN_CLOSE=1,2,3  # 1-3 minutes
POSITION_SIZE=5        # $5 small size
BOT_ENABLED=true
AUTO_RESTART=false     # Stop after 1 cycle

# Run
python3 main.py
```

**Expected:**
- Mở positions trong ~5 giây
- Hold 1-3 phút
- Đóng tự động
- Bot stop (AUTO_RESTART=false)

### **Test 2: Rollback**

```bash
# Để test rollback, tạm thời disable 1 API
# Hoặc set sai API keys cho 1 sàn

# Bot sẽ:
# 1. Try open both
# 2. Nếu 1 sàn fail → Cancel order thành công
# 3. Send Telegram alert
```

### **Test 3: Manual Close**

```bash
# Trong khi bot đang hold, test manual close:

# Close Lighter position
curl -X POST 'http://localhost:8000/api/positions/close' \
  -H 'Content-Type: application/json' \
  -d '{"market_id": 1}'

# Close Aster position
curl -X POST 'http://localhost:8001/api/positions/close' \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "BTC-USDT"}'
```

---

## 🛑 DỪNG BOT

### **Foreground:**
```bash
Ctrl+C
```

### **Background:**
```bash
# Find process
ps aux | grep main.py

# Kill
kill <PID>

# Hoặc
pkill -f main.py
```

### **Screen:**
```bash
# Reattach
screen -r hedging-bot

# Stop
Ctrl+C

# Exit screen
exit
```

---

## 🔍 TROUBLESHOOTING

### **1. Bot không start**

**Check:**
```bash
# Verify .env
cat .env | grep -E "LIGHTER_L1_PRIVATE_KEY|ASTER_API_KEY"

# Test Python imports
python3 -c "import aiohttp; print('OK')"

# Check venv
which python3
```

**Fix:**
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Check Python version (need 3.8+)
python3 --version
```

### **2. Lighter API errors**

**Check:**
```bash
# Server running?
curl http://localhost:8000/api/status

# View logs
sh scripts/view_logs.sh 50

# Restart
sh scripts/stop_lighter.sh
sh scripts/start_lighter_with_logs.sh
```

**Common errors:**
- `invalid signature` → Sai API keys
- `insufficient balance` → Không đủ balance
- `keys mismatch` → Public/private key không match

### **3. Aster API errors**

**Check Aster API keys:**
```bash
# Test connection
curl -X GET 'https://fapi.asterdex.com/fapi/v1/ping'

# Test with keys (replace with yours)
# ...
```

### **4. Positions không đóng**

**Debug:**
```bash
# Check tracked positions
# Bot in-memory → Restart sẽ mất tracking

# Manual close nếu cần
curl -X POST 'http://localhost:8000/api/positions/close' \
  -d '{"market_id": 1}'
```

### **5. Telegram không hoạt động**

**Check:**
```bash
# Test bot token
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Test send message
curl "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test"

# Get chat_id
# 1. Add bot to group
# 2. Send message in group
# 3. curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

---

## 📈 PRODUCTION TIPS

### **1. Set Proper Timeouts**

```bash
# Production: 20-60 minutes
TIME_OPEN_CLOSE=20,30,45,60

# Test: 1-3 minutes
TIME_OPEN_CLOSE=1,2,3
```

### **2. Monitor Logs**

```bash
# Setup log rotation
# Add to crontab
0 0 * * * find /path/to/logs -name "*.log" -mtime +7 -delete

# Or use logrotate
```

### **3. Alert on Failures**

```bash
# Bot auto-sends Telegram alerts
# Make sure TELEGRAM_ENABLED=true

# Setup external monitoring (optional)
# - Uptime Kuma
# - Healthchecks.io
```

### **4. Backup Config**

```bash
# Backup .env
cp .env .env.backup

# Never commit .env to git!
echo ".env" >> .gitignore
```

### **5. Use Screen/Tmux**

```bash
# Screen (simpler)
screen -S hedging-bot
python3 main.py

# Tmux (more features)
tmux new -s hedging-bot
python3 main.py
```

---

## 🐳 DOCKER (Optional - Chưa setup)

```bash
# TODO: Create Dockerfile
# TODO: Create docker-compose.yml
# TODO: Test containerized deployment
```

---

## 📊 MONITORING CHECKLIST

### **Daily:**
- [ ] Check Telegram notifications
- [ ] Verify positions opened/closed correctly
- [ ] Check P&L trends

### **Weekly:**
- [ ] Review logs for errors
- [ ] Check API key expiry
- [ ] Verify balance sufficient

### **Monthly:**
- [ ] Update dependencies
- [ ] Review trading strategy
- [ ] Analyze funding rate arbitrage effectiveness

---

## 🔗 USEFUL COMMANDS

```bash
# Quick status check
sh scripts/check_lighter.sh && echo "✅ Lighter OK"

# View latest positions
curl -s http://localhost:8000/api/positions | jq '.positions[] | select(.size != 0)'

# Check bot process
ps aux | grep main.py

# View real-time logs
tail -f logs/bot.log
tail -f logs/lighter_*.log

# Restart everything
sh scripts/stop_lighter.sh
sh scripts/start_lighter_with_logs.sh
python3 main.py
```

---

## ✅ FINAL CHECKLIST

Trước khi chạy production:

- [ ] ✅ Tested với small size ($5-10)
- [ ] ✅ Tested với short timeout (1-3 min)
- [ ] ✅ Verified positions open correctly
- [ ] ✅ Verified positions close correctly
- [ ] ✅ Tested rollback logic
- [ ] ✅ Telegram notifications working
- [ ] ✅ Have sufficient balance on both exchanges
- [ ] ✅ Understood risks and P&L calculation
- [ ] ✅ Setup monitoring/alerts
- [ ] ✅ Documented API keys safely

---

**🎉 BẠN SẴN SÀNG! CHÚC MAY MẮN!** 🚀

**Need help?** Check:
- `docs/CURRENT_STATUS.md` - Current state
- `docs/CANCEL_CLOSE_IMPLEMENTATION.md` - API details
- `docs/POSITION_MONITOR_PLAN.md` - Future enhancements

