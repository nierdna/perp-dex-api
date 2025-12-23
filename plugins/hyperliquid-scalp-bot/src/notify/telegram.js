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

export function notify(decision) {
  const icon = decision.action === 'LONG' ? '🟢' : '🔴'
  const confidencePercent = Math.round(decision.confidence * 100)

  const message = `
${icon} <b>SIGNAL ALERT: ${decision.action}</b> ${icon}

🤖 <b>Confidence:</b> ${confidencePercent}%
🎯 <b>Entry:</b> ${decision.entry}
🛑 <b>Stop Loss:</b> ${decision.stop_loss_logic}
💰 <b>Take Profit:</b> ${decision.take_profit_logic.join(', ')}

<i>Powered by DeepSeek AI</i>
`

  sendMessage(message)
  console.log('📢 Processing alert:', decision.action)
}