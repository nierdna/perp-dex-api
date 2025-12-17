export function computePnL(wallet, fills, windowMs){
  let wins = 0, losses = 0, trades = fills.length;
  let realized = 0, fee = 0;
  const byCoin = {};

  for(const f of fills){
    const pnl = parseFloat(f.closedPnl || 0);
    const fe = parseFloat(f.fee || 0);

    realized += pnl;
    fee += fe;

    if(pnl > 0) wins++;
    else if(pnl < 0) losses++;

    if(!byCoin[f.coin]) byCoin[f.coin] = 0;
    byCoin[f.coin] += pnl;
  }

  const net = realized - fee;
  const winrate = trades > 0 ? ((wins / trades) * 100).toFixed(1) : 0;

  return {
    wallet,
    trades,
    wins,
    losses,
    winrate,
    realized: realized.toFixed(4),
    fee: fee.toFixed(4),
    net: net.toFixed(4),
    byCoin,
    windowMs
  };
}
