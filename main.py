#!/usr/bin/env python3
"""
Hedging Trading Bot - Entry Point
"""

import asyncio
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Import bot
from bot import HedgingBot


async def main():
    """Main entry point"""
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


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n✅ Bot stopped")

