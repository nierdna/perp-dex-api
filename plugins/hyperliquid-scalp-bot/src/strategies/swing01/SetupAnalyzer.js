/**
 * Setup Analyzer
 * Track setup lifecycle: FORMING → MATURE → STALE / FAILED
 */

// In-memory state: Map<symbol, { state, age, createdAt, zoneId }>
const setupStates = new Map()

// Age thresholds (in 4H candles)
const MATURE_AGE_MIN = 2 // >= 2-3 candle 4H
const MATURE_AGE_MAX = 3
const STALE_AGE = 6 // > 6-10 candle 4H không expansion

/**
 * Setup states
 */
export const SETUP_STATES = {
  FORMING: 'FORMING',
  MATURE: 'MATURE',
  STALE: 'STALE',
  FAILED: 'FAILED'
}

/**
 * Analyze setup state
 * @param {Object} zone - Active zone
 * @param {Object} tf4h - 4H timeframe indicators
 * @param {string} symbol - Trading symbol
 * @returns {Object} { state, age }
 */
export function analyzeSetup(zone, tf4h, symbol) {
  if (!zone || !tf4h) {
    return {
      state: SETUP_STATES.FAILED,
      age: 0
    }
  }

  const currentClose = tf4h.close
  const zoneId = `${zone.type}_${zone.priceRange[0]}_${zone.priceRange[1]}`

  // Check if price is touching zone
  const isInZone = currentClose >= zone.priceRange[0] && currentClose <= zone.priceRange[1]

  // Check HTF structure intact
  const structureIntact = tf4h.structure && tf4h.structure.trend !== 'UNKNOWN'

  // Check volume pullback (volume should decrease when in pullback)
  const volumePullback = tf4h.volRatio < 1.0 // Volume below average

  // Get existing setup state
  const existingSetup = setupStates.get(symbol)

  // FORMING: Chạm HTF zone + HTF structure intact + Volume pullback giảm
  if (isInZone && structureIntact && volumePullback) {
    if (!existingSetup || existingSetup.zoneId !== zoneId) {
      // New setup forming
      setupStates.set(symbol, {
        state: SETUP_STATES.FORMING,
        age: 1, // 1 candle 4H
        createdAt: Date.now(),
        zoneId: zoneId,
        lastUpdate: Date.now()
      })

      return {
        state: SETUP_STATES.FORMING,
        age: 1
      }
    }

    // Existing setup, increment age
    const age = existingSetup.age + 1
    const state = age >= MATURE_AGE_MIN && age <= MATURE_AGE_MAX
      ? SETUP_STATES.MATURE
      : age > STALE_AGE
        ? SETUP_STATES.STALE
        : SETUP_STATES.FORMING

    setupStates.set(symbol, {
      ...existingSetup,
      state: state,
      age: age,
      lastUpdate: Date.now()
    })

    return {
      state: state,
      age: age
    }
  }

  // Setup conditions not met
  if (existingSetup) {
    // Check if setup failed (price moved away from zone)
    const movedAway = (zone.type === 'DEMAND' && currentClose < zone.priceRange[0]) ||
                      (zone.type === 'SUPPLY' && currentClose > zone.priceRange[1])

    if (movedAway && !isInZone) {
      setupStates.set(symbol, {
        ...existingSetup,
        state: SETUP_STATES.FAILED,
        age: existingSetup.age,
        lastUpdate: Date.now()
      })

      return {
        state: SETUP_STATES.FAILED,
        age: existingSetup.age
      }
    }

    // Setup still valid but conditions not met (waiting)
    return {
      state: existingSetup.state,
      age: existingSetup.age
    }
  }

  // No setup
  return {
    state: null,
    age: 0
  }
}

/**
 * Get current setup state for symbol
 * @param {string} symbol - Trading symbol
 * @returns {Object|null} Current setup state
 */
export function getCurrentSetup(symbol) {
  return setupStates.get(symbol) || null
}

/**
 * Clear setup state for symbol (useful for testing)
 * @param {string} symbol - Trading symbol
 */
export function clearSetup(symbol) {
  setupStates.delete(symbol)
}

