
import 'dotenv/config'
import { getBacktestCandles } from '../data/marketCollector.js'
import { calcIndicators } from '../indicators/index.js'
import { normalizeSignal } from '../signal/normalizeSignal.js'
import { getTodaysNews } from '../data/newsCollector.js'
import { getDecision } from '../ai/deepseekDecision.js'

// CONFIG
const USE_AI = process.env.BACKTEST_USE_AI === 'true' // Set to 'true' to test with real AI
const MIN_AI_CONFIDENCE = 0.65 // AI trả về 0.0 - 1.0 (Nới lỏng để khớp với logic mới)

// News Cache để tránh gọi API nhiều lần
const newsCache = new Map()

async function getNewsForDate(dateStr) {
    if (newsCache.has(dateStr)) {
        return newsCache.get(dateStr)
    }

    // Gọi API lấy tin tức cho ngày này
    // Note: getTodaysNews() hiện tại lấy hôm nay + ngày mai
    // Trong backtest, ta cần lấy tin tức cho ngày cụ thể
    const news = await getTodaysNews()
    newsCache.set(dateStr, news)
    return news
}

// Simple helper to check conditions (Replicated from scalpEngine without AI)
function checkTechnicalFilters(signal) {
    const hasEntrySignal = (signal.entry_cross !== 'none')
    const isRsiExtreme = (signal.bias_rsi7 > 80 || signal.bias_rsi7 < 20)

    if (!hasEntrySignal && !isRsiExtreme) return false

    if (hasEntrySignal) {
        if (signal.entry_cross === 'golden_cross' && signal.bias_5m !== 'bullish') return false
        if (signal.entry_cross === 'death_cross' && signal.bias_5m !== 'bearish') return false
    }
    return true
}

