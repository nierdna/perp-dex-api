import http from '../utils/httpClient.js'

const NEWS_API_URL = 'https://divine-insight-production.up.railway.app/events'

export async function getTodaysNews() {
    try {
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const todayStr = today.toISOString().split('T')[0]
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        // Gọi song song 2 ngày
        const [resToday, resTomorrow] = await Promise.all([
            http.get(`${NEWS_API_URL}?date=${todayStr}`, { headers: { 'accept': 'application/json' } }),
            http.get(`${NEWS_API_URL}?date=${tomorrowStr}`, { headers: { 'accept': 'application/json' } })
        ])

        const allEvents = [...(resToday.data || []), ...(resTomorrow.data || [])]

        // Lọc tin tức quan trọng (Medium/High Impact) & liên quan đến USD/Crypto
        const importantEvents = allEvents.filter(e => {
            const isImpactful = e.impact === 'high' || e.impact === 'medium'
            const isRelevant = ['US', 'EU', 'CN'].includes(e.country) || e.title.includes('Fed') || e.title.includes('CPI')
            return isImpactful && isRelevant
        })

        // Sắp xếp theo giờ
        return importantEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
    } catch (error) {
        console.warn('⚠️ Fetch News Error:', error.message)
        return [] // Không crash bot nếu lỗi news
    }
}
