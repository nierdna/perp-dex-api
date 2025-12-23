export async function getMarketSnapshot() {
  return {
    price: 42000,
    candles: [],
    funding: 0.0001,
    openInterest: 1000000,
    account: { hasPosition: false, dailyLoss: 0 }
  }
}