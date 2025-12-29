/**
 * Trigger Scoring
 * Tính score với weights: Regime 30, HTF Zone 30, Structure 25, LTF 10, Momentum 5
 */

// Weights
const WEIGHTS = {
  REGIME: 30,
  HTF_ZONE: 30,
  STRUCTURE: 25,
  LTF: 10,
  MOMENTUM: 5
}

// Thresholds
const THRESHOLD_IGNORE = 70
const THRESHOLD_WATCH = 79
const THRESHOLD_SWING_GRADE = 80

/**
 * Calculate trigger score
 * @param {Object} regimeResult - Result from MarketRegimeEngine
 * @param {Object} zone - Active zone from HTFZoneWatcher
 * @param {Object} setupState - Setup state from SetupAnalyzer
 * @param {Object} ltfConfirmation - LTF confirmation result
 * @param {Object} tf4h - 4H timeframe indicators
 * @returns {Object} { score, breakdown, level }
 */
export function calculateTriggerScore(regimeResult, zone, setupState, ltfConfirmation, tf4h) {
  const breakdown = {
    regime: 0,
    htfZone: 0,
    structure: 0,
    ltf: 0,
    momentum: 0
  }

  // 1. Regime Score (30 points)
  if (regimeResult && regimeResult.regime) {
    if (regimeResult.regime === 'TREND_UP' || regimeResult.regime === 'TREND_DOWN') {
      breakdown.regime = WEIGHTS.REGIME * (regimeResult.confidence / 100)
    } else if (regimeResult.regime === 'RANGE') {
      breakdown.regime = WEIGHTS.REGIME * 0.5 // Range gets 50% of regime points
    } else {
      breakdown.regime = 0 // TRANSITION gets 0
    }
  }

  // 2. HTF Zone Score (30 points)
  if (zone && zone.strength) {
    // Zone strength is 1-5, convert to 0-30 points
    breakdown.htfZone = WEIGHTS.HTF_ZONE * (zone.strength / 5)
    
    // Bonus if zone is not frozen (active)
    if (!zone.frozen) {
      breakdown.htfZone = Math.min(breakdown.htfZone * 1.1, WEIGHTS.HTF_ZONE)
    }
  }

  // 3. Structure Score (25 points)
  if (tf4h && tf4h.structure) {
    if (tf4h.structure.trend === 'UPTREND' || tf4h.structure.trend === 'DOWNTREND') {
      breakdown.structure = WEIGHTS.STRUCTURE * 0.9 // Strong structure
    } else if (tf4h.structure.trend === 'RANGE') {
      breakdown.structure = WEIGHTS.STRUCTURE * 0.6 // Range structure
    } else {
      breakdown.structure = WEIGHTS.STRUCTURE * 0.3 // Unknown structure
    }

    // Bonus if setup is MATURE
    if (setupState && setupState.state === 'MATURE') {
      breakdown.structure = Math.min(breakdown.structure * 1.2, WEIGHTS.STRUCTURE)
    }
  }

  // 4. LTF Score (10 points)
  if (ltfConfirmation && ltfConfirmation.confirmed) {
    const signalCount = ltfConfirmation.signals.length
    // More signals = higher score
    breakdown.ltf = WEIGHTS.LTF * Math.min(signalCount / 3, 1.0) // Max 3 signals = full points
  } else if (ltfConfirmation && ltfConfirmation.signals && ltfConfirmation.signals.length > 0) {
    // Pending signals get partial points
    breakdown.ltf = WEIGHTS.LTF * 0.3
  }

  // 5. Momentum Score (5 points)
  if (tf4h && tf4h.volRatio) {
    // Volume expansion = momentum
    if (tf4h.volRatio >= 1.5) {
      breakdown.momentum = WEIGHTS.MOMENTUM
    } else if (tf4h.volRatio >= 1.2) {
      breakdown.momentum = WEIGHTS.MOMENTUM * 0.7
    } else if (tf4h.volRatio >= 1.0) {
      breakdown.momentum = WEIGHTS.MOMENTUM * 0.4
    }
  }

  // Calculate total score
  const score = Math.round(
    breakdown.regime +
    breakdown.htfZone +
    breakdown.structure +
    breakdown.ltf +
    breakdown.momentum
  )

  // Determine level
  let level = 'IGNORE'
  if (score >= THRESHOLD_SWING_GRADE) {
    level = 'SWING_GRADE'
  } else if (score >= THRESHOLD_WATCH) {
    level = 'WATCH'
  } else if (score >= THRESHOLD_IGNORE) {
    level = 'WATCH'
  }

  return {
    score: score,
    breakdown: breakdown,
    level: level
  }
}

