export async function getDecision(signal) {
  return {
    action: 'LONG',
    entry: 'market',
    stop_loss_logic: 'below_structure',
    take_profit_logic: ['1R','2R'],
    confidence: 0.75
  }
}