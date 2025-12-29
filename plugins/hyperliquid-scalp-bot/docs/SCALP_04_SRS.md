# SCALP_04 Strategy – SRS & Logic Flow Documentation

## 📋 Executive Summary

**Strategy Name**: SCALP_04  
**Type**: Trend-Continuation Scalping Engine (Enhanced)  
**Timeframe**: 15m (Regime) → 5m (Trend Strength) → 1m (Pullback Entry)  
**Objective**: Capture momentum continuation in strong trends  
**Trade Style**: Fast in – fast out (3–10 minutes)  
**Risk Model**: ATR-based dynamic risk (SL = 1.0×ATR, TP = 2.0×ATR, 2R target)  
**Execution**: Signal-only (manual execution)

---

## 🎯 Strategy Philosophy

> "SCALP_04 trades continuation, not prediction."

SCALP_04 is designed to:
- Trade **only strong trends**
- Exploit **momentum continuation** with strict filters
- Avoid sideways / chop markets
- Complement SCALP_03 (mean-reversion / clean setup engine)
- Adapt to volatility conditions

---

## 🚫 Non-Goals

- No counter-trend trading
- No reversal catching
- No sideway range scalping
- No EMA-cross dependency
- No late entries (price too far from structure)

---

## 📊 Multi-Timeframe Framework

### 1️⃣ 15-Minute Chart – Market Regime Filter

**Purpose**: Determine if the market is tradable for continuation.

**Indicators**
- EMA50
- EMA200

**Regime Detection**
- EMA50 > EMA200 → trending_bull
- EMA50 < EMA200 → trending_bear
- Otherwise → ranging

**Rules**
- trending_bull → LONG only
- trending_bear → SHORT only
- ranging → NO_TRADE

---

### 2️⃣ 5-Minute Chart – Trend Strength Validation

**Purpose**: Confirm trend has momentum, not just direction.

**Indicators**
- EMA9
- EMA26
- RSI_7 (format: underscore, not parentheses)
- ATR(14)

**Conditions (ALL REQUIRED)**
- bias_5m === regime_direction
- RSI_7 threshold (stricter - NEW)

**RSI Filter** (Updated: Stricter for better quality)
- **LONG**: RSI_7 ≥ 55 (was 50, now stricter)
- **SHORT**: RSI_7 ≤ 45 (was 50, now stricter)

**Rationale**: RSI = 50 is neutral, not continuation. Requiring RSI ≥ 55 (LONG) or ≤ 45 (SHORT) ensures stronger momentum.

---

### 2.5 Volume Confirmation (NEW)

**Purpose**: Ensure continuation has volume support

**Rule**: Require `entry_vol_ratio >= 0.8`

**Rationale**: Continuation requires volume to confirm momentum. Low volume continuation = false breakout risk.

---

### 2.6 Volatility Regime Filter (NEW)

**Purpose**: Adapt filters based on market volatility

**Volatility Regime Detection**:
- Calculate ATR% = (ATR / price) × 100
- **HIGH**: ATR% > 1.0
- **NORMAL**: 0.5 < ATR% ≤ 1.0
- **LOW**: ATR% ≤ 0.5

**Filter Adjustments**:
- **HIGH volatility**: Require `vol_ratio >= 1.0` (stricter to avoid noise)
- **NORMAL/LOW**: Use standard volume filters (0.8)

---

### 3️⃣ 1-Minute Chart – Continuation Eligibility

**Purpose**: Ensure move is not exhausted or reversing.

**RSI Continuation Zone**
- LONG: RSI_7 60–85 (ideal)
- SHORT: RSI_7 15–40 (ideal)

**Invalid Conditions**
- RSI_7 > 90 or < 10 (extreme exhaustion)
- RSI_7 > 80 (LONG) - too high, risk of reversal
- RSI_7 < 20 (SHORT) - too low, risk of reversal

---

## 🎯 Entry Logic (1-Minute)

### Step 1: Pullback & Hold Structure

**LONG**
- Pullback to EMA9/EMA26
- No candle close below EMA26 (structure hold)
- RSI_7 cools from >70 → 45–55

**SHORT**
- Pullback to EMA9/EMA26
- No candle close above EMA26 (structure hold)
- RSI_7 recovers from <30 → 45–55

---

### Step 2: Late Entry Check (NEW)

**Purpose**: Prevent entering after trend has already moved too far

**Rule**: Reject if price is > 2% away from EMA26

**Calculation**:
```
distanceFromEma26 = |entryClose - EMA26| / EMA26
if distanceFromEma26 > 0.02 → REJECT
```

**Rationale**: Price too far from EMA26 = trend already extended, entry is late. Late entry = high risk, low reward.

---

### Step 3: Re-Entry Trigger

**Trigger A – Micro Breakout**
- Break recent high (LONG) / low (SHORT)
- Close back above EMA9 (LONG) / below EMA9 (SHORT)

**Trigger B – Volume Follow-through**
- Volume ≥ 0.8x average (minimum, prefer ≥ 1.2x)

---

## 🤖 AI Confirmation (Trend Mode)

**AI Role**: Trend Continuation Trader

**Rules**
- LONG only in bull regime
- SHORT only in bear regime
- Reject late RSI_7 (too high/low)
- Reject abnormal volume
- Reject high-impact news proximity
- Consider HTF context (Swing data) for alignment

