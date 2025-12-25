import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import { getActiveStrategies, getStrategy } from './strategies/index.js'
import { executeStrategy } from './core/strategyExecutor.js'
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
        // Lấy params
        const symbol = req.query?.symbol || 'BTC'
        const strategyName = req.query?.strategy || 'SCALP_01'
        const force = req.query?.force === 'true' // Check force param
        // Manual API call: mặc định KHÔNG gửi Telegram (tránh spam). Bật bằng ?notify=true nếu cần.
        const notify = req.query?.notify === 'true'

        console.log(`⚡ Manual Trigger Received: ${strategyName} on ${symbol} (Force: ${force}, Notify: ${notify})`)

        // 1. Validate Strategy
        const strategy = getStrategy(strategyName)
        if (!strategy) {
            return res.status(400).json({
                error: `Strategy '${strategyName}' not found. Available: SCALP_01, SCALP_02`
            })
        }

        // 2. Check Lock
        if (isSymbolLocked(symbol)) {
            return res.status(429).json({ error: `Symbol ${symbol} is busy. Try again shortly.` })
        }

        // 3. Execute with Lock
        const locked = await withSymbolLock(symbol, async () => {
            // Pass force param to skip technical filter
            return await executeStrategy(symbol, strategy, force, { mode: 'api', notify })
        })

        if (locked?.skipped) {
            return res.status(429).json({ error: `Symbol ${symbol} is busy.` })
        }

        // 4. Response
        const result = locked?.result
        if (result?.status === 'error') {
            return res.status(500).json(result)
        }

        // Prefer legacy/clean API payload for manual trigger
        if (result?.api_response) {
            return res.status(200).json(result.api_response)
        }

        // Fallback (should not happen, but keep backward compatibility)
        return res.status(200).json({
            message: 'Cycle executed successfully',
            strategy: strategyName,
            symbol: symbol,
            result: result
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

