/**
 * Alert Cooldown Manager - Chống spam alert cùng action trong khoảng thời gian ngắn
 * 
 * Logic: Nếu cùng symbol + cùng action (LONG/SHORT) trong cooldown period → skip alert
 * Nhưng vẫn cho phép khác action (LONG sau SHORT hoặc ngược lại)
 */

const ALERT_COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MINUTES || '10') * 60 * 1000

// Track last alert: Map<symbol, { action, timestamp }>
const lastAlerts = new Map()

/**
 * Check xem có nên bắn alert không (dựa trên cooldown)
 * @param {string} symbol - Trading symbol (BTC, ETH, etc.)
 * @param {string} action - LONG hoặc SHORT
 * @returns {boolean} true nếu được phép bắn alert, false nếu đang trong cooldown
 */
export function canSendAlert(symbol, action) {
  if (!symbol || (action !== 'LONG' && action !== 'SHORT')) {
    return true // Không phải LONG/SHORT thì không check cooldown
  }

  const key = symbol.toUpperCase()
  const last = lastAlerts.get(key)

  if (!last) {
    // Chưa có alert nào → cho phép
    return true
  }

  // Nếu khác action → cho phép (LONG sau SHORT hoặc ngược lại)
  if (last.action !== action) {
    return true
  }

  // Cùng action → check cooldown
  const now = Date.now()
  const elapsed = now - last.timestamp

  if (elapsed < ALERT_COOLDOWN_MS) {
    // Đang trong cooldown
    const remainingMinutes = Math.ceil((ALERT_COOLDOWN_MS - elapsed) / 60000)
    console.log(`⏸️  Alert cooldown: ${symbol} ${action} (${remainingMinutes}min remaining)`)
    return false
  }

  // Hết cooldown → cho phép
  return true
}

/**
 * Đánh dấu đã bắn alert (update last alert timestamp)
 * @param {string} symbol - Trading symbol
 * @param {string} action - LONG hoặc SHORT
 */
export function markAlertSent(symbol, action) {
  if (!symbol || (action !== 'LONG' && action !== 'SHORT')) {
    return
  }

  const key = symbol.toUpperCase()
  lastAlerts.set(key, {
    action,
    timestamp: Date.now()
  })
}

/**
 * Get cooldown config (for logging/debugging)
 */
export function getCooldownMinutes() {
  return ALERT_COOLDOWN_MS / 60000
}

