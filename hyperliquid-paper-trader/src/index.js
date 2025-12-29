
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'

import { HyperliquidWS } from './core/WebSocketClient.js'
import { TradeEngine } from './core/TradeEngine.js'
import { initDB } from './core/db.js'

dotenv.config()

// 1. Setup Components
const symbol = process.env.SYMBOL ? process.env.SYMBOL.split(',')[0] : 'BTC'
export const ws = new HyperliquidWS(symbol)
export const engine = new TradeEngine(ws)

// 2. Setup API Server
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json())

// Swagger
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
const swaggerDocument = YAML.load('./swagger.yaml')
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Import routes after engine is exported
import { router } from './api/routes.js'
app.use('/api', router)

// Serve Frontend
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../public')));



// 3. Start System
async function start() {
    console.log('🚀 Starting Hyperliquid Paper Trader...')

    // Init Database
    await initDB()

    // Init Engine
    await engine.init()

    // Start WebSocket
    ws.connect()

    // Start API
    app.listen(PORT, () => {
        console.log(`🌍 API Server running on port ${PORT}`)
        console.log(`- POST /api/strategies (Init Wallet)`)
        console.log(`- POST /api/order      (Place Trade)`)
        console.log(`- GET  /api/strategies/:id`)
    })
}

start()