**Note**: AI output uses RSI_7 format (underscore), not RSI(7)

**Confidence**
- Clean continuation: 0.75–0.9
- < 0.7 → reject

**HTF Context Integration**:
- **ALIGNED**: HTF confirms continuation → Confidence +10-15%
- **DIVERGENT**: HTF against continuation → AVOID or reduce confidence -20%
- **AT_ZONE**: Price at HTF zone with continuation direction → Strong setup

---

## 🛡 Risk Management

### Stop Loss (ATR-Based - NEW)

**Primary Method (ATR Available)**:
- **SL = entry ± (1.0 × ATR_1m)**
- Rationale: 1.0×ATR provides tight stop for continuation trades
- Adapts to volatility: High volatility → wider SL, Low volatility → tighter SL

**Fallback Method (ATR Not Available)**:
- **SL = entry ± 0.6%** (fixed percentage)

**HTF Divergent Adjustment**:
- If HTF trend DIVERGENT from continuation: Tighten SL to 0.8 × ATR

### Take Profit (ATR-Based - NEW)

**Primary Method (ATR Available)**:
- **TP = entry ± (2.0 × ATR_1m)**
- **R:R Ratio**: 2:1 (TP = 2.0×ATR, SL = 1.0×ATR)
- Rationale: 2R target for continuation trades

**Fallback Method (ATR Not Available)**:
- **TP = entry ± 1.2%** (fixed percentage)

---

## ⏱ Exit Rules

- TP hit → WIN
- SL hit → LOSS
- RSI_7 loses continuation → CLOSE
- > 60 minutes (TTL) → TIMEOUT (auto-close at current price)

---

## 🔄 Dispatcher Integration

- TREND_STRONG → enable SCALP_04
- RANGE / CHOP → disable SCALP_04

Never run SCALP_03 and SCALP_04 simultaneously on the same symbol.

---

## 🧩 End-to-End Flow

START → Volatility Regime Check → Regime Check → Trend Strength (RSI ≥55/≤45) → Volume Confirmation (≥0.8) → Structure Hold → Late Entry Check → Pullback → Re-entry Trigger → AI Validation → ATR-Based SL/TP → Alert → Track → Exit

---

## 📦 Versioning

**Document Version**: 2.0  
**Last Updated**: 2025-12-26  
**Status**: Production-ready  
**Designed to run alongside SCALP_03**

### Changelog v2.0 (Leader Trader Review Improvements)

#### Critical Fixes:
- **Increased RSI Threshold**: LONG requires RSI ≥ 55 (was 50), SHORT requires RSI ≤ 45 (was 50)
- **Volume Confirmation**: Require vol_ratio >= 0.8 for continuation
- **ATR-Based SL/TP**: Implemented (SL = 1.0×ATR, TP = 2.0×ATR, 2R target)

#### High Priority Improvements:
- **Late Entry Check**: Reject if price > 2% away from EMA26
- **Volatility Regime Filter**: Adapt filters based on HIGH/NORMAL/LOW volatility (HIGH requires vol_ratio >= 1.0)
- **HTF Context Integration**: Enhanced AI prompt with Swing data

### Changelog v1.1 (Previous)
- **RSI Filter Loosened**: Changed from RSI_7 ≥ 55/≤ 45 to ≥ 50/≤ 50 (REVERTED in v2.0 - now stricter)
- **RSI Format**: Updated to RSI_7 (underscore) format throughout documentation
- **TTL Added**: Trades auto-close after 60 minutes if TP/SL not hit
- **Price Fallback**: Added fallback to `signal.price` if `entry_close_1m` not available

---

## 🎓 Strategy Philosophy

### Strengths

1. **Trend-Only Trading**: Only trades strong trends, avoids chop
2. **Momentum Confirmation**: Requires RSI ≥ 55/≤ 45 for strong momentum
3. **Volume Confirmation**: Ensures continuation has volume support
4. **Structure Hold**: Price must stay above/below EMA26 (no breakdown)
5. **Late Entry Protection**: Prevents entering after trend extended
6. **ATR-Based Risk**: Dynamic SL/TP adapts to volatility
7. **HTF Context**: Uses Swing data for better decision making

### Limitations

1. **Trend Dependency**: Requires clear trend, misses range-bound markets
2. **Not Auto-Executing**: User must manually enter trades
3. **Mid Price Tracking**: WIN/LOSS based on mid price, not actual fill price
4. **AI Dependency**: Requires DeepSeek API availability

---

## 📝 Configuration

### Environment Variables

```bash
# Core
SYMBOL=BTC,ETH,SOL          # Comma-separated symbols
POLL_INTERVAL=60            # Cycle interval (seconds)

# AI
DEEPSEEK_API_KEY=<key>      # DeepSeek API key
DEEPSEEK_TIMEOUT_MS=120000  # AI timeout (120s default)

# Notifications
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<chat_id>

# Database
DATABASE_URL=<postgres_url>

# Trade Tracking
TRADE_TTL_MINUTES=60        # Auto-close timeout (minutes)
```

---

## 📚 References

- **Technical Indicators**: `technicalindicators` library (RSI, EMA, ATR)
- **Data Source**: Hyperliquid API (candles, meta, WebSocket)
- **AI Model**: DeepSeek Chat (via API)
- **HTF Context**: Swing01 strategy cache

