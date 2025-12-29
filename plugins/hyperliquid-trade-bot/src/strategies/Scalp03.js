import { BaseStrategy } from './BaseStrategy.js'
import { parsePlan } from '../utils/parsePlan.js'
import { getSwingData, getEnhancedSwingData } from '../data/swingDataCache.js'

export class Scalp03 extends BaseStrategy {
    constructor() {
        super('SCALP_03')
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
        // Volatility regime filter (adjust filters based on volatility)
        const atr = signal.entry_atr || signal.bias_atr || 0
        const volRegime = this.getVolatilityRegime(atr, signal.price)
        
        // In HIGH volatility, require stronger volume (avoid noise)
        if (volRegime === 'HIGH') {
            const volRatio = Number(signal.entry_vol_ratio)
            if (Number.isFinite(volRatio) && volRatio < 1.0) return false // Stricter volume requirement
        }

        // 1. Cross Signal Check
        const hasEntryCross = (signal.entry_cross !== 'none')

        // 2. Reversal Setup Check
        const hasEntryReady = (signal.entry_1m === 'long_ready' || signal.entry_1m === 'short_ready')
        const isRsi1mExtreme = (signal.entry_rsi7 > 80 || signal.entry_rsi7 < 20)
        const isRsi5mExtreme = (signal.bias_rsi7 > 80 || signal.bias_rsi7 < 20)
        const hasReversalSetup = hasEntryReady && isRsi1mExtreme && isRsi5mExtreme

        if (!hasEntryCross && !hasReversalSetup) return false

        // 2.5 RSI Guardrails for Reversal Setup
        if (hasReversalSetup) {
            // Reject if RSI too extreme (likely false reversal)
            if (signal.entry_1m === 'long_ready' && signal.entry_rsi7 < 15) return false
            if (signal.entry_1m === 'short_ready' && signal.entry_rsi7 > 85) return false
        }

        // 2.6 Volume Check for Reversal Setup (stricter than cross signals)
        if (hasReversalSetup) {
            const volRatio = Number(signal.entry_vol_ratio)
            if (Number.isFinite(volRatio) && volRatio < 0.5) return false // Reversal needs stronger volume confirmation
        }

        // 3. Trend Filters (Only for Cross Signals)
        if (hasEntryCross) {
            // 3.1 Align with 5m bias (SRS)
            if (signal.entry_cross === 'golden_cross' && signal.bias_5m !== 'bullish') return false
            if (signal.entry_cross === 'death_cross' && signal.bias_5m !== 'bearish') return false

            // 3.2 Counter-trend filter (with exceptions for strong reversals)
            const isCounterTrend = (signal.entry_cross === 'golden_cross' && signal.regime_15m === 'trending_bear') ||
                                   (signal.entry_cross === 'death_cross' && signal.regime_15m === 'trending_bull')
            
            if (isCounterTrend) {
                // Check for strong reversal conditions
                const hasRsiExtreme = (signal.entry_cross === 'golden_cross' && signal.entry_rsi7 < 20) ||
                                      (signal.entry_cross === 'death_cross' && signal.entry_rsi7 > 80)
                const volRatio = Number(signal.entry_vol_ratio)
                const hasVolumeSpike = Number.isFinite(volRatio) && volRatio >= 2.0
                const swingContext = getSwingData(signal.symbol)
                const hasHtfZone = swingContext?.htf_zone && swingContext.htf_zone.strength >= 3
                const htfScoreWeak = swingContext?.trigger_score !== null && swingContext?.trigger_score !== undefined && swingContext.trigger_score < 50
                
                // Reject counter-trend unless strong reversal conditions met
                if (!hasRsiExtreme && !hasVolumeSpike && !hasHtfZone && !htfScoreWeak) {
                    return false
                }
            }

            // 3.3 RSI risk guardrails for cross signals (reversal setups are exempt)
            if (signal.entry_cross === 'golden_cross' && (signal.entry_rsi7 > 75 || signal.bias_rsi7 > 75)) return false
            if (signal.entry_cross === 'death_cross' && (signal.entry_rsi7 < 25 || signal.bias_rsi7 < 25)) return false

            // 3.4 Volume sanity check: avoid ultra-low volume for cross signals (reduce false breaks)
            // SRS: prefer vol > 1.2x avg; here we only hard-reject extreme low volume
            const volRatio = Number(signal.entry_vol_ratio)
            if (Number.isFinite(volRatio) && volRatio < 0.3) return false
        }

        return true
    }

