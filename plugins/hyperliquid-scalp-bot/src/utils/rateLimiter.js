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
const MARKET_DATA_CACHE_MS = parseInt(process.env.MARKET_DATA_CACHE_MS || '30000') // 30s cache (tăng từ 10s để giảm API calls)
const NEWS_CACHE_MS = parseInt(process.env.NEWS_CACHE_MS || '60000') // 60s cache (news ít thay đổi)
const AI_RATE_LIMIT_MS = parseInt(process.env.AI_RATE_LIMIT_MS || '2000') // Min 2s giữa các AI calls
const MARKET_API_RATE_LIMIT_MS = parseInt(process.env.MARKET_API_RATE_LIMIT_MS || '2000') // Min 2s giữa market API calls (tăng từ 1s)
const META_CACHE_MS = parseInt(process.env.META_CACHE_MS || '10000') // 10s cache cho meta (dùng chung cho tất cả symbols)
const SKIP_LOG_COOLDOWN_MS = parseInt(process.env.SKIP_LOG_COOLDOWN_MINUTES || '5') * 60 * 1000 // 5 phút cooldown cho SKIP logs
const NO_TRADE_LOG_COOLDOWN_MS = parseInt(process.env.NO_TRADE_LOG_COOLDOWN_MINUTES || '2') * 60 * 1000 // 2 phút cooldown cho NO_TRADE logs
const OPEN_LOG_COOLDOWN_MS = parseInt(process.env.OPEN_LOG_COOLDOWN_MINUTES || '10') * 60 * 1000 // 10 phút cooldown cho OPEN logs (LONG/SHORT cùng action)

// Cache storage
const marketDataCache = new Map() // Map<symbol, { data, timestamp }>
const newsCache = { data: null, timestamp: 0 }
const metaCache = { data: null, timestamp: 0 } // Meta dùng chung cho tất cả symbols

// Rate limit tracking
const lastAICall = { timestamp: 0 }
const lastMarketAPICall = { timestamp: 0 }

// Database write cooldown tracking: Map<symbol_strategy, { action, timestamp, aiAction }>
// aiAction: LONG/SHORT để check cooldown cho OPEN logs
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
 * Get cached meta data nếu còn valid
 * @returns {Object|null} - Cached meta hoặc null nếu expired
 */
export function getCachedMeta() {
  if (!metaCache.data) return null
  
  const now = Date.now()
  const age = now - metaCache.timestamp
  
  if (age < META_CACHE_MS) {
    return metaCache.data
  }
  
  // Cache expired
  metaCache.data = null
  metaCache.timestamp = 0
  return null
}

/**
 * Cache meta data (dùng chung cho tất cả symbols)
 * @param {Object} data - Meta data
 */
export function cacheMeta(data) {
  metaCache.data = data
  metaCache.timestamp = Date.now()
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
 * Check xem có nên lưu NO_TRADE/REJECTED/OPEN log vào database không
 * @param {string} symbol - Trading symbol
 * @param {string} strategy - Strategy name
 * @param {string} action - Action (NO_TRADE, REJECTED, OPEN)
 * @param {string} aiAction - AI action (LONG, SHORT) - chỉ cần khi action === 'OPEN'
 * @returns {boolean} - true nếu được phép lưu, false nếu đang trong cooldown
 */
export function shouldSaveNoTradeLog(symbol, strategy, action, aiAction = null) {
  // Validate inputs
  if (!symbol || typeof symbol !== 'string') {
    console.warn(`[RateLimiter] Invalid symbol in shouldSaveNoTradeLog: ${symbol}`)
    return false // DON'T save if symbol is invalid (will cause DB error)
  }
  if (!strategy || typeof strategy !== 'string') {
    console.warn(`[RateLimiter] Invalid strategy in shouldSaveNoTradeLog: ${strategy}`)
    return false
  }
  if (!action || typeof action !== 'string') {
    console.warn(`[RateLimiter] Invalid action in shouldSaveNoTradeLog: ${action}`)
    return false
  }
  
  const key = `${symbol.toUpperCase()}_${strategy}`
  const last = lastDbWrites.get(key)
  
  // OPEN logs: check cooldown dựa trên aiAction (LONG/SHORT)
  if (action === 'OPEN' && (aiAction === 'LONG' || aiAction === 'SHORT')) {
    if (!last || last.action !== 'OPEN') {
      // Chưa có OPEN log → cho phép
      return true
    }
    
    // Nếu khác action (LONG → SHORT hoặc ngược lại) → cho phép (có thể là reverse)
    if (last.aiAction && last.aiAction !== aiAction) {
      return true
    }
    
    // Cùng action (LONG → LONG hoặc SHORT → SHORT) → check cooldown
    const now = Date.now()
    const elapsed = now - last.timestamp
    
    if (elapsed >= OPEN_LOG_COOLDOWN_MS) {
      // Hết cooldown → cho phép
      return true
    }
    
    // Đang trong cooldown → skip
    const remainingMinutes = Math.ceil((OPEN_LOG_COOLDOWN_MS - elapsed) / 60000)
    console.log(`⏸️  DB cooldown: ${symbol} ${aiAction} (${remainingMinutes}min remaining)`)
    return false
  }
  
  // NO_TRADE/REJECTED logs
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
 * @param {string} aiAction - AI action (LONG, SHORT) - chỉ cần khi action === 'OPEN'
 */
export function markDbWrite(symbol, strategy, action, aiAction = null) {
  // Validate inputs before marking
  if (!symbol || typeof symbol !== 'string') {
    console.warn(`[RateLimiter] Invalid symbol in markDbWrite: ${symbol}`)
    return
  }
  if (!strategy || typeof strategy !== 'string') {
    console.warn(`[RateLimiter] Invalid strategy in markDbWrite: ${strategy}`)
    return
  }
  if (!action || typeof action !== 'string') {
    console.warn(`[RateLimiter] Invalid action in markDbWrite: ${action}`)
    return
  }
  
  const key = `${symbol.toUpperCase()}_${strategy}`
  lastDbWrites.set(key, {
    action,
    aiAction: action === 'OPEN' ? aiAction : null, // Chỉ lưu aiAction cho OPEN logs
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

