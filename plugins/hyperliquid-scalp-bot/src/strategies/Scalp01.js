import { BaseStrategy } from './BaseStrategy.js'
import { parsePlan } from '../utils/parsePlan.js'

export class Scalp01 extends BaseStrategy {
    constructor() {
        super('SCALP_01')
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

        // Fallback plan cho SCALP_01 nếu AI trả LONG/SHORT nhưng thiếu SL/TP rõ ràng
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
        return `
Vai trò: Bạn là một chuyên gia giao dịch Crypto Scalping chuyên nghiệp (Strategy SCALP_01).

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

TIN TỨC:
${signal.news && signal.news.length > 0 ? signal.news.map(n => `- [${n.eventTime}] ${n.title} (${n.impact})`).join('\n') : '- None'}

QUY TẮC:
1. Confluence: 15m+5m+1m đồng thuận -> Mạnh.
2. Risk: RSI_7 > 75 (Long risk), RSI_7 < 25 (Short risk).
3. TP/SL: Scalping tight (TP ~0.9%, SL ~0.6%).
4. Volume: Ưu tiên Vol Force >= 1.2x; nếu Vol Force thấp dễ false breakout.

QUAN TRỌNG - FORMAT REASON:
- Luôn dùng format RSI_7, RSI_14 (dấu gạch dưới, KHÔNG dùng ngoặc đơn)
- Ví dụ: "Khung 1M RSI_7 = 30.55 cho thấy quá bán"
- KHÔNG viết RSI(7) hoặc RSI 7 hoặc 7.=

OUTPUT JSON:
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.0-1.0,
  "entry": number,
  "stop_loss_logic": "string",
  "take_profit_logic": ["string"],
  "reason": "Vietnamese explanation, ưu tiên format đánh số 1. 2. 3. (dùng RSI_7, RSI_14)",
  "risk_warning": "string"
}
`
    }
}
