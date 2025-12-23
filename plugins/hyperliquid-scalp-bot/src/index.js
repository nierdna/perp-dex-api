import 'dotenv/config'
import { runScalp } from './bot/scalpEngine.js'
import { startServer } from './server.js'
import { initDB } from './data/db.js'

const SYMBOL = process.env.SYMBOL || 'ETH'
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 60) * 1000

// Init DB
initDB()

// Start API Server
startServer()

// Start Bot Loop
setInterval(runScalp, POLL_INTERVAL)

console.log('🚀 Scalp Bot Started')
console.log('---------------------------------------')
console.log(`📈 Target Symbol:   ${SYMBOL}`)
console.log(`⏱️  Timeframe:       Multi (15m/5m/1m)`)
console.log(`🔄 Poll Interval:   ${POLL_INTERVAL / 1000}s`)
console.log('---------------------------------------')
console.log('Waiting for next cycle...')