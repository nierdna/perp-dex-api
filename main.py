#!/usr/bin/env python3
"""
Trading Bot - Entry Point

Modes:
- IS_API=1: Run API server for 3rd party integration
- IS_WORKER=1: Run hedging bot worker (auto-hedging)
- Both: Run both API server and hedging worker
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()


def run_api_server():
    """Run API server mode"""
    import uvicorn
    from api_server import app
    
    # Railway cung cấp PORT env variable, ưu tiên PORT > API_PORT > 8080
    port = int(os.getenv('PORT', os.getenv('API_PORT', 8080)))
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║          🚀 TRADING API SERVER MODE                      ║
╠══════════════════════════════════════════════════════════╣
║  Port: {port}                                                ║
║  Docs: http://localhost:{port}/docs                        ║
║  Status: http://localhost:{port}/api/status                ║
╠══════════════════════════════════════════════════════════╣
║  Endpoints:                                              ║
║    POST /api/order/market - Place market order           ║
║    POST /api/order/limit  - Place limit order            ║
║    POST /api/order/close  - Close position               ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )


async def run_hedging_worker():
    """Run hedging bot worker mode"""
    from bot import HedgingBot
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║          🤖 HEDGING BOT WORKER MODE                      ║
╠══════════════════════════════════════════════════════════╣
║  Auto-hedging enabled                                    ║
║  Keys from ENV                                           ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    bot = HedgingBot()
    
    try:
        await bot.run()
    except KeyboardInterrupt:
        print("\n\n🛑 Stopped by user (Ctrl+C)")
        print("🔄 Closing any open positions...")
        try:
            result = await bot.close_positions()
            if result:
                print("✅ Positions closed successfully")
                await bot.telegram.send_message("🛑 Bot stopped by user\n✅ Positions closed")
            else:
                print("⚠️ Some positions may not be closed")
                await bot.telegram.send_message("🛑 Bot stopped\n⚠️ Check positions manually")
        except Exception as e:
            print(f"❌ Error closing positions: {e}")
            await bot.telegram.send_message(f"🛑 Bot stopped\n⚠️ Manual close needed: {e}")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        await bot.telegram.send_message(f"❌ Bot crashed: {str(e)}")


async def run_both_modes():
    """Run both API server and hedging worker"""
    import uvicorn
    from api_server import app
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║          🚀 HYBRID MODE - API + WORKER                   ║
╠══════════════════════════════════════════════════════════╣
║  API Server: Running                                     ║
║  Hedging Worker: Running                                 ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # Railway cung cấp PORT env variable, ưu tiên PORT > API_PORT > 8080
    port = int(os.getenv('PORT', os.getenv('API_PORT', 8080)))
    
    # Run API server in background
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    
    # Run both tasks
    await asyncio.gather(
        server.serve(),
        run_hedging_worker()
    )


def main():
    """Main entry point"""
    is_api = os.getenv('IS_API', '0') == '1'
    is_worker = os.getenv('IS_WORKER', '0') == '1'
    
    # Default: Worker mode if nothing specified
    if not is_api and not is_worker:
        is_worker = True
        print("⚠️ No mode specified, defaulting to WORKER mode")
    
    if is_api and is_worker:
        # Both modes
        try:
            asyncio.run(run_both_modes())
        except KeyboardInterrupt:
            print("\n✅ Stopped")
    elif is_api:
        # API server only
        try:
            run_api_server()
        except KeyboardInterrupt:
            print("\n✅ API Server stopped")
    elif is_worker:
        # Worker only
        try:
            asyncio.run(run_hedging_worker())
        except KeyboardInterrupt:
            print("\n✅ Worker stopped")


if __name__ == "__main__":
    main()

