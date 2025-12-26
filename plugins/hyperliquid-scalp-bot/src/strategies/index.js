import { Scalp03 } from './Scalp03.js'
import { Scalp04 } from './Scalp04.js'
import { Swing01 } from './Swing01.js'

// Registry lưu trữ các strategy instance
const strategies = {
    SCALP_03: new Scalp03(),
    SCALP_04: new Scalp04(),
    SWING_01: new Swing01()
}

/**
 * Lấy danh sách các strategy active dựa trên config
 * @returns {Array<BaseStrategy>}
 */
export function getActiveStrategies() {
    // Có thể đọc từ env ACTIVE_STRATEGIES=SCALP_03,SCALP_04
    const activeNames = process.env.ACTIVE_STRATEGIES
        ? process.env.ACTIVE_STRATEGIES.split(',').map(s => s.trim())
        : ['SCALP_03'] // Default

    return activeNames
        .map(name => strategies[name])
        .filter(s => !!s) // Lọc bỏ strategy không tồn tại
}

export function getStrategy(name) {
    return strategies[name]
}
