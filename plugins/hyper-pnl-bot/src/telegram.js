import fetch from 'node-fetch';
import config from './config.js';

export async function sendReport(rep) {
  const getPnlEmoji = (val) => val >= 0 ? "🟢" : "🔴";
  const fmt = (val) => {
    const num = Number(val) || 0;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}`;
  };

  let coinStr = "";
  for (const c in rep.byCoin) {
    const val = rep.byCoin[c];
    coinStr += `• ${c}: <code>${fmt(val)}</code> USDC\n`;
  }

  const pnlEmoji = getPnlEmoji(rep.net);
  const realizedEmoji = getPnlEmoji(rep.realized);
  const feeVal = Number(rep.fee) || 0;

  const text =
    `<b>📊 Hyperliquid PnL Report</b>
<code>${rep.wallet}</code>

<b>🏆 Win Rate: ${rep.winrate}%</b>
• Trades: <b>${rep.trades}</b>
• W/L: ${rep.wins}W - ${rep.losses}L

<b>💰 PnL Summary</b>
• Realized: <b>${fmt(rep.realized)} USDC</b> ${realizedEmoji}
• Fees: <code>-${feeVal.toFixed(2)} USDC</code>
• <b>Net PnL: ${fmt(rep.net)} USDC</b> ${pnlEmoji}

<b>💎 By Coin</b>
${coinStr || "No trades found."}`;

  const { token, chatId } = config.telegram;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!res.ok) {
    const errorData = await res.text();
    console.error(`Telegram API Error: ${res.status} ${res.statusText}`, errorData);
    throw new Error(`Telegram API failed: ${errorData}`);
  } else {
    console.log(`Telegram report sent for ${rep.wallet}`);
  }
}

export async function sendHappyAlert(rep, threshold) {
  const { token, chatId } = config.telegram;
  const pnl = Number(rep.net) || 0;

  if (pnl <= threshold) return;

  const text =
    `🚀 <b>BIG WIN ALERT!</b> 🚀
<code>${rep.wallet}</code>

🎉 PnL (24h): <b>${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDC</b>
✅ Target: > ${threshold} USDC

Keep it up! 💰💰💰`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      })
    });

    if (res.ok) console.log(`Happy Alert sent for ${rep.wallet} (+${pnl} USDC)`);
  } catch (e) {
    console.error("Failed to send Happy Alert:", e);
  }
}
