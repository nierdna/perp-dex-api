import { sendAlert } from './telegram.js';

export function detectRealtimeSignals(token, d) {
  const { ema9, ema26, price, volume } = d;

  // 1. IMPROVED VOLUME ANALYSIS
  // We use previous candles for average to avoid skewing with current partial candle
  const historyVol = volume.slice(0, -1); // Exclude current
  const avgVol = historyVol.reduce((a, b) => a + b, 0) / (historyVol.length || 1);
  const currentVol = volume[volume.length - 1] || 0;

  // Strict Volume Spike: Current volume must be significantly higher than average
  // Since it's realtime (partial candle), hitting 1.5x average of FULL candles is a strong signal
  // RELAXED: 1.2x average (easier to trigger for testing)
  const isHighVolume = currentVol > avgVol * 1.2;

  // 2. SIMPLIFIED CROSS DETECTION
  const dist = Math.abs(ema9 - ema26) / price;

  // If lines are pinched together
  // RELAXED: < 0.2% distance (easier to trigger)
  if (dist < 0.002) {
    let side = "";

    // Determine Bias purely on Price Action relative to EMAs
    // This covers both "approaching cross" and "just crossed" scenarios
    const aboveBoth = price > ema9 && price > ema26;
    const belowBoth = price < ema9 && price < ema26;

    if (aboveBoth) {
      side = "POSSIBLE LONG 🟢";
    } else if (belowBoth) {
      side = "POSSIBLE SHORT 🔴";
    } else {
      // Price is stuck between EMAs = Chop zone / Uncertainty -> No Signal
      return;
    }

    // A. SCALP SIGNAL (Strongest)
    // Coherence: Price is above both EMAs + Volume is spiking
    if (isHighVolume) {
      debounce(token, "SCALP", () => sendAlert(token, "⚡ PRE-EMPTIVE SCALP", {
        side: side,
        price: price,
        tf: "Realtime (Scalp)"
      }));
      return; // Priority
    }

    // B. NEAR CROSS (Standard Warning)
    // Only alert if we haven't alerted recently
    debounce(token, "NEAR", () => sendAlert(token, "⏳ NEAR CROSS (Preparing)", {
      side: side,
      price: price,
      tf: "Realtime"
    }));
  }
}

const lastAlert = {};
function debounce(token, type, fn) {
  const key = token + "_" + type;
  const now = Date.now();
  // Don't spam: Only alert once every 1 minute (Test mode) per token/type for Realtime signals
  if (lastAlert[key] && now - lastAlert[key] < 60000) return;
  lastAlert[key] = now;
  fn();
}