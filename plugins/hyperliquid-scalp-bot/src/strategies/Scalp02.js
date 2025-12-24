import { BaseStrategy } from './BaseStrategy.js'

export class Scalp02 extends BaseStrategy {
    constructor() {
        super('SCALP_02')
    }

    checkConditions(signal) {
        // SCALP_02 Implementation based on SRS v1.0
        // Philosophy: Trade Continuation, Not Prediction.

        // -----------------------------------------
        // 1. 15-Minute Chart – Market Regime Filter
        // -----------------------------------------
        const isBullRegime = signal.regime_15m === 'trending_bull' && signal.regime_ema50 > signal.regime_ema200
        const isBearRegime = signal.regime_15m === 'trending_bear' && signal.regime_ema50 < signal.regime_ema200

        // Nếu không phải Trend rõ ràng -> Bỏ qua
        if (!isBullRegime && !isBearRegime) return false

        // -----------------------------------------
        // 2. 5-Minute Chart – Trend Strength Validation
        // -----------------------------------------
        // Bias must match Regime
        if (isBullRegime && signal.bias_5m !== 'bullish') return false
        if (isBearRegime && signal.bias_5m !== 'bearish') return false

        // RSI Filter (Trend Strength)
        // - LONG: RSI_7 >= 55
        // - SHORT: RSI_7 <= 45
        if (isBullRegime && signal.bias_rsi7 < 55) return false
        if (isBearRegime && signal.bias_rsi7 > 45) return false

        // (Optional) Min Trend Distance |EMA9 - EMA26|
        // Tạm thời bỏ qua hard check khoảng cách giá, vì RSI strength đã cover phần momentum.

        // -----------------------------------------
        // 3. 1-Minute Chart – Continuation Eligibility
        // -----------------------------------------

        // RSI Zones check
        const rsi1m = signal.entry_rsi7
        if (rsi1m > 90 || rsi1m < 10) return false // Reject extremes

        // LONG Setup
        if (isBullRegime) {
            // RSI Continuation Zone: 60-85 (SRS)
            // Tuy nhiên, logic Entry là bắt "Pullback to EMA".
            // Khi Pullback, RSI thường sẽ dip xuống thấp hơn zone continuation một chút rồi hồi lên.
            // SRS Step 1: "RSI cools from >70 -> 45-55"
            // SRS Step 2 (Entry): "Trigger... Close back above EMA9"

            // Điều kiện 1: Giá đang nằm trên EMA26 (Structure hold)
            if (signal.entry_close_1m < signal.entry_ema26) return false

            // Điều kiện 2: Trigger - Price nằm trên EMA9 HOẶC vừa cắt lên EMA9
            const priceAboveEma9 = signal.entry_close_1m > signal.entry_ema9
            if (!priceAboveEma9) return false

            // RSI check cho điểm Entry: Không dùng RSI Continuation Zone cứng nhắc (60-85) mà dùng RSI hợp lệ để vào lệnh (không quá cao)
            // Nếu RSI > 80 thì risk cao -> Skip
            if (rsi1m > 80) return false

            return true
        }

        // SHORT Setup
        if (isBearRegime) {
            // Structure hold
            if (signal.entry_close_1m > signal.entry_ema26) return false

            // Trigger
            const priceBelowEma9 = signal.entry_close_1m < signal.entry_ema9
            if (!priceBelowEma9) return false

            // RSI check
            if (rsi1m < 20) return false

            return true
        }

        return false
    }

    buildAiPrompt(signal) {
        const atrValue = signal.entry_atr || signal.bias_atr || 0
        const volatilityState = (atrValue / signal.price * 100 > 0.5) ? 'High' : 'Normal'

        return `
Strategy: SCALP_02 (Trend Continuation)
Role: Senior Crypto Trader.
Objective: Capture momentum in strong trends.

MARKET DATA (${signal.symbol}):

1. 15M (Regime):
- Trend: ${signal.regime_15m} (EMA50 vs EMA200)
- RSI_14: ${signal.regime_rsi14}

2. 5M (Strength):
- Bias: ${signal.bias_5m}
- RSI_7: ${signal.bias_rsi7} (Bull >= 55, Bear <= 45)

3. 1M (Entry Trigger):
- Price: ${signal.entry_close_1m}
- EMA9: ${signal.entry_ema9} | EMA26: ${signal.entry_ema26}
- RSI_7: ${signal.entry_rsi7}
- ATR_1m: ${atrValue}
- Volume Force: ${signal.entry_vol_ratio}x

REQUIRED ANALYSIS:
1. Is the 15M trend clean? (No choppy price action)
2. Is the 1M pullback resolved? (Price reclaimed EMA9?)
3. Risk Calculation (Use ATR 1m):
   - SL = Price +/- (1.0 * ATR) (Tight Stop)
   - TP = Price +/- (2.0 * ATR) (Target 2R)

QUAN TRỌNG - FORMAT REASON:
- Luôn dùng format RSI_7, RSI_14 (dấu gạch dưới, KHÔNG dùng ngoặc đơn)
- Ví dụ: "RSI_7 = 65.08 cho thấy momentum mạnh"
- KHÔNG viết RSI(7) hoặc RSI 7 hoặc 7.=

OUTPUT JSON:
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.75-0.95,
  "entry": ${signal.entry_close_1m},
  "stop_loss_logic": "Value (e.g. ${signal.entry_close_1m} - ${atrValue})",
  "take_profit_logic": ["Value (e.g. ${signal.entry_close_1m} + ${2 * atrValue})"],
  "reason": "Explain WHY this momentum is valid. Mention RSI_7 strength & Pullback hold. (dùng RSI_7 format)",
  "risk_warning": "Warning if ATR is too high"
}
`
    }
}
