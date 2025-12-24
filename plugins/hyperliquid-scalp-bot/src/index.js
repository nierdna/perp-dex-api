import 'dotenv/config'
import { executeStrategy } from './core/strategyExecutor.js'
import { getActiveStrategies } from './strategies/index.js'
import { startServer } from './server.js'
import { initDB } from './data/db.js'
import { startTradeOutcomeMonitor } from './monitor/tradeOutcomeMonitor.js'
import { withSymbolLock } from './bot/symbolLock.js'

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

  // Get Active Strategies
  const activeStrategies = getActiveStrategies()
  if (activeStrategies.length === 0) {
    console.error('❌ No active strategies found! Check process.env.ACTIVE_STRATEGIES')
    return
  }

  // Define Bot Loop Function
  const runBotCycle = async () => {
    // Chạy song song cho TẤT CẢ các symbol đang theo dõi
    // Dùng map thay vì for loop để tạo ra mảng các promise chạy đồng thời
    const promises = SYMBOLS.map(async (symbol, index) => {

      // Stagger (Delay nhẹ) giữa các symbol để tránh gửi một lúc quá nhiều request gây Rate Limit
      // Ví dụ: BTC (0s) -> ETH (0.5s) -> SOL (1s)
      await new Promise(r => setTimeout(r, index * 500))

      // Lock per symbol: Đảm bảo không chạy chồng chéo cho cùng 1 symbol
      const locked = await withSymbolLock(symbol, async () => {

        // Chạy song song TẤT CẢ các strategy cho symbol này
        // Ví dụ: BTC sẽ được check cả SCALP_01 và SCALP_02 cùng lúc
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

    // Đợi tất cả hoàn thành (chỉ để log cycle finished, không block cycle sau nếu dùng setInterval)
    await Promise.allSettled(promises)
    // console.log(`--- [${new Date().toLocaleTimeString()}] Batch Cycle Finished ---`)
  }

  // Chạy ngay lập tức một lần đầu tiên
  runBotCycle()

  // Set Interval cho các lần tiếp theo
  setInterval(runBotCycle, POLL_INTERVAL)

  console.log('🚀 Scalp Bot Started (Multi-Strategy Architecture)')
  console.log('---------------------------------------')
  console.log(`📈 Target Symbols:    ${SYMBOLS.join(', ')}`)
  console.log(`🧠 Active Strategies: ${activeStrategies.map(s => s.getName()).join(', ')}`)
  console.log(`⏱️  Timeframe:        Multi (15m/5m/1m)`)
  console.log(`🔄 Poll Interval:    ${POLL_INTERVAL / 1000}s`)
  console.log(`⚡ Execution Mode:    Parallel (${SYMBOLS.length} symbols x ${activeStrategies.length} strategies)`)
  console.log('---------------------------------------')
  console.log('Waiting for next cycle...')
}

bootstrap()