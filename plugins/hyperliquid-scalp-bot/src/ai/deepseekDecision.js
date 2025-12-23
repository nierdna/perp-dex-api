import axios from 'axios'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

export async function getDecision(signal) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ Missing DEEPSEEK_API_KEY')
    return { action: 'NO_TRADE', confidence: 0 }
  }

  const prompt = `
Đóng vai một chuyên gia giao dịch Crypto Scalping chuyên nghiệp. Hãy phân tích dữ liệu kỹ thuật đa khung thời gian (Multi-Timeframe) dưới đây cho cặp ${signal.symbol}/USD và đưa ra quyết định: LONG, SHORT, hay ĐỨNG NGOÀI (WAIT).

DỮ LIỆU THỊ TRƯỜNG (Multi-Timeframe Analysis):

📊 15M - MARKET REGIME (Xu hướng tổng thể):
- Regime: ${signal.regime_15m || 'unknown'}
- Cross: ${signal.regime_cross || 'none'} ${signal.regime_cross === 'golden_cross' ? '🟢' : signal.regime_cross === 'death_cross' ? '🔴' : ''}
- EMA 50: ${signal.regime_ema50} | EMA 200: ${signal.regime_ema200}
- RSI (14): ${signal.regime_rsi14}

📈 5M - BIAS & STRUCTURE (Xu hướng ngắn hạn):
- Bias: ${signal.bias_5m || 'unknown'}
- Cross: ${signal.bias_cross || 'none'} ${signal.bias_cross === 'golden_cross' ? '🟢 (Setup!)' : signal.bias_cross === 'death_cross' ? '🔴 (Setup!)' : ''}
- EMA 9: ${signal.bias_ema9} | EMA 26: ${signal.bias_ema26}
- RSI (7): ${signal.bias_rsi7}
- ATR: ${signal.bias_atr}

⚡ 1M - ENTRY TIMING (Điểm vào lệnh):
- Status: ${signal.entry_1m || 'unknown'}
- Cross: ${signal.entry_cross || 'none'} ${signal.entry_cross === 'golden_cross' ? '🟢 (ENTRY!)' : signal.entry_cross === 'death_cross' ? '🔴 (ENTRY!)' : ''}
- EMA 9: ${signal.entry_ema9} | EMA 26: ${signal.entry_ema26}
- RSI (7): ${signal.entry_rsi7}

🔧 THÔNG TIN KHÁC:
- Giá hiện tại: ${signal.price}
- Funding Rate: ${signal.funding}

LƯU Ý QUAN TRỌNG:
- Chỉ vào lệnh khi CẢ 3 KHUNG ĐỒNG THUẬN (15m regime + 5m bias + 1m entry cùng hướng)
- Ưu tiên NO_TRADE nếu có xung đột giữa các khung
- Golden/Death Cross trên 1m là tín hiệu entry mạnh nhất

ĐỊNH DẠNG OUTPUT (CHỈ TRẢ VỀ JSON):
{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "confidence": 0.0 đến 1.0,
  "entry": "vùng giá entry (nếu có)",
  "stop_loss_logic": "giải thích ngắn gọn lý do đặt SL",
  "take_profit_logic": ["target 1", "target 2"],
  "reason": "giải thích lý do vào lệnh bằng Tiếng Việt ngắn gọn, súc tích"
}

Yêu cầu: Chỉ trả về đúng JSON hợp lệ. Không trả về markdown.
`

  try {
    const response = await axios.post(
      DEEPSEEK_ENDPOINT,
      {
        model: "deepseek-chat", // Hoặc deepseek-coder tuỳ account
        messages: [
          { role: "system", content: "Bạn là AI Trading Bot chuyên nghiệp. Hãy trả lời bằng format JSON. Giải thích bằng Tiếng Việt." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1 // Giữ nhiệt độ thấp để AI trả về đúng format + logic chặt chẽ
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
      debug_input: prompt
    }

  } catch (error) {
    console.error('❌ DeepSeek API Error:', error.response?.data || error.message)
    // Fallback an toàn
    return { action: 'NO_TRADE', confidence: 0, reason: "API Error", debug_input: prompt }
  }
}