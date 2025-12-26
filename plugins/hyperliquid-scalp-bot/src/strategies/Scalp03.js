import { BaseStrategy } from './BaseStrategy.js'
import { parsePlan } from '../utils/parsePlan.js'
import { getSwingData, getEnhancedSwingData } from '../data/swingDataCache.js'

export class Scalp03 extends BaseStrategy {
    constructor() {
        super('SCALP_03')
    }

    checkConditions(signal) {
        // 1. Cross Signal Check
        const hasEntryCross = (signal.entry_cross !== 'none')

        // 2. Reversal Setup Check
        const hasEntryReady = (signal.entry_1m === 'long_ready' || signal.entry_1m === 'short_ready')
        const isRsi1mExtreme = (signal.entry_rsi7 > 80 || signal.entry_rsi7 < 20)
        const isRsi5mExtreme = (signal.bias_rsi7 > 80 || signal.bias_rsi7 < 20)
        const hasReversalSetup = hasEntryReady && isRsi1mExtreme && isRsi5mExtreme

        if (!hasEntryCross && !hasReversalSetup) return false

        // 3. Trend Filters (Only for Cross Signals)
        if (hasEntryCross) {
            // 3.1 Align with 5m bias (SRS)
            if (signal.entry_cross === 'golden_cross' && signal.bias_5m !== 'bullish') return false
            if (signal.entry_cross === 'death_cross' && signal.bias_5m !== 'bearish') return false

            // 3.2 Avoid counter-trend vs 15m regime (SRS: avoid unless reversal is strong)
            if (signal.entry_cross === 'golden_cross' && signal.regime_15m === 'trending_bear') return false
            if (signal.entry_cross === 'death_cross' && signal.regime_15m === 'trending_bull') return false

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

    parsePlan(decision, currentPrice) {
        // Default parser từ util
        const plan = parsePlan(decision, currentPrice)

        // Fallback plan cho SCALP_03 nếu AI trả LONG/SHORT nhưng thiếu SL/TP rõ ràng
        if (decision?.action !== 'LONG' && decision?.action !== 'SHORT') return plan

        const entry = Number.isFinite(plan?.entry) ? plan.entry : (Number.isFinite(currentPrice) ? currentPrice : null)
        if (!Number.isFinite(entry) || entry <= 0) return plan

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

QUY TẮC CƠ BẢN:
1. Confluence: 15m+5m+1m đồng thuận -> Mạnh
2. Risk: RSI_7 > 75 (Long risk), RSI_7 < 25 (Short risk)
3. TP/SL: Scalping tight (TP ~0.9%, SL ~0.6%)
4. Volume: Ưu tiên Vol Force >= 1.2x; nếu Vol Force thấp dễ false breakout

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
