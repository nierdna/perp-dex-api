import { RSI, EMA, ATR } from 'technicalindicators'

export function calcIndicators(market, options = {}) {
  if (!market || !market.candles_15m || !market.candles_5m || !market.candles_1m) {
    return {
      regime_15m: 'unknown',
      bias_5m: 'unknown',
      entry_1m: 'unknown'
    }
  }

  const { excludeLastCandle = false } = options

  // Helper: Tính indicators cho 1 khung thời gian
  function analyzeTimeframe(candles, excludeLast = false) {
    // Exclude last candle if requested (to avoid repaint on incomplete bars)
    const data = excludeLast ? candles.slice(0, -1) : candles
    if (data.length < 50) return null

    const closes = data.map(c => parseFloat(c.c))
    const highs = data.map(c => parseFloat(c.h))
    const lows = data.map(c => parseFloat(c.l))

    // RSI
    const rsi7 = RSI.calculate({ values: closes, period: 7 })
    const rsi14 = RSI.calculate({ values: closes, period: 14 })

    // EMA Short
    const ema9 = EMA.calculate({ period: 9, values: closes })
    const ema26 = EMA.calculate({ period: 26, values: closes })

    // EMA Long
    const ema50 = EMA.calculate({ period: 50, values: closes })
    const ema200 = EMA.calculate({ period: 200, values: closes })

    // ATR
    const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })

    // Volume Analysis (SMA 20)
    const volumes = data.slice(-21, -1).map(c => parseFloat(c.v))
    const currentVol = parseFloat(data[data.length - 1].v)
    const volSma = volumes.reduce((a, b) => a + b, 0) / volumes.length
    const volRatio = volSma > 0 ? (currentVol / volSma) : 0
    let volStatus = 'normal'
    if (volRatio >= 3.0) volStatus = 'ultra_high'
    else if (volRatio >= 1.5) volStatus = 'high'
    else if (volRatio < 0.8) volStatus = 'low'

    return {
      rsi7: rsi7[rsi7.length - 1],
      rsi14: rsi14[rsi14.length - 1],
      ema9: ema9[ema9.length - 1],
      ema26: ema26[ema26.length - 1],
      ema50: ema50[ema50.length - 1],
      ema200: ema200[ema200.length - 1],
      atr: atr[atr.length - 1],
      prevEma9: ema9[ema9.length - 2],
      prevEma26: ema26[ema26.length - 2],
      prevEma50: ema50[ema50.length - 2],
      prevEma200: ema200[ema200.length - 2],
      // Volume
      vol_current: currentVol,
      vol_sma: volSma,
      vol_ratio: volRatio,
      vol_status: volStatus
    }
  }

  // Phân tích 3 khung
  const tf15m = analyzeTimeframe(market.candles_15m, excludeLastCandle)
  const tf5m = analyzeTimeframe(market.candles_5m, excludeLastCandle)
  const tf1m = analyzeTimeframe(market.candles_1m, excludeLastCandle)

  if (!tf15m || !tf5m || !tf1m) {
    return { regime_15m: 'insufficient_data', bias_5m: 'insufficient_data', entry_1m: 'insufficient_data' }
  }

  // 15m: Market Regime
  let regime15m = 'ranging'
  let regimeCross = 'none'
  if (tf15m.ema50 && tf15m.ema200) {
    if (tf15m.ema50 > tf15m.ema200) {
      regime15m = 'trending_bull'
      if (tf15m.prevEma50 && tf15m.prevEma200 && tf15m.prevEma50 <= tf15m.prevEma200) {
        regimeCross = 'golden_cross'
      }
    } else if (tf15m.ema50 < tf15m.ema200) {
      regime15m = 'trending_bear'
      if (tf15m.prevEma50 && tf15m.prevEma200 && tf15m.prevEma50 >= tf15m.prevEma200) {
        regimeCross = 'death_cross'
      }
    }
  }

  // 5m: Bias + Structure
  let bias5m = 'neutral'
  let biasCross = 'none'
  if (tf5m.ema9 && tf5m.ema26) {
    if (tf5m.ema9 > tf5m.ema26) {
      bias5m = 'bullish'
      if (tf5m.prevEma9 && tf5m.prevEma26 && tf5m.prevEma9 <= tf5m.prevEma26) {
        biasCross = 'golden_cross'
      }
    } else if (tf5m.ema9 < tf5m.ema26) {
      bias5m = 'bearish'
      if (tf5m.prevEma9 && tf5m.prevEma26 && tf5m.prevEma9 >= tf5m.prevEma26) {
        biasCross = 'death_cross'
      }
    }
  }

  // 1m: Entry Timing
  let entry1m = 'wait'
  let entryCross = 'none'
  if (tf1m.ema9 && tf1m.ema26) {
    if (tf1m.ema9 > tf1m.ema26) {
      entry1m = 'long_ready'
      if (tf1m.prevEma9 && tf1m.prevEma26 && tf1m.prevEma9 <= tf1m.prevEma26) {
        entryCross = 'golden_cross'
      }
    } else if (tf1m.ema9 < tf1m.ema26) {
      entry1m = 'short_ready'
      if (tf1m.prevEma9 && tf1m.prevEma26 && tf1m.prevEma9 >= tf1m.prevEma26) {
        entryCross = 'death_cross'
      }
    }
  }

  return {
    // 15m - Market Regime
    regime_15m: regime15m,
    regime_cross: regimeCross,
    regime_ema50: tf15m.ema50 ? parseFloat(tf15m.ema50.toFixed(2)) : null,
    regime_ema200: tf15m.ema200 ? parseFloat(tf15m.ema200.toFixed(2)) : null,
    regime_rsi14: tf15m.rsi14 ? parseFloat(tf15m.rsi14.toFixed(2)) : null,

    // 5m - Bias & Structure
    bias_5m: bias5m,
    bias_cross: biasCross,
    bias_ema9: tf5m.ema9 ? parseFloat(tf5m.ema9.toFixed(2)) : null,
    bias_ema26: tf5m.ema26 ? parseFloat(tf5m.ema26.toFixed(2)) : null,
    bias_rsi7: tf5m.rsi7 ? parseFloat(tf5m.rsi7.toFixed(2)) : null,
    bias_atr: tf5m.atr ? parseFloat(tf5m.atr.toFixed(4)) : null,

    // 1m - Entry Timing
    entry_1m: entry1m,
    entry_cross: entryCross,
    entry_ema9: tf1m.ema9 ? parseFloat(tf1m.ema9.toFixed(2)) : null,
    entry_ema26: tf1m.ema26 ? parseFloat(tf1m.ema26.toFixed(2)) : null,
    entry_rsi7: tf1m.rsi7 ? parseFloat(tf1m.rsi7.toFixed(2)) : null,
    entry_atr: tf1m.atr ? parseFloat(tf1m.atr.toFixed(4)) : null, // Added ATR 1m
    entry_vol_ratio: tf1m.vol_ratio ? parseFloat(tf1m.vol_ratio.toFixed(2)) : null,
    entry_vol_status: tf1m.vol_status,

    // Raw Data for specialized logic
    // When excludeLastCandle=true, use the last closed candle (length-2 becomes "current", length-3 becomes "previous")
    entry_close_1m: excludeLastCandle 
      ? parseFloat(market.candles_1m[market.candles_1m.length - 2].c)
      : parseFloat(market.candles_1m[market.candles_1m.length - 1].c),
    entry_prev_close_1m: excludeLastCandle
      ? parseFloat(market.candles_1m[market.candles_1m.length - 3].c)
      : parseFloat(market.candles_1m[market.candles_1m.length - 2].c),

    // Common
    price: market.price,
    symbol: market.symbol,
    funding: market.funding
  }
}