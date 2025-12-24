import { getMarketSnapshot } from '../data/marketCollector.js'
import { calcIndicators } from '../indicators/index.js'
import { normalizeSignal } from '../signal/normalizeSignal.js'
import { getDecision } from '../ai/deepseekDecision.js'
import { isValidSignal } from '../risk/riskManager.js'
import { notify } from '../notify/telegram.js'
import { saveLog } from '../data/db.js'
import { getTodaysNews } from '../data/newsCollector.js'
import { parsePlan } from '../utils/parsePlan.js'
import { registerOpenTrade } from '../monitor/tradeOutcomeMonitor.js'

export async function runScalp(symbol = null) {
  const targetSymbol = symbol || process.env.SYMBOL?.split(',')[0]?.trim() || 'BTC'
  console.log(`\n[${new Date().toLocaleTimeString()}] ♻️  Starting cycle for ${targetSymbol}...`)

  // ... (giữ nguyên phần fetch data và filter) ...

  // 1. Fetch Data & News
  process.stdout.write(`   Fetching data for ${targetSymbol}... `)
  const [market, news] = await Promise.all([
    getMarketSnapshot(targetSymbol),
    getTodaysNews()
  ])

  if (!market) {
    console.log('❌ Failed')
    return
  }
  console.log('✅')

  // 2. Calc Indicators
  const indicators = calcIndicators(market)
  const signal = normalizeSignal(indicators)
  signal.news = news // Attach news for AI

  // 3. Filter before AI (Tiết kiệm api)
  const isWorthy = checkConditions(signal)
  if (!isWorthy) {
    console.log('💤 Market quiet. Skip AI.')
    // Lưu log SKIP để tracking
    await saveLog({
      strategy: 'SCALP_01',
      symbol: signal.symbol,
      timeframe: 'Multi-TF',
      price: signal.price,
      ai_action: 'SKIP',
      ai_confidence: 0,
      ai_reason: 'No technical signal (EMA/RSI quiet)',
      ai_full_response: null,
      market_snapshot: indicators // Lưu Full Data Input
    })
    return
  }

  // 4. AI Analysis
  process.stdout.write(`   🤖 Analyzing (${signal.symbol})... `)
  const decision = await getDecision(signal)
  console.log('✅ Done')
  console.log(`   👉 Action: ${decision.action} | Confidence: ${Math.round(decision.confidence * 100)}%`)

  // 5. Parse plan (chỉ meaningful khi LONG/SHORT)
  const plan = (decision.action === 'LONG' || decision.action === 'SHORT')
    ? parsePlan(decision, market.price)
    : null

  const takeProfitPrices = plan?.take_profit
    ? plan.take_profit.map(tp => tp?.price).filter(p => typeof p === 'number' && Number.isFinite(p))
    : null

  // 6. Nếu signal đủ mạnh: đánh dấu OPEN để WS monitor theo dõi WIN/LOSS
  const outcome = isValidSignal(decision) ? 'OPEN' : null

  // 7. Lưu Log vào DB (kèm entry/SL/TP nếu có)
  const logId = await saveLog({
    strategy: 'SCALP_01',
    symbol: signal.symbol,
    timeframe: 'Multi-TF',
    price: signal.price,
    ai_action: decision.action,
    ai_confidence: decision.confidence,
    ai_reason: decision.reason,
    ai_full_response: decision,
    market_snapshot: indicators, // Lưu Full Data Input
    plan,
    entry_price: plan?.entry ?? null,
    stop_loss_price: plan?.stop_loss?.price ?? null,
    take_profit_prices: takeProfitPrices,
    outcome
  })

  // Nếu OPEN thì register vào WS monitor để tự update WIN/LOSS
  if (outcome === 'OPEN' && logId && plan?.entry) {
    registerOpenTrade({
      id: logId,
      symbol: signal.symbol,
      action: decision.action,
      entryPrice: plan.entry,
      stopLossPrice: plan?.stop_loss?.price ?? null,
      takeProfitPrices: takeProfitPrices || [],
    })
  }

  // Chỉ bắn alert nếu signal đủ mạnh
  if (outcome !== 'OPEN') return

  // Không đặt lệnh, chỉ thông báo
  notify(decision, plan)
}

function checkConditions(signal) {
  // 1. BẮT BUỘC: Phải có tín hiệu Entry rõ ràng ở khung 1m (Cross Signal)
  const hasEntryCross = (signal.entry_cross !== 'none')
  
  // Hoặc Entry Ready kết hợp với RSI Extreme (Reversal Setup)
  const hasEntryReady = (signal.entry_1m === 'long_ready' || signal.entry_1m === 'short_ready')
  const isRsi1mExtreme = (signal.entry_rsi7 > 80 || signal.entry_rsi7 < 20)
  const isRsi5mExtreme = (signal.bias_rsi7 > 80 || signal.bias_rsi7 < 20)
  const hasReversalSetup = hasEntryReady && isRsi1mExtreme && isRsi5mExtreme

  // Nếu không có Entry Cross VÀ không có Reversal Setup -> Bỏ qua ngay
  if (!hasEntryCross && !hasReversalSetup) return false

  // 2. Lọc Xu Hướng (Trend Filter) - CHỈ ÁP DỤNG CHO ENTRY CROSS
  // Nếu bắt theo Cross, phải thuận xu hướng 5m (Trend Follow)
  if (hasEntryCross) {
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

  // 3. Nếu là Reversal Setup (RSI Extreme), KHÔNG cần thuận xu hướng 5m
  // Vì bản chất là đánh ngược xu hướng (Reversal). 
  // Để AI tự quyết định rủi ro chỗ này.

  return true
}