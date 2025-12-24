import WebSocket from 'ws'
import { fetchOpenTrades, updateTradeOutcome } from '../data/db.js'

const WS_URL = process.env.HYPERLIQUID_WS_URL || 'wss://api.hyperliquid.xyz/ws'
const RECONNECT_MS = parseInt(process.env.WS_RECONNECT_MS || '2000')

/**
 * Trade object stored in memory.
 * - action: 'LONG' | 'SHORT'
 * - takeProfitPrice: number | null (TP mục tiêu để quyết định WIN; lấy TP gần entry nhất)
 */
const openTradesBySymbol = new Map() // symbol -> Map<tradeId, trade>
let ws = null
let started = false
let reconnectTimer = null

export async function startTradeOutcomeMonitor() {
  if (started) return
  started = true

  await loadOpenTradesFromDB()
  connect()
}

export function registerOpenTrade(trade) {
  if (!trade?.id || !trade?.symbol) return
  if (trade.action !== 'LONG' && trade.action !== 'SHORT') return

  // Derive TP target nếu chưa được set
  if (!Number.isFinite(trade.takeProfitPrice)) {
    trade.takeProfitPrice = pickTakeProfitTarget(trade)
  }

  const symbol = trade.symbol
  const current = openTradesBySymbol.get(symbol) || new Map()
  current.set(trade.id, trade)
  openTradesBySymbol.set(symbol, current)
}

async function loadOpenTradesFromDB() {
  const rows = await fetchOpenTrades()
  for (const r of rows) {
    const takeProfitPrices = normalizeJsonArray(r.take_profit_prices)
    const trade = {
      id: r.id,
      symbol: r.symbol,
      action: r.ai_action,
      entryPrice: toNumber(r.entry_price),
      stopLossPrice: toNumber(r.stop_loss_price),
      takeProfitPrices,
    }
    trade.takeProfitPrice = pickTakeProfitTarget(trade)
    registerOpenTrade(trade)
  }

  const count = Array.from(openTradesBySymbol.values()).reduce((acc, m) => acc + m.size, 0)
  if (count > 0) {
    console.log(`📡 WS Monitor: loaded ${count} OPEN trades from DB`)
  }
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  ws = new WebSocket(WS_URL)

  ws.on('open', () => {
    // Subscribe to mid prices for all symbols (allMids)
    // Hyperliquid WS commonly uses:
    // { "method": "subscribe", "subscription": { "type": "allMids" } }
    safeSend({
      method: 'subscribe',
      subscription: { type: 'allMids' },
    })
    console.log('📡 WS Monitor connected')
  })

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    // Expected: { channel: 'allMids', data: { mids: { BTC: '123.4', ... } } }
    if (msg?.channel === 'allMids' && msg?.data?.mids) {
      handleAllMids(msg.data.mids)
    }
  })

  ws.on('close', () => scheduleReconnect('close'))
  ws.on('error', (err) => scheduleReconnect(err?.message || 'error'))
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return
  console.warn(`⚠️ WS Monitor disconnected (${reason}). Reconnecting in ${RECONNECT_MS}ms...`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_MS)
}

function safeSend(obj) {
  try {
    ws?.send(JSON.stringify(obj))
  } catch {
    // ignore
  }
}

function handleAllMids(mids) {
  // Only process symbols we currently track
  for (const [symbol, tradesMap] of openTradesBySymbol.entries()) {
    const pxStr = mids[symbol]
    if (!pxStr) continue
    const px = parseFloat(pxStr)
    if (!Number.isFinite(px)) continue

    for (const trade of tradesMap.values()) {
      evaluateTradeOnPrice(trade, px)
    }
  }
}

function evaluateTradeOnPrice(trade, price) {
  if (trade._closing) return
  if (!trade?.entryPrice || !Number.isFinite(trade.entryPrice)) return

  const sl = trade.stopLossPrice
  const tp = trade.takeProfitPrice
  const action = trade.action

  // Không có SL/TP thì không thể đánh dấu WIN/LOSS một cách deterministic.
  if (!Number.isFinite(sl) && !Number.isFinite(tp)) return

  if (action === 'LONG') {
    if (Number.isFinite(sl) && price <= sl) return void closeTrade(trade, price, 'LOSS', 'Hit Stop Loss')
    if (Number.isFinite(tp) && price >= tp) return void closeTrade(trade, price, 'WIN', 'Hit Take Profit')
  }

  if (action === 'SHORT') {
    if (Number.isFinite(sl) && price >= sl) return void closeTrade(trade, price, 'LOSS', 'Hit Stop Loss')
    if (Number.isFinite(tp) && price <= tp) return void closeTrade(trade, price, 'WIN', 'Hit Take Profit')
  }
}

async function closeTrade(trade, closePrice, outcome, reason) {
  trade._closing = true

  const pnlPercent =
    trade.action === 'LONG'
      ? (closePrice - trade.entryPrice) / trade.entryPrice
      : (trade.entryPrice - closePrice) / trade.entryPrice

  await updateTradeOutcome({
    id: trade.id,
    outcome,
    close_price: closePrice,
    pnl_percent: pnlPercent,
    outcome_reason: reason,
  })

  // Remove from memory
  const tradesMap = openTradesBySymbol.get(trade.symbol)
  if (tradesMap) {
    tradesMap.delete(trade.id)
    if (tradesMap.size === 0) openTradesBySymbol.delete(trade.symbol)
  }

  console.log(`🏁 Trade #${trade.id} ${trade.symbol} -> ${outcome} (${reason}) @ ${closePrice}`)
}

function pickTakeProfitTarget(trade) {
  const entry = trade.entryPrice
  const prices = Array.isArray(trade.takeProfitPrices) ? trade.takeProfitPrices : []
  const numeric = prices.map(toNumber).filter(Number.isFinite)

  if (!Number.isFinite(entry) || numeric.length === 0) return null

  if (trade.action === 'LONG') {
    const above = numeric.filter(p => p >= entry)
    if (above.length === 0) return null
    return above.reduce((best, p) => (p - entry < best - entry ? p : best), above[0])
  }

  if (trade.action === 'SHORT') {
    const below = numeric.filter(p => p <= entry)
    if (below.length === 0) return null
    return below.reduce((best, p) => (entry - p < entry - best ? p : best), below[0])
  }

  return null
}

function normalizeJsonArray(v) {
  if (!v) return []
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function toNumber(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}


