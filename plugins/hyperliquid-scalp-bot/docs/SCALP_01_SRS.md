# SCALP_01 Strategy - Logic Flow Documentation

## 📋 Executive Summary

**Strategy Name**: SCALP_01  
**Type**: Multi-Timeframe Scalping with AI-Assisted Decision Making  
**Timeframe**: 15m (Regime) → 5m (Bias) → 1m (Entry)  
**Target**: Short-term price movements with >70% win probability  
**Risk/Reward**: 1:1.5 (Stop Loss ~0.6%, Take Profit ~0.9%)

---

## 🎯 Strategy Objectives

1. **Capture short-term momentum** using multi-timeframe confluence
2. **Minimize false signals** through strict technical filters + AI validation
3. **Optimize risk/reward** with tight stop-loss and quick take-profit targets
4. **Adapt to market conditions** via AI analysis of technical + fundamental data

---

## 📊 Multi-Timeframe Analysis Framework

### 1. 15-Minute Chart (Market Regime)

**Purpose**: Identify overall market trend and major structure

**Indicators**:
- **EMA50 vs EMA200**: Long-term trend direction
  - `EMA50 > EMA200` → Bullish regime
  - `EMA50 < EMA200` → Bearish regime
  - Crossover detection: Golden Cross (bullish) / Death Cross (bearish)
- **RSI(14)**: Overbought/Oversold levels
  - >70: Overbought
  - <30: Oversold

**Regime States**:
- `trending_bull`: Uptrend (EMA50 > EMA200)
- `trending_bear`: Downtrend (EMA50 < EMA200)
- `ranging`: Sideways (no clear trend)

**Usage**: Context filter - avoid counter-trend trades unless reversal setup is strong

---

### 2. 5-Minute Chart (Bias & Structure)

**Purpose**: Identify intermediate wave structure and bias direction

**Indicators**:
- **EMA9 vs EMA26**: Short-term trend bias
  - `EMA9 > EMA26` → Bullish bias
  - `EMA9 < EMA26` → Bearish bias
  - Crossover detection for trend changes
- **RSI(7)**: Short-term momentum
- **ATR(14)**: Volatility measurement

**Bias States**:
- `bullish`: EMA9 > EMA26
- `bearish`: EMA9 < EMA26
- `neutral`: No clear bias

**Usage**: Trend filter - entry cross signals must align with 5m bias (trend-following)

---

### 3. 1-Minute Chart (Entry Timing)

**Purpose**: Precise entry point identification for scalping

**Indicators**:
- **EMA9 vs EMA26**: Entry signal generation
  - Golden Cross (EMA9 crosses above EMA26) → LONG signal
  - Death Cross (EMA9 crosses below EMA26) → SHORT signal
- **RSI(7)**: Entry momentum confirmation
- **Volume Analysis**: Entry force validation
  - `vol_ratio >= 3.0` → Ultra high volume
  - `vol_ratio >= 1.5` → High volume
  - `vol_ratio < 0.8` → Low volume

**Entry States**:
- `long_ready`: EMA9 > EMA26 (potential LONG)
- `short_ready`: EMA9 < EMA26 (potential SHORT)
- `wait`: No clear setup

**Usage**: Primary entry trigger - must have clear cross signal or extreme RSI reversal

---

## 🔍 Technical Filter Logic (Pre-AI Screening)

### Filter 1: Entry Signal Requirement

**Mandatory Conditions** (at least ONE must be true):

1. **Entry Cross Signal**:
   - `entry_cross === 'golden_cross'` (LONG setup)
   - `entry_cross === 'death_cross'` (SHORT setup)

2. **Reversal Setup** (Alternative):
   - `entry_1m === 'long_ready' OR 'short_ready'`
   - AND `entry_rsi7 > 80 OR < 20` (RSI extreme on 1m)
   - AND `bias_rsi7 > 80 OR < 20` (RSI extreme on 5m)

**If neither condition met** → Skip AI call (save API cost)

---

### Filter 2: Trend Alignment (For Cross Signals Only)

**Rule**: Entry cross must align with 5m bias (trend-following)

- **Golden Cross (LONG)**:
  - ✅ Allowed if: `bias_5m === 'bullish'`
  - ❌ Rejected if: `bias_5m !== 'bullish'`

- **Death Cross (SHORT)**:
  - ✅ Allowed if: `bias_5m === 'bearish'`
  - ❌ Rejected if: `bias_5m !== 'bearish'`

**Exception**: Reversal setups (RSI extreme) bypass this filter (intentional counter-trend)

---

### Filter 3: Reversal Setup (No Trend Filter)

**Logic**: RSI extreme reversals are counter-trend by nature, so 5m bias filter is skipped. AI decides risk.

