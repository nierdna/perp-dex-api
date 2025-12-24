import axios from 'axios'

const API_URL = 'https://api.hyperliquid.xyz/info'

async function getCandles(symbol, interval) {
  try {
    // Tính số giờ cần lấy dựa trên interval để đủ 250 nến
    const hoursNeeded = interval === '15m' ? 63 : interval === '5m' ? 21 : 5 // 15m: 250*15/60=62.5h, 5m: 250*5/60=20.8h, 1m: 250/60=4.2h
    const startTime = Date.now() - (hoursNeeded * 60 * 60 * 1000)

    const response = await axios.post(API_URL, {
      type: 'candleSnapshot',
      req: { coin: symbol, interval: interval, startTime: startTime }
    })
    return response.data
  } catch (error) {
    console.error(`❌ Get Candles Error (${symbol} ${interval}):`, error.message)
    return []
  }
}

export async function getBacktestCandles(symbol, interval, startTime, endTime) {
  try {
    const response = await axios.post(API_URL, {
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
  try {
    const response = await axios.post(API_URL, { type: 'metaAndAssetCtxs' })
    return response.data
  } catch (error) {
    console.error('❌ Get Meta Error:', error.message)
    return null
  }
}

export async function getMarketSnapshot(symbol = null) {
  // Default symbol: BTC (theo yêu cầu)
  const targetSymbol = symbol || process.env.SYMBOL?.split(',')[0]?.trim() || 'BTC'
  
  // Lấy 3 khung thời gian song song
  const [candles15m, candles5m, candles1m, meta] = await Promise.all([
    getCandles(targetSymbol, '15m'),
    getCandles(targetSymbol, '5m'),
    getCandles(targetSymbol, '1m'),
    getMeta()
  ])

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

  return {
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
}