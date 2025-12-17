import fetch from 'node-fetch';

const INTERVAL_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export async function fetchCandles(symbol, interval) {
  const ms = INTERVAL_MS[interval] || 60000;
  const startTime = Date.now() - (ms * 150); // Fetch ~150 candles back to be safe

  const url = "https://api.hyperliquid.xyz/info";
  const body = {
    type: "candleSnapshot",
    req: {
      coin: symbol,
      interval: interval,
      startTime: startTime
    }
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      console.error(`[API Error] ${symbol} ${interval}: ${r.statusText}`);
      return { data: [] };
    }

    const data = await r.json();

    // ✅ VALIDATE API RESPONSE FORMAT
    if (!Array.isArray(data)) {
      console.error(`[API Format Error] ${symbol} ${interval}: Expected array, got ${typeof data}`);
      return { data: [] };
    }

    // Validate each candle has required fields
    const validCandles = data.filter(candle => {
      if (!candle || typeof candle.c === 'undefined') {
        console.warn(`[Invalid Candle] ${symbol} ${interval}: Missing 'c' field`);
        return false;
      }
      return true;
    });

    if (validCandles.length === 0) {
      console.error(`[No Valid Candles] ${symbol} ${interval}`);
      return { data: [] };
    }

    return { data: validCandles };
  } catch (e) {
    console.error(`[Fetch Error] ${symbol} ${interval}:`, e.message);
    return { data: [] };
  }
}