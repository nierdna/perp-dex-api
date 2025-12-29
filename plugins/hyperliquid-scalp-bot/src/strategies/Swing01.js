import { BaseStrategy } from './BaseStrategy.js'
import { getSwingMarketSnapshot } from '../data/marketCollector.js'
import { calcSwingIndicators } from '../indicators/swingIndicators.js'
import { analyzeRegime } from './swing01/MarketRegimeEngine.js'
import { getBias } from './swing01/BiasEngine.js'
import { detectZones, getBestZone } from './swing01/HTFZoneWatcher.js'
import { analyzeSetup } from './swing01/SetupAnalyzer.js'
import { analyzeLTFConfirmation } from './swing01/LTFConfirmation.js'
import { calculateTriggerScore } from './swing01/TriggerScoring.js'
import { recordTrigger, recordAICall, recordSuppressedTrigger } from './swing01/SwingMetrics.js'

export class Swing01 extends BaseStrategy {
    constructor() {
        super('SWING_01')
        this.triggerInfo = null // Store trigger info for API response
    }

    /**
     * Check conditions before calling AI
     * @param {Object} signal - Signal data (will be swing-specific data)
     * @returns {Boolean} - True if should call AI
     */
    checkConditions(signal) {
        // Signal should contain triggerInfo from Swing01 analysis
        if (!signal || !signal.triggerInfo) {
            return false
        }

        const triggerInfo = signal.triggerInfo
        const score = triggerInfo.trigger_score || 0
        const regime = triggerInfo.regime || ''
        const setupState = triggerInfo.setup_state || ''

        // Conditions for AI call:
        // 1. Trigger score >= 70 (or 65+ with strong zone)
        // 2. Regime != TRANSITION
        // 3. Setup = MATURE (or FORMING with LTF confirmation)
        const zone = triggerInfo.htf_zone || {}
        const zoneStrength = zone.strength || 0
        const hasStrongZone = zoneStrength >= 4

        // Dynamic threshold: 70+ or 65+ with strong zone
        if (score < 70 && !(score >= 65 && hasStrongZone)) {
            recordSuppressedTrigger(signal.symbol || 'BTC', `Score too low: ${score}`)
            return false
        }

        if (regime === 'TRANSITION') {
            recordSuppressedTrigger(signal.symbol || 'BTC', 'Regime is TRANSITION')
            return false
        }

        // Allow MATURE or FORMING with LTF confirmation
        const ltf = triggerInfo.ltf_confirmation || {}
        const isLtfConfirmed = ltf.confirmed || false

        if (setupState !== 'MATURE' && !(setupState === 'FORMING' && isLtfConfirmed)) {
            recordSuppressedTrigger(signal.symbol || 'BTC', `Setup not ready: ${setupState}`)
            return false
        }

        return true
    }

    /**
     * Build AI prompt (Senior Trader Reviewer format)
     * @param {Object} signal - Signal data with triggerInfo
     * @returns {String} - Prompt text
     */
    buildAiPrompt(signal) {
        if (!signal || !signal.triggerInfo) {
            return ''
        }

        const triggerInfo = signal.triggerInfo
        const zone = triggerInfo.htf_zone || {}
        const ltf = triggerInfo.ltf_confirmation || {}

        const systemPrompt = `Vai trò: Bạn là một chuyên gia giao dịch Swing Trading chuyên nghiệp với hơn 15 năm kinh nghiệm giao dịch BTC và thị trường crypto macro.

MỤC TIÊU: Đánh giá xem điều kiện thị trường hiện tại có đáng để *xem xét* một giao dịch swing hay không, dựa trên market regime, structure, liquidity và thời gian.

QUY TẮC NGHIÊM NGẶT:
- KHÔNG cung cấp entry price, stop loss, take profit, leverage, hoặc position size
- KHÔNG dự đoán mục tiêu giá chính xác
- KHÔNG ghi đè quyết định của trader
- Sử dụng giọng điệu bình tĩnh, thận trọng, chuyên nghiệp
- Mặc định NO_TRADE nếu điều kiện không rõ ràng thuận lợi

Bạn phải ưu tiên bảo toàn vốn hơn cơ hội.

QUAN TRỌNG - NGÔN NGỮ:
- Tất cả reasoning và invalidation_note PHẢI viết bằng TIẾNG VIỆT
- Sử dụng thuật ngữ chuyên ngành phù hợp (regime, structure, zone, setup, confirmation)
- Giải thích rõ ràng, ngắn gọn, dễ hiểu`

        const userInput = {
            regime: triggerInfo.regime || 'UNKNOWN',
            bias: triggerInfo.bias || 'NO_TRADE',
            htf_zone: zone.type ? `${zone.type} ${zone.priceRange ? `${(zone.priceRange[0] / 1000).toFixed(0)}k-${(zone.priceRange[1] / 1000).toFixed(0)}k` : ''} (strength ${zone.strength || 0}/5)` : 'None',
            setup_state: triggerInfo.setup_state || 'UNKNOWN',
            ltf_confirmation: ltf.confirmed || false,
            trigger_score: triggerInfo.trigger_score || 0,
            recent_price_action: signal.recentPriceAction || 'No recent price action data'
        }

        const prompt = `${systemPrompt}

DỮ LIỆU THỊ TRƯỜNG (${signal.symbol || 'BTC'}/USD):

1. MARKET REGIME (4H):
- Regime: ${triggerInfo.regime || 'UNKNOWN'}
- Bias: ${triggerInfo.bias || 'NO_TRADE'}

2. HTF ZONE:
- Zone Type: ${zone.type || 'None'}
- Price Range: ${zone.priceRange ? `${(zone.priceRange[0] / 1000).toFixed(0)}k - ${(zone.priceRange[1] / 1000).toFixed(0)}k` : 'N/A'}
- Strength: ${zone.strength || 0}/5

3. SETUP STATE:
- State: ${triggerInfo.setup_state || 'UNKNOWN'}

4. LTF CONFIRMATION:
- Confirmed: ${ltf.confirmed ? 'Có' : 'Không'}
- Signals: ${ltf.signals && ltf.signals.length > 0 ? ltf.signals.join(', ') : 'None'}

5. TRIGGER SCORE:
- Score: ${triggerInfo.trigger_score || 0}/100

6. RECENT PRICE ACTION:
${signal.recentPriceAction || 'No recent price action data'}

OUTPUT JSON (STRICT FORMAT):
{
  "verdict": "CONSIDER | NO_TRADE | AVOID",
  "confidence": 0-100,
  "reasoning": "Giải thích bằng tiếng Việt, ngắn gọn, chuyên nghiệp. Ưu tiên format đánh số 1. 2. 3. nếu có nhiều điểm",
  "invalidation_note": "Điều kiện nào sẽ làm mất hiệu lực ý tưởng này (bằng tiếng Việt)"
}

Nếu thông tin không đủ hoặc mâu thuẫn, trả về:
verdict = NO_TRADE`

        return prompt
    }

