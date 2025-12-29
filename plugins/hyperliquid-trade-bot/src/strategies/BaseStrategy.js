/**
 * Base Strategy Class
 * Tất cả các strategy mới phải kế thừa class này
 */
import { parsePlan } from '../utils/parsePlan.js'

export class BaseStrategy {
    constructor(name = 'BASE_STRATEGY') {
        this.name = name
    }

    /**
     * Tên định danh của Strategy
     */
    getName() {
        return this.name
    }

    /**
     * Logic lọc tín hiệu kỹ thuật TRƯỚC khi gọi AI
     * Giúp tiết kiệm chi phí API
     * @param {Object} signal - Dữ liệu market đã normalize
     * @returns {Boolean} - True nếu đáng để gọi AI
     */
    checkConditions(signal) {
        throw new Error('Method checkConditions() must be implemented')
    }

    /**
     * Xây dựng Prompt để gửi cho AI
     * @param {Object} signal - Dữ liệu market
     * @returns {String} - Prompt text
     */
    buildAiPrompt(signal) {
        throw new Error('Method buildAiPrompt() must be implemented')
    }

    /**
     * Parse kết quả từ AI thành Plan chuẩn
     * @param {Object} decision - Kết quả JSON từ AI
     * @param {Number} currentPrice - Giá hiện tại
     * @returns {Object} - Trade Plan { entry, stop_loss, take_profit }
     */
    parsePlan(decision, currentPrice) {
        // Default parser (có thể override nếu strategy có format output khác)
        // Chuẩn hóa output plan cho tất cả strategy theo util chung
        return parsePlan(decision, currentPrice)
    }
}
