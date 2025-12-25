import { Scalp01 } from './Scalp01.js'
import { Scalp02 } from './Scalp02.js'
import { Swing01 } from './Swing01.js'

// Registry lưu trữ các strategy instance
const strategies = {
    SCALP_01: new Scalp01(),
    SCALP_02: new Scalp02(),
    SWING_01: new Swing01()
}

/**
 * Lấy danh sách các strategy active dựa trên config
 * @returns {Array<BaseStrategy>}
 */
export function getActiveStrategies() {
    // Có thể đọc từ env ACTIVE_STRATEGIES=SCALP_01,SCALP_02
    const activeNames = process.env.ACTIVE_STRATEGIES
        ? process.env.ACTIVE_STRATEGIES.split(',').map(s => s.trim())
        : ['SCALP_01'] // Default

    return activeNames
        .map(name => strategies[name])
        .filter(s => !!s) // Lọc bỏ strategy không tồn tại
}

export function getStrategy(name) {
    return strategies[name]
}
