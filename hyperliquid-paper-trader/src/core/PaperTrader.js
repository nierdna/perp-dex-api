
export class PaperTrader {
    constructor(initialBalance = 100) {
        this.balance = initialBalance
        this.position = null // { entry, size, sl, tp, side, symbol }
        this.history = [] // [ { result: 'WIN'|'LOSS', pnl, entry, exit, ... } ]
    }

    /**
     * Open a new position
     * @param {string} symbol - e.g. 'BTC'
     * @param {string} side - 'LONG' or 'SHORT'
     * @param {number} currentPrice - Market price
     * @param {number} sl - Stop Loss price
     * @param {number} tp - Take Profit price
     */
    openPosition(symbol, side, currentPrice, sl, tp) {
        if (this.position) {
            return { success: false, message: 'Position already open' }
        }

        if (side !== 'LONG' && side !== 'SHORT') {
            return { success: false, message: 'Invalid side (must be LONG or SHORT)' }
        }

        // Validate SL/TP
        if (side === 'LONG') {
            if (sl >= currentPrice) return { success: false, message: 'Long SL must be below Entry' }
            if (tp <= currentPrice) return { success: false, message: 'Long TP must be above Entry' }
        } else {
            if (sl <= currentPrice) return { success: false, message: 'Short SL must be above Entry' }
            if (tp >= currentPrice) return { success: false, message: 'Short TP must be below Entry' }
        }

        this.position = {
            symbol,
            side,
            entry: currentPrice,
            size: this.balance * 20, // Assumed 20x leverage
            margin: this.balance,
            sl,
            tp,
            startTime: Date.now()
        }

        return { success: true, message: `Opened ${side} ${symbol} at ${currentPrice} (SL: ${sl}, TP: ${tp})` }
    }

    /**
     * Check current price against SL/TP
     * @param {number} currentPrice 
     * @returns {Object|null} Result if closed, null if still open
     */
    checkTrade(currentPrice) {
        if (!this.position) return null

        const { side, entry, sl, tp, margin } = this.position
        let result = null // 'WIN' or 'LOSS'
        let exitPrice = currentPrice

        if (side === 'LONG') {
            if (currentPrice >= tp) {
                result = 'WIN'
                exitPrice = tp
            } else if (currentPrice <= sl) {
                result = 'LOSS'
                exitPrice = sl
            }
        } else { // SHORT
            if (currentPrice <= tp) {
                result = 'WIN'
                exitPrice = tp
            } else if (currentPrice >= sl) {
                result = 'LOSS'
                exitPrice = sl
            }
        }

        if (result) {
            return this.closePosition(result, exitPrice)
        }

        return null
    }

    closePosition(result, exitPrice) {
        const { entry, side, margin } = this.position

        // Calculate PnL %
        let pnlPercent = 0
        if (side === 'LONG') {
            pnlPercent = (exitPrice - entry) / entry
        } else {
            pnlPercent = (entry - exitPrice) / entry
        }

        // Apply leverage (20x)
        const LEVERAGE = 20
        const pnlDollar = margin * pnlPercent * LEVERAGE

        this.balance += pnlDollar

        const tradeRecord = {
            result,
            side,
            entry,
            exit: exitPrice,
            pnl: pnlDollar,
            newBalance: this.balance,
            time: new Date().toLocaleString()
        }

        this.history.push(tradeRecord)
        this.position = null // Clear position

        return tradeRecord
    }

    getStatus() {
        return {
            balance: this.balance,
            position: this.position,
            totalTrades: this.history.length,
            wins: this.history.filter(h => h.result === 'WIN').length,
            losses: this.history.filter(h => h.result === 'LOSS').length
        }
    }
}
