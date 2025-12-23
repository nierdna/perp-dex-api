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

import { saveLog } from './data/db.js'

const app = express()
app.use(cors())
app.use(express.json())

// Load Swagger
const swaggerDocument = YAML.load('./swagger.yaml')
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Manual Trigger Endpoint
app.post('/run-scalp', async (req, res) => {
    try {
        console.log('⚡ Manual Trigger Received')

        // 1. Fetch Data
        const market = await getMarketSnapshot()
        if (!market) {
            return res.status(500).json({ error: 'Failed to fetch market data' })
        }

        // 2. Indicators
        const indicators = calcIndicators(market)
        const signal = normalizeSignal(indicators)

        // 3. AI Analysis
        const decision = await getDecision(signal)

        // 4. Lưu Log vào DB (Manual Trigger)
        saveLog({
            strategy: 'SCALP_01_MANUAL',
            symbol: signal.symbol,
            timeframe: 'Multi-TF',
            price: signal.price,
            ai_action: decision.action,
            ai_confidence: decision.confidence,
            ai_reason: decision.reason,
            ai_full_response: decision,
            market_snapshot: {
                regime: indicators.regime_15m,
                bias: indicators.bias_5m,
                entry: indicators.entry_1m,
                ema_cross: {
                    r: indicators.regime_cross,
                    b: indicators.bias_cross,
                    e: indicators.entry_cross
                }
            }
        })

        // 5. Notify if valid
        let notifStatus = 'Skipped (Low Confidence)'
        if (isValidSignal(decision)) {
            notify(decision)
            notifStatus = 'Sent to Telegram'
        }

        res.json({
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
                plan: {
                    entry: decision.entry,
                    stop_loss: decision.stop_loss_logic,
                    take_profit: decision.take_profit_logic
                }
            },
            notification: notifStatus
        })

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
