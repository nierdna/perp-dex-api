import { sendAlert } from './telegram.js';

const last = {};

export function detectConfirmed(token, tf, candles) {
  if (!candles || !candles.data || candles.data.length < 26) return; // Need at least 26 candles for EMA26

  const closes = candles.data.map(i => parseFloat(i.c));
  if (closes.some(isNaN)) return; // Safety check

  const ema9 = ema(closes, 9);
  const ema26 = ema(closes, 26);

  // Debug log: Show all tokens/timeframes to verify Multi-token logic
  const e9 = typeof ema9 === 'number' ? ema9.toFixed(2) : 'NaN';
  const e26 = typeof ema26 === 'number' ? ema26.toFixed(2) : 'NaN';
  console.log(`[DEBUG] ${token} ${tf} -> Price: ${closes[closes.length - 1]} | EMA9: ${e9} | EMA26: ${e26}`);

  const k = token + "_" + tf;

  // 🔒 PROTECT AGAINST FALSE POSITIVE ON FIRST RUN
  if (!last[k]) {
    last[k] = { ema9, ema26, initialized: true };
    console.log(`[INIT] ${token} ${tf} - First run, skipping alert`);
    return; // Skip alert on first calculation
  }

  const prev = last[k];

  // 🚨 DETECT CROSSOVER
  if (prev.ema9 < prev.ema26 && ema9 > ema26)
    sendAlert(token, `Confirmed Bull Cross (A)`, { tf, price: closes[closes.length - 1], side: "LONG 🟢" });
  if (prev.ema9 > prev.ema26 && ema9 < ema26)
    sendAlert(token, `Confirmed Bear Cross (A)`, { tf, price: closes[closes.length - 1], side: "SHORT 🔴" });

  last[k] = { ema9, ema26 };
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