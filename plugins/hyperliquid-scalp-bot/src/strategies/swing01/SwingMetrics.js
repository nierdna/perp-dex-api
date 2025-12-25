/**
 * Swing Metrics Tracking
 * Track: triggers_per_day, avg_trigger_score, regime_changes_per_week, ai_call_rate, suppressed_triggers
 */

// In-memory metrics storage
const metrics = {
  triggers: [], // Array of { timestamp, score, symbol }
  regimeChanges: [], // Array of { timestamp, from, to, symbol }
  aiCalls: [], // Array of { timestamp, symbol }
  suppressedTriggers: [] // Array of { timestamp, reason, symbol }
}

/**
 * Record trigger
 * @param {string} symbol - Trading symbol
 * @param {number} score - Trigger score
 */
export function recordTrigger(symbol, score) {
  metrics.triggers.push({
    timestamp: Date.now(),
    score: score,
    symbol: symbol
  })

  // Keep only last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  metrics.triggers = metrics.triggers.filter(t => t.timestamp > thirtyDaysAgo)
}

/**
 * Record regime change
 * @param {string} symbol - Trading symbol
 * @param {string} fromRegime - Previous regime
 * @param {string} toRegime - New regime
 */
export function recordRegimeChange(symbol, fromRegime, toRegime) {
  metrics.regimeChanges.push({
    timestamp: Date.now(),
    from: fromRegime,
    to: toRegime,
    symbol: symbol
  })

  // Keep only last 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  metrics.regimeChanges = metrics.regimeChanges.filter(r => r.timestamp > sevenDaysAgo)
}

/**
 * Record AI call
 * @param {string} symbol - Trading symbol
 */
export function recordAICall(symbol) {
  metrics.aiCalls.push({
    timestamp: Date.now(),
    symbol: symbol
  })

  // Keep only last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  metrics.aiCalls = metrics.aiCalls.filter(c => c.timestamp > thirtyDaysAgo)
}

/**
 * Record suppressed trigger
 * @param {string} symbol - Trading symbol
 * @param {string} reason - Suppression reason
 */
export function recordSuppressedTrigger(symbol, reason) {
  metrics.suppressedTriggers.push({
    timestamp: Date.now(),
    reason: reason,
    symbol: symbol
  })

  // Keep only last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  metrics.suppressedTriggers = metrics.suppressedTriggers.filter(s => s.timestamp > thirtyDaysAgo)
}

/**
 * Get triggers per day
 * @param {string} symbol - Trading symbol (optional)
 * @returns {number} Triggers per day
 */
export function getTriggersPerDay(symbol = null) {
  const now = Date.now()
  const oneDayAgo = now - (24 * 60 * 60 * 1000)

  let triggers = metrics.triggers.filter(t => t.timestamp > oneDayAgo)
  if (symbol) {
    triggers = triggers.filter(t => t.symbol === symbol)
  }

  return triggers.length
}

/**
 * Get average trigger score
 * @param {string} symbol - Trading symbol (optional)
 * @returns {number} Average trigger score
 */
export function getAvgTriggerScore(symbol = null) {
  const now = Date.now()
  const oneDayAgo = now - (24 * 60 * 60 * 1000)

  let triggers = metrics.triggers.filter(t => t.timestamp > oneDayAgo)
  if (symbol) {
    triggers = triggers.filter(t => t.symbol === symbol)
  }

  if (triggers.length === 0) {
    return 0
  }

  const sum = triggers.reduce((acc, t) => acc + t.score, 0)
  return Math.round(sum / triggers.length)
}

/**
 * Get regime changes per week
 * @param {string} symbol - Trading symbol (optional)
 * @returns {number} Regime changes per week
 */
export function getRegimeChangesPerWeek(symbol = null) {
  const now = Date.now()
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)

  let changes = metrics.regimeChanges.filter(r => r.timestamp > sevenDaysAgo)
  if (symbol) {
    changes = changes.filter(r => r.symbol === symbol)
  }

  return changes.length
}

/**
 * Get AI call rate (calls per day)
 * @param {string} symbol - Trading symbol (optional)
 * @returns {number} AI calls per day
 */
export function getAICallRate(symbol = null) {
  const now = Date.now()
  const oneDayAgo = now - (24 * 60 * 60 * 1000)

  let calls = metrics.aiCalls.filter(c => c.timestamp > oneDayAgo)
  if (symbol) {
    calls = calls.filter(c => c.symbol === symbol)
  }

  return calls.length
}

/**
 * Get suppressed triggers count
 * @param {string} symbol - Trading symbol (optional)
 * @returns {number} Suppressed triggers count
 */
export function getSuppressedTriggers(symbol = null) {
  const now = Date.now()
  const oneDayAgo = now - (24 * 60 * 60 * 1000)

  let suppressed = metrics.suppressedTriggers.filter(s => s.timestamp > oneDayAgo)
  if (symbol) {
    suppressed = suppressed.filter(s => s.symbol === symbol)
  }

  return suppressed.length
}

/**
 * Get all metrics
 * @param {string} symbol - Trading symbol (optional)
 * @returns {Object} All metrics
 */
export function getAllMetrics(symbol = null) {
  return {
    triggers_per_day: getTriggersPerDay(symbol),
    avg_trigger_score: getAvgTriggerScore(symbol),
    regime_changes_per_week: getRegimeChangesPerWeek(symbol),
    ai_call_rate: getAICallRate(symbol),
    suppressed_triggers: getSuppressedTriggers(symbol)
  }
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics() {
  metrics.triggers = []
  metrics.regimeChanges = []
  metrics.aiCalls = []
  metrics.suppressedTriggers = []
}

