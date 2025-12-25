import 'dotenv/config'
import { executeStrategy } from './core/strategyExecutor.js'
import { getActiveStrategies } from './strategies/index.js'
import { startServer } from './server.js'
import { initDB } from './data/db.js'
import { startTradeOutcomeMonitor } from './monitor/tradeOutcomeMonitor.js'
import { withSymbolLock } from './bot/symbolLock.js'
import { startBarCloseScheduler } from './bot/barCloseScheduler.js'

// Parse SYMBOL từ .env (có thể là "BTC" hoặc "BTC,ETH,SOL")
const SYMBOLS = process.env.SYMBOL
  ? process.env.SYMBOL.split(',').map(s => s.trim()).filter(s => s.length > 0)
  : ['BTC'] // Default BTC

// Execution mode: use bar-close scheduler by default, fallback to polling if explicitly set
const USE_BAR_CLOSE = process.env.BAR_CLOSE_MODE !== 'false' && !process.env.POLL_INTERVAL
const POLL_INTERVAL = process.env.POLL_INTERVAL ? (parseInt(process.env.POLL_INTERVAL) * 1000) : null

async function bootstrap() {
  // Init DB (create + migrate)
  await initDB()

  // Start WS monitor để đánh dấu WIN/LOSS cho các signal OPEN
  startTradeOutcomeMonitor().catch(() => {
    // Không crash bot nếu WS monitor lỗi (sẽ tự reconnect nếu WS fail)
  })

  // Start API Server
  startServer()

  // Get Active Strategies
  const activeStrategies = getActiveStrategies()
  if (activeStrategies.length === 0) {
    console.error('❌ No active strategies found! Check process.env.ACTIVE_STRATEGIES')
    return
  }

  // Start execution based on mode
  if (USE_BAR_CLOSE) {
    // Bar-Close Scheduler Mode (default)
    console.log('🚀 Scalp Bot Started (Multi-Strategy Architecture)')
    console.log('---------------------------------------')
    console.log(`📈 Target Symbols:    ${SYMBOLS.join(', ')}`)
    console.log(`🧠 Active Strategies: ${activeStrategies.map(s => s.getName()).join(', ')}`)
    console.log(`⏱️  Timeframe:        Multi (15m/5m/1m)`)
    console.log(`🔄 Execution Mode:    Bar-Close Scheduler (Closed Candles Only)`)
    console.log(`⚡ Processing:        Parallel (${SYMBOLS.length} symbols x ${activeStrategies.length} strategies)`)
    console.log('---------------------------------------')
    
    startBarCloseScheduler(SYMBOLS, activeStrategies)
  } else {
    // Polling Mode (backward compatibility)
    const runBotCycle = async () => {
      const promises = SYMBOLS.map(async (symbol, index) => {
        await new Promise(r => setTimeout(r, index * 500))
        
        const locked = await withSymbolLock(symbol, async () => {
          const strategyPromises = activeStrategies.map(async (strategy) => {
            try {
              await executeStrategy(symbol, strategy)
            } catch (e) {
              console.error(`❌ Error running ${strategy.getName()} for ${symbol}:`, e)
            }
          })
          await Promise.allSettled(strategyPromises)
        })
        
        if (locked?.skipped) {
          console.warn(`⏭️  Skip cycle for ${symbol} (previous cycle still running)`)
        }
      })
      
      await Promise.allSettled(promises)
    }
    
    runBotCycle()
    setInterval(runBotCycle, POLL_INTERVAL)
    
    console.log('🚀 Scalp Bot Started (Multi-Strategy Architecture)')
    console.log('---------------------------------------')
    console.log(`📈 Target Symbols:    ${SYMBOLS.join(', ')}`)
    console.log(`🧠 Active Strategies: ${activeStrategies.map(s => s.getName()).join(', ')}`)
    console.log(`⏱️  Timeframe:        Multi (15m/5m/1m)`)
    console.log(`🔄 Poll Interval:    ${POLL_INTERVAL / 1000}s`)
    console.log(`⚡ Execution Mode:    Polling (Live Candles)`)
    console.log('---------------------------------------')
    console.log('Waiting for next cycle...')
  }
}

bootstrap()