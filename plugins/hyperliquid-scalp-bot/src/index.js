import 'dotenv/config'
import { runScalp } from './bot/scalpEngine.js'
import { startServer } from './server.js'

const SYMBOL = process.env.SYMBOL || 'ETH'
const TIMEFRAME = process.env.TIMEFRAME || '15m'
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 60) * 1000

// Start API Server
startServer()

// Start Bot Loop
setInterval(runScalp, POLL_INTERVAL)

console.log('🚀 Scalp Bot Started')
console.log('---------------------------------------')
console.log(`📈 Target Symbol:   ${SYMBOL}`)
console.log(`⏱️  Timeframe:       ${TIMEFRAME}`)
console.log(`🔄 Poll Interval:   ${POLL_INTERVAL / 1000}s`)
console.log('---------------------------------------')
console.log('Waiting for next cycle...')