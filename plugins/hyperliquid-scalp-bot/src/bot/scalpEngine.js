import { getMarketSnapshot } from '../data/marketCollector.js'
import { calcIndicators } from '../indicators/index.js'
import { normalizeSignal } from '../signal/normalizeSignal.js'
import { getDecision } from '../ai/deepseekDecision.js'
import { isValidSignal } from '../risk/riskManager.js'
import { notify } from '../notify/telegram.js'
import { saveLog } from '../data/db.js'

export async function runScalp() {
  console.log(`\n[${new Date().toLocaleTimeString()}] ♻️  Starting cycle...`)

  // ... (giữ nguyên phần fetch data và filter) ...

  // 1. Fetch Data
  process.stdout.write('   Fetching data... ')
  const market = await getMarketSnapshot()
  if (!market) {
    console.log('❌ Failed')
    return
  }
  console.log('✅')

  // 2. Calc Indicators
  const indicators = calcIndicators(market)
  const signal = normalizeSignal(indicators)

  // 3. Filter before AI (Tiết kiệm api)
  const isWorthy = checkConditions(signal)
  if (!isWorthy) {
    console.log('💤 Market quiet. Skip AI.')
    // Lưu log SKIP để tracking
    saveLog({
      strategy: 'SCALP_01',
      symbol: signal.symbol,
      timeframe: 'Multi-TF',
      price: signal.price,
      ai_action: 'SKIP',
      ai_confidence: 0,
      ai_reason: 'No technical signal (EMA/RSI quiet)',
      ai_full_response: null,
      market_snapshot: {
        regime: indicators.regime_15m,
        bias: indicators.bias_5m,
        entry: indicators.entry_1m
      }
    })
    return
  }

  // 4. AI Analysis
  process.stdout.write(`   🤖 Analyzing (${signal.symbol})... `)
  const decision = await getDecision(signal)
  console.log('✅ Done')
  console.log(`   👉 Action: ${decision.action} | Confidence: ${Math.round(decision.confidence * 100)}%`)

  // 5. Lưu Log vào DB
  saveLog({
    strategy: 'SCALP_01',
    symbol: signal.symbol,
    timeframe: 'Multi-TF',
    price: signal.price,
    ai_action: decision.action,
    ai_confidence: decision.confidence,
    ai_reason: decision.reason,
    ai_full_response: decision,
    market_snapshot: {
      regime: indicators.regime_15m,
      bias: indicators.bias_5m,
      entry: indicators.entry_1m,
      ema_cross: {
        r: indicators.regime_cross,
        b: indicators.bias_cross,
        e: indicators.entry_cross
      }
    }
  })

  // Chỉ bắn alert nếu signal đủ mạnh
  if (!isValidSignal(decision)) return

  // Không đặt lệnh, chỉ thông báo
  notify(decision)
}

function checkConditions(signal) {
  // 1. Phải có tín hiệu Entry rõ ràng ở khung 1m (Trigger)
  const hasEntrySignal = (signal.entry_cross !== 'none')

  // Hoặc RSI quá cực đoan (Cơ hội bắt đảo chiều - Reversal)
  // Khắt khe hơn: 80/20 thay vì 75/25
  const isRsiExtreme = (signal.bias_rsi7 > 80 || signal.bias_rsi7 < 20)

  // Nếu không có Trigger nào -> Bỏ qua ngay
  if (!hasEntrySignal && !isRsiExtreme) return false

  // 2. Lọc Xu Hướng (Trend Filter) - CHỈ ÁP DỤNG CHO ENTRY SIGNAL
  // Nếu bắt theo Cross, phải thuận xu hướng 5m (Trend Follow)
  if (hasEntrySignal) {
    // Golden Cross (Mua) -> 5m phải Bullish (EMA 9 > 26)
    if (signal.entry_cross === 'golden_cross' && signal.bias_5m !== 'bullish') {
      // console.log('   ⚠️ Filtered: Golden Cross but 5m is Bearish')
      return false
    }
    // Death Cross (Bán) -> 5m phải Bearish (EMA 9 < 26)
    if (signal.entry_cross === 'death_cross' && signal.bias_5m !== 'bearish') {
      // console.log('   ⚠️ Filtered: Death Cross but 5m is Bullish')
      return false
    }
  }

  // 3. Nếu là RSI Extreme (Bắt dao rơi/đỉnh), KHÔNG cần thuận xu hướng 5m
  // Vì bản chất là đánh ngược xu hướng (Reversal). 
  // Để AI tự quyết định rủi ro chỗ này.

  return true
}