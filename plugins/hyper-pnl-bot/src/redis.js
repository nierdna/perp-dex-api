import Redis from 'ioredis';
import config from './config.js';

let redis = null;
let isConnected = false;

export function getRedis() {
    if (!redis) {
        const { host, port, password, username, database, family } = config.redis;

        redis = new Redis({
            host,
            port,
            password,
            username,
            db: database,
            family,
            retryStrategy: (times) => Math.min(times * 1000, 5000),
            maxRetriesPerRequest: 3
        });

        redis.on('error', (err) => {
            if (!isConnected) {
                console.error('❌ Redis connection error:', err.message);
            }
        });

        redis.on('connect', () => {
            if (!isConnected) {
                console.log('✅ Redis connected successfully.');
                isConnected = true;
            }
        });
    }
    return redis;
}

// ═══════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

function getToday() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTTLUntilMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
}

// ═══════════════════════════════════════════════════════
// ALERT DEDUPLICATION (existing)
// ═══════════════════════════════════════════════════════

function getStopLossKey(wallet) {
    return `pnl:stoploss:alert:${wallet}:${getToday()}`;
}

function getHappyKey(wallet) {
    return `pnl:happy:alert:${wallet}:${getToday()}`;
}

export async function wasStopLossAlertSent(wallet) {
    const r = getRedis();
    const key = getStopLossKey(wallet);
    const exists = await r.exists(key);
    return exists === 1;
}

export async function markStopLossAlertSent(wallet) {
    const r = getRedis();
    const key = getStopLossKey(wallet);
    const ttlSeconds = getTTLUntilMidnight();
    await r.set(key, '1', 'EX', ttlSeconds);
    console.log(`📝 Marked StopLoss alert sent for ${wallet.slice(0, 10)}... (TTL: ${ttlSeconds}s)`);
}

export async function wasHappyAlertSent(wallet) {
    const r = getRedis();
    const key = getHappyKey(wallet);
    const exists = await r.exists(key);
    return exists === 1;
}

export async function markHappyAlertSent(wallet) {
    const r = getRedis();
    const key = getHappyKey(wallet);
    const ttlSeconds = getTTLUntilMidnight();
    await r.set(key, '1', 'EX', ttlSeconds);
    console.log(`📝 Marked Happy alert sent for ${wallet.slice(0, 10)}... (TTL: ${ttlSeconds}s)`);
}

// ═══════════════════════════════════════════════════════
// PNL SNAPSHOT (Real-time PnL for other projects to read)
// Key: hyperliquid:pnl:{wallet}:latest
// TTL: 60 seconds (auto-refresh)
// ═══════════════════════════════════════════════════════

/**
 * Save latest PnL snapshot for a wallet
 * Other projects can read this key to get real-time PnL data
 * 
 * @param {Object} report - PnL report from computePnL()
 */
export async function savePnlSnapshot(report) {
    const r = getRedis();
    const key = `hyperliquid:pnl:${report.wallet}:latest`;

    const data = {
        wallet: report.wallet,
        net: report.net,
        realized: report.realized,
        fee: report.fee,
        volume: report.volume,
        trades: report.trades,
        wins: report.wins,
        losses: report.losses,
        winrate: report.winrate,
        byCoin: report.byCoin,
        updatedAt: new Date().toISOString()
    };

    // TTL 60s - will be refreshed every 30s by monitor
    await r.set(key, JSON.stringify(data), 'EX', 60);
}

/**
 * Get latest PnL snapshot for a wallet
 * For use by other projects
 */
export async function getPnlSnapshot(wallet) {
    const r = getRedis();
    const key = `hyperliquid:pnl:${wallet}:latest`;
    const data = await r.get(key);
    return data ? JSON.parse(data) : null;
}

// ═══════════════════════════════════════════════════════
// DAILY REPORT HISTORY
// Key: hyperliquid:pnl:{wallet}:daily:{date}
// TTL: 7 days (keep 1 week history)
// ═══════════════════════════════════════════════════════

/**
 * Save daily report for historical tracking
 * Other projects can query past performance
 */
export async function saveDailyReport(report) {
    const r = getRedis();
    const date = getToday();
    const key = `hyperliquid:pnl:${report.wallet}:daily:${date}`;

    const data = {
        wallet: report.wallet,
        date: date,
        net: report.net,
        realized: report.realized,
        fee: report.fee,
        volume: report.volume,
        trades: report.trades,
        wins: report.wins,
        losses: report.losses,
        winrate: report.winrate,
        byCoin: report.byCoin,
        createdAt: new Date().toISOString()
    };

    // TTL 7 days
    await r.set(key, JSON.stringify(data), 'EX', 7 * 24 * 3600);
    console.log(`📊 Saved daily report for ${report.wallet.slice(0, 10)}... (${date})`);
}

/**
 * Get daily report for a specific date
 */
export async function getDailyReport(wallet, date = null) {
    const r = getRedis();
    const targetDate = date || getToday();
    const key = `hyperliquid:pnl:${wallet}:daily:${targetDate}`;
    const data = await r.get(key);
    return data ? JSON.parse(data) : null;
}

/**
 * Get all daily reports for a wallet (last 7 days)
 */
export async function getDailyReports(wallet, days = 7) {
    const r = getRedis();
    const reports = [];

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const key = `hyperliquid:pnl:${wallet}:daily:${dateStr}`;
        const data = await r.get(key);
        if (data) {
            reports.push(JSON.parse(data));
        }
    }

    return reports;
}

// ═══════════════════════════════════════════════════════
// API RESPONSE CACHE (Reduce Hyperliquid API calls)
// Key: hyperliquid:fills:{wallet}
// TTL: 10 seconds
// ═══════════════════════════════════════════════════════

/**
 * Cache API response to avoid rate limiting
 */
export async function cacheFills(wallet, fills) {
    const r = getRedis();
    const key = `hyperliquid:fills:${wallet}`;
    await r.set(key, JSON.stringify(fills), 'EX', 10);
}

/**
 * Get cached fills if available
 * Returns null if cache expired
 */
export async function getCachedFills(wallet) {
    const r = getRedis();
    const key = `hyperliquid:fills:${wallet}`;
    const data = await r.get(key);
    return data ? JSON.parse(data) : null;
}

// ═══════════════════════════════════════════════════════
// WALLET METADATA (For other projects to discover wallets)
// Key: hyperliquid:wallets:active
// Type: Set
// ═══════════════════════════════════════════════════════

/**
 * Register wallet as active (being monitored)
 */
export async function registerActiveWallet(wallet) {
    const r = getRedis();
    await r.sadd('hyperliquid:wallets:active', wallet);
}

/**
 * Get all active wallets being monitored
 * For use by other projects to discover wallets
 */
export async function getActiveWallets() {
    const r = getRedis();
    return await r.smembers('hyperliquid:wallets:active');
}

// ═══════════════════════════════════════════════════════
// SUMMARY: Redis Key Structure for Cross-Project Use
// ═══════════════════════════════════════════════════════
// 
// hyperliquid:pnl:{wallet}:latest          - Real-time PnL (JSON, TTL 60s)
// hyperliquid:pnl:{wallet}:daily:{date}    - Daily reports (JSON, TTL 7d)
// hyperliquid:fills:{wallet}               - API cache (JSON, TTL 10s)
// hyperliquid:wallets:active               - Active wallet set (Set, no TTL)
// pnl:stoploss:alert:{wallet}:{date}       - Stop Loss alert sent (String, TTL midnight)
// pnl:happy:alert:{wallet}:{date}          - Happy alert sent (String, TTL midnight)
//

