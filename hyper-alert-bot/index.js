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
      // Group các lệnh cùng thời điểm, cùng mã, cùng kiểu lại thành 1
      const groupedFills = {};

      fills.forEach(fill => {
        const addr = (data.data.user || data.data.address)?.toLowerCase();
        if (!addr || !WATCH_LIST.includes(addr)) return;

        // Key để gom nhóm: cùng ví + token + chiều (Buy/Sell) + Type (Open/Close) + Thời gian (đến phút hoặc giây)
        // Ở đây dùng chính xác time trả về vì Hyperliquid khớp lệnh cùng lúc sẽ có time giống hệt nhau
        const key = `${addr}_${fill.coin}_${fill.side}_${fill.dir}_${fill.time}`;

        if (!groupedFills[key]) {
          groupedFills[key] = {
            addr: addr,
            coin: fill.coin,
            side: fill.side,
            dir: fill.dir,
            time: fill.time,
            totalSize: 0,
            totalValue: 0,
            totalPnl: 0,
            weightedPriceSum: 0 // Dùng để tính giá trung bình
          };
        }

        const size = parseFloat(fill.sz);
        const price = parseFloat(fill.px);
        const pnl = parseFloat(fill.closedPnl || "0");

        groupedFills[key].totalSize += size;
        groupedFills[key].totalValue += (size * price);
        groupedFills[key].weightedPriceSum += (size * price);
        groupedFills[key].totalPnl += pnl;
      });

      // Duyệt qua các nhóm đã gộp và gửi tin nhắn
      Object.values(groupedFills).forEach(group => {
        const avgPrice = group.weightedPriceSum / group.totalSize;
        const sideLabel = group.side === 'B' ? 'BUY 🟢' : 'SELL 🔴';
        const timeStr = new Date(group.time).toLocaleString();

        // PnL Row
        let pnlRow = "";
        if (group.totalPnl !== 0) {
          const pnlIcon = group.totalPnl >= 0 ? "🟢" : "🔴";
          const pnlSign = group.totalPnl >= 0 ? "+" : "";
          const pnlFormatted = group.totalPnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          pnlRow = `\n${pnlIcon} *PnL:*    ${pnlSign}${pnlFormatted}`;
        }

        // Type Icon
        let typeIcon = "🔥";
        if (group.dir && group.dir.includes("Long")) typeIcon = "🟢";
        if (group.dir && group.dir.includes("Short")) typeIcon = "🔴";

        // Wallet Name
        const walletName = WALLET_NAMES[group.addr] ? `(${WALLET_NAMES[group.addr]})` : "";

        // Format Value & Size
        const valueStr = group.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        // Làm tròn Size gọn gàng (vd: 100.00 thay vì 100.00000)
        const sizeStr = parseFloat(group.totalSize.toFixed(4)).toString();
        const priceStr = parseFloat(avgPrice.toFixed(5)).toString();

        const message = `
🔔 *HYPERLIQUID ALERT*
───────────────────
👤 *Wallet:* \`${group.addr.slice(0, 6)}...${group.addr.slice(-4)}\` ${walletName}
💎 *Token:* #${group.coin}
${typeIcon} *Type:*   ${group.dir}
📊 *Side:*   ${sideLabel}
💰 *Size:*   ${sizeStr}
💵 *Price:*  ${priceStr} (Avg)
💸 *Value:*  ${valueStr}${pnlRow}
⏰ *Time:*   ${timeStr}
───────────────────
`;

        bot.sendMessage(
          CHAT_ID,
          message,
          { parse_mode: "Markdown", message_thread_id: TOPIC_ID }
        );

        console.log(`📤 Sent consolidated alert for ${group.addr} → ${group.coin} (x${group.totalSize})`);
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
