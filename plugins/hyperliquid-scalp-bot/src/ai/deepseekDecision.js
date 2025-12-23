import axios from 'axios'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

export async function getDecision(signal) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ Missing DEEPSEEK_API_KEY')
    return { action: 'NO_TRADE', confidence: 0 }
  }

  const prompt = `
Đóng vai một chuyên gia giao dịch Crypto Scalping chuyên nghiệp. Hãy phân tích dữ liệu kỹ thuật dưới đây cho cặp ${signal.symbol}/USD (khung ${signal.interval || '15m'}) và đưa ra quyết định: LONG, SHORT, hay ĐỨNG NGOÀI (WAIT).

DỮ LIỆU THỊ TRƯỜNG:
- Xu hướng (EMA): ${signal.trend || 'Không rõ'}
- RSI: ${signal.rsi || 'Không rõ'} / Bias: ${signal.bias}
- Động lượng (Momentum): ${signal.momentum}
- Cấu trúc thị trường: ${signal.structure || 'Không rõ'}
- Biến động (ATR): ${signal.atr || 'Không rõ'}
- Funding Rate: ${signal.funding || 'Không rõ'}

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