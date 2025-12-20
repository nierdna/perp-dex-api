export function computePnL(wallet, fills, windowMs) {
  let wins = 0, losses = 0, breakeven = 0;
  let realized = 0, fee = 0, volume = 0;
  let relevantTrades = 0; // Only counts fills with non-zero PnL (usually closing fills)
  const byCoin = {};

  for (const f of fills) {
    const pnl = parseFloat(f.closedPnl || 0);
    const fe = parseFloat(f.fee || 0);
    const sz = parseFloat(f.sz || 0);
    const px = parseFloat(f.px || 0);

    realized += pnl;
    fee += fe;
    volume += sz * px;

    // Only count as a "Trade" for Winrate stats if it realized PnL
    // (Opening fills usually have 0 PnL)
    if (pnl !== 0) {
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      else breakeven++;

      relevantTrades++;
    }

    // Accumulate PnL by coin (include 0 PnL fills just in case metadata is needed later, though affect is 0)
    if (!byCoin[f.coin]) byCoin[f.coin] = 0;
    byCoin[f.coin] += pnl;
  }

  const net = realized - fee;
  // Winrate based on closed trades only
  const totalClosed = wins + losses;
  const winrate = totalClosed > 0 ? ((wins / totalClosed) * 100).toFixed(1) : "0.0";

  return {
    wallet,
    trades: relevantTrades, // Show number of CLOSED/PnL-realizing fills
    totalFills: fills.length, // Optional: if you want to see raw fills count
    wins,
    losses,
    winrate,
    realized: realized.toFixed(4),
    fee: fee.toFixed(4),
    net: net.toFixed(4),
    volume: volume.toFixed(2),
    byCoin,
    windowMs
  };
}
