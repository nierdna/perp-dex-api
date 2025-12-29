# SCALP_03 Strategy - Logic Flow Documentation

## 📋 Executive Summary

**Strategy Name**: SCALP_03  
**Type**: Multi-Timeframe Scalping with AI-Assisted Decision Making (Enhanced)  
**Timeframe**: 15m (Regime) → 5m (Bias) → 1m (Entry)  
**Target**: Short-term price movements with >70% win probability  
**Risk/Reward**: Dynamic ATR-based (SL = 1.5×ATR, TP = 2.0×ATR, ~1.33R) or Fixed (SL ~0.6%, TP ~0.9%)

---

## 🎯 Strategy Objectives

1. **Capture short-term momentum** using multi-timeframe confluence
2. **Minimize false signals** through strict technical filters + AI validation + post-AI hard rules
3. **Optimize risk/reward** with ATR-based dynamic SL/TP that adapts to volatility
4. **Adapt to market conditions** via AI analysis + volatility regime awareness
5. **Prevent extreme entries** with RSI guardrails and volume confirmation

---

## 📊 Multi-Timeframe Analysis Framework

### 1. 15-Minute Chart (Market Regime)

**Purpose**: Identify overall market trend and major structure

**Indicators**:
- **EMA50 vs EMA200**: Long-term trend direction
  - `EMA50 > EMA200` → Bullish regime
  - `EMA50 < EMA200` → Bearish regime
  - Crossover detection: Golden Cross (bullish) / Death Cross (bearish)
- **RSI_14**: Overbought/Oversold levels (format: underscore, not parentheses)
  - >70: Overbought
  - <30: Oversold

**Regime States**:
- `trending_bull`: Uptrend (EMA50 > EMA200)
- `trending_bear`: Downtrend (EMA50 < EMA200)
- `ranging`: Sideways (no clear trend)

**Usage**: Context filter - counter-trend trades allowed only with strong reversal conditions

---

### 2. 5-Minute Chart (Bias & Structure)

**Purpose**: Identify intermediate wave structure and bias direction

**Indicators**:
- **EMA9 vs EMA26**: Short-term trend bias
  - `EMA9 > EMA26` → Bullish bias
  - `EMA9 < EMA26` → Bearish bias
  - Crossover detection for trend changes
- **RSI_7**: Short-term momentum (format: underscore, not parentheses)
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
- **RSI_7**: Entry momentum confirmation (format: underscore, not parentheses)
- **Volume Analysis**: Entry force validation
  - `vol_ratio >= 3.0` → Ultra high volume
  - `vol_ratio >= 1.5` → High volume
  - `vol_ratio < 0.8` → Low volume
- **ATR(14)**: Volatility measurement for dynamic SL/TP

**Entry States**:
- `long_ready`: EMA9 > EMA26 (potential LONG)
- `short_ready`: EMA9 < EMA26 (potential SHORT)
- `wait`: No clear setup

**Usage**: Primary entry trigger - must have clear cross signal or extreme RSI reversal

---

## 🔍 Technical Filter Logic (Pre-AI Screening)

### Filter 0: Volatility Regime Filter (NEW)

**Purpose**: Adapt filters based on market volatility conditions

**Volatility Regime Detection**:
- Calculate ATR% = (ATR / price) × 100
- **HIGH**: ATR% > 1.0
- **NORMAL**: 0.5 < ATR% ≤ 1.0
- **LOW**: ATR% ≤ 0.5

**Filter Adjustments**:
- **HIGH volatility**: Require `vol_ratio >= 1.0` (stricter to avoid noise)
- **NORMAL/LOW**: Use standard volume filters

---

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

### Filter 2: RSI Guardrails for Reversal Setup (NEW)

**Purpose**: Prevent false reversal entries at extreme RSI levels

**Rules**:
- **LONG reversal** (`long_ready`): Reject if `entry_rsi7 < 15` (too extreme, likely false reversal)
- **SHORT reversal** (`short_ready`): Reject if `entry_rsi7 > 85` (too extreme, likely false reversal)

**Rationale**: RSI < 15 or > 85 indicates extreme exhaustion, not a good reversal entry point. Better to wait for RSI to recover from extreme levels.

