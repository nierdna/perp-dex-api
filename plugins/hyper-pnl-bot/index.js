import 'dotenv/config';
import http from 'http';
import { startScheduler } from './src/scheduler.js';

const LOCK_PORT = 3333;

// Create a dummy server to lock the port
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hyperliquid PnL Bot is running.\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ FATAL ERROR: Port ${LOCK_PORT} is already in use!`);
        console.error(`⚠️  A PnL Bot instance is ALREADY RUNNING.`);
        console.error(`⚠️  To prevent double-messages, this new instance will shutdown now.\n`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});

server.listen(LOCK_PORT, () => {
    console.log(`🔒 Singleton Lock acquired on port ${LOCK_PORT}.`);
    console.log("Hyperliquid PnL Bot Starting...");
    startScheduler();
});
