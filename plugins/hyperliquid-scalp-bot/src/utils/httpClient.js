import axios from 'axios'

const timeout = parseInt(process.env.HTTP_TIMEOUT_MS || '12000')

/**
 * Shared Axios client with sane defaults:
 * - timeout to avoid hanging cycles
 */
const http = axios.create({
  timeout: Number.isFinite(timeout) ? timeout : 12000,
})

export default http


