export function isValidSignal(decision) {
  // Chỉ lọc dựa trên độ tin cậy của AI
  if (decision.confidence < 0.7) return false

  return true
}