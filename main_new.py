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
        print("\n🛑 Stopped by user")
        await bot.telegram.send_message("🛑 Bot stopped by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        await bot.telegram.send_message(f"❌ Bot crashed: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())

