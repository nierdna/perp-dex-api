import http from '../utils/httpClient.js'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

export async function getDecision(signal) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ Missing DEEPSEEK_API_KEY')
    return { action: 'NO_TRADE', confidence: 0 }
  }

  const prompt = `
Vai trò: Bạn là một chuyên gia giao dịch Crypto Scalping chuyên nghiệp. Hãy tận dụng cơ hội ngắn hạn nhưng phải quản lý rủi ro chặt chẽ.

MỤC TIÊU: Tìm kiếm lợi nhuận từ các biến động ngắn hạn với xác suất thắng > 70%.

DỮ LIỆU THỊ TRƯỜNG CHO CẶP ${signal.symbol}/USD:

📊 15M CHART (Xu hướng chủ đạo):
- Regime: ${signal.regime_15m || 'unknown'}
- Trend Status: ${signal.regime_cross || 'none'} ${signal.regime_cross === 'golden_cross' ? '🟢 UPTREND' : signal.regime_cross === 'death_cross' ? '🔴 DOWNTREND' : '⚪ SIDEWAY'}
- EMAs: EMA50 (${signal.regime_ema50}) | EMA200 (${signal.regime_ema200})
- RSI (14): ${signal.regime_rsi14} (>70: Overbought | <30: Oversold)

📈 5M CHART (Cấu trúc sóng):
- Bias: ${signal.bias_5m || 'unknown'}
- Trend: ${signal.bias_cross === 'golden_cross' ? '🟢 Tăng' : signal.bias_cross === 'death_cross' ? '🔴 Giảm' : '⚪ Hỗn hợp'}
- EMAs: EMA9 (${signal.bias_ema9}) | EMA26 (${signal.bias_ema26})
- RSI (7): ${signal.bias_rsi7}

⚡ 1M CHART (Điểm vào lệnh Scalping - Quan trọng nhất):
- Setup: ${signal.entry_cross || 'none'} ${signal.entry_cross === 'golden_cross' ? '🟢 Golden Cross (MUA)' : signal.entry_cross === 'death_cross' ? '🔴 Death Cross (BÁN)' : ''}
- EMA9: ${signal.entry_ema9} | EMA26: ${signal.entry_ema26}
- Giá: ${signal.price}
- RSI (7): ${signal.entry_rsi7}
- Volume Force: ${signal.entry_vol_status} (Lực: ${signal.entry_vol_ratio}x)

📰 TIN TỨC:
${signal.news && signal.news.length > 0
      ? signal.news.map(n => `- [${n.eventTime}] ${n.title} (Impact: ${n.impact})`).join('\n')
      : '- Không có tin tức quan trọng.'}

QUY TẮC GIAO DỊCH (LINH HOẠT HƠN):

1. ĐỒNG THUẬN (Flexible Confluence):
   - ƯU TIÊN 1: 15m + 5m + 1m cùng chiều -> CỰC MẠNH (Confidence > 0.9).
   - ƯU TIÊN 2: 15m Sideway nhưng 5m + 1m cùng chiều mạnh -> VÀO LỆNH (Confidence ~ 0.7-0.8).
   - TRÁNH: 15m Uptrend nhưng 5m Downtrend (Ngược sóng) -> NO_TRADE hoặc chờ hồi.

2. QUẢN LÝ RỦI RO (Risk Management):
   - LONG: Tránh khi RSI 1m/5m > 75 (Quá mua cực đại).
   - SHORT: Tránh khi RSI 1m/5m < 25 (Quá bán cực đại).
   - Volume: Ưu tiên setup có volume > 1.2x trung bình.

3. STOP LOSS & TAKE PROFIT (Scalping Optimized):
   - Stop Loss: ~0.6% từ entry (dưới/trên support/resistance gần nhất)
   - Take Profit: ~0.9% từ entry (R:R 1:1.5 để cover fees)
   - Ưu tiên TP tại EMA levels hoặc resistance/support tiếp theo

HÃY SUY LUẬN VÀ TRẢ LỜI JSON:
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.0 đến 1.0 (Hãy tự tin, nếu đẹp thì cho > 0.8),
  "entry": SỐ (Giá vào lệnh cụ thể, ví dụ: 86994),
  "stop_loss_logic": "Điểm dừng lỗ khuyến nghị (mô tả + giá nếu có, ví dụ: Dưới mức hỗ trợ quanh 86600-86650)",
  "take_profit_logic": ["Mục tiêu 1 (mô tả + giá, ví dụ: EMA9 khung 5M ~ 86982)", "Mục tiêu 2 (mô tả + giá, ví dụ: EMA26 khung 5M ~ 87120)"],
  "reason": "Lý do thắng > 70% (Tiếng Việt). QUAN TRỌNG: Format rõ ràng, mỗi điểm một dòng, bắt đầu bằng số thứ tự. Ví dụ:\n1. Khung 1M RSI(7) = 30.55 cho thấy quá bán ngắn hạn\n2. Khung 5M RSI(7) = 33.61 cũng ở vùng oversold\n3. Khung 15M đang sideway, không cản trở đà tăng\nLƯU Ý: Luôn viết đầy đủ RSI(7) = giá_trị, KHÔNG viết tắt thành 7.= hoặc các format lạ khác.",
  "risk_warning": "Cảnh báo rủi ro (nếu có)"
}
`

  try {
    const response = await http.post(
      DEEPSEEK_ENDPOINT,
      {
        model: "deepseek-chat", // Hoặc deepseek-coder tuỳ account
        messages: [
          { role: "system", content: "Bạn là AI Trading Bot chuyên nghiệp. Hãy trả lời bằng format JSON. Giải thích bằng Tiếng Việt." },
          { role: "user", content: prompt }
        ],
        temperature: 0.0 // Giữ nhiệt độ thấp để AI trả về đúng format + logic chặt chẽ
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    )

    const content = response.data.choices[0].message.content
    // Clean markdown blocks if any (ví dụ ```json ... ```)
    const cleanJson = content.replace(/```json|```/g, '').trim()

    const decision = JSON.parse(cleanJson)

    // Trả về cả decision lẫn prompt đầu vào để debug
    return {
      ...decision,
      symbol: signal.symbol,
      debug_input: prompt
    }

  } catch (error) {
    console.error('❌ DeepSeek API Error:', error.response?.data || error.message)
    // Fallback an toàn
    return { action: 'NO_TRADE', confidence: 0, reason: "API Error", symbol: signal.symbol, debug_input: prompt }
  }
}