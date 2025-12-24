/**
 * Parse plan từ AI response để extract giá trị số
 */

/**
 * Extract số từ text (lấy số đầu tiên tìm thấy)
 */
function extractNumber(text) {
  if (!text) return null
  
  // Tìm số (có thể có dấu phẩy, dấu chấm)
  const match = text.match(/[\d,]+\.?\d*/)
  if (match) {
    // Loại bỏ dấu phẩy và chuyển sang số
    const numStr = match[0].replace(/,/g, '')
    const num = parseFloat(numStr)
    return isNaN(num) ? null : num
  }
  return null
}

/**
 * Parse stop_loss từ text
 * @param {string} stopLossText - Text mô tả stop loss
 * @param {number} entryPrice - Giá entry để tính toán
 * @param {string} action - LONG hoặc SHORT
 * @returns {object} { price: number, des: string }
 */
export function parseStopLoss(stopLossText, entryPrice, action) {
  if (!stopLossText || !entryPrice) {
    return { price: null, des: stopLossText || 'N/A' }
  }

  // Tìm số trong text
  const numbers = stopLossText.match(/[\d,]+\.?\d*/g)
  
  if (numbers && numbers.length > 0) {
    // Lấy số đầu tiên (thường là giá)
    const price = parseFloat(numbers[0].replace(/,/g, ''))
    if (!isNaN(price)) {
      return {
        price: price,
        des: stopLossText
      }
    }
  }

  // Nếu không tìm thấy số, thử parse từ mô tả
  // Ví dụ: "Dưới mức hỗ trợ gần nhất quanh 86600-86650"
  const rangeMatch = stopLossText.match(/(\d+)-(\d+)/)
  if (rangeMatch) {
    const lowerPrice = parseFloat(rangeMatch[1])
    const upperPrice = parseFloat(rangeMatch[2])
    // LONG: stop loss ở dưới entry -> lấy số nhỏ hơn
    // SHORT: stop loss ở trên entry -> lấy số lớn hơn
    const price = action === 'LONG' ? lowerPrice : upperPrice
    return {
      price: price,
      des: stopLossText
    }
  }

  // Fallback: tính toán dựa trên % (nếu có mention)
  const percentMatch = stopLossText.match(/(\d+\.?\d*)%/)
  if (percentMatch) {
    const percent = parseFloat(percentMatch[1]) / 100
    const price = action === 'LONG' 
      ? entryPrice * (1 - percent)
      : entryPrice * (1 + percent)
    return {
      price: Math.round(price),
      des: stopLossText
    }
  }

  return {
    price: null,
    des: stopLossText
  }
}

/**
 * Parse take_profit từ array text
 * @param {array} takeProfitTexts - Array text mô tả take profit
 * @param {number} entryPrice - Giá entry để tính toán
 * @param {string} action - LONG hoặc SHORT
 * @returns {array} [{ price: number, des: string }, ...]
 */
export function parseTakeProfit(takeProfitTexts, entryPrice, action) {
  if (!Array.isArray(takeProfitTexts) || !entryPrice) {
    return []
  }

  return takeProfitTexts.map(text => {
    if (!text) {
      return { price: null, des: 'N/A' }
    }

    // Tìm số trong text (ưu tiên số lớn nhất - thường là giá target)
    const numbers = text.match(/[\d,]+\.?\d*/g)
    
    if (numbers && numbers.length > 0) {
      // Lấy số lớn nhất (thường là giá target)
      const prices = numbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n))
      if (prices.length > 0) {
        const maxPrice = Math.max(...prices)
        return {
          price: maxPrice,
          des: text
        }
      }
    }

    // Nếu không tìm thấy số, thử parse từ mô tả
    // Ví dụ: "EMA9 khung 5M ~ 86982"
    const tildeMatch = text.match(/~?\s*(\d+)/)
    if (tildeMatch) {
      const price = parseFloat(tildeMatch[1])
      if (!isNaN(price)) {
        return {
          price: price,
          des: text
        }
      }
    }

    // Fallback: tính toán dựa trên % (nếu có mention)
    const percentMatch = text.match(/(\d+\.?\d*)%/)
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]) / 100
      const price = action === 'LONG'
        ? entryPrice * (1 + percent)
        : entryPrice * (1 - percent)
      return {
        price: Math.round(price),
        des: text
      }
    }

    return {
      price: null,
      des: text
    }
  })
}

/**
 * Parse toàn bộ plan từ decision
 * @param {object} decision - Decision từ AI
 * @param {number} currentPrice - Giá hiện tại (fallback nếu không có entry)
 * @returns {object} { entry, stop_loss, take_profit }
 */
export function parsePlan(decision, currentPrice) {
  const entry = decision.entry || currentPrice || null
  
  const stopLoss = parseStopLoss(
    decision.stop_loss_logic,
    entry,
    decision.action
  )

  const takeProfit = parseTakeProfit(
    decision.take_profit_logic,
    entry,
    decision.action
  )

  return {
    entry: entry,
    stop_loss: stopLoss,
    take_profit: takeProfit
  }
}

