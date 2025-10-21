#!/usr/bin/env python3
"""
Hedging Trading Bot - Market Neutral Strategy
Automatically opens opposite positions on Lighter and Aster DEX
"""

import asyncio
import os
import sys
import random
import time
from pathlib import Path
from dotenv import load_dotenv
import aiohttp
from datetime import datetime

# Load environment variables
load_dotenv()

# Add perpsdex modules to path
sys.path.append(str(Path(__file__).parent / "perpsdex" / "lighter"))
sys.path.append(str(Path(__file__).parent / "perpsdex" / "aster"))


class TelegramNotifier:
    """Telegram notification handler"""
    
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.enabled = os.getenv('TELEGRAM_ENABLED', 'false').lower() == 'true'
    
    async def send_message(self, message: str):
        """Send message to Telegram"""
        if not self.enabled or not self.bot_token or not self.chat_id:
            print(f"📱 Telegram disabled or not configured")
            return False
        
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json={
                    'chat_id': self.chat_id,
                    'text': message,
                    'parse_mode': 'HTML'
                }) as response:
                    if response.status == 200:
                        print(f"✅ Telegram notification sent")
                        return True
                    else:
                        print(f"❌ Telegram failed: {response.status}")
                        return False
        except Exception as e:
            print(f"❌ Telegram error: {e}")
            return False