---

### Filter 3: Volume Check for Reversal Setup (NEW)

**Purpose**: Ensure reversal setups have volume confirmation

**Rule**: Reversal setup requires `entry_vol_ratio >= 0.5` (stricter than cross signals)

**Rationale**: Reversals need stronger volume confirmation than trend-following signals to avoid false reversals in low-volume conditions.

---

### Filter 4: Trend Alignment (For Cross Signals Only)

**Rule**: Entry cross must align with 5m bias (trend-following)

- **Golden Cross (LONG)**:
  - ✅ Allowed if: `bias_5m === 'bullish'`
  - ❌ Rejected if: `bias_5m !== 'bullish'`

- **Death Cross (SHORT)**:
  - ✅ Allowed if: `bias_5m === 'bearish'`
  - ❌ Rejected if: `bias_5m !== 'bearish'`

**Exception**: Reversal setups (RSI extreme) bypass this filter (intentional counter-trend)

---

### Filter 5: Counter-Trend Filter (Enhanced - NEW)

**Purpose**: Allow counter-trend trades only with strong reversal conditions

**Default Rule**: Reject counter-trend cross signals
- `golden_cross` + `regime_15m === 'trending_bear'` → Reject
- `death_cross` + `regime_15m === 'trending_bull'` → Reject

**Exceptions** (Allow counter-trend if ANY condition met):
1. **RSI Extreme**: `entry_rsi7 < 20` (LONG) or `entry_rsi7 > 80` (SHORT)
2. **Volume Spike**: `entry_vol_ratio >= 2.0`
3. **HTF Zone Support/Resistance**: HTF zone strength >= 3
4. **Weak HTF Trend**: HTF trigger_score < 50

**Rationale**: Strong reversals can occur at tops/bottoms. These conditions indicate genuine reversal potential rather than random counter-trend noise.

---

### Filter 6: RSI Risk Guardrails (For Cross Signals Only)

**Rule**: Avoid entries at extreme RSI levels

- **Golden Cross (LONG)**: Reject if `entry_rsi7 > 75` OR `bias_rsi7 > 75`
- **Death Cross (SHORT)**: Reject if `entry_rsi7 < 25` OR `bias_rsi7 < 25`

**Exception**: Reversal setups bypass this (they are designed for extreme RSI)

---

### Filter 7: Volume Sanity Check (For Cross Signals)

**Rule**: Reject ultra-low volume cross signals

- Reject if `entry_vol_ratio < 0.3` (extreme low volume = false breakout risk)

---

## 🤖 AI Decision Making (DeepSeek)

### Input Data

1. **Multi-Timeframe Technical Data**:
   - 15m: Regime, EMA50/200, RSI_14, cross status
   - 5m: Bias, EMA9/26, RSI_7, cross status
   - 1m: Entry setup, EMA9/26, RSI_7, volume force, ATR

2. **HTF Context (Swing Data)**:
   - HTF Regime, Bias, Zone (type, price range, strength)
   - Zone Proximity (AT_ZONE, NEAR_ZONE, FAR_FROM_ZONE)
   - Trend Alignment (ALIGNED, DIVERGENT, NEUTRAL)
   - Trigger Score, Last Updated timestamp

3. **Fundamental Data**:
   - News events (High/Medium impact, US/EU/CN related)
   - Event timing and impact level

4. **Market Context**:
   - Current price, funding rate, open interest

---

### AI Decision Rules (Prompt-Based)

#### 1. Confluence Analysis (Flexible)

- **Priority 1**: 15m + 5m + 1m all aligned → **Confidence > 0.9**
- **Priority 2**: 15m sideways but 5m + 1m aligned → **Confidence 0.7-0.8**
- **Avoid**: 15m uptrend but 5m downtrend (counter-wave) → `NO_TRADE`

#### 2. HTF Context Integration

- **ALIGNED** (HTF and Scalp same direction): Confidence +10-15%
- **DIVERGENT** (HTF and Scalp opposite):
  - HTF trigger_score > 70 → Avoid or reduce confidence -20%
  - HTF trigger_score < 50 → May allow counter-trend with reversal setup
