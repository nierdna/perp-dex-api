import { executeStrategy } from '../core/strategyExecutor.js'
import { withSymbolLock } from './symbolLock.js'

let schedulers = []

/**
 * Start bar-close event schedulers for 1m/5m/15m timeframes (Scalp) and 4H/1H/30M (Swing)
 * Triggers strategy execution only when candles are fully closed
 * @param {Array<string>} symbols - Symbols to track (e.g. ['BTC', 'ETH'])
 * @param {Array<Object>} strategies - Active strategy instances
 */
export function startBarCloseScheduler(symbols, strategies) {
  if (schedulers.length > 0) {
    console.warn('⚠️  Bar-close schedulers already running')
    return
  }

  // Separate Scalp and Swing strategies
  const scalpStrategies = strategies.filter(s => s.getName() !== 'SWING_01')
  const swingStrategies = strategies.filter(s => s.getName() === 'SWING_01')

  console.log('📅 Starting bar-close schedulers...')
  
  // Schedule Scalp timeframes (1m/5m/15m)
  if (scalpStrategies.length > 0) {
    console.log('   Scalp strategies: 1m/5m/15m')
    schedule1mBar(symbols, scalpStrategies)
    schedule5mBar(symbols, scalpStrategies)
    schedule15mBar(symbols, scalpStrategies)
  }
  
  // Schedule Swing timeframes (4H/1H/30M)
  if (swingStrategies.length > 0) {
    console.log('   Swing strategies: 4H/1H/30M')
    schedule4hBar(symbols, swingStrategies)
    schedule1hBar(symbols, swingStrategies)
    schedule30mBar(symbols, swingStrategies)
  }
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
 * @param {string} timeframe - '1m' | '5m' | '15m' | '4h' | '1h' | '30m'
 * @param {Array<string>} symbols
 * @param {Array<Object>} strategies
 */
async function onBarClose(timeframe, symbols, strategies) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
  console.log(`\n[${timestamp}] 📊 ${timeframe} bar closed - processing ${symbols.length} symbols...`)
  
  // For Swing01, only trigger on 4H bar close (main trigger)
  // 1H and 30M can be used for LTF confirmation but main trigger is 4H
  if (timeframe === '1h' || timeframe === '30m') {
    // Only run Swing01 if it's in strategies (for LTF confirmation updates)
    const swingStrategies = strategies.filter(s => s.getName() === 'SWING_01')
    if (swingStrategies.length === 0) {
      return // No swing strategies, skip
    }
    // For now, skip 1H/30M triggers (can be enabled later if needed)
    // Swing01 main trigger is 4H bar close
    return
  }
  
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

/**
 * Schedule next 4-hour bar close (triggers at :00, :04, :08, :12, :16, :20)
 */
function schedule4hBar(symbols, strategies) {
  const now = Date.now()
  // 4H bars: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
  const hoursInDay = 24
  const barInterval = 4 * 60 * 60 * 1000 // 4 hours in ms
  const currentHour = new Date(now).getUTCHours()
  const currentBar = Math.floor(currentHour / 4) * 4
  const nextBar = currentBar + 4
  
  const nextBarTime = new Date(now)
  nextBarTime.setUTCHours(nextBar, 0, 0, 0)
  if (nextBar >= 24) {
    nextBarTime.setUTCDate(nextBarTime.getUTCDate() + 1)
    nextBarTime.setUTCHours(0, 0, 0, 0)
  }
  
  const delay = nextBarTime.getTime() - now
  
  const nextTime = nextBarTime.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })
  console.log(`⏰ Next 4H bar at ${nextTime} UTC (in ${Math.round(delay / 1000)}s)`)
  
  const timer = setTimeout(async () => {
    await onBarClose('4h', symbols, strategies)
    schedule4hBar(symbols, strategies) // recursive
  }, delay)
  
  schedulers.push(timer)
}

/**
 * Schedule next 1-hour bar close (triggers at :00 every hour)
 */
function schedule1hBar(symbols, strategies) {
  const now = Date.now()
  const nextHour = new Date(now)
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0)
  const delay = nextHour.getTime() - now
  
  const nextTime = nextHour.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })
  console.log(`⏰ Next 1H bar at ${nextTime} UTC (in ${Math.round(delay / 1000)}s)`)
  
  const timer = setTimeout(async () => {
    await onBarClose('1h', symbols, strategies)
    schedule1hBar(symbols, strategies) // recursive
  }, delay)
  
  schedulers.push(timer)
}

/**
 * Schedule next 30-minute bar close (triggers at :00, :30 every hour)
 */
function schedule30mBar(symbols, strategies) {
  const now = Date.now()
  const currentMinute = new Date(now).getUTCMinutes()
  const nextBar = currentMinute < 30 ? 30 : 60
  
  const nextBarTime = new Date(now)
  nextBarTime.setUTCMinutes(nextBar, 0, 0)
  if (nextBar >= 60) {
    nextBarTime.setUTCHours(nextBarTime.getUTCHours() + 1, 0, 0, 0)
  }
  
  const delay = nextBarTime.getTime() - now
  
  const nextTime = nextBarTime.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })
  console.log(`⏰ Next 30M bar at ${nextTime} UTC (in ${Math.round(delay / 1000)}s)`)
  
  const timer = setTimeout(async () => {
    await onBarClose('30m', symbols, strategies)
    schedule30mBar(symbols, strategies) // recursive
  }, delay)
  
  schedulers.push(timer)
}

