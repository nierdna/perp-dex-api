export function canExecute(decision, account) {
  if (decision.confidence < 0.65) return false
  if (account.hasPosition) return false
  if (account.dailyLoss > 3) return false
  return true
}