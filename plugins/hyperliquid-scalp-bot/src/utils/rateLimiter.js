/**
 * Rate Limiter & Throttle Manager
 * Chống spam API calls khi polling interval ngắn (15s)
 * 
 * Features:
 * - Rate limiting cho Market Data API (Hyperliquid)
 * - Rate limiting cho News API
 * - Rate limiting cho AI API (DeepSeek)
 * - Cache market data trong thời gian ngắn
 */

// Config từ env
const MARKET_DATA_CACHE_MS = parseInt(process.env.MARKET_DATA_CACHE_MS || '10000') // 10s cache
const NEWS_CACHE_MS = parseInt(process.env.NEWS_CACHE_MS || '60000') // 60s cache (news ít thay đổi)
const AI_RATE_LIMIT_MS = parseInt(process.env.AI_RATE_LIMIT_MS || '2000') // Min 2s giữa các AI calls
const MARKET_API_RATE_LIMIT_MS = parseInt(process.env.MARKET_API_RATE_LIMIT_MS || '1000') // Min 1s giữa market API calls
const SKIP_LOG_COOLDOWN_MS = parseInt(process.env.SKIP_LOG_COOLDOWN_MINUTES || '5') * 60 * 1000 // 5 phút cooldown cho SKIP logs
const NO_TRADE_LOG_COOLDOWN_MS = parseInt(process.env.NO_TRADE_LOG_COOLDOWN_MINUTES || '2') * 60 * 1000 // 2 phút cooldown cho NO_TRADE logs

// Cache storage
const marketDataCache = new Map() // Map<symbol, { data, timestamp }>
const newsCache = { data: null, timestamp: 0 }

// Rate limit tracking
const lastAICall = { timestamp: 0 }
const lastMarketAPICall = { timestamp: 0 }

// Database write cooldown tracking: Map<symbol_strategy, { action, timestamp }>
const lastDbWrites = new Map()

/**
 * Get cached market data nếu còn valid
 * @param {string} symbol - Trading symbol
 * @returns {Object|null} - Cached data hoặc null nếu expired
 */
export function getCachedMarketData(symbol) {
  const key = symbol.toUpperCase()
  const cached = marketDataCache.get(key)
  
  if (!cached) return null
  
  const now = Date.now()
  const age = now - cached.timestamp
  
  if (age < MARKET_DATA_CACHE_MS) {
    // Cache còn valid
    return cached.data
  }
  
  // Cache expired, remove
  marketDataCache.delete(key)
  return null
}

/**
 * Cache market data
 * @param {string} symbol - Trading symbol
 * @param {Object} data - Market data
 */
export function cacheMarketData(symbol, data) {
  const key = symbol.toUpperCase()
  marketDataCache.set(key, {
    data,
    timestamp: Date.now()
  })
}

/**
 * Get cached news nếu còn valid
 * @returns {Array|null} - Cached news hoặc null nếu expired
 */
export function getCachedNews() {
  if (!newsCache.data) return null
  
  const now = Date.now()
  const age = now - newsCache.timestamp
  
  if (age < NEWS_CACHE_MS) {
    return newsCache.data
  }
  
  // Cache expired
  newsCache.data = null
  newsCache.timestamp = 0
  return null
}

/**
 * Cache news data
 * @param {Array} data - News array
 */
export function cacheNews(data) {
  newsCache.data = data
  newsCache.timestamp = Date.now()
}

/**
 * Check và throttle AI API calls
 * @returns {boolean} - true nếu được phép gọi AI, false nếu cần đợi
 */
export function canCallAI() {
  const now = Date.now()
  const elapsed = now - lastAICall.timestamp
  
  if (elapsed >= AI_RATE_LIMIT_MS) {
    lastAICall.timestamp = now
    return true
  }
  
  // Cần đợi
  const waitMs = AI_RATE_LIMIT_MS - elapsed
  console.log(`⏸️  AI rate limit: wait ${Math.ceil(waitMs / 1000)}s`)
  return false
}

/**
 * Mark AI call đã thực hiện (manual update nếu cần)
 */
export function markAICall() {
  lastAICall.timestamp = Date.now()
}

/**
 * Check và throttle Market API calls
 * @returns {boolean} - true nếu được phép gọi Market API, false nếu cần đợi
 */
export function canCallMarketAPI() {
  const now = Date.now()
  const elapsed = now - lastMarketAPICall.timestamp
  
  if (elapsed >= MARKET_API_RATE_LIMIT_MS) {
    lastMarketAPICall.timestamp = now
    return true
  }
  
  // Cần đợi (nhưng market API thường nhanh, nên không log)
  return false
}

/**
 * Mark Market API call đã thực hiện
 */
export function markMarketAPICall() {
  lastMarketAPICall.timestamp = Date.now()
}

/**
 * Clear all caches (for testing/debugging)
 */
export function clearCaches() {
  marketDataCache.clear()
  newsCache.data = null
  newsCache.timestamp = 0
}

/**
 * Check xem có nên lưu SKIP log vào database không
 * @param {string} symbol - Trading symbol
 * @param {string} strategy - Strategy name
 * @returns {boolean} - true nếu được phép lưu, false nếu đang trong cooldown
 */
export function shouldSaveSkipLog(symbol, strategy) {
  const key = `${symbol.toUpperCase()}_${strategy}`
  const last = lastDbWrites.get(key)
  
  if (!last || last.action !== 'SKIP') {
    // Chưa có hoặc khác action → cho phép lưu
    return true
  }
  
  const now = Date.now()
  const elapsed = now - last.timestamp
  
  if (elapsed >= SKIP_LOG_COOLDOWN_MS) {
    // Hết cooldown → cho phép
    return true
  }
  
  // Đang trong cooldown → skip
  return false
}

/**
 * Check xem có nên lưu NO_TRADE/REJECTED log vào database không
 * @param {string} symbol - Trading symbol
 * @param {string} strategy - Strategy name
 * @param {string} action - Action (NO_TRADE, REJECTED)
 * @returns {boolean} - true nếu được phép lưu, false nếu đang trong cooldown
 */
export function shouldSaveNoTradeLog(symbol, strategy, action) {
  // OPEN logs luôn được lưu (quan trọng)
  if (action === 'OPEN') {
    return true
  }
  
  const key = `${symbol.toUpperCase()}_${strategy}`
  const last = lastDbWrites.get(key)
  
  if (!last || (last.action !== 'NO_TRADE' && last.action !== 'REJECTED')) {
    // Chưa có hoặc khác action → cho phép lưu
    return true
  }
  
  const now = Date.now()
  const elapsed = now - last.timestamp
  
  if (elapsed >= NO_TRADE_LOG_COOLDOWN_MS) {
    // Hết cooldown → cho phép
    return true
  }
  
  // Đang trong cooldown → skip
  return false
}

/**
 * Mark đã lưu log vào database
 * @param {string} symbol - Trading symbol
 * @param {string} strategy - Strategy name
 * @param {string} action - Action (SKIP, NO_TRADE, REJECTED, OPEN)
 */
export function markDbWrite(symbol, strategy, action) {
  const key = `${symbol.toUpperCase()}_${strategy}`
  lastDbWrites.set(key, {
    action,
    timestamp: Date.now()
  })
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats() {
  return {
    marketDataCacheSize: marketDataCache.size,
    newsCached: newsCache.data !== null,
    lastAICallAge: Date.now() - lastAICall.timestamp,
    lastMarketAPICallAge: Date.now() - lastMarketAPICall.timestamp,
    dbWriteCooldownSize: lastDbWrites.size
  }
}

