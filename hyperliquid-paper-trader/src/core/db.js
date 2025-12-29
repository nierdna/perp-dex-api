
import pg from 'pg'
const { Pool } = pg
import dotenv from 'dotenv'

dotenv.config()

// Default fallback if env not set, though user should set DATABASE_URL
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/hyperliquid_bot'

const pool = new Pool({
  connectionString,
})

export const db = {
  query: (text, params) => pool.query(text, params),
}

export async function initDB() {
  const client = await pool.connect()
  try {
    console.log('🔌 Connecting to Database...')

    // 1. Table: strategies
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategies (
        id VARCHAR(50) PRIMARY KEY,
        initial_capital NUMERIC(20, 2) NOT NULL,
        current_balance NUMERIC(20, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // 2. Table: positions
    await client.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        strategy_id VARCHAR(50) REFERENCES strategies(id),
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        entry_price NUMERIC(20, 8) NOT NULL,
        size NUMERIC(20, 8) NOT NULL,
        sl NUMERIC(20, 8),
        tp NUMERIC(20, 8),
        status VARCHAR(20) DEFAULT 'OPEN',
        exit_price NUMERIC(20, 8) DEFAULT NULL,
        pnl NUMERIC(20, 2) DEFAULT NULL,
        result VARCHAR(10) DEFAULT NULL,
        close_reason VARCHAR(20) DEFAULT NULL,
        closed_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // Migration for existing tables
    await client.query(`
      ALTER TABLE positions ADD COLUMN IF NOT EXISTS result VARCHAR(10) DEFAULT NULL;
      ALTER TABLE positions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP DEFAULT NULL;
    `)

    console.log('✅ Database Schema Initialized')
  } catch (err) {
    console.error('❌ Database Init Error:', err)
  } finally {
    client.release()
  }
}
