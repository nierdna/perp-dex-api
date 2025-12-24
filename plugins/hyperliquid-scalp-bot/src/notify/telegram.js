import axios from 'axios'

export async function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('⚠️ Telegram config missing (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)')
    return
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML' // Dùng HTML cho dễ format đậm nhạt
    })
    console.log('✅ Telegram alert sent')
  } catch (error) {
    console.error('❌ Telegram send error:', error.message)
  }
}

/**
 * Clean và format text để xử lý các pattern lạ
 */
function cleanText(text) {
  if (!text) return text
  
  // Fix pattern "7.=" thành "RSI(7) ="
  text = text.replace(/(\d+)\.=/g, (match, num) => {
    return `RSI(${num}) =`
  })
  
  // Fix pattern "RSI 7.=" thành "RSI(7) ="
  text = text.replace(/RSI\s+(\d+)\.=/g, 'RSI($1) =')
  
  // Fix pattern "RSI7.=" thành "RSI(7) ="
  text = text.replace(/RSI(\d+)\.=/g, 'RSI($1) =')
  
  // Fix các pattern tương tự với EMA, Volume, etc.
  text = text.replace(/(EMA\d+|Volume|RSI)\s*(\d+)\.=/g, '$1($2) =')
  
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
  reason = reason.replace(/(\.)\s*(\d+)[\.\)]\s*/g, '$1\n$2$3 ')
  
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
  const khungPattern = /(\d+)[\.\)]\s*(Khung|RSI|EMA|Volume|Giá|Trend)/g
  if (khungPattern.test(reason)) {
    // Tách tại mỗi số + dấu chấm/ngoặc + từ khóa
    const parts = reason.split(/(?=\d+[\.\)]\s*(?:Khung|RSI|EMA|Volume|Giá|Trend))/)
    if (parts.length > 1) {
      return parts
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => {
          item = cleanText(item)
          // Thêm bullet nếu chưa có
          if (/^\d+[\.\)]/.test(item)) {
            return item.replace(/^(\d+)([\.\)])\s*/, '• $1. ')
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

export function notify(decision, plan = null) {
  const icon = decision.action === 'LONG' ? '🟢' : '🔴'
  const confidencePercent = Math.round(decision.confidence * 100)

  // Sử dụng plan nếu có, fallback về decision
  const entry = plan?.entry || decision.entry || 'N/A'
  const stopLoss = plan?.stop_loss || { price: null, des: decision.stop_loss_logic || 'N/A' }
  const takeProfit = plan?.take_profit || (Array.isArray(decision.take_profit_logic) 
    ? decision.take_profit_logic.map(tp => ({ price: null, des: tp }))
    : [])

  // Format reason
  const formattedReason = formatReason(decision.reason)

  // Format stop loss
  let stopLossText = stopLoss.des
  if (stopLoss.price) {
    stopLossText = `${stopLoss.price} (${stopLoss.des})`
  }

  // Format take profit
  let takeProfitText = ''
  if (takeProfit.length > 0) {
    takeProfitText = takeProfit
      .map((tp, index) => {
        const tpNum = index + 1
        if (tp.price) {
          return `TP${tpNum}: ${tp.price} - ${tp.des}`
        }
        return `TP${tpNum}: ${tp.des}`
      })
      .join('\n')
  } else {
    takeProfitText = 'N/A'
  }

  const message = `
${icon} <b>SIGNAL ALERT: ${decision.action}</b> ${icon}

━━━━━━━━━━━━━━━━━━━━
🤖 <b>Confidence:</b> ${confidencePercent}%

💡 <b>Phân tích:</b>
${formattedReason}

━━━━━━━━━━━━━━━━━━━━
🎯 <b>Entry:</b> ${entry}
🛑 <b>Stop Loss:</b> ${stopLossText}

💰 <b>Take Profit:</b>
${takeProfitText}
━━━━━━━━━━━━━━━━━━━━
`

  sendMessage(message)
  console.log('📢 Processing alert:', decision.action)
}