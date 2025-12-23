export function normalizeSignal(ind) {
  return {
    bias: ind.emaTrend,
    momentum: ind.rsi > 60 ? 'strong' : 'weak',
    volatility: 'low',
    context: 'trend_pullback'
  }
}