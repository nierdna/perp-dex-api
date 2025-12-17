import { fetchFills } from './hyperApi.js';
import { computePnL } from './pnlEngine.js';
import { sendReport, sendHappyAlert } from './telegram.js';
import config from './config.js';

const { wallets, intervalMs, windowMs } = config.pnl;

// Track the last time we checked to prevent gaps
let lastCheckTokens = {};

export function startScheduler() {
  const { scheduleTime, alertInit, happyPnl } = config.pnl;
  console.log(`Scheduler started. Target Time: ${scheduleTime}, Run on Start: ${alertInit}`);

  // Start the Happy Monitor if configured
  if (happyPnl !== 0) {
    startHappyMonitor(happyPnl);
  }

  // 1. Check ALERT_INIT to decide whether to run immediately
  if (alertInit) {
    console.log("ALERT_INIT=1: Executing immediate startup scan...");
    run();
  } else {
    console.log("ALERT_INIT=0: Skipping immediate startup scan. Waiting for scheduled time.");
    // If skipping startup, secure the lastCheckTime mostly to avoid scanning years of history if it runs first time
    // We assume the user wants to start tracking from NOW or standard window
    const now = Date.now();
    config.pnl.wallets.forEach(w => {
      // Initialize lastCheckTokens to (NOW - 24h) so the first scheduled run covers the last day
      // Standard report still uses windowMs from config
      lastCheckTokens[w] = now - config.pnl.windowMs;
    });
  }

  // 2. Parse fixed schedule time (HH:MM) treated as UTC
  const [hh, mm] = scheduleTime.split(':').map(Number);

  // 3. Calculate time to next schedule (UTC)
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setUTCHours(hh, mm, 0, 0);

  // If time has passed for today (in UTC), schedule for tomorrow
  if (nextRun.getTime() <= now.getTime()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const delayMs = nextRun.getTime() - now.getTime();
  console.log(`Next daily scan scheduled at: ${nextRun.toISOString()} (UTC) (in ${(delayMs / 3600000).toFixed(2)} hours)`);

  // 4. Schedule the alignment run
  setTimeout(() => {
    run();
    // 5. After hitting the target time, run every 24h fixed
    setInterval(run, 24 * 60 * 60 * 1000);
  }, delayMs);
}

function startHappyMonitor(threshold) {
  console.log(`🚀 Happy Monitor started! Checking every 1h if PnL (24h) > ${threshold} USDC`);

  const check = async () => {
    const now = Date.now();
    const window24h = 24 * 3600000;
    const from = now - window24h;

    for (const w of wallets) {
      if (!w) continue;
      try {
        const fills = await fetchFills(w);
        // Filter specifically for the rolling 24h window
        const filtered = fills.filter(f => f.time >= from);

        if (filtered.length > 0) {
          const report = computePnL(w, filtered, window24h);
          await sendHappyAlert(report, threshold);
        }
      } catch (e) {
        console.error(`Happy Monitor Error for ${w}:`, e);
      }
    }
  };

  // Run immediately then interval
  check();
  setInterval(check, 3600000); // Check every 1 hour
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
