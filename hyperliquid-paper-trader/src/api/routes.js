
import express from 'express'
import { engine } from '../index.js'
import { db } from '../core/db.js'

export const router = express.Router()

// 1. Init Strategy (Wallet)
router.post('/strategies', async (req, res) => {
    try {
        const { id, capital } = req.body
        if (!id || !capital) {
            return res.status(400).json({ error: 'Missing id or capital' })
        }
        const result = await engine.createStrategy(id, parseFloat(capital))
        res.json(result)
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

// 2. Place Order
router.post('/order', async (req, res) => {
    try {
        // { strategyId, symbol, side, size, sl, tp }
        const { strategyId, symbol, side, size, sl, tp } = req.body

        if (!strategyId || !symbol || !side || !size) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        const position = await engine.placeOrder(
            strategyId,
            symbol,
            side,
            parseFloat(size),
            sl ? parseFloat(sl) : null,
            tp ? parseFloat(tp) : null
        )
        res.json({ success: true, position })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

// 2.1 Close Position
router.post('/position/close', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing position id' });
        await engine.closePositionManually(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2.2 Update TP/SL
router.post('/position/update', async (req, res) => {
    try {
        const { id, tp, sl } = req.body; // id, tp, sl
        if (!id) return res.status(400).json({ error: 'Missing position id' });

        const result = await engine.updateTpSl(id, tp, sl);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Get All Strategies
router.get('/strategies', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM strategies ORDER BY created_at DESC");
        const strategies = result.rows.map(s => {
            const initial = parseFloat(s.initial_capital);
            const current = parseFloat(s.current_balance);
            const pnl = current - initial;
            const roi = initial > 0 ? (pnl / initial) * 100 : 0;
            return {
                ...s,
                pnl: pnl.toFixed(2),
                roi: roi.toFixed(2)
            };
        });
        res.json(strategies);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Get Strategy Status
router.get('/strategies/:id', async (req, res) => {
    try {
        const data = await engine.getStrategy(req.params.id)
        if (!data) return res.status(404).json({ error: 'Strategy not found' })
        res.json(data)
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

// 4. Get active positions (Debug)
router.get('/positions', (req, res) => {
    res.json(engine.activePositions)
})
