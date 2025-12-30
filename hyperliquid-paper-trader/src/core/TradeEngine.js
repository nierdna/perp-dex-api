
import { db } from './db.js'

export class TradeEngine {
    constructor(wsClient) {
        this.ws = wsClient
        this.activePositions = []
        this.priceCache = {} // { 'BTC': 100000 }
        this.isReady = false
        this.lastRiskCheck = {} // Track last risk check time per strategy for throttling
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

        // Check risk for active strategies (throttled to once per 5 seconds per strategy)
        const activeStrategyIds = [...new Set(this.activePositions.map(p => p.strategy_id))];
        const now = Date.now();

        for (const stratId of activeStrategyIds) {
            // Throttle: Only check risk if >5 seconds since last check
            if (!this.lastRiskCheck[stratId] || (now - this.lastRiskCheck[stratId] > 5000)) {
                await this.checkRisk(stratId);
                this.lastRiskCheck[stratId] = now;
            }
        }

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

            // Check Risk after close (though close might have been triggered by risk)
            // this.checkRisk(strategy_id) 

        } catch (error) {
            console.error('❌ Error closing position:', error)
        }
    }

    async checkRisk(strategyId) {
        // 1. Get Strategy Logic
        const stratRes = await db.query("SELECT * FROM strategies WHERE id = $1", [strategyId]);
        if (!stratRes.rows.length) return;
        const strategy = stratRes.rows[0];

        const maxDailyLossPercent = parseFloat(strategy.max_daily_loss);
        if (!maxDailyLossPercent || maxDailyLossPercent <= 0) return; // No limit

        // 2. Calculate Realized PnL Today (UTC)
        const now = new Date();
        const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const historyRes = await db.query(`
            SELECT SUM(pnl) as realized_pnl 
            FROM positions 
            WHERE strategy_id = $1 AND status = 'CLOSED' AND closed_at >= $2
        `, [strategyId, startOfDayUTC.toISOString()]);

        const realizedPnL = parseFloat(historyRes.rows[0].realized_pnl || 0);

        // 3. Calculate Unrealized PnL (Active)
        let unrealizedPnL = 0;
        const activePositions = this.activePositions.filter(p => p.strategy_id === strategyId);

        for (const pos of activePositions) {
            const currentPrice = this.priceCache[pos.symbol];
            if (!currentPrice) continue;

            const entry = parseFloat(pos.entry_price);
            const size = parseFloat(pos.size);

            let pnl = 0;
            if (pos.side === 'LONG') {
                pnl = (currentPrice - entry) / entry * size;
            } else { // SHORT
                pnl = (entry - currentPrice) / entry * size;
            }
            unrealizedPnL += pnl;
        }

        const totalDailyPnL = realizedPnL + unrealizedPnL;
        const limitAmount = parseFloat(strategy.current_balance) * (maxDailyLossPercent / 100); // Use current balance for dynamic risk

        // console.log(`🛡️ Risk Check [${strategyId}]: Daily PnL: $${totalDailyPnL.toFixed(2)} / Limit: -$${limitAmount.toFixed(2)}`);

        // 4. Trigger Kill Switch
        if (totalDailyPnL <= -limitAmount) {
            console.warn(`🚨 RISK ALERT: Strategy ${strategyId} hit Daily Loss Limit ($${totalDailyPnL.toFixed(2)} < -$${limitAmount.toFixed(2)}). Closing ALL.`);
            // Close All
            await this.closeAllPositions(strategyId);
            // Optionally set a flag in DB to block new orders until tomorrow
            // For now, placeOrder validation will just fail if it checks the same logic or if we add a 'locked' state.
            // Let's rely on placeOrder calling checkRisk or checking PnL.
            return { locked: true, reason: 'DAILY_LOSS_LIMIT' };
        }
        return { locked: false };
    }

    async reducePosition(pos, reduceSize, exitPrice) {
        // Partial Close Logic
        const pnlPercent = (pos.side === 'LONG')
            ? (exitPrice - parseFloat(pos.entry_price)) / parseFloat(pos.entry_price)
            : (parseFloat(pos.entry_price) - exitPrice) / parseFloat(pos.entry_price);

        const pnlDollar = reduceSize * pnlPercent;
        const result = pnlDollar >= 0 ? 'WIN' : 'LOSS';

        console.log(`📉 Reducing ${pos.symbol} ${pos.side} by $${reduceSize}. PnL: $${pnlDollar.toFixed(2)}`);

        // 1. Record the 'Closed' portion as a historical trade (Optional: some systems don't do this for partials, but we should for PnL tracking)
        // We insert a CLOSED record for the portion closed.
        await db.query(`
            INSERT INTO positions (strategy_id, symbol, side, entry_price, size, exit_price, pnl, result, close_reason, status, closed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PARTIAL_CLOSE', 'CLOSED', NOW())
        `, [
            pos.strategy_id,
            pos.symbol,
            pos.side,
            pos.entry_price,
            reduceSize,
            exitPrice,
            pnlDollar,
            result
        ]);

        // 2. Update the Balance
        await db.query(`UPDATE strategies SET current_balance = current_balance + $1 WHERE id = $2`, [pnlDollar, pos.strategy_id]);

        // 3. Update the Active Position Size
        const newSize = parseFloat(pos.size) - reduceSize;
        await db.query(`UPDATE positions SET size = $1, updated_at = NOW() WHERE id = $2`, [newSize, pos.id]);

        // 4. Update Memory
        pos.size = newSize;

        return { pnl: pnlDollar };
    }

    async closePositionManually(id) {
        const pos = this.activePositions.find(p => p.id === parseInt(id));
        if (!pos) throw new Error("Position not found or already closed");

        const currentPrice = this.priceCache[pos.symbol];
        if (!currentPrice) throw new Error("Market price not available");

        await this.closePosition(pos, "MANUAL", currentPrice, "USER_CLOSE");
        return { success: true };
    }

    async closeAllPositions(strategyId) {
        const positionsToClose = this.activePositions.filter(p => p.strategy_id === strategyId);
        if (positionsToClose.length === 0) return { success: true, count: 0 };

        const currentPrice = this.priceCache[positionsToClose[0].symbol]; // Assuming same symbol or getting price per symbol
        // Better: iterate and get price for each

        let count = 0;
        for (const pos of positionsToClose) {
            const price = this.priceCache[pos.symbol];
            if (price) {
                await this.closePosition(pos, "MANUAL", price, "USER_CLOSE_ALL");
                count++;
            }
        }
        return { success: true, count };
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

    async updateRiskSettings(id, maxDailyLoss, maxPositionSize, maxOpenPositions) {
        await db.query(
            "UPDATE strategies SET max_daily_loss = $1, max_position_size = $2, max_open_positions = $3 WHERE id = $4",
            [maxDailyLoss, maxPositionSize, maxOpenPositions, id]
        );
        return { success: true };
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
        const currentPrice = this.priceCache[symbol]
        if (!currentPrice) {
            throw new Error(`Market price for ${symbol} not available yet`)
        }

        // 2. Validate Strategy & Balance
        const strategyRes = await db.query("SELECT * FROM strategies WHERE id = $1", [strategyId])
        if (strategyRes.rows.length === 0) {
            throw new Error(`Strategy ${strategyId} not found. Please init first.`)
        }
        const strategy = strategyRes.rows[0];
        const currentBalance = parseFloat(strategy.current_balance);

        // 2.1 Check Risk (Daily Loss)
        const riskCheck = await this.checkRisk(strategyId);
        if (riskCheck && riskCheck.locked) {
            throw new Error(`🚫 Trading Locked: Max Daily Loss Hit (${riskCheck.reason})`);
        }

        // 2.2 Check Max Position Size
        const maxPosSize = parseFloat(strategy.max_position_size);
        if (maxPosSize > 0) {
            const maxAllowed = parseFloat(strategy.current_balance) * (maxPosSize / 100); // Use current balance for dynamic risk
            if (size > maxAllowed) {
                throw new Error(`🚫 Position size $${size} exceeds max allowed $${maxAllowed.toFixed(2)} (${maxPosSize}% of current balance $${strategy.current_balance})`);
            }
        }

        // 2.3 Check Max Open Positions
        const maxOpenPos = parseInt(strategy.max_open_positions);
        const strategyPositions = this.activePositions.filter(p => p.strategy_id === strategyId);
        if (maxOpenPos > 0 && strategyPositions.length >= maxOpenPos) {
            throw new Error(`🚫 Max open positions reached (${maxOpenPos}). Close a position before opening a new one.`);
        }

        // Calculate Used Margin
        const usedMargin = strategyPositions.reduce((sum, p) => sum + parseFloat(p.size), 0);
        const availableBalance = currentBalance - usedMargin;

        console.log(`💰 Balance: ${currentBalance}, Used: ${usedMargin}, Available: ${availableBalance}`);

        // 3. Logic Check (Netting vs New)
        const existingPos = this.activePositions.find(p => p.strategy_id === strategyId && p.symbol === symbol);
        size = parseFloat(size);

        if (existingPos) {
            if (existingPos.side !== side) {
                // NETTING LOGIC (One-Way)
                const currentPosSize = parseFloat(existingPos.size);

                if (Math.abs(currentPosSize - size) < 0.01) {
                    // EXACT MATCH: Full Close
                    console.log(`🔄 Netting: Full Close ${existingPos.symbol}`);
                    let result = 'LOSS';
                    const entry = parseFloat(existingPos.entry_price);
                    if (existingPos.side === 'LONG') { if (currentPrice > entry) result = 'WIN'; }
                    else { if (currentPrice < entry) result = 'WIN'; }

                    await this.closePosition(existingPos, result, currentPrice, "NETTING_CLOSE");
                    return { status: 'CLOSED', message: 'Position closed via netting' };

                } else if (size < currentPosSize) {
                    // PARTIAL CLOSE (Reduce Only)
                    // No Margin Check needed for reducing
                    console.log(`📉 Netting: Reducing ${existingPos.symbol} by ${size}`);
                    await this.reducePosition(existingPos, size, currentPrice);
                    return { status: 'REDUCED', message: 'Position reduced via netting' };

                } else {
                    // FLIP (Close + Open Remainder)
                    const remainingSize = size - currentPosSize;

                    // Margin Check for Remainder (taking into account freed margin)
                    // The 'availableBalance' assumes 'currentPosSize' is used. 
                    // Closing 'existinPos' frees 'currentPosSize'.
                    // So effective available = availableBalance + currentPosSize.
                    if (remainingSize > (availableBalance + currentPosSize)) {
                        throw new Error(`Insufficient balance for Flip. Need $${remainingSize}, Valid Max: $${availableBalance + currentPosSize}`);
                    }

                    console.log(`🔄 Netting: Flipping ${existingPos.symbol}`);
                    // 1. Close Old
                    let result = 'LOSS';
                    const entry = parseFloat(existingPos.entry_price);
                    if (existingPos.side === 'LONG') { if (currentPrice > entry) result = 'WIN'; }
                    else { if (currentPrice < entry) result = 'WIN'; }
                    await this.closePosition(existingPos, result, currentPrice, "FLIP_CLOSE");

                    // 2. Open New (Remainder)
                    console.log(`🚀 Netting: Opening remaining ${remainingSize} ${side}`);
                    size = remainingSize;
                    // Continue to Insert...
                }
            } else {
                // SAME SIDE: Pyramiding
                if (size > availableBalance) {
                    throw new Error(`Insufficient balance. Available: $${availableBalance}, Req: $${size}`);
                }
                console.log(`📈 Pyramiding: Adding ${size} to ${existingPos.symbol}`);
                const newSize = parseFloat(existingPos.size) + size;

                // Update DB
                await db.query(`UPDATE positions SET size = $1, updated_at = NOW() WHERE id = $2`, [newSize, existingPos.id]);
                // Update Memory
                existingPos.size = newSize;
                return existingPos;
            }
        } else {
            // NEW POSITION
            if (size > availableBalance) {
                throw new Error(`Insufficient balance. Available: $${availableBalance}, Req: $${size}`);
            }
        }

        // 2.6 Validation (SL/TP)
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

    async getStrategy(id, page = 1, limit = 10) {
        const strat = await db.query("SELECT * FROM strategies WHERE id = $1", [id])
        if (!strat.rows.length) return null

        // Get active positions
        const active = this.activePositions.filter(p => p.strategy_id === id)

        // Get total count for pagination
        const countRes = await db.query(`
            SELECT COUNT(*) as total FROM positions 
            WHERE strategy_id = $1 AND status = 'CLOSED'
        `, [id])
        const totalTrades = parseInt(countRes.rows[0].total)

        // Get paginated history
        const offset = (page - 1) * limit
        const history = await db.query(`
            SELECT * FROM positions 
            WHERE strategy_id = $1 AND status = 'CLOSED' 
            ORDER BY closed_at DESC, updated_at DESC 
            LIMIT $2 OFFSET $3
        `, [id, limit, offset])

        const totalPages = Math.ceil(totalTrades / limit)

        return {
            ...strat.rows[0],
            positions: active,
            recent_history: history.rows,
            current_price: this.priceCache[this.ws.symbol] || null,
            pagination: {
                page,
                limit,
                total: totalTrades,
                totalPages
            }
        }
    }
}