    /**
     * Validate AI decision against hard rules (post-AI validation)
     * Override decision if it violates core scalping rules
     * @param {Object} decision - AI decision object
     * @param {Object} signal - Signal data with indicators
     * @returns {Object} - Validated decision (may override action to NO_TRADE)
     */
    validateDecision(decision, signal) {
        if (!decision || !signal) return decision

        const entryRsi7 = signal.entry_rsi7
        const action = decision.action

        // Hard rule: SHORT khi RSI_7 < 25 = short đáy, rất nguy hiểm
        if (action === 'SHORT' && Number.isFinite(entryRsi7) && entryRsi7 < 25) {
            return {
                ...decision,
                action: 'NO_TRADE',
                confidence: 0,
                reason: `❌ VI PHẠM RULE: RSI_7 = ${entryRsi7.toFixed(2)} < 25 (quá bán). Short tại đáy LTF = short squeeze risk cực cao. Chờ RSI_7 hồi lên 60-70 hoặc chờ breakdown structure rõ ràng trước khi short.`,
                risk_warning: `RSI_7 quá bán (${entryRsi7.toFixed(2)}) - KHÔNG được short. Đây là điểm chốt short hoặc chờ long hồi, không phải mở short mới.`
            }
        }

        // Hard rule: LONG khi RSI_7 > 75 = long đỉnh, rất nguy hiểm
        if (action === 'LONG' && Number.isFinite(entryRsi7) && entryRsi7 > 75) {
            return {
                ...decision,
                action: 'NO_TRADE',
                confidence: 0,
                reason: `❌ VI PHẠM RULE: RSI_7 = ${entryRsi7.toFixed(2)} > 75 (quá mua). Long tại đỉnh LTF = long squeeze risk cực cao. Chờ RSI_7 hồi xuống 40-50 hoặc chờ pullback structure rõ ràng trước khi long.`,
                risk_warning: `RSI_7 quá mua (${entryRsi7.toFixed(2)}) - KHÔNG được long. Đây là điểm chốt long hoặc chờ short hồi, không phải mở long mới.`
            }
        }

        return decision
    }

    parsePlan(decision, currentPrice, signal) {
        // Default parser từ util
        const plan = parsePlan(decision, currentPrice)

        // Fallback plan cho SCALP_03 nếu AI trả LONG/SHORT nhưng thiếu SL/TP rõ ràng
        if (decision?.action !== 'LONG' && decision?.action !== 'SHORT') return plan

        const entry = Number.isFinite(plan?.entry) ? plan.entry : (Number.isFinite(currentPrice) ? currentPrice : null)
        if (!Number.isFinite(entry) || entry <= 0) return plan

        // ATR-based SL/TP (adapts to volatility)
        const atr = signal?.entry_atr || signal?.bias_atr || 0
        if (atr > 0) {
            // SL = 1.5 × ATR (tight scalping stop)
            const slPrice = decision.action === 'LONG' 
                ? entry - (atr * 1.5)
                : entry + (atr * 1.5)
            
            // TP = 2.0 × ATR (1.33R target)
            const tpPrice = decision.action === 'LONG'
                ? entry + (atr * 2.0)
                : entry - (atr * 2.0)
            
            // Only set if not already provided by AI
            if (!plan?.stop_loss || !Number.isFinite(plan.stop_loss.price)) {
                plan.stop_loss = {
                    price: Math.round(slPrice * 100) / 100,
                    description: `SL = 1.5 × ATR (${atr.toFixed(2)}) - tight scalping stop`
                }
            }
            
            if (!Array.isArray(plan?.take_profit) || plan.take_profit.length === 0 || !Number.isFinite(plan.take_profit[0]?.price)) {
                plan.take_profit = [{
                    price: Math.round(tpPrice * 100) / 100,
                    description: `TP = 2.0 × ATR (1.33R target)`
                }]
            }
        } else {
            // Fallback to fixed % if ATR not available
            const slPct = 0.006 // ~0.6%
            const tpPct = 0.009 // ~0.9%

            // Stop loss fallback
            if (!plan?.stop_loss || !Number.isFinite(plan.stop_loss.price)) {
                const slPrice = decision.action === 'LONG' ? entry * (1 - slPct) : entry * (1 + slPct)
                plan.stop_loss = {
                    price: Math.round(slPrice * 100) / 100,
                    description: `SL mặc định ~0.6% ${decision.action === 'LONG' ? 'dưới' : 'trên'} entry (fallback theo SRS)`
                }
            }

            // Take profit fallback (ít nhất TP1)
            if (!Array.isArray(plan?.take_profit) || plan.take_profit.length === 0 || !Number.isFinite(plan.take_profit[0]?.price)) {
                const tp1Price = decision.action === 'LONG' ? entry * (1 + tpPct) : entry * (1 - tpPct)
                plan.take_profit = [
                    {
                        price: Math.round(tp1Price * 100) / 100,
                        description: `TP1 mặc định ~0.9% ${decision.action === 'LONG' ? 'trên' : 'dưới'} entry (fallback theo SRS)`
                    }
                ]
            }
        }

        // Ensure entry is set
        plan.entry = entry
        return plan
    }

