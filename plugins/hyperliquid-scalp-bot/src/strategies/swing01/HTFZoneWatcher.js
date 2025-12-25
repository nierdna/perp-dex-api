/**
 * HTF Zone Watcher
 * Phát hiện DEMAND/SUPPLY/EMA_RETEST/RANGE_EDGE zones trên 1D/4H
 */

// In-memory state: Map<symbol, Array<Zone>>
const activeZones = new Map()

/**
 * Zone types
 */
export const ZONE_TYPES = {
  DEMAND: 'DEMAND',
  SUPPLY: 'SUPPLY',
  EMA_RETEST: 'EMA_RETEST',
  RANGE_EDGE: 'RANGE_EDGE'
}

/**
 * Detect zones on HTF (1D/4H)
 * @param {Object} tf1d - 1D timeframe indicators
 * @param {Object} tf4h - 4H timeframe indicators
 * @param {string} symbol - Trading symbol
 * @param {string} regime - Current market regime
 * @returns {Array} Array of active zones
 */
export function detectZones(tf1d, tf4h, symbol, regime) {
  if (!tf4h) {
    return []
  }

  const zones = []

  // 1. EMA_RETEST zone: Price near EMA200
  if (tf4h.ema200 && tf4h.close) {
    const distanceFromEMA = Math.abs(tf4h.close - tf4h.ema200) / tf4h.ema200
    if (distanceFromEMA < 0.02) { // Within 2% of EMA200
      zones.push({
        type: ZONE_TYPES.EMA_RETEST,
        priceRange: [
          tf4h.ema200 * 0.98,
          tf4h.ema200 * 1.02
        ],
        strength: 3,
        frozen: false,
        detectedAt: Date.now()
      })
    }
  }

  // 2. DEMAND zone: Support (swing lows)
  const demandZones = detectDemandZones(tf1d, tf4h)
  zones.push(...demandZones)

  // 3. SUPPLY zone: Resistance (swing highs)
  const supplyZones = detectSupplyZones(tf1d, tf4h)
  zones.push(...supplyZones)

  // 4. RANGE_EDGE: Biên của range (khi regime = RANGE)
  if (regime === 'RANGE' && tf4h.structure) {
    const rangeZones = detectRangeEdges(tf4h)
    zones.push(...rangeZones)
  }

  // Update active zones and check for frozen zones
  updateActiveZones(symbol, zones, tf4h, regime)

  return getActiveZones(symbol)
}

/**
 * Detect demand zones (support) from swing lows
 */
function detectDemandZones(tf1d, tf4h) {
  const zones = []

  if (!tf4h || !tf4h.structure || !tf4h.structure.swings) {
    return zones
  }

  // Find recent swing lows
  const swingLows = tf4h.structure.swings.filter(s => s.type === 'LOW')
  if (swingLows.length < 2) {
    return zones
  }

  // Get last 2 swing lows
  const lastLow = swingLows[swingLows.length - 1]
  const prevLow = swingLows[swingLows.length - 2]

  // Create demand zone around recent swing low
  const zonePrice = lastLow.price
  const zoneWidth = Math.abs(zonePrice - prevLow.price) * 0.1 // 10% of distance between lows

  zones.push({
    type: ZONE_TYPES.DEMAND,
    priceRange: [
      zonePrice - zoneWidth,
      zonePrice + zoneWidth
    ],
    strength: calculateZoneStrength(lastLow, prevLow, 'LOW'),
    frozen: false,
    detectedAt: Date.now()
  })

  return zones
}

/**
 * Detect supply zones (resistance) from swing highs
 */
function detectSupplyZones(tf1d, tf4h) {
  const zones = []

  if (!tf4h || !tf4h.structure || !tf4h.structure.swings) {
    return zones
  }

  // Find recent swing highs
  const swingHighs = tf4h.structure.swings.filter(s => s.type === 'HIGH')
  if (swingHighs.length < 2) {
    return zones
  }

  // Get last 2 swing highs
  const lastHigh = swingHighs[swingHighs.length - 1]
  const prevHigh = swingHighs[swingHighs.length - 2]

  // Create supply zone around recent swing high
  const zonePrice = lastHigh.price
  const zoneWidth = Math.abs(zonePrice - prevHigh.price) * 0.1 // 10% of distance between highs

  zones.push({
    type: ZONE_TYPES.SUPPLY,
    priceRange: [
      zonePrice - zoneWidth,
      zonePrice + zoneWidth
    ],
    strength: calculateZoneStrength(lastHigh, prevHigh, 'HIGH'),
    frozen: false,
    detectedAt: Date.now()
  })

  return zones
}

