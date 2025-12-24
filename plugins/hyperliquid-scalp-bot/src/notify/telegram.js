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
 * Format reason text thành bullet points dễ đọc
 */
function formatReason(reason) {
  if (!reason) return 'N/A'
  
  // Pattern 1: "(1) ... (2) ... (3) ..."
  const parenPattern = /\((\d+)\)/g
  if (parenPattern.test(reason)) {
    return reason
      .split(/(?=\(\d+\))/) // Split tại mỗi (1), (2), (3)...
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => {
        // Thay (1) thành • 1.
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
        return item.replace(/^(\d+)\)\s/, '• $1. ')
      })
      .join('\n')
  }
  
  // Nếu không có pattern nào, trả về nguyên bản
  return reason
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