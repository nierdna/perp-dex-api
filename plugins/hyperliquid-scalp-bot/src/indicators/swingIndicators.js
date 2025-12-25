import { EMA } from 'technicalindicators'

/**
 * Calculate swing indicators for 1D, 4H, 1H, 30M timeframes
 * @param {Object} market - Market data with candles_1d, candles_4h, candles_1h, candles_30m
 * @param {Object} options - Options { excludeLastCandle: boolean }
 * @returns {Object} Indicators for each timeframe
 */
export function calcSwingIndicators(market, options = {}) {
  if (!market || !market.candles_1d || !market.candles_4h || !market.candles_1h || !market.candles_30m) {
    return {
      tf1d: null,
      tf4h: null,
      tf1h: null,
      tf30m: null
    }
  }

  const { excludeLastCandle = false } = options

  // Helper: Analyze timeframe
  function analyzeTimeframe(candles, excludeLast = false) {
    const data = excludeLast ? candles.slice(0, -1) : candles
    if (data.length < 200) return null // Need enough data for EMA200

    const closes = data.map(c => parseFloat(c.c))
    const highs = data.map(c => parseFloat(c.h))
    const lows = data.map(c => parseFloat(c.l))
    const volumes = data.map(c => parseFloat(c.v))

    // EMA200 for trend analysis
    const ema200 = EMA.calculate({ period: 200, values: closes })

    // EMA50 for LTF confirmation
    const ema50 = EMA.calculate({ period: 50, values: closes })

    // Volume analysis
    const recentVolumes = volumes.slice(-20)
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
    const currentVol = volumes[volumes.length - 1]
    const volRatio = avgVolume > 0 ? (currentVol / avgVolume) : 0

    // Structure detection (HH/HL for uptrend, LH/LL for downtrend)
    const structure = detectStructure(data)

    return {
      ema200: ema200[ema200.length - 1],
      prevEma200: ema200.length >= 2 ? ema200[ema200.length - 2] : null,
      ema50: ema50[ema50.length - 1],
      prevEma50: ema50.length >= 2 ? ema50[ema50.length - 2] : null,
      close: closes[closes.length - 1],
      prevClose: closes.length >= 2 ? closes[closes.length - 2] : null,
      high: highs[highs.length - 1],
      low: lows[lows.length - 1],
      volume: currentVol,
      volRatio: volRatio,
      structure: structure,
      candles: data // Keep candles for BOS detection
    }
  }

  const tf1d = analyzeTimeframe(market.candles_1d, excludeLastCandle)
  const tf4h = analyzeTimeframe(market.candles_4h, excludeLastCandle)
  const tf1h = analyzeTimeframe(market.candles_1h, excludeLastCandle)
  const tf30m = analyzeTimeframe(market.candles_30m, excludeLastCandle)

  return {
    tf1d,
    tf4h,
    tf1h,
    tf30m
  }
}

/**
 * Detect market structure (HH/HL for uptrend, LH/LL for downtrend)
 * @param {Array} candles - Array of candle objects
 * @returns {Object} Structure info
 */
function detectStructure(candles) {
  if (candles.length < 20) {
    return { trend: 'UNKNOWN', lastSwing: null, swings: [] }
  }

  const highs = candles.map(c => parseFloat(c.h))
  const lows = candles.map(c => parseFloat(c.l))

  // Find swing highs and lows (simplified: local maxima/minima)
  const swings = []
  const lookback = 5

  for (let i = lookback; i < candles.length - lookback; i++) {
    // Check for swing high
    let isSwingHigh = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && highs[j] >= highs[i]) {
        isSwingHigh = false
        break
      }
    }
    if (isSwingHigh) {
      swings.push({ type: 'HIGH', index: i, price: highs[i] })
    }

    // Check for swing low
    let isSwingLow = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && lows[j] <= lows[i]) {
        isSwingLow = false
        break
      }
    }
    if (isSwingLow) {
      swings.push({ type: 'LOW', index: i, price: lows[i] })
    }
  }

  // Analyze structure
  const recentSwings = swings.slice(-6) // Last 6 swings
  if (recentSwings.length < 4) {
    return { trend: 'UNKNOWN', lastSwing: recentSwings[recentSwings.length - 1] || null, swings: recentSwings }
  }

  // Check for HH/HL (uptrend) or LH/LL (downtrend)
  let trend = 'UNKNOWN'
  const highsOnly = recentSwings.filter(s => s.type === 'HIGH')
  const lowsOnly = recentSwings.filter(s => s.type === 'LOW')

  if (highsOnly.length >= 2 && lowsOnly.length >= 2) {
    const lastHigh = highsOnly[highsOnly.length - 1].price
    const prevHigh = highsOnly[highsOnly.length - 2].price
    const lastLow = lowsOnly[lowsOnly.length - 1].price
    const prevLow = lowsOnly[lowsOnly.length - 2].price

    if (lastHigh > prevHigh && lastLow > prevLow) {
      trend = 'UPTREND' // HH + HL
    } else if (lastHigh < prevHigh && lastLow < prevLow) {
      trend = 'DOWNTREND' // LH + LL
    } else {
      trend = 'RANGE'
    }
  }

  return {
    trend,
    lastSwing: recentSwings[recentSwings.length - 1] || null,
    swings: recentSwings
  }
}