/**
 * Detect range edges
 */
function detectRangeEdges(tf4h) {
  const zones = []

  if (!tf4h || !tf4h.structure || !tf4h.structure.swings) {
    return zones
  }

  const swings = tf4h.structure.swings
  if (swings.length < 4) {
    return zones
  }

  // Find range high and low
  const highs = swings.filter(s => s.type === 'HIGH').map(s => s.price)
  const lows = swings.filter(s => s.type === 'LOW').map(s => s.price)

  if (highs.length > 0 && lows.length > 0) {
    const rangeHigh = Math.max(...highs)
    const rangeLow = Math.min(...lows)
    const rangeWidth = (rangeHigh - rangeLow) * 0.05 // 5% of range

    // Upper edge (supply)
    zones.push({
      type: ZONE_TYPES.RANGE_EDGE,
      priceRange: [
        rangeHigh - rangeWidth,
        rangeHigh + rangeWidth
      ],
      strength: 3,
      frozen: false,
      detectedAt: Date.now(),
      edgeType: 'UPPER'
    })

    // Lower edge (demand)
    zones.push({
      type: ZONE_TYPES.RANGE_EDGE,
      priceRange: [
        rangeLow - rangeWidth,
        rangeLow + rangeWidth
      ],
      strength: 3,
      frozen: false,
      detectedAt: Date.now(),
      edgeType: 'LOWER'
    })
  }

  return zones
}

/**
 * Calculate zone strength (1-5)
 */
function calculateZoneStrength(current, previous, type) {
  // Strength based on how many times price has respected this level
  // Simplified: based on distance and recency
  const priceDiff = Math.abs(current.price - previous.price)
  const percentDiff = priceDiff / previous.price

  if (percentDiff > 0.1) {
    return 5 // Strong zone (large swing)
  } else if (percentDiff > 0.05) {
    return 4
  } else if (percentDiff > 0.02) {
    return 3
  } else {
    return 2
  }
}

/**
 * Update active zones and check for frozen zones
 */
function updateActiveZones(symbol, newZones, tf4h, regime) {
  const existingZones = activeZones.get(symbol) || []

  // Check if existing zones should be frozen
  // Zone bị freeze cho đến khi:
  // - Close HTF phá zone
  // - Hoặc regime đổi
  const currentClose = tf4h.close

  const updatedZones = existingZones.map(zone => {
    const isInZone = currentClose >= zone.priceRange[0] && currentClose <= zone.priceRange[1]
    const isBroken = (zone.type === ZONE_TYPES.DEMAND && currentClose < zone.priceRange[0]) ||
                     (zone.type === ZONE_TYPES.SUPPLY && currentClose > zone.priceRange[1]) ||
                     (zone.type === ZONE_TYPES.RANGE_EDGE && !isInZone)

    if (isBroken) {
      // Zone bị phá, remove it
      return null
    }

    // Check if zone should be frozen (price is in zone)
    return {
      ...zone,
      frozen: isInZone
    }
  }).filter(z => z !== null)

  // Add new zones
  updatedZones.push(...newZones)

  // Keep only last 10 zones per symbol
  if (updatedZones.length > 10) {
    updatedZones.sort((a, b) => b.detectedAt - a.detectedAt)
    updatedZones.splice(10)
  }

  activeZones.set(symbol, updatedZones)
}

/**
 * Get active zones for symbol
 */
export function getActiveZones(symbol) {
  return activeZones.get(symbol) || []
}

/**
 * Get best zone (highest strength, not frozen)
 */
export function getBestZone(symbol) {
  const zones = getActiveZones(symbol)
  if (zones.length === 0) {
    return null
  }

  // Filter out frozen zones
  const unfrozenZones = zones.filter(z => !z.frozen)
  if (unfrozenZones.length === 0) {
    return zones[0] // Return first zone if all are frozen
  }

  // Return zone with highest strength
  return unfrozenZones.sort((a, b) => b.strength - a.strength)[0]
}

/**
 * Clear zones for symbol (useful for testing)
 */
export function clearZones(symbol) {
  activeZones.delete(symbol)
}

