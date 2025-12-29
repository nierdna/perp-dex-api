import http from '../utils/httpClient.js'
import { getCachedMarketData, cacheMarketData, canCallMarketAPI, markMarketAPICall, getCachedMeta, cacheMeta } from '../utils/rateLimiter.js'

const API_URL = 'https://api.hyperliquid.xyz/info'

// Retry logic với exponential backoff cho 429 errors
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // Chỉ retry nếu là 429 (rate limit)
      if (error.response?.status === 429 && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff: 1s, 2s, 4s
        console.warn(`⚠️ Rate limit 429, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}

async function getCandles(symbol, interval) {
  // Tính số giờ/ngày cần lấy dựa trên interval để đủ 250 nến
  let hoursNeeded = 0
  let daysNeeded = 0
  
  if (interval === '1d') {
    daysNeeded = 250 // 250 ngày
  } else if (interval === '4h') {
    hoursNeeded = 250 * 4 // 250*4 = 1000 giờ (~42 ngày)
  } else if (interval === '1h') {
    hoursNeeded = 250 // 250 giờ (~10.4 ngày)
  } else if (interval === '30m') {
    hoursNeeded = 250 * 0.5 // 125 giờ (~5.2 ngày)
  } else if (interval === '15m') {
    hoursNeeded = 63 // 250*15/60=62.5h
  } else if (interval === '5m') {
    hoursNeeded = 21 // 250*5/60=20.8h
  } else {
    hoursNeeded = 5 // 1m: 250/60=4.2h
  }
  
  const startTime = daysNeeded > 0 
    ? Date.now() - (daysNeeded * 24 * 60 * 60 * 1000)
    : Date.now() - (hoursNeeded * 60 * 60 * 1000)

  try {
    const response = await retryWithBackoff(() => 
      http.post(API_URL, {
        type: 'candleSnapshot',
        req: { coin: symbol, interval: interval, startTime: startTime }
      })
    )
    return response.data
  } catch (error) {
    console.error(`❌ Get Candles Error (${symbol} ${interval}):`, error.message)
    return []
  }
}

export async function getBacktestCandles(symbol, interval, startTime, endTime) {
  try {
    const response = await http.post(API_URL, {
      type: 'candleSnapshot',
      req: { coin: symbol, interval: interval, startTime: startTime, endTime: endTime }
    })
    return response.data
  } catch (error) {
    console.error(`❌ Backtest Data Error (${interval}):`, error.message)
    return []
  }
}

async function getMeta() {
  // Check cache trước (meta dùng chung cho tất cả symbols)
  const cached = getCachedMeta()
  if (cached) {
    return cached
  }

  try {
    const response = await retryWithBackoff(() => 
      http.post(API_URL, { type: 'metaAndAssetCtxs' })
    )
    const metaData = response.data
    
    // Cache meta
    cacheMeta(metaData)
    
    return metaData
  } catch (error) {
    console.error('❌ Get Meta Error:', error.message)
    return null
  }
}

export async function getMarketSnapshot(symbol = null) {
  // Default symbol: BTC (theo yêu cầu)
  const targetSymbol = symbol || process.env.SYMBOL?.split(',')[0]?.trim() || 'BTC'
  
  // Check cache trước
  const cached = getCachedMarketData(targetSymbol)
  if (cached) {
    return cached
  }
  
  // Rate limit check - đợi nếu cần
  if (!canCallMarketAPI()) {
    // Đợi một chút trước khi gọi API
    const waitTime = 1000 // 1s
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  
  // Lấy 3 khung thời gian song song (nhưng stagger nhẹ để tránh rate limit)
  // Meta được cache riêng nên không cần đợi
  const meta = await getMeta()
  
  // Stagger candles requests (mỗi request cách nhau 200ms)
  const candles15m = await getCandles(targetSymbol, '15m')
  markMarketAPICall()
  
  await new Promise(resolve => setTimeout(resolve, 200))
  const candles5m = await getCandles(targetSymbol, '5m')
  markMarketAPICall()
  
  await new Promise(resolve => setTimeout(resolve, 200))
  const candles1m = await getCandles(targetSymbol, '1m')
  markMarketAPICall()

  if (!candles15m.length || !candles5m.length || !candles1m.length || !meta) {
    console.warn(`⚠️ Market data incomplete for ${targetSymbol}`)
    return null
  }

  // Tìm thông tin coin hiện tại trong meta
  // universe chứa danh sách coin, assetCtxs chứa giá/funding
  const coinIndex = meta[0].universe.findIndex(u => u.name === targetSymbol)
  if (coinIndex === -1) {
    console.warn(`⚠️ Symbol ${targetSymbol} not found in universe`)
    return null
  }
  const assetCtx = meta[1][coinIndex]

  // Giá hiện tại (mark price hoặc mid price)
  const currentPrice = parseFloat(assetCtx.markPx)

  // Funding rate (hourly formatted)
  const fundingRate = parseFloat(assetCtx.funding)

  const marketData = {
    symbol: targetSymbol,
    price: currentPrice,

    // Multi-timeframe candles
    candles_15m: candles15m,
    candles_5m: candles5m,
    candles_1m: candles1m,

    funding: fundingRate,
    openInterest: parseFloat(assetCtx.openInterest),
    // Mock account vì ta không login
    account: { hasPosition: false, dailyLoss: 0 }
  }
  
  // Cache data
  cacheMarketData(targetSymbol, marketData)
  
  return marketData
}

/**
 * Get market snapshot for Swing01 strategy (includes 1D, 4H, 1H, 30M timeframes)
 * @param {string} symbol - Trading symbol (default: BTC)
 * @returns {Object|null} Market data with swing timeframes
 */
export async function getSwingMarketSnapshot(symbol = null) {
  const targetSymbol = symbol || process.env.SYMBOL?.split(',')[0]?.trim() || 'BTC'
  
  // Check cache trước (có thể cache riêng cho swing)
  const cached = getCachedMarketData(targetSymbol)
  if (cached && cached.candles_1d && cached.candles_4h && cached.candles_1h && cached.candles_30m) {
    return cached
  }
  
  // Rate limit check
  if (!canCallMarketAPI()) {
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const meta = await getMeta()
  
  // Fetch swing timeframes với stagger để tránh rate limit
  const candles1d = await getCandles(targetSymbol, '1d')
  markMarketAPICall()
  
  await new Promise(resolve => setTimeout(resolve, 200))
  const candles4h = await getCandles(targetSymbol, '4h')
  markMarketAPICall()
  
  await new Promise(resolve => setTimeout(resolve, 200))
  const candles1h = await getCandles(targetSymbol, '1h')
  markMarketAPICall()
  
  await new Promise(resolve => setTimeout(resolve, 200))
  const candles30m = await getCandles(targetSymbol, '30m')
  markMarketAPICall()
  
  if (!candles1d.length || !candles4h.length || !candles1h.length || !candles30m.length || !meta) {
    console.warn(`⚠️ Swing market data incomplete for ${targetSymbol}`)
    return null
  }
  
  const coinIndex = meta[0].universe.findIndex(u => u.name === targetSymbol)
  if (coinIndex === -1) {
    console.warn(`⚠️ Symbol ${targetSymbol} not found in universe`)
    return null
  }
  const assetCtx = meta[1][coinIndex]
  
  const currentPrice = parseFloat(assetCtx.markPx)
  const fundingRate = parseFloat(assetCtx.funding)
  
  const marketData = {
    symbol: targetSymbol,
    price: currentPrice,
    
    // Swing timeframes
    candles_1d: candles1d,
    candles_4h: candles4h,
    candles_1h: candles1h,
    candles_30m: candles30m,
    
    // Also include Scalp timeframes for compatibility
    candles_15m: [],
    candles_5m: [],
    candles_1m: [],
    
    funding: fundingRate,
    openInterest: parseFloat(assetCtx.openInterest),
    account: { hasPosition: false, dailyLoss: 0 }
  }
  
  // Cache data
  cacheMarketData(targetSymbol, marketData)
  
  return marketData
}