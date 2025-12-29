
import { db } from './db.js'

export class TradeEngine {
    constructor(wsClient) {
        this.ws = wsClient
        this.activePositions = []
        this.priceCache = {} // { 'BTC': 100000 }
        this.isReady = false
    }

    async init() {
        console.log('⚙️ Initializing Trade Engine...')
        try {
            const res = await db.query("SELECT * FROM positions WHERE status = 'OPEN'")
            this.activePositions = res.rows
            console.log(`✅ Loaded ${this.activePositions.length} active positions`)
        } catch (error) {
            console.error('❌ Failed to load positions:', error)
        }

        // Subscribe to WS updates
        this.ws.onPriceUpdate((price) => {
            this.priceCache[this.ws.symbol] = price // Assumes WS is single symbol for now
            this.onPriceUpdate(price)
        })
        this.isReady = true
    }

    async onPriceUpdate(price) {
        if (!this.activePositions.length) return
        for (const pos of this.activePositions) {
            this.checkTrade(pos, price)
        }
    }

    async checkTrade(pos, currentPrice) {
        const { id, side, sl, tp } = pos
        let result = null
        let exitPrice = currentPrice
        let reason = ''

        if (side === 'LONG') {
            if (tp && currentPrice >= parseFloat(tp)) {
                result = 'WIN'
                exitPrice = parseFloat(tp)
                reason = 'TP'
            } else if (sl && currentPrice <= parseFloat(sl)) {
                result = 'LOSS'
                exitPrice = parseFloat(sl)
                reason = 'SL'
            }
        } else { // SHORT
            if (tp && currentPrice <= parseFloat(tp)) {
                result = 'WIN'
                exitPrice = parseFloat(tp)
                reason = 'TP'
            } else if (sl && currentPrice >= parseFloat(sl)) {
                result = 'LOSS'
                exitPrice = parseFloat(sl)
                reason = 'SL'
            }
        }

        if (result) {
            await this.closePosition(pos, result, exitPrice, reason)
        }
    }

    async closePosition(pos, result, exitPrice, reason) {
        const { id, strategy_id, entry_price, size, side } = pos
        const entry = parseFloat(entry_price)
        const posSize = parseFloat(size)

        // Calculate PnL (Linear for Perps)
        // PnL = Size * (Exit - Entry) / Entry (if Size is User Margin * Leverage)
        // Or simple: (Exit - Entry) * PositionQty
        // Let's assume 'size' passed is Margin * Leverage (Notional Value in USD).
        // PnL = Notional * (Exit - Entry)/Entry * Direction

        let pnlPercent = 0
        if (side === 'LONG') {
            pnlPercent = (exitPrice - entry) / entry
        } else {
            pnlPercent = (entry - exitPrice) / entry
        }

        const pnlDollar = posSize * pnlPercent

        console.log(`🔔 Closing Trade [${id}] ${strategy_id} ${side} ${result} PnL: $${pnlDollar.toFixed(2)}`)

        try {
            await db.query(`
                UPDATE positions 
                SET status = 'CLOSED', 
                    exit_price = $1, 
                    pnl = $2, 
                    result = $3, 
                    close_reason = $4,
                    closed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $5
            `, [exitPrice, pnlDollar, result, reason, id])

            await db.query(`
                UPDATE strategies 
                SET current_balance = current_balance + $1 
                WHERE id = $2
            `, [pnlDollar, strategy_id])

            this.activePositions = this.activePositions.filter(p => p.id !== id)

        } catch (error) {
            console.error('❌ Error closing position:', error)
        }

    async closePositionManually(id) {
            const pos = this.activePositions.find(p => p.id === parseInt(id));
            if (!pos) throw new Error("Position not found or already closed");

            const currentPrice = this.priceCache[pos.symbol];
            if (!currentPrice) throw new Error("Market price not available");

            await this.closePosition(pos, "MANUAL", currentPrice, "USER_CLOSE");
            return { success: true };
        }

    async updateTpSl(id, tp, sl) {
            const posIndex = this.activePositions.findIndex(p => p.id === parseInt(id));
            if (posIndex === -1) throw new Error("Position not found or already closed");

            const pos = this.activePositions[posIndex];

            // Basic Validation
            const currentPrice = this.priceCache[pos.symbol];
            if (currentPrice) {
                if (pos.side === 'LONG') {
                    if (sl && parseFloat(sl) >= currentPrice) throw new Error(`Long SL (${sl}) must be below Current Price (${currentPrice})`)
                    if (tp && parseFloat(tp) <= currentPrice) throw new Error(`Long TP (${tp}) must be above Current Price (${currentPrice})`)
                } else if (pos.side === 'SHORT') {
                    if (sl && parseFloat(sl) <= currentPrice) throw new Error(`Short SL (${sl}) must be above Current Price (${currentPrice})`)
                    if (tp && parseFloat(tp) >= currentPrice) throw new Error(`Short TP (${tp}) must be below Current Price (${currentPrice})`)
                }
            }

            // Update DB
            await db.query("UPDATE positions SET tp = $1, sl = $2, updated_at = NOW() WHERE id = $3", [tp, sl, id]);

            // Update Memory
            this.activePositions[posIndex].tp = tp;
            this.activePositions[posIndex].sl = sl;

            return { success: true, position: this.activePositions[posIndex] };
        }
    }

