import { sendAlert } from './telegram.js';

// Memory cache to store processed candle times per token_tf
// Format: { "BTC_5m": 1700000300000 }
const processedCandles = {};

const last = {};

export function detectConfirmed(token, tf, candles) {
  // Need at least 26 candles + 1 open candle = 27 data points to be safe, 
  // but let's stick to safe length
  if (!candles || !candles.data || candles.data.length < 30) return;

  // We want the LAST CLOSED candle. 
  // candles.data[length-1] is the current OPEN candle (fluctuating).
  // candles.data[length-2] is the last CLOSED candle (fixed).

  const lastClosedIndex = candles.data.length - 2;
  const candle = candles.data[lastClosedIndex];
  const candleTime = candle.t; // Epoch time of the closed candle

  // Key for storing state per token+timeframe
  const k = token + "_" + tf;

  // 🔒 STRICT DUPLICATE PROTECTION
  // If we already processed this exact candle timestamp, EXIT IMMEDIATELY.
  if (processedCandles[k] === candleTime) {
    return;
  }

  // Calculate EMA on the closed historical data
  // We use data up to lastClosedIndex inclusive
  const closes = candles.data.slice(0, lastClosedIndex + 1).map(i => parseFloat(i.c));

  if (closes.some(isNaN)) return;

  const ema9 = ema(closes, 9);
  const ema26 = ema(closes, 26);
  const price = closes[closes.length - 1];

  // Debug log (Only once per new candle ideally, or debug mode)
  // const e9 = ema9.toFixed(2);
  // const e26 = ema26.toFixed(2);
  // console.log(`[DEBUG] ${token} ${tf} -> Price: ${price} | EMA9: ${e9} | EMA26: ${e26}`);

  // 🔒 INIT STATE ON FIRST RUN
  if (!last[k]) {
    last[k] = { ema9, ema26, initialized: true };
    processedCandles[k] = candleTime; // Mark as processed so we don't alert on existing history
    console.log(`[INIT] ${token} ${tf} - First run on candle ${new Date(candleTime).toLocaleTimeString()}, skipping alert`);
    return;
  }

  const prev = last[k];

  // 🚨 DETECT CROSSOVER
  // Note: We compare current EMA of closed candle vs EMA of PREVIOUS closed candle (stored in last[k])
  // Wait, last[k] stores the EMAs calculated from the *previous* unique candle we processed.
  // So if we process candle T-1 now, last[k] holds T-2. This is correct for detecting the crossover EVENT that just finalized.

  let alerted = false;
  if (prev.ema9 < prev.ema26 && ema9 > ema26) {
    sendAlert(token, `Confirmed Bull Cross (A)`, { tf, price, side: "LONG 🟢" });
    alerted = true;
  }

  if (prev.ema9 > prev.ema26 && ema9 < ema26) {
    sendAlert(token, `Confirmed Bear Cross (A)`, { tf, price, side: "SHORT 🔴" });
    alerted = true;
  }

  // Update state to current candle AND mark this candleTime as processed
  last[k] = { ema9, ema26, initialized: true };
  processedCandles[k] = candleTime; // ✅ Critical Fix
}

function ema(values, length) {
  if (values.length < length) {
    console.error(`Not enough data for EMA${length}: got ${values.length} candles`);
    return NaN;
  }

  // ✅ CORRECT EMA CALCULATION
  // Step 1: Calculate SMA for first N values as initial EMA
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const val = typeof values[i] === 'number' ? values[i] : parseFloat(values[i]);
    sum += val;
  }
  let emaValue = sum / length; // Initial EMA = SMA

  // Step 2: Apply EMA formula for remaining values
  const k = 2 / (length + 1);
  for (let i = length; i < values.length; i++) {
    const val = typeof values[i] === 'number' ? values[i] : parseFloat(values[i]);
    emaValue = val * k + emaValue * (1 - k);
  }

  return emaValue;
}