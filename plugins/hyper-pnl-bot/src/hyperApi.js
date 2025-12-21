import fetch from 'node-fetch';

export async function fetchFills(wallet) {
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

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429 || text.includes("rate limited")) {
      throw new Error(`⚠️ Hyperliquid Rate Limit Hit (429).`);
    }
    throw new Error(`API Error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
