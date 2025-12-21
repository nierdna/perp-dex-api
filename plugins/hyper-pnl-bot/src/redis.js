import Redis from 'ioredis';
import config from './config.js';

let redis = null;

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
            retryDelayOnFailover: 1000,
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });

        redis.on('error', (err) => {
            console.error('Redis connection error:', err.message);
        });

        redis.on('connect', () => {
            console.log('✅ Redis connected successfully.');
        });
    }
    return redis;
}

// Key format: pnl:stoploss:alert:{wallet}:{date}
// Example: pnl:stoploss:alert:0x63a5f...:2025-12-22
function getStopLossKey(wallet) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `pnl:stoploss:alert:${wallet}:${today}`;
}

function getHappyKey(wallet) {
    const today = new Date().toISOString().split('T')[0];
    return `pnl:happy:alert:${wallet}:${today}`;
}

/**
 * Check if Stop Loss alert was already sent today for this wallet
 */
export async function wasStopLossAlertSent(wallet) {
    const r = getRedis();
    const key = getStopLossKey(wallet);
    const exists = await r.exists(key);
    return exists === 1;
}

/**
 * Mark Stop Loss alert as sent for this wallet (expires at midnight UTC)
 */
export async function markStopLossAlertSent(wallet) {
    const r = getRedis();
    const key = getStopLossKey(wallet);

    // Calculate seconds until midnight UTC
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    const ttlSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

    await r.set(key, '1', 'EX', ttlSeconds);
    console.log(`📝 Marked StopLoss alert sent for ${wallet.slice(0, 10)}... (TTL: ${ttlSeconds}s)`);
}

/**
 * Check if Happy alert was already sent today for this wallet
 */
export async function wasHappyAlertSent(wallet) {
    const r = getRedis();
    const key = getHappyKey(wallet);
    const exists = await r.exists(key);
    return exists === 1;
}

/**
 * Mark Happy alert as sent for this wallet (expires at midnight UTC)
 */
export async function markHappyAlertSent(wallet) {
    const r = getRedis();
    const key = getHappyKey(wallet);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    const ttlSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

    await r.set(key, '1', 'EX', ttlSeconds);
    console.log(`📝 Marked Happy alert sent for ${wallet.slice(0, 10)}... (TTL: ${ttlSeconds}s)`);
}
