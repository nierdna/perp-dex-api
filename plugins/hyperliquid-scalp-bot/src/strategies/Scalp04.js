import { BaseStrategy } from './BaseStrategy.js'
import { parsePlan } from '../utils/parsePlan.js'
import { getSwingData, getEnhancedSwingData } from '../data/swingDataCache.js'

export class Scalp04 extends BaseStrategy {
    constructor() {
        super('SCALP_04')
    }

    /**
     * Get volatility regime based on ATR percentage
     * @param {number} atr - ATR value
     * @param {number} price - Current price
     * @returns {string} - 'HIGH', 'NORMAL', 'LOW', or 'UNKNOWN'
     */
    getVolatilityRegime(atr, price) {
        if (!atr || !price || price <= 0) return 'UNKNOWN'
        const atrPct = (atr / price) * 100
        if (atrPct > 1.0) return 'HIGH'
        if (atrPct > 0.5) return 'NORMAL'
        return 'LOW'
    }

    checkConditions(signal) {
        // SCALP_04 Implementation based on SRS v1.0
        // Philosophy: Trade Continuation, Not Prediction.

        // Volatility regime filter (adjust filters based on volatility)
        const atr = signal.entry_atr || signal.bias_atr || 0
        const volRegime = this.getVolatilityRegime(atr, signal.price)
        
        // In HIGH volatility, require stronger volume (avoid noise)
        if (volRegime === 'HIGH') {
            const volRatio = Number(signal.entry_vol_ratio)
            if (Number.isFinite(volRatio) && volRatio < 1.0) return false // Stricter volume requirement
        }

        // Fallback: entry_close_1m = price nếu không có
        const entryClose = signal.entry_close_1m || signal.price

        // -----------------------------------------
        // 1. 15-Minute Chart – Market Regime Filter
        // -----------------------------------------
        const isBullRegime = signal.regime_15m === 'trending_bull' && signal.regime_ema50 > signal.regime_ema200
        const isBearRegime = signal.regime_15m === 'trending_bear' && signal.regime_ema50 < signal.regime_ema200

        // Nếu không phải Trend rõ ràng -> Bỏ qua
        if (!isBullRegime && !isBearRegime) {
            // console.log(`[SCALP_04] Rejected: No clear trend (regime=${signal.regime_15m})`)
            return false
        }

        // -----------------------------------------
        // 2. 5-Minute Chart – Trend Strength Validation
        // -----------------------------------------
        // Bias must match Regime
        if (isBullRegime && signal.bias_5m !== 'bullish') {
            // console.log(`[SCALP_04] Rejected: Bull regime but 5m bias=${signal.bias_5m}`)
            return false
        }
        if (isBearRegime && signal.bias_5m !== 'bearish') {
            // console.log(`[SCALP_04] Rejected: Bear regime but 5m bias=${signal.bias_5m}`)
            return false
        }

        // RSI Filter (Trend Strength) - Require stronger momentum
        // - LONG: RSI_7 >= 55 (was 50, now stricter)
        // - SHORT: RSI_7 <= 45 (was 50, now stricter)
        if (isBullRegime && signal.bias_rsi7 < 55) {
            // console.log(`[SCALP_04] Rejected: Bull regime but RSI_7=${signal.bias_rsi7} < 55`)
            return false
        }
        if (isBearRegime && signal.bias_rsi7 > 45) {
            // console.log(`[SCALP_04] Rejected: Bear regime but RSI_7=${signal.bias_rsi7} > 45`)
            return false
        }

        // 2.5 Volume Confirmation for Continuation
        const volRatio = Number(signal.entry_vol_ratio)
        if (Number.isFinite(volRatio) && volRatio < 0.8) {
            return false // Continuation requires volume confirmation
        }

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
            if (entryClose < signal.entry_ema26) {
                // console.log(`[SCALP_04] Rejected LONG: Price ${entryClose} < EMA26 ${signal.entry_ema26}`)
                return false
            }

            // Check for late entry (price too far from EMA26)
            const distanceFromEma26 = Math.abs(entryClose - signal.entry_ema26) / signal.entry_ema26
            if (distanceFromEma26 > 0.02) {  // > 2% = late entry
                return false
            }

            // Điều kiện 2: Trigger - Price nằm trên EMA9 HOẶC vừa cắt lên EMA9
            const priceAboveEma9 = entryClose > signal.entry_ema9
            if (!priceAboveEma9) {
                // console.log(`[SCALP_04] Rejected LONG: Price ${entryClose} <= EMA9 ${signal.entry_ema9}`)
                return false
            }

            // RSI check cho điểm Entry: Không dùng RSI Continuation Zone cứng nhắc (60-85) mà dùng RSI hợp lệ để vào lệnh (không quá cao)
            // Nếu RSI > 80 thì risk cao -> Skip
            if (rsi1m > 80) {
                // console.log(`[SCALP_04] Rejected LONG: RSI_7=${rsi1m} > 80 (too high)`)
                return false
            }

            // console.log(`[SCALP_04] ✅ LONG Setup passed: Price=${entryClose}, EMA9=${signal.entry_ema9}, EMA26=${signal.entry_ema26}, RSI_7=${rsi1m}`)
            return true
        }

