/**
 * LTF Confirmation
 * Detect BOS trên 1H/30M, EMA50/VWAP reclaim, volume expansion
 */

import { detectBOS } from '../../indicators/swingIndicators.js'
import { calculateVWAP } from '../../indicators/swingIndicators.js'

/**
 * Analyze LTF confirmation signals
 * @param {Object} tf1h - 1H timeframe indicators
 * @param {Object} tf30m - 30M timeframe indicators
 * @param {Array} candles1h - 1H candles
 * @param {Array} candles30m - 30M candles
 * @returns {Object} { confirmed, signals }
 */
export function analyzeLTFConfirmation(tf1h, tf30m, candles1h, candles30m) {
  const signals = []
  let confirmed = false

  // 1. BOS (Break of Structure) trên 1H/30M
  // Rule: BOS phải được confirm bởi >= 2 close (không dùng wick)
  if (candles1h && candles1h.length > 0) {
    const bos1h = detectBOS(candles1h, '1h')
    if (bos1h.detected && bos1h.confirmed) {
      signals.push('BOS_1H')
      confirmed = true
    } else if (bos1h.detected && !bos1h.confirmed) {
      signals.push('BOS_1H_PENDING')
    }
  }

  if (candles30m && candles30m.length > 0) {
    const bos30m = detectBOS(candles30m, '30m')
    if (bos30m.detected && bos30m.confirmed) {
      signals.push('BOS_30M')
      confirmed = true
    } else if (bos30m.detected && !bos30m.confirmed) {
      signals.push('BOS_30M_PENDING')
    }
  }

  // 2. EMA50 reclaim
  if (tf1h && tf1h.ema50 && tf1h.close && tf1h.prevEma50 && candles1h && candles1h.length >= 2) {
    const currentClose = tf1h.close
    const ema50 = tf1h.ema50
    const prevClose = parseFloat(candles1h[candles1h.length - 2].c) // Previous candle close

    // Bullish reclaim: Price was below EMA50, now above
    if (prevClose < tf1h.prevEma50 && currentClose > ema50) {
      signals.push('EMA50_RECLAIM_BULLISH')
      confirmed = true
    }
    // Bearish reclaim: Price was above EMA50, now below
    else if (prevClose > tf1h.prevEma50 && currentClose < ema50) {
      signals.push('EMA50_RECLAIM_BEARISH')
      confirmed = true
    }
  }

  if (tf30m && tf30m.ema50 && tf30m.close && tf30m.prevEma50 && candles30m && candles30m.length >= 2) {
    const currentClose = tf30m.close
    const ema50 = tf30m.ema50
    const prevClose = parseFloat(candles30m[candles30m.length - 2].c) // Previous candle close

    if (prevClose < tf30m.prevEma50 && currentClose > ema50) {
      signals.push('EMA50_RECLAIM_BULLISH_30M')
      confirmed = true
    } else if (prevClose > tf30m.prevEma50 && currentClose < ema50) {
      signals.push('EMA50_RECLAIM_BEARISH_30M')
      confirmed = true
    }
  }

  // 3. VWAP reclaim
  if (candles1h && candles1h.length > 0) {
    const vwap = calculateVWAP(candles1h.slice(-20)) // Last 20 candles
    if (vwap && tf1h && tf1h.close) {
      const currentClose = tf1h.close
      const prevCandles = candles1h.slice(-21, -1)
      const prevVwap = calculateVWAP(prevCandles)
      const prevClose = prevCandles.length > 0 ? parseFloat(prevCandles[prevCandles.length - 1].c) : currentClose

      // Bullish VWAP reclaim
      if (prevClose < prevVwap && currentClose > vwap) {
        signals.push('VWAP_RECLAIM_BULLISH')
        confirmed = true
      }
      // Bearish VWAP reclaim
      else if (prevClose > prevVwap && currentClose < vwap) {
        signals.push('VWAP_RECLAIM_BEARISH')
        confirmed = true
      }
    }
  }

  if (candles30m && candles30m.length > 0) {
    const vwap = calculateVWAP(candles30m.slice(-20))
    if (vwap && tf30m && tf30m.close) {
      const currentClose = tf30m.close
      const prevCandles = candles30m.slice(-21, -1)
      const prevVwap = calculateVWAP(prevCandles)
      const prevClose = prevCandles.length > 0 ? parseFloat(prevCandles[prevCandles.length - 1].c) : currentClose

      if (prevClose < prevVwap && currentClose > vwap) {
        signals.push('VWAP_RECLAIM_BULLISH_30M')
        confirmed = true
      } else if (prevClose > prevVwap && currentClose < vwap) {
        signals.push('VWAP_RECLAIM_BEARISH_30M')
        confirmed = true
      }
    }
  }

  // 4. Volume expansion
  if (tf1h && tf1h.volRatio) {
    if (tf1h.volRatio >= 1.5) {
      signals.push('VOL_EXPANSION_1H')
      confirmed = true
    } else if (tf1h.volRatio >= 1.2) {
      signals.push('VOL_EXPANSION_1H_WEAK')
    }
  }

  if (tf30m && tf30m.volRatio) {
    if (tf30m.volRatio >= 1.5) {
      signals.push('VOL_EXPANSION_30M')
      confirmed = true
    } else if (tf30m.volRatio >= 1.2) {
      signals.push('VOL_EXPANSION_30M_WEAK')
    }
  }

  return {
    confirmed: confirmed,
    signals: signals
  }
}