- **AT_ZONE** (Price at HTF Demand/Supply):
  - Same direction as zone → Confidence +15%
  - Opposite direction → Reduce confidence -10%

#### 3. Risk Management Constraints

- **LONG**: Avoid if RSI_7 (1m) > 75 OR RSI_7 (5m) > 75 (extreme overbought)
- **SHORT**: Avoid if RSI_7 (1m) < 25 OR RSI_7 (5m) < 25 (extreme oversold)
- **Volume**: Prefer setups with volume > 1.2x average
- **Volatility**: In HIGH volatility, require stronger volume confirmation

---

## ✅ Post-AI Hard Rule Validation (NEW)

### `validateDecision()` Method

**Purpose**: Override AI decision if it violates core scalping rules

**Hard Rules**:

1. **SHORT with RSI_7 < 25**:
   - Override: `action = NO_TRADE`
   - Reason: "RSI_7 quá bán, short tại đáy LTF = short squeeze risk cực cao"
   - Confidence: Set to 0

2. **LONG with RSI_7 > 75**:
   - Override: `action = NO_TRADE`
   - Reason: "RSI_7 quá mua, long tại đỉnh LTF = long squeeze risk cực cao"
   - Confidence: Set to 0

**Rationale**: Even if AI suggests a trade, these extreme RSI levels are too risky for scalping. Better to wait for RSI to normalize.

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

### Stop Loss (ATR-Based - NEW)

**Primary Method (ATR Available)**:
- **SL = entry ± (1.5 × ATR_1m)**
- Rationale: 1.5×ATR provides tight scalping stop that adapts to volatility
- High volatility → Wider SL (avoids noise stop-outs)
- Low volatility → Tighter SL (optimizes R:R)

**Fallback Method (ATR Not Available)**:
- **SL = entry ± 0.6%** (fixed percentage)
- Used when ATR data is missing

**Direction**:
- LONG: SL below entry
- SHORT: SL above entry

### Take Profit (ATR-Based - NEW)

**Primary Method (ATR Available)**:
- **TP = entry ± (2.0 × ATR_1m)**
- **R:R Ratio**: ~1.33:1 (TP = 2.0×ATR, SL = 1.5×ATR)
- Rationale: 2.0×ATR target adapts to volatility while maintaining good R:R

**Fallback Method (ATR Not Available)**:
- **TP = entry ± 0.9%** (fixed percentage)
- Used when ATR data is missing

**Multiple TPs**: System tracks first TP hit (scalping optimized)

---

## 🎯 Trade Execution & Tracking

### Alert Generation

**When**: Signal passes `isValidSignal()` check AND post-AI validation

**Content**:
- Strategy name (SCALP_03)
- Token symbol
- Action (LONG/SHORT)
- Confidence percentage
- AI reasoning (formatted)
- Entry price
- Stop Loss (price + description, ATR-based if available)
- Take Profit levels (price + description, ATR-based if available)
- HTF Context (if available)

**Note**: Bot does NOT auto-execute trades. User manually enters based on alert.

---

## 🔒 Safety Mechanisms

### 1. Symbol Lock
- Prevent concurrent cycles for same symbol
- Per-symbol mutex lock

### 2. HTTP Timeout
- General APIs: 12s timeout
- DeepSeek AI: 120s timeout

### 3. Trade TTL
- Auto-close after 60 minutes (configurable)

### 4. Error Handling
- Graceful fallbacks (return `NO_TRADE` on error)
- Detailed error logging
- Bot continues running even if one cycle fails

### 5. Post-AI Hard Rules (NEW)
- Override AI decision if violates RSI extreme rules
- Prevents short at bottom / long at top scenarios

---

## 🎓 Strategy Philosophy

### Strengths

1. **Multi-Timeframe Confluence**: Reduces false signals by requiring alignment across 3 timeframes
2. **AI-Assisted**: Leverages LLM reasoning for complex market context
3. **Strict Filtering**: Pre-AI filters save costs; Post-AI filters + hard rules ensure quality
4. **ATR-Based Risk Management**: Dynamic SL/TP adapts to volatility conditions
5. **Volatility Awareness**: Filters adjust based on market volatility regime
6. **HTF Context Integration**: Uses Swing data for better decision making
7. **Hard Rule Protection**: Post-AI validation prevents extreme RSI entries

