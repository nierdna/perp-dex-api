import WebSocket from 'ws';
import { updateDynamic } from './state.js';
import { detectRealtimeSignals } from './realtimeDetector.js';

export function startRealtime() {
  connect();
}

function connect() {
  const tokens = (process.env.TOKENS || "BTC").split(",");
  const ws = new WebSocket("wss://api.hyperliquid.xyz/ws");

  let pingInterval;

  ws.on("open", () => {
    console.log("WS realtime connected");
    tokens.forEach(t => {
      console.log(`Subscribed to ${t}`);
      ws.send(JSON.stringify(["subscribe", { type: "trades", coin: t }]));
    });

    // Heartbeat: Ping every 30s
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log("-> Ping sent");
        ws.send(JSON.stringify({ method: "ping" }));
      }
    }, 30000);
  });

  ws.on("message", (raw) => {
    try {
      const d = JSON.parse(raw);

      // Handle Pong
      if (d.data === 'pong') {
        console.log("<- Pong received (WS Alive)");
        return;
      }

      if (!d.data?.trades) return;
      const coin = d.coin;
      d.data.trades.forEach(tr => {
        const upd = updateDynamic(coin, tr);
        detectRealtimeSignals(coin, upd);
      });
    } catch (e) { }
  });

  ws.on("close", () => {
    clearInterval(pingInterval);
    console.log("WS closed. Reconnecting in 5s...");
    setTimeout(connect, 5000);
  });

  ws.on("error", (err) => {
    console.error("WS error:", err.message);
    ws.close();
  });
}