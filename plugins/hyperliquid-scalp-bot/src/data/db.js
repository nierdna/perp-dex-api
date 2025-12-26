import pg from 'pg'
import 'dotenv/config'

// Support both DATABASE_URL and individual connection params (backward compatible)
const pool = process.env.DATABASE_URL
    ? new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
    })
    : new pg.Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    })

// Tạo bảng nếu chưa có (cập nhật tên bảng và thêm cột strategy)
const CREATE_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS logs_trade (
    id SERIAL PRIMARY KEY,
    strategy VARCHAR(50) DEFAULT 'SCALP_03',
    symbol VARCHAR(10) NOT NULL,
    timeframe VARCHAR(50) NOT NULL,
    price NUMERIC,
    ai_action VARCHAR(20),
    ai_confidence NUMERIC,
    ai_reason TEXT,
    ai_full_response JSONB,
    market_snapshot JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`

// Schema mở rộng để lưu plan/entry/SL/TP và kết quả WIN/LOSS theo WS monitor.
// Dùng ALTER ... IF NOT EXISTS để không phá DB đang chạy.
const MIGRATION_QUERIES = [
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS plan JSONB;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS entry_price NUMERIC;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS stop_loss_price NUMERIC;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS take_profit_prices JSONB;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS outcome VARCHAR(10);`, // OPEN | WIN | LOSS
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS outcome_reason TEXT;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS close_price NUMERIC;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS pnl_percent NUMERIC;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;`,
    `ALTER TABLE logs_trade ADD COLUMN IF NOT EXISTS trigger_info JSONB;`, // For Swing01 strategy
    `ALTER TABLE logs_trade ALTER COLUMN timeframe TYPE VARCHAR(50);`, // Fix timeframe length for Swing strategies
]

export async function initDB() {
    try {
        await pool.query(CREATE_TABLE_QUERY)
        for (const q of MIGRATION_QUERIES) {
            await pool.query(q)
        }
        console.log('✅ Database connected & table logs_trade ready')
    } catch (err) {
        console.error('❌ Database connection error:', err.message)
    }
}

export async function saveLog(data) {
    const query = `
    INSERT INTO logs_trade 
    (strategy, symbol, timeframe, price, ai_action, ai_confidence, ai_reason, ai_full_response, market_snapshot, plan, entry_price, stop_loss_price, take_profit_prices, outcome, trigger_info)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id
  `
    const values = [
        data.strategy || 'SCALP_03',
        data.symbol,
        data.timeframe,
        data.price,
        data.ai_action,
        data.ai_confidence,
        data.ai_reason,
        JSON.stringify(data.ai_full_response),
        JSON.stringify(data.market_snapshot),
        data.plan ? JSON.stringify(data.plan) : null,
        data.entry_price ?? null,
        data.stop_loss_price ?? null,
        data.take_profit_prices ? JSON.stringify(data.take_profit_prices) : null,
        data.outcome ?? null,
        data.trigger_info ? JSON.stringify(data.trigger_info) : null,
    ]

    try {
        const result = await pool.query(query, values)
        // console.log('💾 Log saved to DB')
        return result?.rows?.[0]?.id ?? null
    } catch (err) {
        console.error('❌ Save log error:', err.message)
        return null
    }
}

export async function fetchOpenTrades() {
    const query = `
      SELECT id, symbol, ai_action, entry_price, stop_loss_price, take_profit_prices, created_at
      FROM logs_trade
      WHERE outcome = 'OPEN'
    `
    try {
        const result = await pool.query(query)
        return result.rows || []
    } catch (err) {
        console.error('❌ Fetch open trades error:', err.message)
        return []
    }
}

export async function updateTradeOutcome({ id, outcome, close_price, pnl_percent, outcome_reason }) {
    const query = `
      UPDATE logs_trade
      SET outcome = $2,
          close_price = $3,
          pnl_percent = $4,
          outcome_reason = $5,
          closed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `
    const values = [id, outcome, close_price ?? null, pnl_percent ?? null, outcome_reason ?? null]
    try {
        await pool.query(query, values)
        return true
    } catch (err) {
        console.error('❌ Update trade outcome error:', err.message)
        return false
    }
}
