import axios from 'axios'

const API_URL = 'https://api.hyperliquid.xyz/info'
const SYMBOL = process.env.SYMBOL || 'ETH'
const INTERVAL = process.env.TIMEFRAME || '15m'

async function getCandles() {
  try {
    const response = await axios.post(API_URL, {
      type: 'candleSnapshot',
      req: { coin: SYMBOL, interval: INTERVAL, startTime: Date.now() - 24 * 60 * 60 * 1000 } // req logic vary, often just coin/interval implies recent
    })
    // API trả về mảng nến: { t, o, h, l, c, v }
    return response.data
  } catch (error) {
    console.error('❌ Get Candles Error:', error.message)
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

export async function getMarketSnapshot() {
  // Chạy song song 2 request cho nhanh
  const [candles, meta] = await Promise.all([getCandles(), getMeta()])

  if (!candles.length || !meta) {
    console.warn('⚠️ Market data incomplete')
    return null
  }

  // Tìm thông tin coin hiện tại trong meta
  // universe chứa danh sách coin, assetCtxs chứa giá/funding
  const coinIndex = meta[0].universe.findIndex(u => u.name === SYMBOL)
  const assetCtx = meta[1][coinIndex]

  // Giá hiện tại (mark price hoặc mid price)
  const currentPrice = parseFloat(assetCtx.markPx)

  // Funding rate (hourly formatted)
  const fundingRate = parseFloat(assetCtx.funding)

  return {
    symbol: SYMBOL,
    price: currentPrice,
    candles: candles, // Array of {t, o, h, l, c, v}
    funding: fundingRate,
    openInterest: parseFloat(assetCtx.openInterest),
    // Mock account vì ta không login
    account: { hasPosition: false, dailyLoss: 0 }
  }
}