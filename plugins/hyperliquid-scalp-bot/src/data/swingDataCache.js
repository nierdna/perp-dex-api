/**
 * Swing Data Cache Module
 * In-memory cache for Swing01 analysis results
 * Provides HTF context for Scalp strategies
 */

// In-memory cache: Map<symbol, { regime, bias, htf_zone, trigger_score, updatedAt }>
const swingDataCache = new Map()

/**
 * Format zone for display in prompts
 * @param {Object} zone - HTF zone object
 * @returns {string|null} Formatted zone string or null
 */
function formatZone(zone) {
  if (!zone || !zone.type) return null
  const typeMap = {
    DEMAND: 'Demand',
    SUPPLY: 'Supply',
    EMA_RETEST: 'EMA Retest',
    RANGE_EDGE: 'Range Edge'
  }
  const type = typeMap[zone.type] || zone.type
  if (zone.priceRange && zone.priceRange.length >= 2) {
    const low = (zone.priceRange[0] / 1000).toFixed(0)
    const high = (zone.priceRange[1] / 1000).toFixed(0)
    const strength = zone.strength ? ` (Strength: ${zone.strength}/5)` : ''
    return `${type} ${low}k-${high}k${strength}`
  }
  return type
}

/**
 * Format time since last update
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string} Human-readable time difference
 */
function formatTimeSince(timestamp) {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  
  if (diffMins < 1) return '< 1 min'
  if (diffMins < 60) return `${diffMins} mins`
  if (diffHours < 24) return `${diffHours} hours`
  return `${Math.floor(diffHours / 24)} days`
}

/**
 * Check price proximity to HTF zone
 * @param {number} currentPrice - Current market price
 * @param {Object} zone - HTF zone object
 * @returns {string|null} 'AT_ZONE' | 'NEAR_ZONE' | 'FAR_FROM_ZONE' | null
 */
function checkZoneProximity(currentPrice, zone) {
  if (!zone?.priceRange || zone.priceRange.length < 2) return null
  
  const [low, high] = zone.priceRange
  const mid = (low + high) / 2
  const range = high - low
  const distance = Math.abs(currentPrice - mid)
  const proximity = distance / range
  
  if (proximity < 0.5) return 'AT_ZONE'
  if (proximity < 2) return 'NEAR_ZONE'
  return 'FAR_FROM_ZONE'
}

/**
 * Check trend alignment between HTF and scalp signal
 * @param {Object} swingContext - Swing cache data
 * @param {string} scalpDirection - 'LONG' | 'SHORT' | null
 * @returns {string} 'ALIGNED' | 'DIVERGENT' | 'NEUTRAL' | 'UNKNOWN'
 */
function checkTrendAlignment(swingContext, scalpDirection) {
  if (!swingContext?.bias || !scalpDirection) return 'UNKNOWN'
  
  const swingBias = swingContext.bias
  
  // Aligned: Both same direction
  if ((swingBias === 'LONG_ONLY' && scalpDirection === 'LONG') ||
      (swingBias === 'SHORT_ONLY' && scalpDirection === 'SHORT')) {
    return 'ALIGNED'
  }
  
  // Divergent: Opposite directions
  if ((swingBias === 'LONG_ONLY' && scalpDirection === 'SHORT') ||
      (swingBias === 'SHORT_ONLY' && scalpDirection === 'LONG')) {
    return 'DIVERGENT'
  }
  
  // Neutral: Swing has NO_TRADE bias
  if (swingBias === 'NO_TRADE') return 'NEUTRAL'
  
  return 'UNKNOWN'
}

/**
 * Set swing data for a symbol
 * Called when Swing01 executes and generates triggerInfo
 * @param {string} symbol - Trading symbol (e.g., 'BTC')
 * @param {Object} triggerInfo - Full triggerInfo from Swing01
 */
export function setSwingData(symbol, triggerInfo) {
  if (!symbol || !triggerInfo) {
    console.warn('[SwingCache] Invalid parameters for setSwingData')
    return
  }

  // Extract core data only
  const cachedData = {
    regime: triggerInfo.regime || null,
    bias: triggerInfo.bias || null,
    htf_zone: triggerInfo.htf_zone || null,
    trigger_score: triggerInfo.trigger_score || null,
    updatedAt: Date.now()
  }

  swingDataCache.set(symbol, cachedData)
  console.log(`[SwingCache] Updated cache for ${symbol}: regime=${cachedData.regime}, bias=${cachedData.bias}, score=${cachedData.trigger_score}`)
}

/**
 * Get swing data for a symbol
 * Returns latest cached data or null if not available
 * @param {string} symbol - Trading symbol
 * @returns {Object|null} Cached swing data or null
 */
export function getSwingData(symbol) {
  if (!symbol) return null
  
  const cached = swingDataCache.get(symbol)
  if (!cached) {
    return null
  }

  return {
    ...cached,
    // Add formatted zone for convenience
    formattedZone: formatZone(cached.htf_zone)
  }
}

/**
 * Clear swing data for a symbol
 * @param {string} symbol - Trading symbol
 */
export function clearSwingData(symbol) {
  if (symbol) {
    swingDataCache.delete(symbol)
    console.log(`[SwingCache] Cleared cache for ${symbol}`)
  } else {
    swingDataCache.clear()
    console.log('[SwingCache] Cleared all cache')
  }
}

/**
 * Get all cached swing data (for debugging)
 * @returns {Object} Map of all cached data
 */
export function getAllSwingData() {
  const result = {}
  for (const [symbol, data] of swingDataCache.entries()) {
    result[symbol] = {
      ...data,
      formattedZone: formatZone(data.htf_zone)
    }
  }
  return result
}

/**
 * Get formatted zone string for use in prompts
 * @param {Object} zone - HTF zone object
 * @returns {string} Formatted zone string or 'N/A'
 */
export function getFormattedZone(zone) {
  return formatZone(zone) || 'N/A'
}

/**
 * Get enhanced swing data with additional context
 * @param {string} symbol - Trading symbol
 * @param {number} currentPrice - Current market price (optional)
 * @param {string} scalpDirection - Scalp signal direction (optional)
 * @returns {Object|null} Enhanced cached swing data or null
 */
export function getEnhancedSwingData(symbol, currentPrice = null, scalpDirection = null) {
  if (!symbol) return null
  
  const cached = swingDataCache.get(symbol)
  if (!cached) return null
  
  return {
    ...cached,
    formattedZone: formatZone(cached.htf_zone),
    lastUpdated: formatTimeSince(cached.updatedAt),
    zoneProximity: currentPrice ? checkZoneProximity(currentPrice, cached.htf_zone) : null,
    trendAlignment: scalpDirection ? checkTrendAlignment(cached, scalpDirection) : null
  }
}

