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
    strategy VARCHAR(50) DEFAULT 'SCALP_01',
    symbol VARCHAR(10) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    price NUMERIC,
    ai_action VARCHAR(20),
    ai_confidence NUMERIC,
    ai_reason TEXT,
    ai_full_response JSONB,
    market_snapshot JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`

export async function initDB() {
    try {
        await pool.query(CREATE_TABLE_QUERY)
        console.log('✅ Database connected & table logs_trade ready')
    } catch (err) {
        console.error('❌ Database connection error:', err.message)
    }
}

export async function saveLog(data) {
    const query = `
    INSERT INTO logs_trade 
    (strategy, symbol, timeframe, price, ai_action, ai_confidence, ai_reason, ai_full_response, market_snapshot)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `
    const values = [
        data.strategy || 'SCALP_01',
        data.symbol,
        data.timeframe,
        data.price,
        data.ai_action,
        data.ai_confidence,
        data.ai_reason,
        JSON.stringify(data.ai_full_response),
        JSON.stringify(data.market_snapshot)
    ]

    try {
        await pool.query(query, values)
        // console.log('💾 Log saved to DB')
    } catch (err) {
        console.error('❌ Save log error:', err.message)
    }
}
