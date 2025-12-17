import { sendAlert } from './telegram.js';

export function detectRealtimeSignals(token, d) {
  const { ema9, ema26, price, volume } = d;

  const dist = Math.abs(ema9 - ema26) / price;
  if (dist < 0.001) {
    // ✅ CORRECT SIDE PREDICTION LOGIC
    // If EMA9 < EMA26 (death cross structure):
    //   - Price > EMA9 + EMA9 approaching EMA26 = Potential Bull Cross (LONG)
    //   - Price < EMA9 = Bearish momentum continues (SHORT)
    // If EMA9 > EMA26 (golden cross structure):
    //   - Price < EMA9 + EMA9 approaching EMA26 = Potential Bear Cross (SHORT)
    //   - Price > EMA9 = Bullish momentum continues (LONG)

    let possibleSide;
    if (ema9 < ema26) {
      // EMA9 below EMA26 - if price strong, potential golden cross
      possibleSide = price > ema9 ? "POSSIBLE LONG 🟢" : "POSSIBLE SHORT 🔴";
    } else {
      // EMA9 above EMA26 - if price weak, potential death cross
      possibleSide = price < ema9 ? "POSSIBLE SHORT 🔴" : "POSSIBLE LONG 🟢";
    }

    debounce(token, "B", () => sendAlert(token, "Near Cross (B)", {
      side: possibleSide,
      price: price
    }));
  }

  if ((ema9 > ema26 && dist < 0.0005) || (ema26 > ema9 && dist < 0.0005)) {
    const avg = volume.reduce((a, b) => a + b, 0) / volume.length;
    const last5 = volume.slice(-5).reduce((a, b) => a + b, 0);
    if (last5 > avg * 3) {
      // Volume spike direction based on current structure
      const spikeSide = ema9 > ema26 ? "LONG SPIKE 🟢" : "SHORT SPIKE 🔴";
      debounce(token, "C", () => sendAlert(token, "Momentum Spike (C)", {
        side: spikeSide,
        price: price
      }));
    }
  }
}

const lastAlert = {};
function debounce(token, type, fn) {
  const key = token + "_" + type;
  const now = Date.now();
  if (lastAlert[key] && now - lastAlert[key] < 60000) return;
  lastAlert[key] = now;
  fn();
}