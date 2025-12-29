/**
 * Swing Cooldown Manager
 * Rules:
 * - Per zone: 12-24h
 * - Per setup: 24-48h
 * - Global: max 2-3 alerts/day
 */

// Cooldown durations
const ZONE_COOLDOWN_MIN_MS = 12 * 60 * 60 * 1000 // 12 hours
const ZONE_COOLDOWN_MAX_MS = 24 * 60 * 60 * 1000 // 24 hours
const SETUP_COOLDOWN_MIN_MS = 24 * 60 * 60 * 1000 // 24 hours
const SETUP_COOLDOWN_MAX_MS = 48 * 60 * 60 * 1000 // 48 hours
const GLOBAL_MAX_ALERTS_PER_DAY = 3

// State: Map<symbol, { lastAlert, dailyCount, zoneCooldowns, setupCooldowns }>
const cooldownState = new Map()

/**
 * Check if alert can be sent
 * @param {string} symbol - Trading symbol
 * @param {string} zoneId - Zone identifier
 * @param {string} setupId - Setup identifier
 * @returns {Object} { canSend, reason }
 */
export function canSendAlert(symbol, zoneId, setupId) {
  const now = Date.now()
  const state = cooldownState.get(symbol) || {
    lastAlert: null,
    dailyCount: 0,
    zoneCooldowns: new Map(),
    setupCooldowns: new Map(),
    dailyResetTime: getDailyResetTime()
  }

  // Reset daily count if new day
  if (now >= state.dailyResetTime) {
    state.dailyCount = 0
    state.dailyResetTime = getDailyResetTime()
  }

  // 1. Check global daily limit
  if (state.dailyCount >= GLOBAL_MAX_ALERTS_PER_DAY) {
    return {
      canSend: false,
      reason: `Global daily limit reached (${state.dailyCount}/${GLOBAL_MAX_ALERTS_PER_DAY})`
    }
  }

  // 2. Check zone cooldown
  if (zoneId && state.zoneCooldowns.has(zoneId)) {
    const zoneCooldown = state.zoneCooldowns.get(zoneId)
    if (now < zoneCooldown.until) {
      const remainingHours = Math.ceil((zoneCooldown.until - now) / (60 * 60 * 1000))
      return {
        canSend: false,
        reason: `Zone cooldown active (${remainingHours}h remaining)`
      }
    }
  }

  // 3. Check setup cooldown
  if (setupId && state.setupCooldowns.has(setupId)) {
    const setupCooldown = state.setupCooldowns.get(setupId)
    if (now < setupCooldown.until) {
      const remainingHours = Math.ceil((setupCooldown.until - now) / (60 * 60 * 1000))
      return {
        canSend: false,
        reason: `Setup cooldown active (${remainingHours}h remaining)`
      }
    }
  }

  return {
    canSend: true,
    reason: null
  }
}

/**
 * Mark alert as sent
 * @param {string} symbol - Trading symbol
 * @param {string} zoneId - Zone identifier
 * @param {string} setupId - Setup identifier
 */
export function markAlertSent(symbol, zoneId, setupId) {
  const now = Date.now()
  let state = cooldownState.get(symbol)

  if (!state) {
    state = {
      lastAlert: null,
      dailyCount: 0,
      zoneCooldowns: new Map(),
      setupCooldowns: new Map(),
      dailyResetTime: getDailyResetTime()
    }
  }

  // Reset daily count if new day
  if (now >= state.dailyResetTime) {
    state.dailyCount = 0
    state.dailyResetTime = getDailyResetTime()
  }

  // Update last alert
  state.lastAlert = now

  // Increment daily count
  state.dailyCount++

  // Set zone cooldown (12-24h)
  if (zoneId) {
    const zoneCooldownDuration = ZONE_COOLDOWN_MIN_MS + 
      Math.random() * (ZONE_COOLDOWN_MAX_MS - ZONE_COOLDOWN_MIN_MS)
    state.zoneCooldowns.set(zoneId, {
      until: now + zoneCooldownDuration
    })
  }

  // Set setup cooldown (24-48h)
  if (setupId) {
    const setupCooldownDuration = SETUP_COOLDOWN_MIN_MS + 
      Math.random() * (SETUP_COOLDOWN_MAX_MS - SETUP_COOLDOWN_MIN_MS)
    state.setupCooldowns.set(setupId, {
      until: now + setupCooldownDuration
    })
  }

  cooldownState.set(symbol, state)
}

/**
 * Get daily reset time (midnight UTC)
 */
function getDailyResetTime() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCHours(0, 0, 0, 0)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.getTime()
}

/**
 * Get cooldown state for symbol (for debugging)
 * @param {string} symbol - Trading symbol
 * @returns {Object} Cooldown state
 */
export function getCooldownState(symbol) {
  return cooldownState.get(symbol) || null
}

/**
 * Clear cooldown for symbol (useful for testing)
 * @param {string} symbol - Trading symbol
 */
export function clearCooldown(symbol) {
  cooldownState.delete(symbol)
}

