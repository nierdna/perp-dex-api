
# BTC Swing Trigger Bot – SRS v1.2 (Stability First + DeepSeek Reviewer)

## 1. Mục tiêu hệ thống

Xây dựng bot **Swing Trigger cho BTC**:
- Không auto trade
- Không entry / SL / TP
- Chỉ phát hiện điều kiện swing-grade
- Gửi trigger cho trader quyết định
- Ưu tiên ổn định, ít nhiễu, dùng lâu dài

Bot đóng vai **Senior Trading Assistant**, AI chỉ là lớp review.

---

## 2. Data Source

- Provider: Hyperliquid
- Asset: BTC
- Timeframes:
  - HTF: 1D, 4H
  - LTF: 1H, 30M

```ts
Candle {
  timestamp
  open
  high
  low
  close
  volume
}
```

---

## 3. High-Level Flow

Hyperliquid Candles
→ Market Regime Engine (Hard Gate)
→ Bias Engine (Locked)
→ HTF Zone Watcher (Frozen)
→ Setup Analyzer (Mature Only)
→ LTF Confirmation (Debounce)
→ Trigger Scoring
→ DeepSeek AI Reviewer
→ Human Alert

---

## 4. Market Regime Engine

Output:
TREND_UP | TREND_DOWN | RANGE | TRANSITION

Logic:
- TREND_UP: Close > EMA200 + HH/HL
- TREND_DOWN: Close < EMA200 + LH/LL
- RANGE: Vol thấp + structure phẳng

Stability:
- Regime chỉ đổi nếu giữ >= 3–5 candle 4H

---

## 5. Bias Engine

TREND_UP   → LONG_ONLY  
TREND_DOWN → SHORT_ONLY  
Else       → NO_TRADE  

Bias bị lock 24–48h, không flip trong ngày.

---

## 6. HTF Zone Watcher

Zone Types:
- DEMAND
- SUPPLY
- EMA_RETEST
- RANGE_EDGE

Zone bị freeze cho đến khi:
- Close HTF phá zone
- Hoặc regime đổi

---

## 7. Setup Analyzer

States:
FORMING → MATURE → STALE / FAILED

FORMING:
- Chạm HTF zone
- HTF structure intact
- Volume pullback giảm

MATURE:
- Tồn tại >= 2–3 candle 4H

STALE:
- > 6–10 candle 4H không expansion

---

## 8. LTF Confirmation

Theo dõi:
- BOS 1H / 30M
- EMA50 / VWAP reclaim
- Volume expansion

Rule:
- BOS phải được confirm bởi >= 2 close (không dùng wick)

---

## 9. Trigger Scoring

Weight:
- Regime: 30
- HTF Zone: 30
- Structure: 25
- LTF: 10
- Momentum: 5

Threshold:
- <70 Ignore
- 70–79 Watch
- >=80 Swing-grade

---

## 10. DeepSeek AI Reviewer (Senior Trader)

### Khi nào gọi AI
- Trigger score >= 80
- Regime != TRANSITION
- Setup = MATURE

### Prompt DeepSeek – Senior Trader Reviewer

SYSTEM PROMPT:

You are a senior discretionary swing trader with over 15 years of experience trading BTC and crypto macro markets.

Your role:
- Act as a trade reviewer, not a signal generator
- Evaluate whether current market conditions justify *consideration* of a swing trade
- Think in terms of market regime, structure, liquidity, and time

Strict rules:
- DO NOT provide entry price, stop loss, take profit, leverage, or position size
- DO NOT predict exact price targets
- DO NOT override the human trader
- Use calm, conservative, professional tone
- Default to WAIT if conditions are not clearly favorable

You must prioritize capital preservation over opportunity.

USER INPUT FORMAT (JSON):

{
  "regime": "...",
  "bias": "...",
  "htf_zone": "...",
  "setup_state": "...",
  "ltf_confirmation": true/false,
  "trigger_score": number,
  "recent_price_action": "..."
}

YOUR OUTPUT FORMAT (STRICT JSON):

{
  "verdict": "CONSIDER | WAIT | AVOID",
  "confidence": 0-100,
  "reasoning": "short professional reasoning",
  "invalidation_note": "what would clearly invalidate this idea"
}

If information is insufficient or mixed, respond with:
verdict = WAIT

---

## 11. Alert Format

BTC – Swing Trigger Alert

Regime: TREND_UP (4H)
Bias: LONG_ONLY
HTF Zone: Demand 41k–42k (4/5)
Setup: MATURE
LTF: BOS 1H confirmed
Trigger Score: 82/100

AI View: CONSIDER (78%)
Note: HTF structure intact, pullback healthy.

This is NOT a trade signal. Trader decides execution and risk.

---

## 12. Cooldown & Spam Control

- Per zone: 12–24h
- Per setup: 24–48h
- Global: max 2–3 alerts/day

---

## 13. Fail-safe

- Hyperliquid lỗi → giữ state cũ, không trigger mới
- DeepSeek lỗi → gửi alert không AI
- Không block hệ thống

---

## 14. Metrics (Bắt buộc log)

- triggers_per_day
- avg_trigger_score
- regime_changes_per_week
- ai_call_rate
- suppressed_triggers

---

## 15. Non-goals

- Auto trade
- Backtest
- Entry optimization
- Indicator spam

---

Version: v1.2 – Stability + AI Reviewer Prompt Included
