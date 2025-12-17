import 'dotenv/config';
import { startRealtime } from './src/realtime.js';
import { startScheduler } from './src/scheduler.js';

// ✅ VALIDATE CRITICAL ENV VARIABLES
const requiredEnv = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID'];
const missing = requiredEnv.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.error(`❌ FATAL: Missing required ENV variables: ${missing.join(', ')}`);
    console.error(`Please check your .env file.`);
    process.exit(1);
}

console.log("✅ EMA PRO BOT STARTING...");
console.log(`📊 Monitoring: ${process.env.TOKENS || 'BTC'}`);
console.log(`⏱  Timeframes: ${process.env.TIMEFRAMES || '1m,5m'}`);

startRealtime();
startScheduler();