---

## 🤖 AI Decision Making (DeepSeek)

### Input Data

1. **Multi-Timeframe Technical Data**:
   - 15m: Regime, EMA50/200, RSI(14), cross status
   - 5m: Bias, EMA9/26, RSI(7), cross status
   - 1m: Entry setup, EMA9/26, RSI(7), volume force

2. **Fundamental Data**:
   - News events (High/Medium impact, US/EU/CN related)
   - Event timing and impact level

3. **Market Context**:
   - Current price, funding rate, open interest

---

### AI Decision Rules (Prompt-Based)

#### 1. Confluence Analysis (Flexible)

- **Priority 1**: 15m + 5m + 1m all aligned → **Confidence > 0.9**
- **Priority 2**: 15m sideways but 5m + 1m aligned → **Confidence 0.7-0.8**
- **Avoid**: 15m uptrend but 5m downtrend (counter-wave) → `NO_TRADE`

#### 2. Risk Management Constraints

- **LONG**: Avoid if RSI(1m) > 75 OR RSI(5m) > 75 (extreme overbought)
- **SHORT**: Avoid if RSI(1m) < 25 OR RSI(5m) < 25 (extreme oversold)
- **Volume**: Prefer setups with volume > 1.2x average

#### 3. Stop Loss & Take Profit Guidelines

- **Stop Loss**: ~0.6% from entry (below/above nearest support/resistance)
- **Take Profit**: ~0.9% from entry (R:R 1:1.5 to cover fees)
- **TP Priority**: Target EMA levels or next resistance/support

---

### AI Output Format

```json
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.0-1.0,
  "entry": <price_number>,
  "stop_loss_logic": "<description + price if available>",
  "take_profit_logic": ["<TP1 description>", "<TP2 description>"],
  "reason": "<Vietnamese explanation, numbered points>",
  "risk_warning": "<optional risk note>"
}
```

---

## ✅ Signal Validation (Post-AI)

### Final Filter: `isValidSignal()`

**Requirements**:

1. **Action Check**:
   - ✅ `action === 'LONG'` OR `action === 'SHORT'`
   - ❌ `action === 'NO_TRADE'` → Rejected (no alert)

2. **Confidence Threshold**:
   - ✅ `confidence >= 0.7` (70%)
   - ❌ `confidence < 0.7` → Rejected (low quality signal)

**Result**: Only signals passing both checks trigger Telegram alert and trade tracking

---

## 📈 Trade Plan Parsing

### Entry Price

- **Source**: AI `decision.entry` OR current market price (fallback)
- **Validation**: Must be finite number

### Stop Loss

**Parsing Logic**:
1. Extract numbers from `stop_loss_logic` text
2. Filter numbers near entry price (within 80%-120% range)
3. Select closest to entry (most likely actual price)
4. If no match, try range pattern (e.g., "86600-86650")
5. If still no match, try percentage pattern (e.g., "0.6%")
6. Fallback: `null` (no SL price, only description)

**Direction**:
- LONG: SL below entry
- SHORT: SL above entry

### Take Profit

**Parsing Logic**:
1. Extract numbers from each `take_profit_logic` array item
2. For LONG: Select TP closest to entry (above entry) from all TPs
3. For SHORT: Select TP closest to entry (below entry) from all TPs
4. This becomes the **primary TP target** for WIN/LOSS tracking

**Multiple TPs**: System tracks first TP hit (scalping optimized)

---

## 🎯 Trade Execution & Tracking

### Alert Generation

**When**: Signal passes `isValidSignal()` check

**Content**:
- Strategy name (SCALP_01 / SCALP_01_MANUAL)
- Token symbol
- Action (LONG/SHORT)
- Confidence percentage
- AI reasoning (formatted)
- Entry price
- Stop Loss (price + description)
- Take Profit levels (price + description)

**Note**: Bot does NOT auto-execute trades. User manually enters based on alert.

---

### Trade Tracking (WebSocket Monitor)

**Purpose**: Track hypothetical trade outcomes if user followed alert

**Mechanism**:
1. When signal is validated → Log to DB with `outcome = 'OPEN'`
2. Register trade in WebSocket monitor:
   - Symbol, action, entry price
   - Stop loss price, take profit price(s)
   - Creation timestamp

3. **Real-time Price Monitoring**:
   - Subscribe to Hyperliquid `allMids` WebSocket
   - Update on every price tick
   - Check WIN/LOSS conditions

**WIN Condition**:
- LONG: Price >= Take Profit
- SHORT: Price <= Take Profit

**LOSS Condition**:
- LONG: Price <= Stop Loss
- SHORT: Price >= Stop Loss

