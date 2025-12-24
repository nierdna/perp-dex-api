export function isValidSignal(decision) {
  // Chuẩn hoá: chỉ cho phép LONG/SHORT bắn alert.
  // NO_TRADE dù confidence cao vẫn phải skip để tránh spam/false alert.
  const action = decision?.action
  if (action !== 'LONG' && action !== 'SHORT') return false

  // Lọc dựa trên độ tin cậy của AI
  if ((decision?.confidence ?? 0) < 0.7) return false

  return true
}