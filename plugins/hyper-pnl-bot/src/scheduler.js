import { fetchFills } from './hyperApi.js';
import { computePnL } from './pnlEngine.js';
import { sendReport, sendHappyAlert, sendStopLossAlert } from './telegram.js';
import config from './config.js';

const { wallets, intervalMs, windowMs } = config.pnl;

// Track the last time we checked to prevent gaps
let lastCheckTokens = {};

export function startScheduler() {
  const { scheduleTime, alertInit, happyPnl, stopLossPnl } = config.pnl;
  const instanceId = Math.floor(Math.random() * 10000);
  console.log(`🤖 Bot Instance ID: #${instanceId}`);
  console.log(`Scheduler started. Target Time: ${scheduleTime}, Run on Start: ${alertInit}`);

  // Start the Happy/StopLoss Monitor if configured
  if (happyPnl !== 0 || stopLossPnl !== 0) {
    startPnlMonitor(happyPnl, stopLossPnl);
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

function startPnlMonitor(happyThreshold, stopLossThreshold) {
  // Import Redis helpers dynamically to avoid circular deps
  import('./redis.js').then(({ wasStopLossAlertSent, markStopLossAlertSent, wasHappyAlertSent, markHappyAlertSent, getRedis }) => {

    // Test Redis connection
    const redis = getRedis();
    redis.connect().catch(err => {
      console.error('❌ Redis connection failed:', err.message);
    });

    console.log(`🚀 PnL Monitor started! Checking every 30 seconds.`);
    if (happyThreshold !== 0) console.log(`   ✅ Happy Alert: PnL > ${happyThreshold} USDC`);
    if (stopLossThreshold !== 0) console.log(`   🛑 Stop Loss Alert: PnL < ${stopLossThreshold} USDC`);

    const check = async () => {
      const now = Date.now();
      const window24h = 24 * 3600000;
      const from = now - window24h;

      for (const w of wallets) {
        if (!w) continue;
        try {
          const fills = await fetchFills(w);
          const filtered = fills.filter(f => f.time >= from);

          if (filtered.length > 0) {
            const report = computePnL(w, filtered, window24h);
            const pnl = Number(report.net) || 0;

            // Check Stop Loss
            if (stopLossThreshold !== 0 && pnl < stopLossThreshold) {
              const alreadySent = await wasStopLossAlertSent(w);
              if (!alreadySent) {
                await sendStopLossAlert(report, stopLossThreshold);
                await markStopLossAlertSent(w);
              }
            }

            // Check Happy Alert
            if (happyThreshold !== 0 && pnl > happyThreshold) {
              const alreadySent = await wasHappyAlertSent(w);
              if (!alreadySent) {
                await sendHappyAlert(report, happyThreshold);
                await markHappyAlertSent(w);
              }
            }
          }
        } catch (e) {
          console.error(`PnL Monitor Error for ${w}:`, e.message);
        }
      }
    };

    // Run immediately then every 30 seconds
    check();
    setInterval(check, 30000);
  });
}

let isScanning = false;

async function run() {
  if (isScanning) {
    console.log("⚠️ Skipping scan: Another scan is currently in progress.");
    return;
  }
  isScanning = true;

  const now = Date.now();
  console.log(`Running PnL check at ${new Date(now).toISOString()}...`);

  for (const w of wallets) {
    if (!w) continue;

    // ALWAYS look back by windowMs (Standard 24h or per config)
    // This ensures reports are consistent "Daily Snapshots" regardless of restart times
    const from = now - windowMs;

    try {
      console.log(`Fetching data for ${w} from ${new Date(from).toISOString()}...`);
      const fills = await fetchFills(w);
      // Filter for the exact window [now - 24h, now]
      const filtered = fills.filter(f => f.time >= from && f.time <= now);

      if (filtered.length > 0) {
        console.log(`Found ${filtered.length} trades. Computing PnL...`);
        const report = computePnL(w, filtered, windowMs);
        await sendReport(report);
      } else {
        console.log(`No trades found for ${w} in this period.`);
      }

    } catch (e) {
      console.error(`Error processing wallet ${w}:`, e);
    }
  }

  isScanning = false;
}
