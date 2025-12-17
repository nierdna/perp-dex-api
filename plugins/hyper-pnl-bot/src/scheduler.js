import { fetchFills } from './hyperApi.js';
import { computePnL } from './pnlEngine.js';
import { sendReport } from './telegram.js';
import config from './config.js';

const { wallets, intervalMs, windowMs } = config.pnl;

// Track the last time we checked to prevent gaps
let lastCheckTokens = {};

export function startScheduler() {
  console.log(`Scheduler started. Logic: Run immediately, then align to next 00:00 daily.`);

  // 1. Run immediately (Startup)
  run();

  // 2. Calculate time to next midnight
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0); // Jump to next 00:00:00

  const delayMs = nextMidnight.getTime() - now.getTime();
  console.log(`Next daily scan scheduled at: ${nextMidnight.toLocaleString()} (in ${(delayMs / 3600000).toFixed(2)} hours)`);

  // 3. Schedule the alignment run
  setTimeout(() => {
    run();
    // 4. After hitting midnight, run every 24h fixed
    setInterval(run, 24 * 60 * 60 * 1000);
  }, delayMs);
}

async function run() {
  const now = Date.now();
  console.log(`Running PnL check at ${new Date(now).toISOString()}...`);

  for (const w of wallets) {
    if (!w) continue;

    // Determine start time:
    // 1. If we have a last check time, continue from there (covers gaps/lag)
    // 2. Otherwise (first run), look back by PNL_WINDOW
    const from = lastCheckTokens[w] || (now - windowMs);

    // Safety: Don't let the window be absurdly large if bot was off for days
    // Max lookback is constrained to 3x interval or window to prevent fetching too much history on long downtime, 
    // but ensures short lags are covered.
    const effectiveFrom = Math.max(from, now - (Math.max(windowMs, intervalMs) * 3));

    try {
      console.log(`Fetching data for ${w} from ${new Date(effectiveFrom).toISOString()}...`);
      const fills = await fetchFills(w);
      const filtered = fills.filter(f => f.time >= effectiveFrom && f.time < now); // Strict inequality for end time to avoid overlaps if we user ranges carefully

      if (filtered.length > 0) {
        console.log(`Found ${filtered.length} trades. Computing PnL...`);
        const report = computePnL(w, filtered, now - effectiveFrom);
        await sendReport(report);
      } else {
        console.log(`No trades found for ${w} in this period.`);
      }

      // Update check time ONLY after successful execution
      lastCheckTokens[w] = now;

    } catch (e) {
      console.error(`Error processing wallet ${w}:`, e);
      // Do NOT update lastCheckTokens[w], so retry will cover this period
    }
  }
}
