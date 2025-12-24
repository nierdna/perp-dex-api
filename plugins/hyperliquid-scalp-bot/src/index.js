import 'dotenv/config'
import { runScalp } from './bot/scalpEngine.js'
import { startServer } from './server.js'
import { initDB } from './data/db.js'
import { startTradeOutcomeMonitor } from './monitor/tradeOutcomeMonitor.js'

// Parse SYMBOL từ .env (có thể là "BTC" hoặc "BTC,ETH,SOL")
const SYMBOLS = process.env.SYMBOL 
  ? process.env.SYMBOL.split(',').map(s => s.trim()).filter(s => s.length > 0)
  : ['BTC'] // Default BTC

const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 60) * 1000

async function bootstrap() {
  // Init DB (create + migrate)
  await initDB()

  // Start WS monitor để đánh dấu WIN/LOSS cho các signal OPEN
  startTradeOutcomeMonitor().catch(() => {
    // Không crash bot nếu WS monitor lỗi (sẽ tự reconnect nếu WS fail)
  })

  // Start API Server
  startServer()

  // Start Bot Loop - Chạy cho từng symbol
  let symbolIndex = 0
  setInterval(() => {
    // Round-robin qua các symbol
    const currentSymbol = SYMBOLS[symbolIndex % SYMBOLS.length]
    runScalp(currentSymbol)
    symbolIndex++
  }, POLL_INTERVAL)

  console.log('🚀 Scalp Bot Started')
  console.log('---------------------------------------')
  console.log(`📈 Target Symbols:   ${SYMBOLS.join(', ')}`)
  console.log(`⏱️  Timeframe:       Multi (15m/5m/1m)`)
  console.log(`🔄 Poll Interval:   ${POLL_INTERVAL / 1000}s`)
  console.log(`🔄 Symbol Rotation: Round-robin (${SYMBOLS.length} symbol${SYMBOLS.length > 1 ? 's' : ''})`)
  console.log('---------------------------------------')
  console.log('Waiting for next cycle...')
}

bootstrap()