
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
import { recordAICall } from '../strategies/swing01/SwingMetrics.js'
import { canSendAlert, markAlertSent } from '../notify/swingCooldown.js'
import { setSwingData, getSwingData } from '../data/swingDataCache.js'
import { getStrategy } from '../strategies/index.js'

/**
 * Execute a single cycle for a specific strategy
 * @param {String} symbol - The target symbol (e.g., 'BTC')
 * @param {Object} strategy - The Strategy Instance (must extend BaseStrategy)
 * @param {Boolean} skipFilter - If true, bypass technical filters and force AI analysis (default: false)
 * @param {Object} options - Extra options (used by API/manual mode)
 * @param {'bot'|'api'} options.mode - Execution mode (default: 'bot')
 * @param {Boolean} options.notify - If true, send Telegram notification for this cycle (default: false)
 * @param {Boolean} options.useClosedCandles - If true, exclude last (incomplete) candle from indicators (default: false)
 */
export async function executeStrategy(symbol, strategy, skipFilter = false, options = {}) {
    const strategyName = strategy.getName()
    const mode = options?.mode || 'bot'
    const shouldNotify = options?.notify === true
    const useClosedCandles = options?.useClosedCandles || false
    console.log(`\n[${new Date().toLocaleTimeString()}] ♻️  Executing ${strategyName} for ${symbol}${skipFilter ? ' (Filter Skipped)' : ''}${useClosedCandles ? ' [Closed]' : ''}...`)

    // SWING_01 has different flow - use analyzeMarket() method
    if (strategyName === 'SWING_01') {
        return await executeSwing01Strategy(symbol, strategy, skipFilter, options)
    }

    // 1. Fetch Data & News (Shared Data Layer) - Scalp strategies
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
    const indicators = calcIndicators(market, { excludeLastCandle: useClosedCandles })
    const signal = normalizeSignal(indicators)
    
    // Ensure symbol and price are set (calcIndicators might not return these)
    signal.symbol = signal.symbol || symbol
    signal.price = signal.price || (market?.candles_1m?.[market.candles_1m.length - 1]?.close)
    signal.news = news

    // Check if data is sufficient (if all indicators are insufficient_data, abort early)
    const isDataSufficient = signal.price && 
                             signal.regime_15m !== 'insufficient_data' && 
                             signal.bias_5m !== 'insufficient_data' && 
                             signal.entry_1m !== 'insufficient_data'
    
    if (!isDataSufficient) {
        console.log(`   [${strategyName}] ⚠️ Insufficient data (price=${signal.price}, regime=${signal.regime_15m}, bias=${signal.bias_5m}, entry=${signal.entry_1m})`)
        
        if (mode === 'api') {
            const marketCtx = {
                symbol: signal.symbol || symbol,
                price: signal.price || null,
                indicators: indicators
            }
            return {
                status: 'error',
                reason: 'Insufficient market data',
                api_response: {
                    message: 'Cycle executed successfully',
                    market_ctx: marketCtx,
                    ai_input: null,
                    ai_output: {
                        action: 'NO_TRADE',
                        confidence: 0,
                        reason: 'Insufficient market data - không đủ dữ liệu để phân tích',
                        risk_warning: 'Thiếu dữ liệu thị trường, không thể đưa ra quyết định giao dịch',
                        plan: null
                    },
                    notification: null
                }
            }
        }
        return { status: 'error', reason: 'Insufficient market data' }
    }

    // market_ctx: trả full indicators như "bản cũ" (regime/bias/entry/ema/rsi/atr/vol/funding...)
    // Lưu ý: indicators ở đây là output của calcIndicators(market), KHÔNG chứa candles (tránh payload quá nặng)
    const marketCtx = {
        symbol: signal.symbol,
        price: signal.price,
        indicators: indicators
    }

    // Auto-populate Swing cache if empty (to provide HTF context for Scalp)
    const swingCache = getSwingData(signal.symbol)
    if (!swingCache) {
        try {
            process.stdout.write(`   [${strategyName}] Populating Swing cache... `)
            const swingStrategy = getStrategy('SWING_01')
            if (swingStrategy) {
                const swingSignal = await swingStrategy.analyzeMarket(signal.symbol)
                if (swingSignal && swingSignal.triggerInfo) {
                    setSwingData(signal.symbol, swingSignal.triggerInfo)
                    console.log('✅')
                } else {
                    console.log('⚠️ (No swing data)')
                }
            } else {
                console.log('⚠️ (Swing01 not available)')
            }
        } catch (error) {
            console.log(`⚠️ (Error: ${error.message})`)
            // Continue anyway - Scalp can work without Swing context
        }
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
    let decision = await getDecision(signal, prompt)
    console.log('✅ Done')
    
    // 4.5. Post-AI Validation (Strategy-specific hard rules)
    // Validate decision against hard rules (e.g., RSI extremes for SCALP_03)
    if (strategy.validateDecision && typeof strategy.validateDecision === 'function') {
        const validatedDecision = strategy.validateDecision(decision, signal)
        if (validatedDecision.action !== decision.action) {
            console.log(`   ⚠️ Decision overridden: ${decision.action} → ${validatedDecision.action} (Hard rule violation)`)
            decision = validatedDecision
        }
    }
    
    console.log(`   👉 Action: ${decision.action} | Confidence: ${Math.round(decision.confidence * 100)}%`)

    // 5. Build Plan
    // Parse plan via strategy method (or default)
    // Pass signal parameter for ATR-based calculations
    const plan = (decision.action === 'LONG' || decision.action === 'SHORT')
        ? strategy.parsePlan(decision, market.price, signal)
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
            ai_confidence: Math.min(100, Math.max(0, parseFloat(decision.confidence || 0))), // Clamp to 0-100
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
        // Chỉ notify nếu có đủ data và valid decision
        if (mode !== 'api' && decision?.action && decision.action !== 'NO_TRADE' && plan?.entry) {
            notify(decision, plan, strategyName)
        }

        if (mode === 'api') {
            const manualStrategyName = `${strategyName}_MANUAL`
            // Chỉ notify nếu có đủ data và valid decision
            const shouldSendNotification = shouldNotify && 
                                          decision?.action && 
                                          decision.action !== 'NO_TRADE' && 
                                          plan?.entry
            const sent = shouldSendNotification ? notify(decision, plan, manualStrategyName) : null
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
        // Chỉ notify NO_TRADE nếu có đủ data (price, indicators valid)
        const shouldSendNotification = shouldNotify && 
                                      signal.price && 
                                      signal.regime_15m !== 'insufficient_data'
        const sent = shouldSendNotification ? notify(decision, plan, manualStrategyName) : null
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
                notification: sent ? 'Sent to Telegram' : (shouldNotify && !shouldSendNotification ? 'Skipped (insufficient data)' : (shouldNotify ? 'Skipped (cooldown)' : null))
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

/**
 * Execute Swing01 strategy (different flow)
 */
async function executeSwing01Strategy(symbol, strategy, skipFilter, options) {
    const strategyName = 'SWING_01'
    const mode = options?.mode || 'bot'
    const shouldNotify = options?.notify === true
    const useClosedCandles = options?.useClosedCandles || false

    try {
        // 1. Analyze market (Swing01 specific)
        process.stdout.write(`   [${strategyName}] Analyzing market... `)
        const signal = await strategy.analyzeMarket(symbol)
        
        if (!signal || !signal.triggerInfo) {
            console.log('❌ Failed to analyze market')
            return { status: 'error', reason: 'Market analysis failed' }
        }
        console.log('✅')

        const triggerInfo = signal.triggerInfo
        const marketCtx = {
            symbol: signal.symbol,
            price: signal.price,
            triggerInfo: triggerInfo
        }

        // Cache swing data even if it will be filtered (Scalp needs latest HTF context)
        setSwingData(symbol, triggerInfo)

        // 2. Technical Filter
        const isWorthy = skipFilter ? true : strategy.checkConditions(signal)

        if (!isWorthy) {
            console.log(`   [${strategyName}] 💤 Skipped (Technical Filter)`)
            
            if (shouldSaveSkipLog(signal.symbol, strategyName)) {
                await saveLog({
                    strategy: strategyName,
                    symbol: signal.symbol,
                    timeframe: 'Swing (1D/4H/1H/30M)',
                    price: signal.price,
                    ai_action: 'SKIP',
                    ai_confidence: 0,
                    ai_reason: 'Filtered by Technical Conditions',
                    ai_full_response: null,
                    market_snapshot: triggerInfo,
                    trigger_info: triggerInfo
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
                            verdict: 'WAIT',
                            confidence: 0,
                            reasoning: 'Filtered by Technical Conditions'
                        },
                        trigger_info: triggerInfo,
                        notification: null
                    }
                }
            }

            return { status: 'skipped', reason: 'Technical Filter' }
        }

        // 3. AI Analysis (with fail-safe)
        process.stdout.write(`   [${strategyName}] 🤖 AI Analyzing... `)
        const prompt = strategy.buildAiPrompt(signal)
        let decision = null
        let aiDecision = null
        let aiError = false

        try {
            decision = await getDecision(signal, prompt)
            recordAICall(signal.symbol)
            console.log('✅ Done')
            console.log(`   👉 Verdict: ${(decision.verdict || decision.action || 'NO_TRADE').toUpperCase()} | Confidence: ${Math.round((decision.confidence || 0))}%`)
            
            // 4. Parse AI decision (Swing01 doesn't parse entry/SL/TP)
            aiDecision = strategy.parsePlan(decision, signal.price)
        } catch (error) {
            // DeepSeek lỗi → gửi alert không AI (fallback)
            console.log('⚠️ AI Error, using fallback')
            aiError = true
            decision = {
                verdict: 'NO_TRADE',
                confidence: 0,
                reasoning: 'AI analysis unavailable',
                invalidation_note: 'AI service error'
            }
            aiDecision = {
                verdict: 'NO_TRADE',
                confidence: 0,
                reasoning: 'AI analysis unavailable',
                invalidation_note: 'AI service error'
            }
        }

        // 5. Check cooldown for alert
        const zoneId = triggerInfo.htf_zone ? `${triggerInfo.htf_zone.type}_${triggerInfo.htf_zone.priceRange?.[0]}` : null
        const setupId = triggerInfo.setup_state ? `${triggerInfo.setup_state}_${Date.now()}` : null
        const cooldownCheck = canSendAlert(symbol, zoneId, setupId)

        // 6. Determine if should alert (CONSIDER verdict with score >= 80)
        // Even if AI error, still alert if score is high (but with NO_TRADE verdict)
        const hasAIVerdict = !aiError && (aiDecision.verdict === 'CONSIDER' || (decision && decision.verdict === 'CONSIDER'))
        const shouldAlert = triggerInfo.trigger_score >= 80 && cooldownCheck.canSend && hasAIVerdict

        // 7. Save Log
        let logId = null
        if (shouldAlert || shouldSaveNoTradeLog(signal.symbol, strategyName, aiDecision.verdict || 'NO_TRADE', null)) {
            logId = await saveLog({
                strategy: strategyName,
                symbol: signal.symbol,
                timeframe: 'Swing (1D/4H/1H/30M)',
                price: signal.price,
                ai_action: aiDecision.verdict || decision.verdict || 'NO_TRADE',
                ai_confidence: Math.min(100, Math.max(0, parseFloat(aiDecision.confidence || decision.confidence || 0))), // Clamp to 0-100
                ai_reason: aiDecision.reasoning || decision.reasoning || '',
                ai_full_response: decision,
                market_snapshot: triggerInfo,
                trigger_info: triggerInfo
                // NO plan, entry_price, stop_loss_price, take_profit_prices, outcome
            })
            markDbWrite(signal.symbol, strategyName, aiDecision.verdict || 'NO_TRADE', null)
        }

        // 8. Notify if should alert
        if (shouldAlert) {
            markAlertSent(symbol, zoneId, setupId)
            if (mode !== 'api') {
                // Send alert (decision may be null if AI error, use aiDecision as fallback)
                const alertDecision = decision || aiDecision
                notify(alertDecision, null, strategyName, triggerInfo)
            }
        }

        // 9. Build API response
        if (mode === 'api') {
            const manualStrategyName = `${strategyName}_MANUAL`
            const alertDecision = decision || aiDecision
            // In API mode with notify=true, send alert regardless of shouldAlert (for testing/manual review)
            const sent = shouldNotify ? notify(alertDecision, null, manualStrategyName, triggerInfo) : null
            const aiInput = decision?.debug_input || prompt
            const aiOutput = decision ? { ...decision } : { ...aiDecision }
            if (aiOutput.debug_input) {
                delete aiOutput.debug_input
            }

            return {
                status: shouldAlert ? 'executed' : 'processed',
                action: aiDecision.verdict || decision.verdict || 'NO_TRADE',
                logId,
                api_response: {
                    message: 'Cycle executed successfully',
                    market_ctx: marketCtx,
                    ai_input: aiInput,
                    ai_output: {
                        verdict: aiOutput.verdict || aiOutput.action || 'NO_TRADE',
                        confidence: aiOutput.confidence || 0,
                        reasoning: aiOutput.reasoning || aiOutput.reason || '',
                        invalidation_note: aiOutput.invalidation_note || ''
                    },
                    trigger_info: triggerInfo,
                    notification: sent ? 'Sent to Telegram' : (shouldNotify ? 'Skipped (cooldown or other reason)' : null)
                }
            }
        }

        return {
            status: shouldAlert ? 'executed' : 'processed',
            action: aiDecision.verdict || decision.verdict || 'NO_TRADE',
            logId
        }

    } catch (error) {
        console.error(`[Swing01] Error:`, error.message)
        // Fail-safe: return error but don't crash
        return {
            status: 'error',
            reason: error.message
        }
    }
}
