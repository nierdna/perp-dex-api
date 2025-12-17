import fetch from 'node-fetch';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;

export function sendAlert(tokenName, type, extraObj) {
  // extraObj can be a string (old way) or object { tf, price, ... }
  let tf = "";
  let price = "";
  let side = "";

  if (typeof extraObj === 'object') {
    tf = extraObj.tf || "";
    price = extraObj.price ? `Price: *${extraObj.price}*` : "";
    side = extraObj.side ? `Side: *${extraObj.side}*` : "";
  } else {
    tf = extraObj; // Fallback for old calls if any
  }

  const text = `⚡ *EMA ALERT 9/26*
Token: *${tokenName}*
Type: *${type}*
${side ? side : ""}
${tf ? `Timeframe: *${tf}*` : ""}
${price ? price : ""}
`;

  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: 'Markdown' // Enable bold text
    })
  });
}