/**
 * Detect Break of Structure (BOS)
 * @param {Array} candles - Array of candle objects
 * @param {string} timeframe - Timeframe identifier ('1h', '30m')
 * @returns {Object} BOS detection result
 */
export function detectBOS(candles, timeframe) {
  if (!candles || candles.length < 20) {
    return { detected: false, type: null, price: null, confirmed: false }
  }

  // Need at least 2 closed candles for confirmation
  const data = candles.slice(0, -1) // Exclude last incomplete candle
  if (data.length < 20) {
    return { detected: false, type: null, price: null, confirmed: false }
  }

  const closes = data.map(c => parseFloat(c.c))
  const highs = data.map(c => parseFloat(c.h))
  const lows = data.map(c => parseFloat(c.l))

  // Find recent swing high and low
  const lookback = 10
  let recentHigh = -Infinity
  let recentHighIndex = -1
  let recentLow = Infinity
  let recentLowIndex = -1

  for (let i = data.length - lookback; i < data.length; i++) {
    if (highs[i] > recentHigh) {
      recentHigh = highs[i]
      recentHighIndex = i
    }
    if (lows[i] < recentLow) {
      recentLow = lows[i]
      recentLowIndex = i
    }
  }

  const lastClose = closes[closes.length - 1]
  const prevClose = closes[closes.length - 2]

  // Bullish BOS: Close above recent swing high (confirmed by >= 2 closes)
  if (lastClose > recentHigh && prevClose > recentHigh) {
    return {
      detected: true,
      type: 'BULLISH_BOS',
      price: recentHigh,
      confirmed: true,
      timeframe
    }
  }

  // Bearish BOS: Close below recent swing low (confirmed by >= 2 closes)
  if (lastClose < recentLow && prevClose < recentLow) {
    return {
      detected: true,
      type: 'BEARISH_BOS',
      price: recentLow,
      confirmed: true,
      timeframe
    }
  }

  // Potential BOS but not confirmed yet
  if (lastClose > recentHigh || lastClose < recentLow) {
    return {
      detected: true,
      type: lastClose > recentHigh ? 'BULLISH_BOS' : 'BEARISH_BOS',
      price: lastClose > recentHigh ? recentHigh : recentLow,
      confirmed: false, // Only 1 close, need 2
      timeframe
    }
  }

  return { detected: false, type: null, price: null, confirmed: false, timeframe }
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * @param {Array} candles - Array of candle objects
 * @returns {number|null} VWAP value
 */
export function calculateVWAP(candles) {
  if (!candles || candles.length === 0) {
    return null
  }

  // VWAP = Sum(Price * Volume) / Sum(Volume)
  // Price = (High + Low + Close) / 3
  let totalPV = 0
  let totalVolume = 0

  for (const candle of candles) {
    const high = parseFloat(candle.h)
    const low = parseFloat(candle.l)
    const close = parseFloat(candle.c)
    const volume = parseFloat(candle.v)

    const typicalPrice = (high + low + close) / 3
    totalPV += typicalPrice * volume
    totalVolume += volume
  }

  if (totalVolume === 0) {
    return null
  }

  return totalPV / totalVolume
}

