import 'dotenv/config'
import { runScalp } from './bot/scalpEngine.js'

setInterval(runScalp, 60_000)
console.log('🚀 Scalp bot started')