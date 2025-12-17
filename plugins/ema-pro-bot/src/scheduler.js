import { fetchCandles } from './source.js';
import { detectConfirmed } from './signalConfirmed.js';

export function startScheduler() {
  const tfs = (process.env.TIMEFRAMES || "1m,5m").split(",");
  setInterval(() => run(tfs), 60000);
}

async function run(tfs) {
  console.log(`\n--- Scheduler Tick at ${new Date().toLocaleTimeString()} ---`);
  const tokens = (process.env.TOKENS || "BTC").split(",");
  for (const tf of tfs) {
    for (const token of tokens) {
      const c = await fetchCandles(token, tf);
      detectConfirmed(token, tf, c);
    }
  }
  console.log("--- Check completed ---\n");
}