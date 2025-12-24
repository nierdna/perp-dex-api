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
  // Tính số giờ cần lấy dựa trên interval để đủ 250 nến
  const hoursNeeded = interval === '15m' ? 63 : interval === '5m' ? 21 : 5 // 15m: 250*15/60=62.5h, 5m: 250*5/60=20.8h, 1m: 250/60=4.2h
  const startTime = Date.now() - (hoursNeeded * 60 * 60 * 1000)

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