        // SHORT Setup
        if (isBearRegime) {
            // Structure hold
            if (entryClose > signal.entry_ema26) {
                // console.log(`[SCALP_04] Rejected SHORT: Price ${entryClose} > EMA26 ${signal.entry_ema26}`)
                return false
            }

            // Check for late entry (price too far from EMA26)
            const distanceFromEma26 = Math.abs(entryClose - signal.entry_ema26) / signal.entry_ema26
            if (distanceFromEma26 > 0.02) {  // > 2% = late entry
                return false
            }

            // Trigger
            const priceBelowEma9 = entryClose < signal.entry_ema9
            if (!priceBelowEma9) {
                // console.log(`[SCALP_04] Rejected SHORT: Price ${entryClose} >= EMA9 ${signal.entry_ema9}`)
                return false
            }

            // RSI check
            if (rsi1m < 20) {
                // console.log(`[SCALP_04] Rejected SHORT: RSI_7=${rsi1m} < 20 (too low)`)
                return false
            }

            // console.log(`[SCALP_04] ✅ SHORT Setup passed: Price=${entryClose}, EMA9=${signal.entry_ema9}, EMA26=${signal.entry_ema26}, RSI_7=${rsi1m}`)
            return true
        }

        return false
    }

    parsePlan(decision, currentPrice, signal) {
        // Default parser từ util
        const plan = parsePlan(decision, currentPrice)

        // Fallback plan cho SCALP_04 nếu AI trả LONG/SHORT nhưng thiếu SL/TP rõ ràng
        if (decision?.action !== 'LONG' && decision?.action !== 'SHORT') return plan

        const entry = Number.isFinite(plan?.entry) ? plan.entry : (Number.isFinite(currentPrice) ? currentPrice : null)
        if (!Number.isFinite(entry) || entry <= 0) return plan

        // ATR-based SL/TP (as per prompt requirements)
        const atr = signal?.entry_atr || signal?.bias_atr || 0
        if (atr > 0) {
            // SL = 1.0 × ATR (tight stop)
            const slPrice = decision.action === 'LONG' 
                ? entry - (atr * 1.0)
                : entry + (atr * 1.0)
            
            // TP = 2.0 × ATR (2R target)
            const tpPrice = decision.action === 'LONG'
                ? entry + (atr * 2.0)
                : entry - (atr * 2.0)
            
            plan.stop_loss = {
                price: Math.round(slPrice * 100) / 100,
                description: `SL = 1.0 × ATR (${atr.toFixed(2)})`
            }
            
            plan.take_profit = [{
                price: Math.round(tpPrice * 100) / 100,
                description: `TP = 2.0 × ATR (2R target)`
            }]
        } else {
            // Fallback to fixed % if ATR not available
            const slPct = 0.006
            const tpPct = 0.012
            plan.stop_loss = {
                price: decision.action === 'LONG' 
                    ? entry * (1 - slPct) 
                    : entry * (1 + slPct),
                description: 'SL fallback ~0.6%'
            }
            plan.take_profit = [{
                price: decision.action === 'LONG'
                    ? entry * (1 + tpPct)
                    : entry * (1 - tpPct),
                description: 'TP fallback ~1.2%'
            }]
        }
        
        plan.entry = entry
        return plan
    }

    buildAiPrompt(signal) {
        const atrValue = signal.entry_atr || signal.bias_atr || 0
        const volatilityState = (atrValue / signal.price * 100 > 0.5) ? 'High' : 'Normal'
        
        // Determine scalp direction from regime (Scalp04 is continuation strategy)
        let scalpDirection = null
        if (signal.regime_15m === 'trending_bull') scalpDirection = 'LONG'
        else if (signal.regime_15m === 'trending_bear') scalpDirection = 'SHORT'
        // If range/unknown, scalpDirection stays null (alignment will be UNKNOWN, which is correct)
        
        // Get enhanced swing context
        const swingContext = getEnhancedSwingData(signal.symbol, signal.entry_close_1m || signal.price, scalpDirection)

        return `
Strategy: SCALP_04 (Trend Continuation)
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
- Price: ${signal.entry_close_1m || signal.price}
- EMA9: ${signal.entry_ema9} | EMA26: ${signal.entry_ema26}
- RSI_7: ${signal.entry_rsi7}
- ATR_1m: ${atrValue}
- Volume Force: ${signal.entry_vol_ratio}x

4. SWING CONTEXT (HTF - Higher Timeframe):
- Last Updated: ${swingContext?.lastUpdated || 'N/A'}
- Regime: ${swingContext?.regime || 'N/A'}
- Bias: ${swingContext?.bias || 'N/A'}
- HTF Zone: ${swingContext?.formattedZone || 'N/A'}
- Zone Proximity: ${swingContext?.zoneProximity || 'N/A'}
- Trigger Score: ${swingContext?.trigger_score !== null && swingContext?.trigger_score !== undefined ? swingContext.trigger_score : 'N/A'}/100
- Trend Alignment: ${swingContext?.trendAlignment || 'UNKNOWN'}

TIMEFRAME HIERARCHY (Higher = Priority):
1. Daily/4H (Swing) - Macro trend
2. 15M (Scalp Regime) - Primary trend
3. 5M/1M - Execution timing
→ Trade WITH higher timeframe trends

REQUIRED ANALYSIS:
1. Is the 15M trend clean? (No choppy price action)
2. Is the 1M pullback resolved? (Price reclaimed EMA9?)
3. HTF Alignment Check:
   - ALIGNED: HTF confirms continuation -> Increase confidence +10-15%
   - DIVERGENT: HTF against continuation -> AVOID or reduce confidence -20%
4. Zone Proximity Check:
   - AT_ZONE with continuation direction -> Strong setup (bounce probability high)
   - AT_ZONE against continuation direction -> Risk high (need strong volume to break)
5. HTF Score Check:
   - Score >= 80: HTF trend very strong, continuation highly probable
   - Score < 50: HTF weak, be careful with continuation
6. Risk Calculation (Use ATR 1m):
   - SL = Price +/- (1.0 * ATR) (Tight Stop)
   - TP = Price +/- (2.0 * ATR) (Target 2R)
   - If HTF DIVERGENT: Tighten SL to 0.8 * ATR

CONFLICT RESOLUTION:
- If HTF trend DIVERGENT from scalp continuation:
  * HTF Score >= 70: AVOID continuation trade, HTF likely reversal
  * HTF Score < 50: May continue but reduce size, tight SL
- If AT_ZONE and trying to break zone:
  * Need Volume Force >= 1.5x and HTF score < 60
  * Otherwise AVOID

QUAN TRỌNG - FORMAT REASON:
- Luôn dùng format RSI_7, RSI_14 (dấu gạch dưới, KHÔNG dùng ngoặc đơn)
- Ví dụ: "RSI_7 = 65.08 cho thấy momentum mạnh"
- KHÔNG viết RSI(7) hoặc RSI 7 hoặc 7.=
- PHẢI mention HTF alignment và zone proximity trong reason

OUTPUT JSON:
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.75-0.95,
  "entry": ${signal.entry_close_1m || signal.price},
  "stop_loss_logic": "Value (consider HTF conflict -> tighter SL)",
  "take_profit_logic": ["Value (2R minimum)"],
  "reason": "Explain continuation validity. Mention HTF alignment, zone proximity, score. (dùng RSI_7 format)",
  "risk_warning": "Warning if HTF divergent or at zone resistance"
}
`
    }
}