    // --- API Methods ---

    async createStrategy(id, initialCapital) {
        try {
            await db.query(`
                INSERT INTO strategies (id, initial_capital, current_balance)
                VALUES ($1, $2, $2)
                ON CONFLICT (id) DO NOTHING
            `, [id, initialCapital])
            return { success: true, message: `Strategy ${id} created/ready` }
        } catch (error) {
            return { success: false, message: error.message }
        }
    }

    async placeOrder(strategyId, symbol, side, size, sl, tp) {
        // 1. Get current price
        // Only support connected symbol for now (BTC)
        const currentPrice = this.priceCache[symbol]
        if (!currentPrice) {
            throw new Error(`Market price for ${symbol} not available yet`)
        }

        // 2. Validate Strategy
        const strategyRes = await db.query("SELECT * FROM strategies WHERE id = $1", [strategyId])
        if (strategyRes.rows.length === 0) {
            // Auto-create if not exists? Or throw error. Let's throw.
            throw new Error(`Strategy ${strategyId} not found. Please init first.`)
        }

        // 2.5 Validation
        if (side === 'LONG') {
            if (sl && parseFloat(sl) >= currentPrice) throw new Error(`Long SL (${sl}) must be below Entry (${currentPrice})`)
            if (tp && parseFloat(tp) <= currentPrice) throw new Error(`Long TP (${tp}) must be above Entry (${currentPrice})`)
        } else if (side === 'SHORT') {
            if (sl && parseFloat(sl) <= currentPrice) throw new Error(`Short SL (${sl}) must be above Entry (${currentPrice})`)
            if (tp && parseFloat(tp) >= currentPrice) throw new Error(`Short TP (${tp}) must be below Entry (${currentPrice})`)
        }

        // 3. Insert Position
        const res = await db.query(`
            INSERT INTO positions (strategy_id, symbol, side, entry_price, size, sl, tp, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN') 
            RETURNING *
        `, [strategyId, symbol, side, currentPrice, size, sl, tp])

        const newPos = res.rows[0]

        // 4. Add to Memory
        this.activePositions.push(newPos)

        return newPos
    }

    async getStrategy(id) {
        const strat = await db.query("SELECT * FROM strategies WHERE id = $1", [id])
        if (!strat.rows.length) return null

        // Get active positions and history limit 10
        const active = this.activePositions.filter(p => p.strategy_id === id)
        const history = await db.query(`
            SELECT * FROM positions 
            WHERE strategy_id = $1 AND status = 'CLOSED' 
            ORDER BY closed_at DESC, updated_at DESC LIMIT 10
        `, [id])

        return {
            ...strat.rows[0],
            positions: active,
            recent_history: history.rows,
            current_price: this.priceCache[this.ws.symbol] || null
        }
    }
}
