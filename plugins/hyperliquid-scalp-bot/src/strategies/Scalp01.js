import { BaseStrategy } from './BaseStrategy.js'

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

        // 3. Trend Filter (Only for Cross Signals)
        if (hasEntryCross) {
            if (signal.entry_cross === 'golden_cross' && signal.bias_5m !== 'bullish') return false
            if (signal.entry_cross === 'death_cross' && signal.bias_5m !== 'bearish') return false
        }

        return true
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
- RSI(14): ${signal.regime_rsi14}

2. 5M CHART (Bias):
- Bias: ${signal.bias_5m || 'unknown'}
- EMA9/26: ${signal.bias_ema9} | ${signal.bias_ema26}
- RSI(7): ${signal.bias_rsi7}

3. 1M CHART (Entry):
- Setup: ${signal.entry_cross || 'none'}
- Price: ${signal.price}
- EMA9/26: ${signal.entry_ema9} | ${signal.entry_ema26}
- RSI(7): ${signal.entry_rsi7}
- Vol Force: ${signal.entry_vol_status} (${signal.entry_vol_ratio}x)

TIN TỨC:
${signal.news && signal.news.length > 0 ? signal.news.map(n => `- [${n.eventTime}] ${n.title} (${n.impact})`).join('\n') : '- None'}

QUY TẮC:
1. Confluence: 15m+5m+1m đồng thuận -> Mạnh.
2. Risk: RSI > 75 (Long risk), RSI < 25 (Short risk).
3. TP/SL: Scalping tight (TP ~0.9%, SL ~0.6%).

OUTPUT JSON:
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.0-1.0,
  "entry": number,
  "stop_loss_logic": "string",
  "take_profit_logic": ["string"],
  "reason": "Vietnamese explanation",
  "risk_warning": "string"
}
`
    }
}