**TIMEOUT Condition**:
- Trade open > TTL (default: 60 minutes)
- Close at current mid price
- Mark as `TIMEOUT` outcome

---

## 📊 Performance Metrics

### Tracked Data

1. **Trade Logs** (PostgreSQL):
   - Strategy, symbol, timeframe
   - Entry price, SL price, TP prices
   - AI action, confidence, reasoning
   - Outcome: OPEN / WIN / LOSS / TIMEOUT
   - Close price, PnL percentage
   - Creation & close timestamps

2. **Market Snapshot**:
   - Full indicator values at signal time
   - News events context
   - AI full response (for debugging)

### Calculated Metrics

- **Win Rate**: `WIN / (WIN + LOSS)`
- **Average PnL**: Average profit/loss per trade
- **Max Win/Loss**: Largest profit and loss
- **Total PnL**: Cumulative performance

---

## 🔒 Safety Mechanisms

### 1. Symbol Lock

**Problem**: Prevent concurrent cycles for same symbol

**Solution**: Per-symbol mutex lock
- If symbol is busy → Skip cycle
- Prevents duplicate signals and API spam

### 2. HTTP Timeout

**Problem**: API calls hanging indefinitely

**Solution**:
- General APIs: 12s timeout
- DeepSeek AI: 120s timeout (AI processing takes longer)

### 3. Trade TTL

**Problem**: Trades stuck in OPEN state forever

**Solution**: Auto-close after 60 minutes (configurable)
- Prevents stale tracking
- Provides closure for analysis

### 4. Error Handling

**Problem**: API failures crashing bot

**Solution**:
- Graceful fallbacks (return `NO_TRADE` on error)
- Detailed error logging (timeout vs network vs API)
- Bot continues running even if one cycle fails

---

## 🎓 Strategy Philosophy

### Strengths

1. **Multi-Timeframe Confluence**: Reduces false signals by requiring alignment across 3 timeframes
2. **AI-Assisted**: Leverages LLM reasoning for complex market context (news, structure, confluence)
3. **Strict Filtering**: Pre-AI filters save costs; Post-AI filters ensure quality
4. **Scalping Optimized**: Tight SL/TP (0.6%/0.9%) for quick in/out
5. **Risk Management**: RSI extremes, trend alignment, volume confirmation

### Limitations

1. **Not Auto-Executing**: User must manually enter trades (intentional - no auto-trading risk)
2. **Mid Price Tracking**: WIN/LOSS based on mid price, not actual fill price (spread/slippage not accounted)
3. **Single TP Target**: Tracks first TP only (scalping style, not multi-TP trailing)
4. **AI Dependency**: Requires DeepSeek API availability (120s timeout, may fail on network issues)

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

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DATA COLLECTION                                           │
│    - Fetch 15m/5m/1m candles (Hyperliquid API)              │
│    - Fetch news events (High/Medium impact)                 │
│    - Get current price, funding rate                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. INDICATOR CALCULATION                                    │
│    - 15m: EMA50/200, RSI(14), regime detection              │
│    - 5m: EMA9/26, RSI(7), bias detection                    │
│    - 1m: EMA9/26, RSI(7), volume analysis                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TECHNICAL FILTER (Pre-AI)                                │
│    ✓ Entry cross OR RSI extreme reversal?                   │
│    ✓ If cross: Align with 5m bias?                          │
│    → If NO: Skip AI (save cost)                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AI ANALYSIS (DeepSeek)                                    │
│    - Input: All indicators + news + context                 │
│    - Output: action, confidence, entry, SL, TP, reason      │
│    - Timeout: 120s                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. SIGNAL VALIDATION (Post-AI)                              │
│    ✓ action === LONG/SHORT?                                 │
│    ✓ confidence >= 0.7?                                     │
│    → If NO: Log but no alert                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. PLAN PARSING                                              │
│    - Extract entry price (AI or market)                      │
│    - Parse SL price from text                                │
│    - Parse TP prices from array (select primary target)      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. LOG & TRACK                                               │
│    - Save to DB (outcome = OPEN)                            │
│    - Register in WS monitor                                 │
│    - Send Telegram alert                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. REAL-TIME MONITORING (WebSocket)                          │
│    - Subscribe to allMids (Hyperliquid)                     │
│    - Check WIN: Price hits TP                                │
│    - Check LOSS: Price hits SL                               │
│    - Check TIMEOUT: >60min open                              │
│    - Update DB: outcome, close_price, pnl_percent          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 References

- **Technical Indicators**: `technicalindicators` library (RSI, EMA, ATR)
- **Data Source**: Hyperliquid API (candles, meta, WebSocket)
- **AI Model**: DeepSeek Chat (via API)
- **News Source**: Divine Insight API (economic events)

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Strategy Code**: `SCALP_01`

