import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import WebSocket from "ws";

// Load ENV
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TOPIC_ID = process.env.TELEGRAM_ADMIN_TOPIC; // Optional
// Parse WALLETS: support format "ADDRESS|NAME" or just "ADDRESS"
const walletConfig = (process.env.WALLETS || "").split(",").map(w => w.trim()).filter(Boolean);

const WATCH_LIST = [];
const WALLET_NAMES = {};

walletConfig.forEach(entry => {
  const [address, name] = entry.split("|");
  const cleanAddr = address.trim().toLowerCase();

  if (cleanAddr) {
    WATCH_LIST.push(cleanAddr);
    if (name) WALLET_NAMES[cleanAddr] = name.trim();
  }
});

if (!BOT_TOKEN || !CHAT_ID || WATCH_LIST.length === 0) {
  console.error("❌ Missing ENV variables. Check .env file.");
  process.exit(1);
}

// Init Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Tách logic connect ra hàm riêng để tái sử dụng khi reconnect
function connect() {
  const ws = new WebSocket("wss://api.hyperliquid.xyz/ws");

  ws.on("open", () => {
    console.log("🟢 Connected to Hyperliquid WS");

    // Subscribe userFills cho từng ví
    WATCH_LIST.forEach(address => {
      const msg = {
        method: "subscribe",
        subscription: {
          type: "userFills",
          user: address
        }
      };
      ws.send(JSON.stringify(msg));

      const displayName = WALLET_NAMES[address] ? `${address} (${WALLET_NAMES[address]})` : address;
      console.log(`🛰️ Subscribed to fills for wallet: ${displayName}`);
    });

    // Ping mỗi 50s để giữ kết nối (tránh bị server ngắt do idle)
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ method: "ping" }));
      } else {
        clearInterval(pingInterval);
      }
    }, 50000);
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw);

      // Debug log (uncomment nếu cần debug)
      // console.log("👉 WS Recv:", JSON.stringify(data));

      // Xử lý pong response (nếu có)
      if (data.channel === 'pong') return;

      // Chỉ xử lý data dạng fills
      if (!data || !data.data || !data.data.fills) return;

      // Bỏ qua gói tin snapshot (dữ liệu lịch sử khi mới connect) để tránh spam Telegram
      if (data.data.isSnapshot) {
        console.log(`📂 Skipped snapshot with ${data.data.fills.length} fills.`);
        return;
      }

      const fills = data.data.fills;
      // API Hyperliquid thường trả về 'user' thay vì 'address' trong channel userFills
      const addr = (data.data.user || data.data.address)?.toLowerCase();

      if (!addr) return;

      if (!WATCH_LIST.includes(addr)) {
        // console.log(`ℹ️ Ignored update for ${addr} (not in watch list)`);
        return;
      }

      fills.forEach(fill => {
        const side = fill.side === 'B' ? 'BUY 🟢' : 'SELL 🔴';
        const dir = fill.dir; // VD: Open Long, Close Short, Open Short, Close Long
        const price = fill.px;
        const size = fill.sz;
        const coin = fill.coin;
        const time = new Date(fill.time).toLocaleString();

        const value = (parseFloat(price) * parseFloat(size)).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

        // Icon cho Type
        let typeIcon = "🔥";
        if (dir.includes("Long")) typeIcon = "🟢";
        if (dir.includes("Short")) typeIcon = "🔴";

        // Tên ví (nếu có)
        const walletName = WALLET_NAMES[addr] ? `(${WALLET_NAMES[addr]})` : "";

        const message = `
🔔 *HYPERLIQUID ALERT*
───────────────────
👤 *Wallet:* \`${addr.slice(0, 6)}...${addr.slice(-4)}\` ${walletName}
💎 *Token:* #${coin}
${typeIcon} *Type:*   ${dir}
📊 *Side:*   ${side}
💰 *Size:*   ${size}
💵 *Price:*  ${price}
💸 *Value:*  ${value}
⏰ *Time:*   ${time}
───────────────────
`;

        bot.sendMessage(
          CHAT_ID,
          message,
          { parse_mode: "Markdown", message_thread_id: TOPIC_ID }
        );

        console.log(`📤 Sent alert for ${addr} → ${side} ${size} ${coin}`);
      });

    } catch (err) {
      console.error("❌ WS parse error:", err);
    }
  });

  ws.on("close", () => {
    console.log("🔴 WS disconnected. Reconnecting in 5s...");
    setTimeout(connect, 5000);
  });

  ws.on("error", (err) => {
    console.error("❌ WS Error:", err);
    ws.close(); // Force close để trigger reconnect
  });
}

// Bắt đầu kết nối
connect();
