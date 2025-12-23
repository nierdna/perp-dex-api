import { getMarketSnapshot } from '../data/marketCollector.js'
import { calcIndicators } from '../indicators/index.js'
import { normalizeSignal } from '../signal/normalizeSignal.js'
import { getDecision } from '../ai/deepseekDecision.js'
import { isValidSignal } from '../risk/riskManager.js'
import { notify } from '../notify/telegram.js'

export async function runScalp() {
  console.log(`\n[${new Date().toLocaleTimeString()}] ♻️  Starting cycle...`)

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

  // 3. AI Analysis
  process.stdout.write(`   🤖 Analyzing (${signal.symbol})... `)
  const decision = await getDecision(signal)
  console.log('✅ Done')
  console.log(`   👉 Action: ${decision.action} | Confidence: ${Math.round(decision.confidence * 100)}%`)

  // Chỉ bắn alert nếu signal đủ mạnh
  if (!isValidSignal(decision)) return

  // Không đặt lệnh, chỉ thông báo
  notify(decision)
}