import { getMarketSnapshot } from '../data/marketCollector.js'
import { calcIndicators } from '../indicators/index.js'
import { normalizeSignal } from '../signal/normalizeSignal.js'
import { getDecision } from '../ai/deepseekDecision.js'
import { canExecute } from '../risk/riskManager.js'
import { placeOrder } from '../hyperliquid/orders.js'
import { notify } from '../notify/telegram.js'

export async function runScalp() {
  const market = await getMarketSnapshot()
  const indicators = calcIndicators(market)
  const signal = normalizeSignal(indicators)
  const decision = await getDecision(signal)

  if (!canExecute(decision, market.account)) return

  await placeOrder(decision)
  notify(decision)
}