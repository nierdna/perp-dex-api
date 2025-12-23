# Hyperliquid Scalp Bot (Node.js MVP)

## 🎯 Mục tiêu
Bot scalp perp trên **Hyperliquid**, dùng **DeepSeek làm decision engine**, code xử lý toàn bộ indicator và risk.

## ✅ Làm được
- Lấy data thị trường
- Tính indicator (EMA, RSI, ATR)
- Chuẩn hoá signal
- AI quyết định LONG / SHORT / NO_TRADE
- Quản lý risk
- Vào / thoát lệnh
- Gửi Telegram

## ❌ Không làm (MVP)
- Backtest
- Hedge
- Multi-symbol

## 🚀 Cách chạy
```bash
npm install
cp .env.example .env
npm run dev
```

## 🧠 Kiến trúc
Market → Indicator → Signal → DeepSeek → Risk → Order → Notify

## ⚠️ Lưu ý
- Chạy size nhỏ
- Ưu tiên NO_TRADE