### Limitations

1. **Not Auto-Executing**: User must manually enter trades
2. **Mid Price Tracking**: WIN/LOSS based on mid price, not actual fill price
3. **Single TP Target**: Tracks first TP only (scalping style)
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

## 📦 Versioning

**Document Version**: 2.0  
**Last Updated**: 2025-12-26  
**Strategy Code**: `SCALP_03`

### Changelog v2.0 (Leader Trader Review Improvements)

#### Critical Fixes:
- **RSI Guardrails for Reversal Setup**: Added rejection for RSI < 15 (long_ready) and RSI > 85 (short_ready)
- **Volume Check for Reversal Setup**: Require vol_ratio >= 0.5 (stricter than cross signals)
- **ATR-Based SL/TP**: Dynamic risk management (SL = 1.5×ATR, TP = 2.0×ATR)
- **Post-AI Hard Rules**: Override AI decision if RSI < 25 (SHORT) or RSI > 75 (LONG)

#### High Priority Improvements:
- **Relax Counter-Trend Filter**: Allow counter-trend with strong reversal conditions (RSI extreme, volume spike, HTF zone, weak HTF score)
- **Volatility Regime Filter**: Adapt filters based on HIGH/NORMAL/LOW volatility (HIGH requires vol_ratio >= 1.0)
- **HTF Context Integration**: Enhanced AI prompt with Swing data (regime, bias, zone, alignment, proximity)

### Changelog v1.1 (Previous)
- **RSI Format**: Updated to RSI_7, RSI_14 (underscore format)
- **AI Prompt**: AI instructed to use RSI_7 format in responses

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DATA COLLECTION                                           │
│    - Fetch 15m/5m/1m candles (Hyperliquid API)              │
│    - Fetch news events (High/Medium impact)                 │
│    - Get Swing HTF context (if available)                   │
│    - Get current price, funding rate, ATR                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. INDICATOR CALCULATION                                    │
│    - 15m: EMA50/200, RSI_14, regime detection              │
│    - 5m: EMA9/26, RSI_7, bias detection                    │
│    - 1m: EMA9/26, RSI_7, volume analysis, ATR              │
│    - Volatility regime detection (HIGH/NORMAL/LOW)          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TECHNICAL FILTER (Pre-AI)                                │
│    ✓ Volatility regime check (HIGH requires vol >= 1.0)    │
│    ✓ Entry cross OR RSI extreme reversal?                   │
│    ✓ RSI guardrails for reversal (reject extreme <15/>85)  │
│    ✓ Volume check for reversal (require >= 0.5)            │
│    ✓ If cross: Align with 5m bias?                          │
│    ✓ Counter-trend: Strong reversal conditions?            │
│    → If NO: Skip AI (save cost)                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AI ANALYSIS (DeepSeek)                                   │
│    - Input: All indicators + news + HTF context            │
│    - Output: action, confidence, entry, SL, TP, reason      │
│    - Timeout: 120s                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. POST-AI HARD RULE VALIDATION (NEW)                        │
│    ✓ SHORT with RSI < 25? → Override to NO_TRADE           │
│    ✓ LONG with RSI > 75? → Override to NO_TRADE            │
│    → Prevents extreme entries                               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. SIGNAL VALIDATION (Post-AI)                              │
│    ✓ action === LONG/SHORT?                                 │
│    ✓ confidence >= 0.7?                                     │
│    → If NO: Log but no alert                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. PLAN PARSING (ATR-Based)                                 │
│    - Extract entry price (AI or market)                     │
│    - Calculate SL = 1.5×ATR (or 0.6% fallback)               │
│    - Calculate TP = 2.0×ATR (or 0.9% fallback)              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. LOG & TRACK                                               │
│    - Save to DB (outcome = OPEN)                            │
│    - Register in WS monitor                                 │
│    - Send Telegram alert                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. REAL-TIME MONITORING (WebSocket)                         │
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
- **HTF Context**: Swing01 strategy cache

