/**
 * Bias Engine
 * Map regime → bias, lock 24-48h
 */

// In-memory state: Map<symbol, { bias, lockedUntil }>
const biasLocks = new Map()

// Lock duration: 24-48 hours
const LOCK_DURATION_MIN_MS = 24 * 60 * 60 * 1000 // 24 hours
const LOCK_DURATION_MAX_MS = 48 * 60 * 60 * 1000 // 48 hours

/**
 * Get bias from regime
 * @param {string} regime - Market regime (TREND_UP, TREND_DOWN, RANGE, TRANSITION)
 * @param {string} symbol - Trading symbol
 * @returns {Object} { bias, lockedUntil }
 */
export function getBias(regime, symbol) {
  // Check if bias is locked
  const lock = biasLocks.get(symbol)
  const now = Date.now()

  if (lock && lock.lockedUntil > now) {
    // Bias is still locked, return locked bias
    return {
      bias: lock.bias,
      lockedUntil: lock.lockedUntil,
      isLocked: true
    }
  }

  // Map regime to bias
  let newBias = 'NO_TRADE'

  if (regime === 'TREND_UP') {
    newBias = 'LONG_ONLY'
  } else if (regime === 'TREND_DOWN') {
    newBias = 'SHORT_ONLY'
  } else {
    // RANGE or TRANSITION -> NO_TRADE
    newBias = 'NO_TRADE'
  }

  // If bias changed, lock it for 24-48h
  if (!lock || lock.bias !== newBias) {
    // Random lock duration between 24-48h
    const lockDuration = LOCK_DURATION_MIN_MS + Math.random() * (LOCK_DURATION_MAX_MS - LOCK_DURATION_MIN_MS)
    const lockedUntil = now + lockDuration

    biasLocks.set(symbol, {
      bias: newBias,
      lockedUntil: lockedUntil
    })

    return {
      bias: newBias,
      lockedUntil: lockedUntil,
      isLocked: true,
      isNewLock: true
    }
  }

  // Bias unchanged, extend lock if needed
  if (lock && lock.lockedUntil <= now) {
    // Lock expired but bias unchanged, extend lock
    const lockDuration = LOCK_DURATION_MIN_MS + Math.random() * (LOCK_DURATION_MAX_MS - LOCK_DURATION_MIN_MS)
    const lockedUntil = now + lockDuration

    biasLocks.set(symbol, {
      bias: newBias,
      lockedUntil: lockedUntil
    })

    return {
      bias: newBias,
      lockedUntil: lockedUntil,
      isLocked: true
    }
  }

  // Bias unchanged and still locked
  return {
    bias: lock.bias,
    lockedUntil: lock.lockedUntil,
    isLocked: true
  }
}

/**
 * Get current bias for symbol
 * @param {string} symbol - Trading symbol
 * @returns {string|null} Current bias
 */
export function getCurrentBias(symbol) {
  const lock = biasLocks.get(symbol)
  if (!lock) {
    return null
  }
  return lock.bias
}

/**
 * Clear bias lock for symbol (useful for testing)
 * @param {string} symbol - Trading symbol
 */
export function clearBiasLock(symbol) {
  biasLocks.delete(symbol)
}