class HedgingBot:
    """Main hedging bot orchestrator"""
    
    def __init__(self):
        # Load configuration from ENV
        self.trade_token = os.getenv('TRADE_TOKEN', 'BTC')
        self.position_size = float(os.getenv('POSITION_SIZE', '200'))
        self.leverage = int(os.getenv('LEVERAGE', '5'))
        self.sl_percent = float(os.getenv('SL_PERCENT', '3'))
        
        # Parse RR ratio
        rr_str = os.getenv('RR_RATIO', '1,2')
        self.rr_ratio = [int(x.strip()) for x in rr_str.split(',')]
        
        # Parse time options
        time_str = os.getenv('TIME_OPEN_CLOSE', '20,30,60')
        self.time_options = [int(x.strip()) for x in time_str.split(',')]
        
        # Bot state
        self.enabled = os.getenv('BOT_ENABLED', 'true').lower() == 'true'
        self.auto_restart = os.getenv('AUTO_RESTART', 'false').lower() == 'true'
        
        # Telegram
        self.telegram = TelegramNotifier()
        
        # Order tracking
        self.lighter_order = None
        self.aster_order = None
        self.lighter_side = None
        self.aster_side = None
    
    def print_config(self):
        """Print current configuration"""
        print("\n" + "=" * 60)
        print("🤖 HEDGING BOT - MARKET NEUTRAL STRATEGY")
        print("=" * 60)
        print(f"📊 Trading Pair: {self.trade_token}-USDT")
        print(f"💰 Total Position Size: ${self.position_size}")
        print(f"📈 Leverage: {self.leverage}x")
        print(f"🛡️ Stop Loss: {self.sl_percent}%")
        print(f"⚖️ R:R Ratio: {self.rr_ratio[0]}:{self.rr_ratio[1]}")
        print(f"⏱️ Time Options: {self.time_options} minutes")
        print(f"🔄 Auto Restart: {'✅' if self.auto_restart else '❌'}")
        print(f"📱 Telegram: {'✅' if self.telegram.enabled else '❌'}")
        print("=" * 60 + "\n")
    
    async def place_lighter_order(self, side: str) -> dict:
        """Place order on Lighter DEX"""
        try:
            print(f"🔵 Placing {side.upper()} order on Lighter...")
            
            # Use Lighter API
            api_url = os.getenv('LIGHTER_API_URL', 'http://localhost:8000')
            endpoint = f"{api_url}/api/orders/{side.lower()}"
            
            payload = {
                "symbol": self.trade_token,
                "size_usd": self.position_size,
                "leverage": self.leverage,
                "sl_percent": self.sl_percent,
                "rr_ratio": self.rr_ratio
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload) as response:
                    data = await response.json()
                    
                    if response.status == 200 and data.get('success'):
                        print(f"✅ Lighter {side.upper()} order placed: {data.get('order_id')}")
                        return {
                            'success': True,
                            'exchange': 'lighter',
                            'side': side,
                            'order_id': data.get('order_id'),
                            'entry_price': data.get('entry_price'),
                            'position_size': data.get('position_size'),
                            'tp_sl': data.get('tp_sl')
                        }
                    else:
                        error = data.get('detail', 'Unknown error')
                        print(f"❌ Lighter {side.upper()} failed: {error}")
                        return {
                            'success': False,
                            'exchange': 'lighter',
                            'side': side,
                            'error': error
                        }
        except Exception as e:
            print(f"❌ Lighter exception: {e}")
            return {
                'success': False,
                'exchange': 'lighter',
                'side': side,
                'error': str(e)
            }
    
    async def place_aster_order(self, side: str) -> dict:
        """Place order on Aster DEX"""
        try:
            print(f"🟠 Placing {side.upper()} order on Aster...")
            
            # Use Aster API
            api_url = os.getenv('ASTER_API_URL_LOCAL', 'http://localhost:8001')
            endpoint = f"{api_url}/api/orders/{side.lower()}"
            
            payload = {
                "symbol": f"{self.trade_token}-USDT",
                "size_usd": self.position_size,
                "leverage": self.leverage,
                "sl_percent": self.sl_percent,
                "rr_ratio": self.rr_ratio
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload) as response:
                    data = await response.json()
                    
                    if response.status == 200 and data.get('success'):
                        print(f"✅ Aster {side.upper()} order placed: {data.get('order_id')}")
                        return {
                            'success': True,
                            'exchange': 'aster',
                            'side': side,
                            'order_id': data.get('order_id'),
                            'entry_price': data.get('entry_price'),
                            'position_size': data.get('position_size'),
                            'tp_sl': data.get('tp_sl')
                        }
                    else:
                        error = data.get('detail', 'Unknown error')
                        print(f"❌ Aster {side.upper()} failed: {error}")
                        return {
                            'success': False,
                            'exchange': 'aster',
                            'side': side,
                            'error': error
                        }
        except Exception as e:
            print(f"❌ Aster exception: {e}")
            return {
                'success': False,
                'exchange': 'aster',
                'side': side,
                'error': str(e)
            }
    
    async def cancel_order(self, exchange: str, order_id: str) -> bool:
        """Cancel an order (TODO: implement cancel endpoint)"""
        print(f"⚠️ Attempting to cancel {exchange} order {order_id}")
        print(f"⚠️ Cancel endpoint not implemented yet - please cancel manually!")
        return False
    
    async def close_positions(self) -> bool:
        """Close all positions (TODO: implement close endpoint)"""
        print(f"\n🔄 Closing all positions...")
        print(f"⚠️ Close endpoint not implemented yet - positions will close via TP/SL!")
        
        # Send Telegram notification
        await self.telegram.send_message(
            f"🔄 <b>Closing Positions</b>\n\n"
            f"Token: {self.trade_token}\n"
            f"Lighter: {self.lighter_side.upper() if self.lighter_side else 'N/A'}\n"
            f"Aster: {self.aster_side.upper() if self.aster_side else 'N/A'}\n"
            f"Size: ${self.position_size}\n\n"
            f"⚠️ Positions will close via TP/SL orders"
        )
        
        return True
    
    async def open_hedged_positions(self):
        """Open hedged positions on both exchanges"""
        
        # Randomly choose direction for Lighter (50/50)
        lighter_side = random.choice(['long', 'short'])
        aster_side = 'short' if lighter_side == 'long' else 'long'
        
        print(f"\n🎲 Random strategy:")
        print(f"   Lighter: {lighter_side.upper()}")
        print(f"   Aster: {aster_side.upper()}")
        
        # Place orders simultaneously
        print(f"\n⚡ Placing orders simultaneously...")
        results = await asyncio.gather(
            self.place_lighter_order(lighter_side),
            self.place_aster_order(aster_side),
            return_exceptions=True
        )
        
        lighter_result = results[0] if not isinstance(results[0], Exception) else {'success': False, 'error': str(results[0])}
        aster_result = results[1] if not isinstance(results[1], Exception) else {'success': False, 'error': str(results[1])}
        
        # Check if both succeeded
        lighter_success = lighter_result.get('success', False)
        aster_success = aster_result.get('success', False)
        
        if lighter_success and aster_success:
            # ✅ Both orders successful
            self.lighter_order = lighter_result
            self.aster_order = aster_result
            self.lighter_side = lighter_side
            self.aster_side = aster_side
            
            print(f"\n🎉 ✅ HEDGED POSITION OPENED SUCCESSFULLY!")
            print(f"\n📊 Lighter ({lighter_side.upper()}):")
            print(f"   Order ID: {lighter_result.get('order_id')}")
            print(f"   Entry: ${lighter_result.get('entry_price')}")
            print(f"   Size: {lighter_result.get('position_size')}")
            
            print(f"\n📊 Aster ({aster_side.upper()}):")
            print(f"   Order ID: {aster_result.get('order_id')}")
            print(f"   Entry: ${aster_result.get('entry_price')}")
            print(f"   Size: {aster_result.get('position_size')}")
            
            # Send Telegram success
            await self.telegram.send_message(
                f"✅ <b>Opened hedged position</b>\n\n"
                f"Token: {self.trade_token}\n"
                f"Size: ${self.position_size}\n"
                f"Leverage: {self.leverage}x\n\n"
                f"🔵 Lighter: {lighter_side.upper()}\n"
                f"   Entry: ${lighter_result.get('entry_price'):.2f}\n"
                f"   Order: {lighter_result.get('order_id')}\n\n"
                f"🟠 Aster: {aster_side.upper()}\n"
                f"   Entry: ${aster_result.get('entry_price'):.2f}\n"
                f"   Order: {aster_result.get('order_id')}"
            )
            
            return True
            
        else:
            # ❌ At least one order failed - ROLLBACK
            print(f"\n❌ HEDGE FAILED - ROLLING BACK!")
            
            if lighter_success:
                print(f"⚠️ Lighter order succeeded but Aster failed")
                print(f"⚠️ Need to cancel Lighter order: {lighter_result.get('order_id')}")
                await self.cancel_order('lighter', lighter_result.get('order_id'))
            
            if aster_success:
                print(f"⚠️ Aster order succeeded but Lighter failed")
                print(f"⚠️ Need to cancel Aster order: {aster_result.get('order_id')}")
                await self.cancel_order('aster', aster_result.get('order_id'))
            
            # Send Telegram failure
            error_msg = []
            if not lighter_success:
                error_msg.append(f"Lighter: {lighter_result.get('error', 'Unknown')}")
            if not aster_success:
                error_msg.append(f"Aster: {aster_result.get('error', 'Unknown')}")
            
            await self.telegram.send_message(
                f"❌ <b>Failed to open hedged position</b>\n\n"
                f"Token: {self.trade_token}\n"
                f"Size: ${self.position_size}\n\n"
                f"Errors:\n" + "\n".join(error_msg) + "\n\n"
                f"⚠️ Manual intervention may be required!"
            )
            
            return False
    
    async def run_cycle(self):
        """Run one trading cycle"""
        
        # Step 1: Open hedged positions
        print(f"\n{'=' * 60}")
        print(f"🚀 OPENING HEDGED POSITIONS")
        print(f"{'=' * 60}")
        
        success = await self.open_hedged_positions()
        
        if not success:
            print(f"\n❌ Failed to open positions - aborting cycle")
            return False
        
        # Step 2: Random wait time
        wait_time = random.choice(self.time_options)
        print(f"\n⏰ Positions will be held for {wait_time} minutes")
        print(f"   Close time: {datetime.now().strftime('%H:%M:%S')} + {wait_time}m")
        
        # Wait (with progress updates every minute)
        for i in range(wait_time):
            remaining = wait_time - i
            print(f"⏳ {remaining} minutes remaining...", end='\r')
            await asyncio.sleep(60)
        
        print(f"\n⏰ Time's up! Closing positions...")
        
        # Step 3: Close positions
        await self.close_positions()
        
        return True
    
    async def run(self):
        """Main bot loop"""
        
        if not self.enabled:
            print("❌ Bot is disabled (BOT_ENABLED=false)")
            return
        
        self.print_config()
        
        # Initial notification
        await self.telegram.send_message(
            f"🤖 <b>Hedging Bot Started</b>\n\n"
            f"Token: {self.trade_token}\n"
            f"Position Size: ${self.position_size}\n"
            f"Leverage: {self.leverage}x\n"
            f"R:R: {self.rr_ratio[0]}:{self.rr_ratio[1]}\n"
            f"Time Options: {self.time_options} min\n"
            f"Auto Restart: {'✅' if self.auto_restart else '❌'}"
        )
        
        cycle_count = 0
        
        while True:
            cycle_count += 1
            print(f"\n{'#' * 60}")
            print(f"# CYCLE {cycle_count}")
            print(f"{'#' * 60}")
            
            success = await self.run_cycle()
            
            if not success:
                print(f"\n❌ Cycle {cycle_count} failed")
            else:
                print(f"\n✅ Cycle {cycle_count} completed")
            
            if not self.auto_restart:
                print(f"\n🛑 Auto-restart disabled - stopping bot")
                break
            
            # Wait a bit before next cycle
            print(f"\n⏳ Waiting 30 seconds before next cycle...")
            await asyncio.sleep(30)
        
        # Final notification
        await self.telegram.send_message(
            f"🛑 <b>Hedging Bot Stopped</b>\n\n"
            f"Total cycles: {cycle_count}"
        )


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
