
import { getMarketSnapshot } from '../data/marketCollector.js'
import { calcIndicators } from '../indicators/index.js'
import { normalizeSignal } from '../signal/normalizeSignal.js'
import { getDecision } from '../ai/deepseekDecision.js'
import { isValidSignal } from '../risk/riskManager.js'
import { notify } from '../notify/telegram.js'
import { saveLog } from '../data/db.js'
import { getTodaysNews } from '../data/newsCollector.js'
import { registerOpenTrade } from '../monitor/tradeOutcomeMonitor.js'
import { shouldSaveSkipLog, shouldSaveNoTradeLog, markDbWrite } from '../utils/rateLimiter.js'

/**
 * Execute a single cycle for a specific strategy
 * @param {String} symbol - The target symbol (e.g., 'BTC')
 * @param {Object} strategy - The Strategy Instance (must extend BaseStrategy)
 * @param {Boolean} skipFilter - If true, bypass technical filters and force AI analysis (default: false)
 * @param {Object} options - Extra options (used by API/manual mode)
 * @param {'bot'|'api'} options.mode - Execution mode (default: 'bot')
 * @param {Boolean} options.notify - If true, send Telegram notification for this cycle (default: false)
 */
export async function executeStrategy(symbol, strategy, skipFilter = false, options = {}) {
    const strategyName = strategy.getName()
    const mode = options?.mode || 'bot'
    const shouldNotify = options?.notify === true
    console.log(`\n[${new Date().toLocaleTimeString()}] ♻️  Executing ${strategyName} for ${symbol}${skipFilter ? ' (Filter Skipped)' : ''}...`)

    // 1. Fetch Data & News (Shared Data Layer)
    process.stdout.write(`   [${strategyName}] Fetching data... `)
    const [market, news] = await Promise.all([
        getMarketSnapshot(symbol),
        getTodaysNews()
    ])

    if (!market) {
        console.log('❌ Failed to fetch market data')
        return { status: 'error', reason: 'Market data fetch failed' }
    }
    console.log('✅')

    // 2. Calc Indicators & Signal
    const indicators = calcIndicators(market)
    const signal = normalizeSignal(indicators)
    signal.news = news

    // market_ctx: trả full indicators như "bản cũ" (regime/bias/entry/ema/rsi/atr/vol/funding...)
    // Lưu ý: indicators ở đây là output của calcIndicators(market), KHÔNG chứa candles (tránh payload quá nặng)
    const marketCtx = {
        symbol: signal.symbol,
        price: signal.price,
        indicators: indicators
    }

    // 3. Technical Filter (Strategy Specific)
    // Nếu skipFilter = true thì bỏ qua bước này
    const isWorthy = skipFilter ? true : strategy.checkConditions(signal)

    if (!isWorthy) {
        console.log(`   [${strategyName}] 💤 Skipped (Technical Filter)`)

        // Chống spam SKIP logs vào database
        if (shouldSaveSkipLog(signal.symbol, strategyName)) {
            await saveLog({
                strategy: strategyName,
                symbol: signal.symbol,
                timeframe: 'Multi-TF',
                price: signal.price,
                ai_action: 'SKIP',
                ai_confidence: 0,
                ai_reason: 'Filtered by Technical Conditions',
                ai_full_response: null,
                market_snapshot: indicators
            })
            markDbWrite(signal.symbol, strategyName, 'SKIP')
        }
        if (mode === 'api') {
            return {
                status: 'skipped',
                reason: 'Technical Filter',
                api_response: {
                    message: 'Cycle executed successfully',
                    market_ctx: marketCtx,
                    ai_input: null,
                    ai_output: {
                        action: 'NO_TRADE',
                        confidence: 0,
                        reason: 'Filtered by Technical Conditions',
                        plan: null
                    },
                    notification: null
                }
            }
        }

        return { status: 'skipped', reason: 'Technical Filter' }
    }

    // 4. AI Analysis
    process.stdout.write(`   [${strategyName}] 🤖 AI Analyzing... `)
    const prompt = strategy.buildAiPrompt(signal)
    const decision = await getDecision(signal, prompt)
    console.log('✅ Done')
    console.log(`   👉 Action: ${decision.action} | Confidence: ${Math.round(decision.confidence * 100)}%`)

    // 5. Build Plan
    // Parse plan via strategy method (or default)
    const plan = (decision.action === 'LONG' || decision.action === 'SHORT')
        ? strategy.parsePlan(decision, market.price)
        : null

    const takeProfitPrices = plan?.take_profit
        ? plan.take_profit.map(tp => tp?.price).filter(p => typeof p === 'number' && Number.isFinite(p))
        : null

    // 6. Validation (Post-AI)
    // Check global risk rules + strategy specific logic (here using generic riskManager)
    // Trong tương lai, method này cũng có thể move vào strategy nếu cần
    const outcome = isValidSignal(decision) ? 'OPEN' : 'REJECTED'
    const action = decision.action === 'NO_TRADE' ? 'NO_TRADE' : (outcome === 'OPEN' ? 'OPEN' : 'REJECTED')
    const aiAction = (decision.action === 'LONG' || decision.action === 'SHORT') ? decision.action : null

    // 7. Save Log (với cooldown cho NO_TRADE/REJECTED/OPEN)
    let logId = null
    if (outcome === 'OPEN' || shouldSaveNoTradeLog(signal.symbol, strategyName, action, aiAction)) {
        logId = await saveLog({
            strategy: strategyName, // Log đúng tên strategy
            symbol: signal.symbol,
            timeframe: 'Multi-TF',
            price: signal.price,
            ai_action: decision.action,
            ai_confidence: decision.confidence,
            ai_reason: decision.reason,
            ai_full_response: decision,
            market_snapshot: indicators,
            plan,
            entry_price: plan?.entry ?? null,
            stop_loss_price: plan?.stop_loss?.price ?? null,
            take_profit_prices: takeProfitPrices,
            outcome: outcome === 'OPEN' ? 'OPEN' : null
        })
        markDbWrite(signal.symbol, strategyName, action, aiAction)
    }

    // 8. Register Monitor & Notify
    if (outcome === 'OPEN') {
        if (logId && plan?.entry) {
            registerOpenTrade({
                id: logId,
                symbol: signal.symbol,
                action: decision.action,
                entryPrice: plan.entry,
                stopLossPrice: plan?.stop_loss?.price ?? null,
                takeProfitPrices: takeProfitPrices || [],
                createdAtMs: Date.now(),
            })
        }
        // Bot auto chỉ notify khi OPEN; API/manual có thể notify theo options.notify
        if (mode !== 'api') {
            notify(decision, plan, strategyName)
        }

        if (mode === 'api') {
            const manualStrategyName = `${strategyName}_MANUAL`
            const sent = shouldNotify ? notify(decision, plan, manualStrategyName) : null
            const aiInput = decision?.debug_input || prompt
            const aiOutput = { ...decision }
            delete aiOutput.debug_input

            return {
                status: 'executed',
                action: decision.action,
                logId,
                api_response: {
                    message: 'Cycle executed successfully',
                    market_ctx: marketCtx,
                    ai_input: aiInput,
                    ai_output: {
                        action: aiOutput.action,
                        confidence: aiOutput.confidence,
                        reason: aiOutput.reason,
                        risk_warning: aiOutput.risk_warning,
                        plan: plan
                    },
                    notification: sent ? 'Sent to Telegram' : (shouldNotify ? 'Skipped (cooldown)' : null)
                }
            }
        }

        return { status: 'executed', action: decision.action, logId }
    }

    if (mode === 'api') {
        const manualStrategyName = `${strategyName}_MANUAL`
        const sent = shouldNotify ? notify(decision, plan, manualStrategyName) : null
        const aiInput = decision?.debug_input || prompt
        const aiOutput = { ...decision }
        delete aiOutput.debug_input

        return {
            status: 'processed',
            action: decision.action,
            reason: 'Low Confidence/No Trade',
            ai_output: decision, // giữ nguyên cho nội bộ/backward compat
            api_response: {
                message: 'Cycle executed successfully',
                market_ctx: marketCtx,
                ai_input: aiInput,
                ai_output: {
                    action: aiOutput.action,
                    confidence: aiOutput.confidence,
                    reason: aiOutput.reason,
                    risk_warning: aiOutput.risk_warning,
                    plan: plan
                },
                notification: sent ? 'Sent to Telegram' : (shouldNotify ? 'Skipped (cooldown)' : null)
            }
        }
    }

    return {
        status: 'processed',
        action: decision.action,
        reason: 'Low Confidence/No Trade',
        ai_output: decision // Trả thêm full AI response để debug
    }
}
