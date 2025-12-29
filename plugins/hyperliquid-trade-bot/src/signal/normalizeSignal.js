export function normalizeSignal(ind) {
  return {
    ...ind, // Giữ lại toàn bộ data gốc (rsi, trend, symbol, price...)

    // Thêm các đánh giá sơ bộ (Pre-analysis)
    bias: ind.trend,
    momentum: ind.rsi > 60 ? 'strong_bull' : (ind.rsi < 40 ? 'strong_bear' : 'neutral'),
    context: 'dynamic'
  }
}