    /**
     * Parse AI decision (KHÔNG parse entry/SL/TP, chỉ parse verdict)
     * @param {Object} decision - AI decision JSON
     * @param {Number} currentPrice - Current price (not used for Swing01)
     * @returns {Object} - Parsed decision (verdict only)
     */
    parsePlan(decision, currentPrice) {
        // Swing01 is trigger-only, no entry/SL/TP
        // Just return the AI verdict
        return {
            verdict: decision.verdict || 'NO_TRADE',
            confidence: decision.confidence || 0,
            reasoning: decision.reasoning || '',
            invalidation_note: decision.invalidation_note || ''
        }
    }

    /**
     * Analyze market and return trigger info
     * This is called before checkConditions() to build signal
     * @param {string} symbol - Trading symbol
     * @returns {Object} Signal with triggerInfo
     */
    async analyzeMarket(symbol = 'BTC') {
        try {
            // 1. Fetch market data
            const market = await getSwingMarketSnapshot(symbol)
            if (!market) {
                throw new Error('Failed to fetch market data')
            }

            // 2. Calculate indicators
            const indicators = calcSwingIndicators(market, { excludeLastCandle: true })
            if (!indicators.tf4h || !indicators.tf1h || !indicators.tf30m) {
                throw new Error('Insufficient indicator data')
            }

            // 3. Market Regime Engine
            const regimeResult = analyzeRegime(indicators.tf4h, symbol)

            // 4. Bias Engine
            const biasResult = getBias(regimeResult.regime, symbol)

            // 5. HTF Zone Watcher
            const zones = detectZones(indicators.tf1d, indicators.tf4h, symbol, regimeResult.regime)
            const bestZone = getBestZone(symbol)

            // 6. Setup Analyzer
            const setupState = bestZone ? analyzeSetup(bestZone, indicators.tf4h, symbol) : { state: null, age: 0 }

            // 7. LTF Confirmation
            const ltfConfirmation = analyzeLTFConfirmation(
                indicators.tf1h,
                indicators.tf30m,
                market.candles_1h,
                market.candles_30m
            )

            // 8. Trigger Scoring
            const triggerScore = calculateTriggerScore(
                regimeResult,
                bestZone,
                setupState,
                ltfConfirmation,
                indicators.tf4h
            )

            // Record trigger
            recordTrigger(symbol, triggerScore.score)

            // Build trigger info
            const triggerInfo = {
                regime: regimeResult.regime,
                bias: biasResult.bias,
                htf_zone: bestZone ? {
                    type: bestZone.type,
                    priceRange: bestZone.priceRange,
                    strength: bestZone.strength
                } : null,
                setup_state: setupState.state,
                ltf_confirmation: {
                    confirmed: ltfConfirmation.confirmed,
                    signals: ltfConfirmation.signals
                },
                trigger_score: triggerScore.score,
                trigger_breakdown: triggerScore.breakdown
            }

            // Store for API response
            this.triggerInfo = triggerInfo

            return {
                symbol: symbol,
                price: market.price,
                triggerInfo: triggerInfo,
                recentPriceAction: `Price: ${market.price}, Regime: ${regimeResult.regime}, Score: ${triggerScore.score}`
            }

        } catch (error) {
            console.error(`[Swing01] Error analyzing market:`, error.message)
            // Fail-safe: return null, keep old state
            return null
        }
    }

    /**
     * Get trigger info (for API response)
     * @returns {Object|null} Trigger info
     */
    getTriggerInfo() {
        return this.triggerInfo
    }
}

