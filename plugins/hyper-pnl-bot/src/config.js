import 'dotenv/config';

function parseInterval(text) {
    if (!text) return 3600000;
    if (text.endsWith('h')) return parseInt(text) * 3600000;
    if (text.endsWith('m')) return parseInt(text) * 60000;
    if (text.endsWith('d')) return parseInt(text) * 86400000;
    return 3600000; // default 1h
}

const config = {
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
    },
    pnl: {
        wallets: (process.env.WALLETS || "").split(",").map(x => x.trim()).filter(Boolean),
        // PNL_INTERVAL is now implicitly 24h if using fixed time scheduling
        intervalMs: parseInterval(process.env.PNL_INTERVAL || "24h"),
        windowMs: parseInterval(process.env.PNL_WINDOW || "24h"),
        scheduleTime: process.env.PNL_INTERVAL_TIME || "00:00",
        alertInit: process.env.ALERT_INIT === "1" || process.env.ALERT_INIT === "true",
        windowRaw: process.env.PNL_WINDOW || "24h"
    }
};

// Validate required configuration
if (!config.telegram.token) {
    throw new Error("❌ Error: TELEGRAM_BOT_TOKEN is missing in .env file");
}
if (!config.telegram.chatId) {
    throw new Error("❌ Error: TELEGRAM_ADMIN_CHAT_ID is missing in .env file");
}
if (config.pnl.wallets.length === 0) {
    console.warn("⚠️ Warning: No WALLETS configured in .env. Bot will observe nothing.");
}

export default config;
