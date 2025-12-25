import { executeStrategy } from '../core/strategyExecutor.js'
import { withSymbolLock } from './symbolLock.js'

let schedulers = []

/**
 * Start bar-close event schedulers for 1m/5m/15m timeframes
 * Triggers strategy execution only when candles are fully closed
 * @param {Array<string>} symbols - Symbols to track (e.g. ['BTC', 'ETH'])
 * @param {Array<Object>} strategies - Active strategy instances
 */
export function startBarCloseScheduler(symbols, strategies) {
  if (schedulers.length > 0) {
    console.warn('⚠️  Bar-close schedulers already running')
    return
  }

  console.log('📅 Starting bar-close schedulers (1m/5m/15m)...')
  
  // Schedule 1-minute bar closes
  schedule1mBar(symbols, strategies)
  
  // Schedule 5-minute bar closes
  schedule5mBar(symbols, strategies)
  
  // Schedule 15-minute bar closes
  schedule15mBar(symbols, strategies)
}

/**
 * Stop all schedulers (useful for graceful shutdown)
 */
export function stopBarCloseScheduler() {
  schedulers.forEach(timer => clearTimeout(timer))
  schedulers = []
  console.log('🛑 Bar-close schedulers stopped')
}

/**
 * Schedule next 1-minute bar close (triggers at :00 seconds)
 */
function schedule1mBar(symbols, strategies) {
  const now = Date.now()
  const nextMinute = Math.ceil(now / 60000) * 60000 // next :00
  const delay = nextMinute - now
  
  const nextTime = new Date(nextMinute).toLocaleTimeString('en-US', { hour12: false })
  console.log(`⏰ Next 1m bar at ${nextTime} (in ${Math.round(delay / 1000)}s)`)
  
  const timer = setTimeout(async () => {
    await onBarClose('1m', symbols, strategies)
    schedule1mBar(symbols, strategies) // recursive
  }, delay)
  
  schedulers.push(timer)
}

/**
 * Schedule next 5-minute bar close (triggers at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55)
 */
function schedule5mBar(symbols, strategies) {
  const now = Date.now()
  const nextBar = Math.ceil(now / (5 * 60000)) * (5 * 60000)
  const delay = nextBar - now
  
  const nextTime = new Date(nextBar).toLocaleTimeString('en-US', { hour12: false })
  console.log(`⏰ Next 5m bar at ${nextTime} (in ${Math.round(delay / 1000)}s)`)
  
  const timer = setTimeout(async () => {
    await onBarClose('5m', symbols, strategies)
    schedule5mBar(symbols, strategies) // recursive
  }, delay)
  
  schedulers.push(timer)
}

/**
 * Schedule next 15-minute bar close (triggers at :00, :15, :30, :45)
 */
function schedule15mBar(symbols, strategies) {
  const now = Date.now()
  const nextBar = Math.ceil(now / (15 * 60000)) * (15 * 60000)
  const delay = nextBar - now
  
  const nextTime = new Date(nextBar).toLocaleTimeString('en-US', { hour12: false })
  console.log(`⏰ Next 15m bar at ${nextTime} (in ${Math.round(delay / 1000)}s)`)
  
  const timer = setTimeout(async () => {
    await onBarClose('15m', symbols, strategies)
    schedule15mBar(symbols, strategies) // recursive
  }, delay)
  
  schedulers.push(timer)
}

/**
 * Execute strategies when a bar closes
 * @param {string} timeframe - '1m' | '5m' | '15m'
 * @param {Array<string>} symbols
 * @param {Array<Object>} strategies
 */
async function onBarClose(timeframe, symbols, strategies) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
  console.log(`\n[${timestamp}] 📊 ${timeframe} bar closed - processing ${symbols.length} symbols...`)
  
  // Process all symbols in parallel with stagger to avoid rate limits
  const promises = symbols.map(async (symbol, index) => {
    // Stagger: BTC (0s) -> ETH (0.5s) -> SOL (1s) -> LINK (1.5s)
    await new Promise(r => setTimeout(r, index * 500))
    
    // Lock per symbol to prevent concurrent cycles
    const locked = await withSymbolLock(symbol, async () => {
      // Run all strategies for this symbol in parallel
      const strategyPromises = strategies.map(async (strategy) => {
        try {
          // Pass flag to use closed candles only
          await executeStrategy(symbol, strategy, false, { useClosedCandles: true })
        } catch (e) {
          console.error(`❌ Error running ${strategy.getName()} for ${symbol}:`, e)
        }
      })
      
      await Promise.allSettled(strategyPromises)
    })
    
    if (locked?.skipped) {
      console.warn(`⏭️  Skip ${symbol} (previous cycle still running)`)
    }
  })
  
  await Promise.allSettled(promises)
  console.log(`✅ ${timeframe} bar processing complete`)
}

