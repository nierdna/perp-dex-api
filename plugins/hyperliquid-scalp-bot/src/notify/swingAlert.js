/**
 * Swing Alert Formatter
 * Format alert theo SRS (không có entry/SL/TP, chỉ trigger info + AI view)
 * Style giống Scalp: đẹp, chuyên nghiệp với MarkdownV2
 */

// Import escape functions từ telegram.js (exported)
import { escapeMarkdownV2, escapeInlineCode, sanitizeForCodeBlock } from './telegram.js'

/**
 * Format swing alert message (đẹp như Scalp)
 * @param {Object} triggerInfo - Trigger information
 * @param {Object} aiOutput - AI output (verdict, confidence, reasoning, invalidation_note)
 * @param {string} symbol - Trading symbol
 * @returns {string} Formatted alert message (MarkdownV2 ready)
 */
export function formatSwingAlert(triggerInfo, aiOutput, symbol = 'BTC') {
  // Verdict icon mapping
  const verdictIcon = {
    'CONSIDER': '🟢',
    'NO_TRADE': '⚪',
    'AVOID': '🔴',
    'WAIT': '⚪' // Fallback
  }
  
  const verdict = (aiOutput?.verdict || 'NO_TRADE').toUpperCase()
  const icon = verdictIcon[verdict] || verdictIcon['NO_TRADE']
  const confidencePercent = Math.round(aiOutput?.confidence || 0)
  
  // Format regime
  const regimeText = triggerInfo.regime || 'UNKNOWN'
  const regimeDisplay = regimeText.replace('_', ' ')
  
  // Format bias
  const biasText = triggerInfo.bias || 'NO_TRADE'
  const biasDisplay = biasText.replace('_', ' ')
  
  // Format HTF Zone
  let zoneDisplay = 'N/A'
  if (triggerInfo.htf_zone) {
    const zone = triggerInfo.htf_zone
    const zoneTypeMap = {
      'DEMAND': 'Demand',
      'SUPPLY': 'Supply',
      'EMA_RETEST': 'EMA Retest',
      'RANGE_EDGE': 'Range Edge'
    }
    const zoneType = zoneTypeMap[zone.type] || zone.type
    if (zone.priceRange && zone.priceRange.length >= 2) {
      const priceLow = (zone.priceRange[0] / 1000).toFixed(0)
      const priceHigh = (zone.priceRange[1] / 1000).toFixed(0)
      const strength = zone.strength ? ` - Strength ${zone.strength}/5` : ''
      zoneDisplay = `${zoneType}: ${priceLow}k-${priceHigh}k${strength}`
    } else {
      zoneDisplay = zoneType
    }
  }
  
  // Format setup state
  const setupDisplay = triggerInfo.setup_state || 'NONE'
  
  // Format LTF confirmation
  let ltfDisplay = 'None'
  if (triggerInfo.ltf_confirmation?.confirmed && triggerInfo.ltf_confirmation?.signals?.length > 0) {
    ltfDisplay = triggerInfo.ltf_confirmation.signals.join(', ')
  } else if (triggerInfo.ltf_confirmation?.signals?.length > 0) {
    ltfDisplay = triggerInfo.ltf_confirmation.signals.join(', ') + ' - Pending'
  }
  
  // Format trigger score
  const triggerScore = triggerInfo.trigger_score || 0
  const scoreBreakdown = triggerInfo.trigger_breakdown || {}
  
  // Format reasoning và invalidation_note (sanitize cho code block)
  const reasoningText = aiOutput?.reasoning || 'N/A'
  const invalidationText = aiOutput?.invalidation_note || 'N/A'
  
  const reasoningBlock = sanitizeForCodeBlock(reasoningText)
  const invalidationBlock = sanitizeForCodeBlock(invalidationText)
  
  // Escape cho MarkdownV2
  const safeSymbol = escapeInlineCode(symbol)
  const safeRegime = escapeInlineCode(regimeDisplay)
  const safeBias = escapeInlineCode(biasDisplay)
  const safeZone = escapeInlineCode(zoneDisplay)
  const safeSetup = escapeInlineCode(setupDisplay)
  const safeLtf = escapeInlineCode(ltfDisplay)
  const safeVerdict = escapeMarkdownV2(verdict)
  const safeScore = escapeInlineCode(String(triggerScore))
  
  // Build message với format đẹp như Scalp
  // Escape text headers cho MarkdownV2 (ngoặc đơn, dấu chấm cuối câu)
  const message = `${icon} *SWING TRIGGER: ${safeVerdict}* ${icon}
🏷️ *Token:* \`${safeSymbol}\`
📊 *Strategy:* \`SWING_01\`

━━━━━━━━━━━━━━━━━━━━
📈 *Market Context \\(4H\\):*
\`Regime:\` \`${safeRegime}\`
\`Bias:\` \`${safeBias}\`

📍 *HTF Zone:*
\`${safeZone}\`

📊 *Setup State:*
\`${safeSetup}\`

✅ *LTF Confirmation:*
\`${safeLtf}\`

🎯 *Trigger Score:* \`${safeScore}/100\`

━━━━━━━━━━━━━━━━━━━━
🤖 *AI Analysis:*
*Confidence:* \`${confidencePercent}%\`

💡 *Reasoning:*
\`\`\`
${reasoningBlock}
\`\`\`

⚠️ *Invalidation:*
\`\`\`
${invalidationBlock}
\`\`\`

━━━━━━━━━━━━━━━━━━━━
ℹ️ *Note:* This is a trigger alert, NOT a trade signal\\. Trader decides execution and risk\\.`

  return message
}

