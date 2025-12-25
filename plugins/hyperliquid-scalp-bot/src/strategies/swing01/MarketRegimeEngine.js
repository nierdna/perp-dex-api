/**
 * Market Regime Engine
 * Phân tích regime trên 4H timeframe với stability check
 */

// In-memory state: Map<symbol, Array<{ regime, timestamp }>>
const regimeHistory = new Map()

// Stability requirement: Regime phải giữ >= 3-5 candle 4H mới được coi là stable
const STABILITY_MIN_CANDLES = 3
const STABILITY_MAX_CANDLES = 5

/**
 * Analyze market regime on 4H timeframe
 * @param {Object} tf4h - 4H timeframe indicators from calcSwingIndicators
 * @param {string} symbol - Trading symbol
 * @returns {Object} { regime, confidence }
 */
export function analyzeRegime(tf4h, symbol) {
  if (!tf4h || !tf4h.ema200 || !tf4h.close) {
    return {
      regime: 'UNKNOWN',
      confidence: 0
    }
  }

  const currentClose = tf4h.close
  const ema200 = tf4h.ema200
  const structure = tf4h.structure

  // Determine current regime based on price vs EMA200 and structure
  let currentRegime = 'RANGE'
  let confidence = 50

  // TREND_UP: Close > EMA200 + HH/HL structure
  if (currentClose > ema200) {
    if (structure && structure.trend === 'UPTREND') {
      currentRegime = 'TREND_UP'
      confidence = 80
    } else if (structure && structure.trend === 'DOWNTREND') {
      // Price above EMA200 but structure is down -> TRANSITION
      currentRegime = 'TRANSITION'
      confidence = 40
    } else {
      // Price above EMA200 but unclear structure
      currentRegime = 'TREND_UP'
      confidence = 60
    }
  }
  // TREND_DOWN: Close < EMA200 + LH/LL structure
  else if (currentClose < ema200) {
    if (structure && structure.trend === 'DOWNTREND') {
      currentRegime = 'TREND_DOWN'
      confidence = 80
    } else if (structure && structure.trend === 'UPTREND') {
      // Price below EMA200 but structure is up -> TRANSITION
      currentRegime = 'TRANSITION'
      confidence = 40
    } else {
      // Price below EMA200 but unclear structure
      currentRegime = 'TREND_DOWN'
      confidence = 60
    }
  }
  // RANGE: Close near EMA200 + low volatility
  else {
    currentRegime = 'RANGE'
    confidence = 50
  }

  // Check stability: Regime chỉ đổi nếu giữ >= 3-5 candle 4H
  const stableRegime = checkStability(symbol, currentRegime)

  return {
    regime: stableRegime,
    confidence: confidence,
    rawRegime: currentRegime, // Current regime before stability check
    isStable: stableRegime === currentRegime
  }
}

/**
 * Check regime stability
 * @param {string} symbol - Trading symbol
 * @param {string} currentRegime - Current regime
 * @returns {string} Stable regime (may be different from current if not stable yet)
 */
function checkStability(symbol, currentRegime) {
  const history = regimeHistory.get(symbol) || []
  const now = Date.now()

  // Add current regime to history
  history.push({
    regime: currentRegime,
    timestamp: now
  })

  // Keep only last 10 entries
  if (history.length > 10) {
    history.shift()
  }

  regimeHistory.set(symbol, history)

  // Check if current regime has been consistent for >= STABILITY_MIN_CANDLES
  if (history.length < STABILITY_MIN_CANDLES) {
    // Not enough history, return previous stable regime or current
    return history.length > 0 ? history[0].regime : currentRegime
  }

  // Check last N candles
  const recentHistory = history.slice(-STABILITY_MAX_CANDLES)
  const allSame = recentHistory.every(h => h.regime === currentRegime)

  if (allSame && recentHistory.length >= STABILITY_MIN_CANDLES) {
    // Stable regime
    return currentRegime
  }

  // Not stable yet, return previous stable regime
  // Find the most common regime in recent history
  const regimeCounts = {}
  for (const h of recentHistory) {
    regimeCounts[h.regime] = (regimeCounts[h.regime] || 0) + 1
  }

  let mostCommonRegime = currentRegime
  let maxCount = 0
  for (const [regime, count] of Object.entries(regimeCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostCommonRegime = regime
    }
  }

  return mostCommonRegime
}

/**
 * Get current regime for symbol
 * @param {string} symbol - Trading symbol
 * @returns {string|null} Current stable regime
 */
export function getCurrentRegime(symbol) {
  const history = regimeHistory.get(symbol) || []
  if (history.length === 0) {
    return null
  }
  return history[history.length - 1].regime
}

/**
 * Clear regime history for symbol (useful for testing)
 * @param {string} symbol - Trading symbol
 */
export function clearRegimeHistory(symbol) {
  regimeHistory.delete(symbol)
}