    buildAiPrompt(signal) {
        // Determine scalp direction from signal (priority order)
        let scalpDirection = null
        
        // Priority 1: Entry signals (strongest)
        if (signal.entry_cross === 'golden_cross') scalpDirection = 'LONG'
        else if (signal.entry_cross === 'death_cross') scalpDirection = 'SHORT'
        else if (signal.entry_1m === 'long_ready') scalpDirection = 'LONG'
        else if (signal.entry_1m === 'short_ready') scalpDirection = 'SHORT'
        
        // Priority 2: Bias (if no entry signal)
        else if (signal.bias_5m === 'bullish') scalpDirection = 'LONG'
        else if (signal.bias_5m === 'bearish') scalpDirection = 'SHORT'
        
        // Priority 3: Regime (if no bias clear)
        else if (signal.regime_15m === 'trending_bull') scalpDirection = 'LONG'
        else if (signal.regime_15m === 'trending_bear') scalpDirection = 'SHORT'
        
        // If still null, alignment will be UNKNOWN (which is correct for range/unclear market)
        
        // Get enhanced swing context
        const swingContext = getEnhancedSwingData(signal.symbol, signal.price, scalpDirection)
        
        return `
Vai trò: Bạn là một chuyên gia giao dịch Crypto Scalping chuyên nghiệp (Strategy SCALP_03).

MỤC TIÊU: Tìm kiếm lợi nhuận ngắn hạn với xác suất thắng > 70% dựa trên đa khung thời gian.

DỮ LIỆU THỊ TRƯỜNG (${signal.symbol}/USD):

1. 15M CHART (Trend):
- Regime: ${signal.regime_15m || 'unknown'}
- Cross: ${signal.regime_cross || 'none'}
- EMA50: ${signal.regime_ema50} | EMA200: ${signal.regime_ema200}
- RSI_14: ${signal.regime_rsi14}

2. 5M CHART (Bias):
- Bias: ${signal.bias_5m || 'unknown'}
- Cross: ${signal.bias_cross || 'none'}
- EMA9/26: ${signal.bias_ema9} | ${signal.bias_ema26}
- RSI_7: ${signal.bias_rsi7}
- ATR_14: ${signal.bias_atr}

3. 1M CHART (Entry):
- Entry State: ${signal.entry_1m || 'unknown'}
- Cross: ${signal.entry_cross || 'none'}
- Price: ${signal.price}
- EMA9/26: ${signal.entry_ema9} | ${signal.entry_ema26}
- RSI_7: ${signal.entry_rsi7}
- Vol Force: ${signal.entry_vol_status} (${signal.entry_vol_ratio}x)
- Funding: ${signal.funding}

4. SWING CONTEXT (HTF - Higher Timeframe):
- Last Updated: ${swingContext?.lastUpdated || 'N/A'}
- Regime: ${swingContext?.regime || 'N/A'}
- Bias: ${swingContext?.bias || 'N/A'}
- HTF Zone: ${swingContext?.formattedZone || 'N/A'}
- Zone Proximity: ${swingContext?.zoneProximity || 'N/A'}
- Trigger Score: ${swingContext?.trigger_score !== null && swingContext?.trigger_score !== undefined ? swingContext.trigger_score : 'N/A'}/100
- Trend Alignment: ${swingContext?.trendAlignment || 'UNKNOWN'}

TIN TỨC:
${signal.news && signal.news.length > 0 ? signal.news.map(n => `- [${n.eventTime}] ${n.title} (${n.impact})`).join('\n') : '- None'}

TIMEFRAME HIERARCHY (Cao hơn = Ưu tiên hơn):
1. Daily/4H (Swing Regime) - Xu hướng lớn, quyết định bias chính
2. 15M (Scalp Regime) - Xu hướng trung, filter setup
3. 5M (Scalp Bias) - Xu hướng nhỏ, timing zone
4. 1M (Scalp Entry) - Execution timing only
→ NGUYÊN TẮC: Trade THEO xu hướng lớn, ENTRY ở timeframe nhỏ

QUY TẮC CƠ BẢN (CỨNG - KHÔNG VI PHẠM):
1. Confluence: 15m+5m+1m đồng thuận -> Mạnh
2. RSI_7 HARD RULES (KHÔNG ĐƯỢC VI PHẠM):
   - RSI_7 < 25 → KHÔNG ĐƯỢC SHORT (short đáy = short squeeze risk cực cao)
   - RSI_7 > 75 → KHÔNG ĐƯỢC LONG (long đỉnh = long squeeze risk cực cao)
   - RSI quá bán = điểm chốt short hoặc chờ long hồi, KHÔNG phải mở short mới
   - RSI quá mua = điểm chốt long hoặc chờ short hồi, KHÔNG phải mở long mới
3. TP/SL: Scalping tight (TP ~0.9%, SL ~0.6%)
4. Volume: Ưu tiên Vol Force >= 1.2x; nếu Vol Force < 0.3x → giảm confidence -30% hoặc NO_TRADE

QUY TẮC SWING CONTEXT NÂNG CAO:
5a. HTF Alignment (Trend Alignment):
   - ALIGNED (HTF và Scalp cùng hướng): Confidence +10-15%, setup mạnh
   - DIVERGENT (HTF và Scalp ngược hướng): 
     * Nếu HTF trigger_score > 70 -> Ưu tiên HTF, scalp ngược chiều cần TRÁNH hoặc giảm confidence -20%
     * Nếu HTF trigger_score < 50 -> Scalp có thể vào counter-trend nhẹ nhàng nhưng phải có reversal setup rõ ràng
   - NEUTRAL (HTF NO_TRADE): Dựa vào scalp timeframes, cẩn thận hơn

5b. HTF Zone Proximity (Zone Proximity):
   - AT_ZONE (Price đang ở HTF Demand/Supply):
     * Nếu scalp CÙNG HƯỚNG với zone (Long tại Demand, Short tại Supply) -> Confidence +15%, probability bounce cao
     * Nếu scalp NGƯỢC HƯỚNG zone -> Giảm confidence -10%, risk cao (break zone cần volume mạnh)
   - NEAR_ZONE: Cẩn thận, price có thể test zone trước khi tiếp tục
   - FAR_FROM_ZONE: Zone ít ảnh hưởng

5c. HTF Zone Strength:
   - Strength >= 3/5: Zone mạnh, respect zone hơn
   - Strength < 3/5: Zone yếu, có thể break dễ hơn

5d. HTF Regime Considerations:
   - TREND_UP/TREND_DOWN: Trend rõ ràng, ưu tiên trade theo trend
   - RANGE: Dễ false breakout, giảm position size, tighten SL
   - TRANSITION: Không rõ ràng, cẩn thận hoặc NO_TRADE

CONFLICT RESOLUTION:
- Khi HTF (Swing) mâu thuẫn với LTF (Scalp):
  1. Check HTF trigger_score: 
     - Score >= 80: HTF trend rất mạnh, LTF counter-trend TRÁNH
     - Score 50-79: HTF trend khá mạnh, LTF counter-trend cần reversal setup cực rõ (RSI extreme + volume spike)
     - Score < 50: HTF yếu, LTF có thể lead reversal
  2. Check Zone Proximity:
     - AT_ZONE + Zone strength >= 3: Respect zone, trade theo zone direction
     - FAR_FROM_ZONE: Zone ít ảnh hưởng, dựa vào LTF hơn
  3. Check HTF Regime:
     - RANGE: LTF có thể scalp cả 2 chiều tại range edges
     - TREND: Ưu tiên trade theo trend, counter-trend rất rủi ro

QUAN TRỌNG - FORMAT REASON:
- Luôn dùng format RSI_7, RSI_14 (dấu gạch dưới, KHÔNG dùng ngoặc đơn)
- Ví dụ: "Khung 1M RSI_7 = 30.55 cho thấy quá bán"
- KHÔNG viết RSI(7) hoặc RSI 7 hoặc 7.=
- Trong reason, PHẢI đề cập đến HTF context nếu có impact (alignment, zone proximity, score)

OUTPUT JSON:
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.0-1.0,
  "entry": number,
  "stop_loss_logic": "string",
  "take_profit_logic": ["string"],
  "reason": "Vietnamese explanation, ưu tiên format đánh số 1. 2. 3. PHẢI mention HTF context nếu relevant (dùng RSI_7, RSI_14)",
  "risk_warning": "string, mention HTF conflict nếu có"
}
`
    }
}
