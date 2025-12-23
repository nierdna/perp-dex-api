import { RSI, EMA, ATR } from 'technicalindicators'

export function calcIndicators(market) {
  if (!market || !market.candles || market.candles.length < 50) {
    return {
      trend: 'unknown',
      rsi: 50,
      atr: 0,
      structure: 'unknown'
    }
  }

  // Hyperliquid candles: { t, o, h, l, c, v }
  // technicalindicators cần mảng số
  const closes = market.candles.map(c => parseFloat(c.c))
  const highs = market.candles.map(c => parseFloat(c.h))
  const lows = market.candles.map(c => parseFloat(c.l))

  // 1. RSI (14)
  const rsiValues = RSI.calculate({
    values: closes,
    period: 14
  })
  const currentRsi = rsiValues[rsiValues.length - 1]

  // 2. EMA Trend (EMA 50 vs EMA 200)
  const ema50 = EMA.calculate({ period: 50, values: closes })
  const ema200 = EMA.calculate({ period: 200, values: closes })

  const lastEma50 = ema50[ema50.length - 1]
  const lastEma200 = ema200[ema200.length - 1]

  let trend = 'sideways'
  if (lastEma50 > lastEma200) trend = 'bullish'
  else if (lastEma50 < lastEma200) trend = 'bearish'

  // 3. ATR (Volatility)
  const atrValues = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  })
  const currentAtr = atrValues[atrValues.length - 1]

  return {
    trend: trend, // bullish | bearish
    rsi: parseFloat(currentRsi.toFixed(2)),
    atr: parseFloat(currentAtr.toFixed(4)),
    structure: 'calculating...', // Để AI tự đánh giá thêm
    funding: market.funding,
    price: market.price,
    symbol: market.symbol,
    interval: process.env.TIMEFRAME || '15m'
  }
}