import http from '../utils/httpClient.js'
import { canSendAlert, markAlertSent } from './alertCooldown.js'

/**
 * Escape MarkdownV2 special characters để tránh lỗi Telegram API 400.
 * Ref: Telegram MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escapeMarkdownV2(text) {
  if (text === null || text === undefined) return ''
  const s = String(text)
  // Escape backslash first
  return s
    .replace(/\\/g, '\\\\')
    // IMPORTANT: escape '-' inside character class to avoid "Range out of order"
    // Match Telegram MarkdownV2 special chars: _ * [ ] ( ) ~ ` > # + - = | { } . !
    .replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, '\\$&')
}

/**
 * Escape content placed INSIDE inline code block: `...`
 * In MarkdownV2, inside code we only need to escape backslash and backtick.
 */
function escapeInlineCode(text) {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
}

/**
 * Sanitize content placed inside triple-backtick code block.
 * Avoid breaking the fence by stripping triple backticks.
 */
function sanitizeForCodeBlock(text) {
  if (text === null || text === undefined) return ''
  return String(text).replace(/```/g, "'''")
}

/**
 * Truncate message nếu quá dài (Telegram limit 4096 chars)
 */
function truncateMessage(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength - 50) + '\n\n... (message truncated)'
}

export async function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('⚠️ Telegram config missing (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)')
    return
  }

  // Truncate nếu quá dài
  const truncated = truncateMessage(text, 4000)
  
  // Log length để debug
  if (text.length > 4000) {
    console.warn(`⚠️ Telegram message too long (${text.length} chars), truncating to ${truncated.length}`)
  }

  try {
    await http.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: truncated,
      parse_mode: 'MarkdownV2' // MarkdownV2 (yêu cầu escape chặt)
    })
    console.log('✅ Telegram alert sent')
  } catch (error) {
    // Log chi tiết hơn để debug
    const errorDetail = error.response?.data || error.message
    console.error('❌ Telegram send error:', errorDetail)
    if (error.response?.status === 400) {
      console.error('   Message length:', truncated.length, 'chars')
      console.error('   First 200 chars:', truncated.substring(0, 200))
    }
  }
}

/**
 * Clean và format text để xử lý các pattern lạ
 */
function cleanText(text) {
  if (!text) return text
  
  // Convert RSI(7) → RSI_7 (format mới)
  text = text.replace(/RSI\((\d+)\)/g, 'RSI_$1')
  
  // Fix case AI output bị xuống dòng/bullet kỳ lạ: "RSI\n• 7. = 65.08" hoặc "RSI• 7. = 65.08"
  // Chuẩn hóa về "RSI_7 = 65.08"
  text = text.replace(/RSI\s*(?:\r?\n\s*)?•\s*(\d+)\.\s*=\s*/g, 'RSI_$1 = ')
  
  // Fix case bullet standalone: "\n• 7. = 65.08" -> "\nRSI_7 = 65.08"
  // (Tránh đụng format đánh số thông thường vì pattern này có dấu "=" khá đặc thù)
  text = text.replace(/(^|\n)\s*•\s*(\d+)\.\s*=\s*/g, '$1RSI_$2 = ')

  // Fix pattern "7.=" thành "RSI_7 ="
  text = text.replace(/(\d+)\.=/g, (match, num) => {
    return `RSI_${num} =`
  })
  
  // Fix pattern "RSI 7.=" thành "RSI_7 ="
  text = text.replace(/RSI\s+(\d+)\.=/g, 'RSI_$1 =')
  
  // Fix pattern "RSI7.=" thành "RSI_7 ="
  text = text.replace(/RSI(\d+)\.=/g, 'RSI_$1 =')
  
  // Fix các pattern tương tự với EMA, Volume, etc. (giữ format EMA(26) nhưng RSI dùng RSI_7)
  text = text.replace(/(EMA\d+|Volume)\s*(\d+)\.=/g, '$1($2) =')
  
  return text
}

/**
 * Format reason text thành bullet points dễ đọc
 */
function formatReason(reason) {
  if (!reason) return 'N/A'
  
  // Clean text trước khi format
  reason = cleanText(reason)
  
  // Tách text dính liền thành từng dòng (tìm pattern số + dấu chấm hoặc số + ngoặc)
  // Ví dụ: "...tăng kỹ thuật. 2. Khung 5M..." -> tách thành 2 dòng
  // Chỉ coi là đánh số list nếu số nhỏ (tránh ăn nhầm EMA200, ATR14, v.v.)
  reason = reason.replace(/(\.)\s*((?:[1-9]|1\d|20))([\.\)])\s*/g, '$1\n$2$3 ')
  
  // Pattern 1: "(1) ... (2) ... (3) ..."
  const parenPattern = /\((\d+)\)/g
  if (parenPattern.test(reason)) {
    return reason
      .split(/(?=\(\d+\))/) // Split tại mỗi (1), (2), (3)...
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // Thay (1) thành • 1.
        item = cleanText(item)
        return item.replace(/^\((\d+)\)/, '• $1.')
      })
      .join('\n')                                                                                                              
  }
  
  // Pattern 2: "1. ... 2. ... 3. ..." (số + dấu chấm)
  const dotPattern = /^\d+\.\s/
  if (dotPattern.test(reason.trim())) {
    return reason
      .split(/(?=^\d+\.\s)/m) // Split tại mỗi "1. ", "2. ", "3. "...
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        item = cleanText(item)
        // Thay "1. " thành "• 1. "
        return item.replace(/^(\d+)\.\s/, '• $1. ')
      })
      .join('\n')
  }
  
  // Pattern 3: "1) ... 2) ... 3) ..." (số + dấu ngoặc đơn không có dấu chấm)
  const parenNoDotPattern = /^\d+\)\s/
  if (parenNoDotPattern.test(reason.trim())) {
    return reason
      .split(/(?=^\d+\)\s)/m)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        item = cleanText(item)
        return item.replace(/^(\d+)\)\s/, '• $1. ')
      })
      .join('\n')
  }
  
  // Pattern 4: Text có chứa "Khung" hoặc các từ khóa phân tích, tự động tách
  // Tìm các pattern như "1. Khung", "2. Khung", "3. Khung" ngay cả khi không có xuống dòng
  // Chỉ match số nhỏ để tránh "200. Khung" từ EMA200.
  const khungPattern = /((?:[1-9]|1\d|20))[\.\)]\s*(Khung|RSI|EMA|Volume|Giá|Trend)/g
  if (khungPattern.test(reason)) {
    // Tách tại mỗi số + dấu chấm/ngoặc + từ khóa
    const parts = reason.split(/(?=(?:[1-9]|1\d|20)[\.\)]\s*(?:Khung|RSI|EMA|Volume|Giá|Trend))/)
    if (parts.length > 1) {
      return parts
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => {
          item = cleanText(item)
          // Thêm bullet nếu chưa có
          if (/^(?:[1-9]|1\d|20)[\.\)]/.test(item)) {
            return item.replace(/^((?:[1-9]|1\d|20))([\.\)])\s*/, '• $1. ')
          }
          return '• ' + item
        })
        .join('\n')
    }
  }
  
  // Nếu không có pattern nào, clean và trả về nguyên bản với bullet đầu dòng
  reason = cleanText(reason)
  return reason.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.startsWith('•') ? line : '• ' + line)
    .join('\n')
}

export function notify(decision, plan = null, strategy = null) {
  const icon = decision.action === 'LONG' ? '🟢' : (decision.action === 'SHORT' ? '🔴' : '⚪')
  const confidencePercent = Math.round(decision.confidence * 100)
  const symbol = decision.symbol || decision?.market?.symbol || 'N/A'
  
  // Format strategy name với icon phù hợp
  const strategyName = strategy || 'SCALP_01'
  const strategyIcon = strategyName.includes('MANUAL') ? '🔧' : '⚡'
  const strategyLabel = strategyName.includes('MANUAL') ? `${strategyIcon} ${strategyName} (Manual)` : `${strategyIcon} ${strategyName} (Auto)`

  // Sử dụng plan nếu có, fallback về decision
  const entry = plan?.entry || decision.entry || 'N/A'
  const stopLoss = plan?.stop_loss || { price: null, description: decision.stop_loss_logic || 'N/A' }
  const takeProfit = plan?.take_profit || (Array.isArray(decision.take_profit_logic) 
    ? decision.take_profit_logic.map(tp => ({ price: null, description: tp }))
    : [])

  // Format reason
  // Double-pass sanitize để bắt hết các case reason bị xuống dòng/bullet kỳ lạ
  const formattedReason = cleanText(formatReason(decision.reason))

  // Format stop loss
  const stopLossDesc = stopLoss?.description ?? stopLoss?.des ?? 'N/A'
  let stopLossText = stopLossDesc
  if (stopLoss.price) {
    stopLossText = `${stopLoss.price} (${stopLossDesc})`
  }

  // Format take profit
  let takeProfitText = ''
  if (takeProfit.length > 0) {
    takeProfitText = takeProfit
      .map((tp, index) => {
        const tpNum = index + 1
        const label = `TP${tpNum}:`
        const desRaw = (tp?.description ?? tp?.des ?? '').toString().trim()

        // Nếu AI đã format sẵn "TP1: 86950 ..." thì dùng nguyên bản để tránh bị lặp "TP1: ... - TP1: ..."
        if (/^TP\s*\d+\s*:/i.test(desRaw)) {
          return desRaw
        }

        // Nếu des đã chứa price (vd "86950 (0.9% dưới entry)") thì chỉ cần prefix label
        if (tp?.price && desRaw.includes(String(tp.price))) {
          return `${label} ${desRaw}`
        }

        if (tp?.price) {
          return `${label} ${tp.price} - ${desRaw || 'N/A'}`
        }
        return `${label} ${desRaw || 'N/A'}`
      })
      .join('\n')
  } else {
    takeProfitText = 'N/A'
  }

  // MarkdownV2:
  // - Các giá trị dynamic nên đặt trong inline code để tránh escape quá nhiều.
  // - Phần reason & TP dùng code block để giữ nguyên dấu chấm, RSI_7, EMA200... và tránh Telegram parse list.
  const safeAction = escapeMarkdownV2(decision.action)
  const safeSymbolCode = escapeInlineCode(symbol)
  const safeStrategyCode = escapeInlineCode(strategyLabel)
  const safeEntryCode = escapeInlineCode(String(entry))
  const safeStopLossCode = escapeInlineCode(String(stopLossText))

  const reasonBlock = sanitizeForCodeBlock(formattedReason)
  const tpBlock = sanitizeForCodeBlock(takeProfitText)

  const message =
`${icon} *SIGNAL ALERT: ${safeAction}* ${icon}
🏷️ *Token:* \`${safeSymbolCode}\`
📊 *Strategy:* \`${safeStrategyCode}\`

━━━━━━━━━━━━━━━━━━━━
🤖 *Confidence:* \`${confidencePercent}%\`

💡 *Phân tích:*
\`\`\`
${reasonBlock}
\`\`\`

━━━━━━━━━━━━━━━━━━━━
🎯 *Entry:* \`${safeEntryCode}\`
🛑 *Stop Loss:* \`${safeStopLossCode}\`

💰 *Take Profit:*
\`\`\`
${tpBlock}
\`\`\`
━━━━━━━━━━━━━━━━━━━━`

  // Check cooldown trước khi gửi (chống spam cùng action)
  // Dùng lại biến symbol đã khai báo ở trên (dòng 184)
  const action = decision.action
  const symbolForCooldown = symbol === 'N/A' ? 'UNKNOWN' : symbol

  if (!canSendAlert(symbolForCooldown, action)) {
    console.log(`⏸️  Alert skipped (cooldown): ${symbolForCooldown} ${action}`)
    return null // Không gửi alert
  }

  // Gửi alert
  sendMessage(message)
  
  // Đánh dấu đã gửi (update cooldown tracker)
  markAlertSent(symbolForCooldown, action)
  
  console.log('📢 Processing alert:', decision.action)
  return message
}