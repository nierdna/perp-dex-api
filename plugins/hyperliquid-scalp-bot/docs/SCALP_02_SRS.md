# SCALP_02 Strategy – SRS & Logic Flow Documentation

## 📋 Executive Summary

**Strategy Name**: SCALP_02  
**Type**: Trend-Continuation Scalping Engine  
**Timeframe**: 15m (Regime) → 5m (Trend Strength) → 1m (Pullback Entry)  
**Objective**: Capture momentum continuation in strong trends  
**Trade Style**: Fast in – fast out (3–10 minutes)  
**Risk Model**: ATR-based dynamic risk (NOT fixed %)  
**Execution**: Signal-only (manual execution)

---

## 🎯 Strategy Philosophy

> “SCALP_02 trades continuation, not prediction.”

SCALP_02 is designed to:
- Trade **only strong trends**
- Exploit **RSI extreme continuation**
- Avoid sideways / chop markets
- Complement SCALP_01 (mean-reversion / clean setup engine)

---

## 🚫 Non-Goals

- No counter-trend trading
- No reversal catching
- No sideway range scalping
- No EMA-cross dependency

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
- |EMA9 − EMA26| ≥ min_trend_distance

**RSI Filter** (Updated: Loosened for better signal frequency)
- LONG: RSI_7 ≥ 50 (was 55, now more flexible)
- SHORT: RSI_7 ≤ 50 (was 45, now more flexible)

---

### 3️⃣ 1-Minute Chart – Continuation Eligibility

**Purpose**: Ensure move is not exhausted or reversing.

**RSI Continuation Zone**
- LONG: RSI_7 60–85
- SHORT: RSI_7 15–40

**Invalid Conditions**
- RSI_7 > 90 or < 10
- Any bullish/bearish divergence

---

## 🎯 Entry Logic (1-Minute)

### Step 1: Pullback & Hold Structure

**LONG**
- Pullback to EMA9/EMA26
- No candle close below EMA26
- RSI_7 cools from >70 → 45–55

**SHORT**
- Pullback to EMA9/EMA26
- No candle close above EMA26
- RSI_7 recovers from <30 → 45–55

---

### Step 2: Re-Entry Trigger (ANY ONE)

**Trigger A – Micro Breakout**
- Break recent high (LONG) / low (SHORT)
- Close back above EMA9 (LONG) / below EMA9 (SHORT)

**Trigger B – Volume Follow-through**
- Volume ≥ 1.1x average
- No abnormal spread expansion

---

## 🤖 AI Confirmation (Trend Mode)

**AI Role**: Trend Continuation Trader

**Rules**
- LONG only in bull regime
- SHORT only in bear regime
- Reject late RSI_7 (too high/low)
- Reject abnormal volume
- Reject high-impact news proximity

**Note**: AI output uses RSI_7 format (underscore), not RSI(7)

**Confidence**
- Clean continuation: 0.75–0.9
- < 0.7 → reject

---

## 🛡 Risk Management

**Stop Loss**
- SL = entry ± (0.8–1.2) × ATR(1m)

**Take Profit**
- TP = 1.3–1.6 × risk

---

## ⏱ Exit Rules

- TP hit → WIN
- SL hit → LOSS
- RSI_7 loses continuation → CLOSE
- > 60 minutes (TTL) → TIMEOUT (auto-close at current price)

---

## 🔄 Dispatcher Integration

- TREND_STRONG → enable SCALP_02
- RANGE / CHOP → disable SCALP_02

Never run SCALP_01 and SCALP_02 simultaneously on the same symbol.

---

## 🧩 End-to-End Flow

START → Regime Check → Trend Strength → RSI Continuation → Pullback → Re-entry Trigger → AI Validation → Alert → Track → Exit

---

## 📦 Versioning

Document Version: 1.1  
Last Updated: 2025-01-XX  
Status: Production-ready  
Designed to run alongside SCALP_01

### Changelog v1.1
- **RSI Filter Loosened**: Changed from RSI_7 ≥ 55/≤ 45 to ≥ 50/≤ 50 for better signal frequency
- **RSI Format**: Updated to RSI_7 (underscore) format throughout documentation
- **TTL Added**: Trades auto-close after 60 minutes if TP/SL not hit
- **Price Fallback**: Added fallback to `signal.price` if `entry_close_1m` not available