async function runBacktest() {
    console.log('🔄 Fetching Historical Data (1 Day)...')
    const days = 1
    const endTime = Date.now()
    const startTime = endTime - (days * 24 * 60 * 60 * 1000)
    const SYMBOL = process.env.SYMBOL || 'ETH'

    // Fetch data song song
    const [c15m, c5m, c1m] = await Promise.all([
        getBacktestCandles(SYMBOL, '15m', startTime - 48 * 60 * 60 * 1000, endTime), // Lấy dư data để tính EMA
        getBacktestCandles(SYMBOL, '5m', startTime - 24 * 60 * 60 * 1000, endTime),
        getBacktestCandles(SYMBOL, '1m', startTime, endTime)
    ])

    if (!c1m.length) {
        console.log('❌ No data found.')
        return
    }

    console.log(`✅ Loaded: ${c1m.length} candles (1m), ${c5m.length} candles (5m), ${c15m.length} candles (15m)`)

    // PRE-CACHE NEWS: Lấy tin tức cho tất cả các ngày trong khoảng backtest
    console.log('📰 Pre-caching news data...')
    const uniqueDates = new Set()
    for (let i = 200; i < c1m.length - 100; i++) {
        const dateStr = new Date(c1m[i].t).toISOString().split('T')[0]
        uniqueDates.add(dateStr)
    }

    let newsApiCalls = 0
    for (const dateStr of uniqueDates) {
        await getNewsForDate(dateStr)
        newsApiCalls++
    }
    console.log(`✅ Cached news for ${uniqueDates.size} unique dates (${newsApiCalls} API calls)`)
    console.log(`🤖 AI Mode: ${USE_AI ? 'ENABLED (Real AI Analysis)' : 'DISABLED (Technical Filters Only)'}`)

    let signals = []
    let wins = 0
    let losses = 0
    let inPosition = false
    let positionCloseIndex = 0
    let aiSkips = 0 // Số lần AI từ chối signal

    // CAPITAL MANAGEMENT
    const INITIAL_CAPITAL = 100 // $100
    const POSITION_SIZE = 200   // $200 (2x leverage)
    let currentBalance = INITIAL_CAPITAL

    // BACKTEST PARAMS (Scalping Optimized)
    const TAKE_PROFIT = 0.009 // 0.9% (R:R 1:1.5)
    const STOP_LOSS = 0.006   // 0.6%
    const MAX_HOLD_CANDLES = 60 // Timeout 60 nến (~1h)

    console.log('🚀 Running Simulator (Single Position Mode)...')
    console.log(`💰 Capital: $${INITIAL_CAPITAL} | Position: $${POSITION_SIZE}`)

    // Loop through 1m candles
    for (let i = 200; i < c1m.length - 100; i++) {
        // Log progress every 200 candles
        if (i % 200 === 0) {
            console.log(`🔎 Scanning candle ${i}/${c1m.length - 100}`);
        }
        // Nếu đang giữ lệnh, skip
        if (inPosition && i < positionCloseIndex) {
            continue
        }

        // Lệnh cũ đã đóng
        inPosition = false

        const currentCandle = c1m[i]
        const currentTime = currentCandle.t

        const tf1m_slice = c1m.slice(i - 199, i + 1)
        const tf5m_slice = c5m.filter(c => c.t <= currentTime).slice(-200)
        const tf15m_slice = c15m.filter(c => c.t <= currentTime).slice(-200)

        const marketFake = {
            candles_15m: tf15m_slice,
            candles_5m: tf5m_slice,
            candles_1m: tf1m_slice,
            price: parseFloat(currentCandle.c),
            symbol: SYMBOL,
            funding: 0
        }

        const indicators = calcIndicators(marketFake)
        const signal = normalizeSignal(indicators)

        // Check Hard Filter (Chỉ lấy các điểm giao cắt thực sự hoặc signal rõ ràng)
        if (checkTechnicalFilters(signal) && signal.entry_cross !== 'none') {
            console.log(`📈 Technical filter passed at ${new Date(currentTime).toLocaleString()}, type: ${signal.entry_cross}`);

            let shouldTrade = true
            let aiDecision = null

            // Nếu bật AI mode, check thêm AI decision
            if (USE_AI) {
                console.log(`🤖 Calling AI for signal at ${new Date(currentTime).toLocaleString()}`);

                const dateStr = new Date(currentTime).toISOString().split('T')[0]
                const news = await getNewsForDate(dateStr)

                signal.news_events = news // Attach news vào signal

                try {
                    aiDecision = await getDecision(signal)

                    // Check AI confidence và action
                    // NOTE: Chuẩn hoá action chỉ còn LONG/SHORT/NO_TRADE (không dùng WAIT nữa)
                    if (aiDecision.action === 'NO_TRADE' || aiDecision.confidence < MIN_AI_CONFIDENCE) {
                        console.log(`⚠️ AI rejected signal: action=${aiDecision.action}, confidence=${(aiDecision.confidence * 100).toFixed(0)}%`);
                        shouldTrade = false
                        aiSkips++
                    } else {
                        console.log(`✅ AI accepted signal: action=${aiDecision.action}, confidence=${(aiDecision.confidence * 100).toFixed(0)}%`);

                        // Verify AI side matches technical side
                        const technicalSide = signal.entry_cross === 'golden_cross' ? 'LONG' : 'SHORT'
                        if (aiDecision.action !== technicalSide) {
                            console.log(`⚠️ AI side mismatch: AI=${aiDecision.action}, technical=${technicalSide}`);
                            shouldTrade = false
                            aiSkips++
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ AI Error at ${new Date(currentTime).toLocaleString()}: ${error.message}`)
                    shouldTrade = false
                }
            }

            if (!shouldTrade) {
                continue // Skip signal này
            }

            // FOUND SIGNAL! Open position
            const entryPrice = parseFloat(currentCandle.c)
            let result = 'TIMEOUT'
            let exitIndex = i + MAX_HOLD_CANDLES
            let exitPrice = entryPrice

            // Look ahead future candles
            for (let j = i + 1; j < Math.min(c1m.length, i + MAX_HOLD_CANDLES); j++) {
                const future = c1m[j]
                const high = parseFloat(future.h)
                const low = parseFloat(future.l)

                if (signal.entry_cross === 'golden_cross') { // LONG
                    if (high >= entryPrice * (1 + TAKE_PROFIT)) {
                        result = 'WIN'
                        exitPrice = entryPrice * (1 + TAKE_PROFIT)
                        exitIndex = j
                        break
                    }
                    if (low <= entryPrice * (1 - STOP_LOSS)) {
                        result = 'LOSS'
                        exitPrice = entryPrice * (1 - STOP_LOSS)
                        exitIndex = j
                        break
                    }
                } else if (signal.entry_cross === 'death_cross') { // SHORT
                    if (low <= entryPrice * (1 - TAKE_PROFIT)) {
                        result = 'WIN'
                        exitPrice = entryPrice * (1 - TAKE_PROFIT)
                        exitIndex = j
                        break
                    }
                    if (high >= entryPrice * (1 + STOP_LOSS)) {
                        result = 'LOSS'
                        exitPrice = entryPrice * (1 + STOP_LOSS)
                        exitIndex = j
                        break
                    }
                }
            }

            // Nếu timeout, đóng lệnh tại giá market và tính PnL
            if (result === 'TIMEOUT' && exitIndex < c1m.length) {
                const exitCandle = c1m[exitIndex]
                exitPrice = parseFloat(exitCandle.c)
                const pnl = signal.entry_cross === 'golden_cross'
                    ? (exitPrice - entryPrice) / entryPrice
                    : (entryPrice - exitPrice) / entryPrice

                result = pnl > 0 ? 'WIN' : 'LOSS'
            }

            // Tính PnL ($)
            const pnlPercent = signal.entry_cross === 'golden_cross'
                ? (exitPrice - entryPrice) / entryPrice
                : (entryPrice - exitPrice) / entryPrice
            const pnlDollar = POSITION_SIZE * pnlPercent
            currentBalance += pnlDollar

            if (result === 'WIN') wins++
            if (result === 'LOSS') losses++

            signals.push({
                time: new Date(currentTime).toLocaleString(),
                type: signal.entry_cross === 'golden_cross' ? 'LONG' : 'SHORT',
                entry: entryPrice,
                exit: exitPrice.toFixed(2),
                result: result,
                pnl: `$${pnlDollar.toFixed(2)}`,
                balance: `$${currentBalance.toFixed(2)}`,
                ...(USE_AI && aiDecision ? { ai_conf: `${aiDecision.confidence}%` } : {})
            })

            // Đánh dấu đang giữ lệnh
            inPosition = true
            positionCloseIndex = exitIndex + 1
        }
    }

    console.table(signals)
    console.log('-------------------------------------------')
    console.log(`🔍 Total Signals Found: ${signals.length}`)
    if (USE_AI) {
        console.log(`🤖 AI Filtered Out: ${aiSkips} signals`)
    }
    console.log(`✅ WIN: ${wins}`)
    console.log(`❌ LOSS: ${losses}`)
    const winrate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : 0
    console.log(`💰 Winrate: ${winrate}%`)
    console.log('-------------------------------------------')
    console.log(`💵 Initial Capital: $${INITIAL_CAPITAL}`)
    console.log(`💵 Final Balance: $${currentBalance.toFixed(2)}`)
    const totalPnL = currentBalance - INITIAL_CAPITAL
    const pnlPercent = (totalPnL / INITIAL_CAPITAL) * 100
    console.log(`📈 Total PnL: $${totalPnL.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`)
    console.log('-------------------------------------------')

    // Thống kê thêm
    if (signals.length > 0) {
        const avgPnL = totalPnL / signals.length
        const maxWin = Math.max(...signals.filter(s => s.result === 'WIN').map(s => parseFloat(s.pnl.replace('$', ''))))
        const maxLoss = Math.min(...signals.filter(s => s.result === 'LOSS').map(s => parseFloat(s.pnl.replace('$', ''))))
        console.log(`📊 Avg PnL per trade: $${avgPnL.toFixed(2)}`)
        console.log(`📈 Max Win: $${maxWin.toFixed(2)}`)
        console.log(`📉 Max Loss: $${maxLoss.toFixed(2)}`)
        console.log('-------------------------------------------')
    }
}

runBacktest()
