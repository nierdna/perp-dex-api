
import WebSocket from 'ws'

const WS_URL = 'wss://api.hyperliquid.xyz/ws'

export class HyperliquidWS {
    constructor(symbol = 'BTC') {
        this.symbol = symbol
        this.ws = null
        this.pingInterval = null
        this.callbacks = []
        this.isConnected = false
    }

    connect() {
        console.log(`🔌 Connecting to Hyperliquid WS (${this.symbol})...`)
        this.ws = new WebSocket(WS_URL)

        this.ws.on('open', () => {
            console.log('✅ Connected to WebSocket')
            this.isConnected = true
            this.subscribe()
            this.startHeartbeat()
        })

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data)

                // Handle Heartbeat response (pong)
                if (message.channel === 'pong') {
                    return
                }

                // Handle Trade Data
                if (message.channel === 'trades' && message.data) {
                    // Trades array: [ { coin, side, px, sz, time, hash } ]
                    // We just need the latest price
                    const trades = message.data
                    if (trades.length > 0) {
                        const lastTrade = trades[trades.length - 1]
                        const price = parseFloat(lastTrade.px)
                        this.notify(price)
                    }
                }
            } catch (error) {
                console.error('❌ WS Message Error:', error.message)
            }
        })

        this.ws.on('close', () => {
            console.log('⚠️ WebSocket Closed. Reconnecting...')
            this.isConnected = false
            this.stopHeartbeat()
            setTimeout(() => this.connect(), 2000)
        })

        this.ws.on('error', (err) => {
            console.error('❌ WebSocket Error:', err.message)
        })
    }

    subscribe() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

        const msg = {
            method: 'subscribe',
            subscription: {
                type: 'trades',
                coin: this.symbol
            }
        }
        this.ws.send(JSON.stringify(msg))
    }

    startHeartbeat() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ method: 'ping' }))
            }
        }, 30000) // Ping every 30s
    }

    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval)
            this.pingInterval = null
        }
    }

    onPriceUpdate(callback) {
        this.callbacks.push(callback)
    }

    notify(price) {
        this.callbacks.forEach(cb => cb(price))
    }

    close() {
        this.stopHeartbeat()
        if (this.ws) {
            this.ws.terminate() // Force close
        }
    }
}
