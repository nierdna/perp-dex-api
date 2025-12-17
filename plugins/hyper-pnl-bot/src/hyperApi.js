import fetch from 'node-fetch';

export async function fetchFills(wallet){
  const url = "https://api-ui.hyperliquid.xyz/info";
  const body = {
    aggregateByTime: true,
    type: "userFills",
    user: wallet
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
