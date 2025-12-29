import http from '../utils/httpClient.js'
import { canCallAI, markAICall } from '../utils/rateLimiter.js'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

/**
 * Gọi AI để phân tích và đưa ra quyết định
 * @param {Object} signal - Signal data (chứa symbol, price...)
 * @param {String} prompt - Prompt text đã được build bởi Strategy
 * @returns {Promise<Object>} - Decision JSON
 */
export async function getDecision(signal, prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ Missing DEEPSEEK_API_KEY')
    return { action: 'NO_TRADE', confidence: 0 }
  }

  // DeepSeek AI cần timeout dài hơn (120s) vì AI processing có thể lâu
  const aiTimeout = parseInt(process.env.DEEPSEEK_TIMEOUT_MS || '120000')

  // Rate limit check
  if (!canCallAI()) {
    // Nếu không được phép gọi AI ngay, đợi một chút
    const waitTime = 1000 // 1s
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

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
        timeout: Number.isFinite(aiTimeout) ? aiTimeout : 120000,
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

    // Mark AI call đã thực hiện
    markAICall()

    // Trả về cả decision lẫn prompt đầu vào để debug
    return {
      ...decision,
      symbol: signal.symbol,
      debug_input: prompt
    }

  } catch (error) {
    // Phân loại lỗi rõ ràng hơn
    let errorType = 'Unknown'
    let errorDetail = error.message || 'Unknown error'

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message === 'aborted') {
      errorType = 'Timeout'
      errorDetail = `Request timeout after ${aiTimeout}ms (AI processing may take longer)`
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      errorType = 'Network Error'
      errorDetail = `Connection error: ${error.code}`
    } else if (error.response) {
      errorType = 'API Error'
      errorDetail = error.response.data || error.response.statusText || `HTTP ${error.response.status}`
    }

    console.error(`❌ DeepSeek API Error [${errorType}]:`, errorDetail)

    // Fallback an toàn
    return {
      action: 'NO_TRADE',
      confidence: 0,
      reason: `API Error: ${errorType}`,
      symbol: signal.symbol,
      debug_input: prompt
    }
  }
}