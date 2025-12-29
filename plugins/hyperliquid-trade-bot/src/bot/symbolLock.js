/**
 * Simple in-memory per-symbol lock to prevent overlapping cycles.
 * Note: this is process-local (not distributed). Good enough for single bot instance.
 */

const inFlightBySymbol = new Map() // symbol -> startedAtMs

export function isSymbolLocked(symbol) {
  return inFlightBySymbol.has(symbol)
}

export async function withSymbolLock(symbol, fn) {
  if (!symbol) {
    // No symbol -> just run (should not happen for our usage)
    return await fn()
  }

  if (inFlightBySymbol.has(symbol)) {
    return { skipped: true }
  }

  inFlightBySymbol.set(symbol, Date.now())
  try {
    const result = await fn()
    return { skipped: false, result }
  } finally {
    inFlightBySymbol.delete(symbol)
  }
}


