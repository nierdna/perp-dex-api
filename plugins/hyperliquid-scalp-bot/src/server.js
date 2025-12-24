import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import { getMarketSnapshot } from './data/marketCollector.js'
import { calcIndicators } from './indicators/index.js'
import { normalizeSignal } from './signal/normalizeSignal.js'
import { getDecision } from './ai/deepseekDecision.js'
import { isValidSignal } from './risk/riskManager.js'
import { notify } from './notify/telegram.js'
import { parsePlan } from './utils/parsePlan.js'

import { saveLog } from './data/db.js'
import { getTodaysNews } from './data/newsCollector.js'
import { registerOpenTrade } from './monitor/tradeOutcomeMonitor.js'
import { isSymbolLocked, withSymbolLock } from './bot/symbolLock.js'

const app = express()
app.use(cors())
app.use(express.json())

// Load Swagger
const swaggerDocument = YAML.load('./swagger.yaml')
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Manual Trigger Endpoint
app.get('/ai-scalp', async (req, res) => {
    try {
        // Lấy SYMBOL từ query, default là BTC
        const symbol = req.query?.symbol || 'BTC'
        console.log(`⚡ Manual Trigger Received for ${symbol}`)

        if (isSymbolLocked(symbol)) {
            return res.status(429).json({ error: `Symbol ${symbol} is busy (cycle in progress). Try again shortly.` })
        }

        const locked = await withSymbolLock(symbol, async () => {
        // 1. Fetch Data & News
        const [market, news] = await Promise.all([
            getMarketSnapshot(symbol),
            getTodaysNews()
        ])

        if (!market) {
            return { status: 500, body: { error: 'Failed to fetch market data' } }
        }

        // 2. Indicators
        const indicators = calcIndicators(market)
        const signal = normalizeSignal(indicators)
        signal.news = news // Attach news

        // 3. AI Analysis
        const decision = await getDecision(signal)

        // 4. Parse plan (chỉ meaningful khi LONG/SHORT)
        const plan = (decision.action === 'LONG' || decision.action === 'SHORT')
            ? parsePlan(decision, market.price)
            : null

        const takeProfitPrices = plan?.take_profit
            ? plan.take_profit.map(tp => tp?.price).filter(p => typeof p === 'number' && Number.isFinite(p))
            : null

        // 5. Nếu signal đủ mạnh: đánh dấu OPEN để WS monitor theo dõi WIN/LOSS
        const outcome = isValidSignal(decision) ? 'OPEN' : null

        // 6. Lưu Log vào DB (Manual Trigger) - kèm plan/entry/SL/TP
        const logId = await saveLog({
            strategy: 'SCALP_01_MANUAL',
            symbol: signal.symbol,
            timeframe: 'Multi-TF',
            price: signal.price,
            ai_action: decision.action,
            ai_confidence: decision.confidence,
            ai_reason: decision.reason,
            ai_full_response: decision,
            market_snapshot: indicators, // Lưu Full Data Input
            plan,
            entry_price: plan?.entry ?? null,
            stop_loss_price: plan?.stop_loss?.price ?? null,
            take_profit_prices: takeProfitPrices,
            outcome
        })

        // 6. Notify if valid
        let notifStatus = 'Skipped (Low Confidence)'
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
            notify(decision, plan, 'SCALP_01_MANUAL')
            notifStatus = 'Sent to Telegram'
        }

        return { status: 200, body: {
            message: 'Cycle executed successfully',
            market_ctx: {
                symbol: market.symbol,
                price: market.price,
                indicators: indicators // Trả về cả EMA, RSI để double check
            },
            ai_input: decision.debug_input, // INPUT: Prompt gửi đi
            ai_output: {                   // OUTPUT: Kết quả trả về
                action: decision.action,
                confidence: decision.confidence,
                reason: decision.reason,
                plan: plan // Format: { entry, stop_loss: { price, des }, take_profit: [{ price, des }] }
            },
            notification: notifStatus
        } }
        })

        if (locked?.skipped) {
            return res.status(429).json({ error: `Symbol ${symbol} is busy (cycle in progress). Try again shortly.` })
        }
        return res.status(locked?.result?.status || 200).json(locked?.result?.body || { message: 'OK' })

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error.message })
    }
})

// Start Server
const PORT = process.env.PORT || 3000
export function startServer() {
    app.listen(PORT, () => {
        console.log(`🌐 API Server running at http://localhost:${PORT}`)
        console.log(`📄 Swagger Docs at http://localhost:${PORT}/api-docs`)
    })
}
