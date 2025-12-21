import fetch from 'node-fetch';
import { getCachedFills, cacheFills } from './redis.js';

export async function fetchFills(wallet) {
  // Check Redis cache first
  const cached = await getCachedFills(wallet);
  if (cached) {
    return cached;
  }

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
  const fills = Array.isArray(data) ? data : [];

  // Cache the result for 10 seconds
  await cacheFills(wallet, fills);

  return fills;
}

