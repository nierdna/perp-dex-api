"""
Hedging Bot Main Orchestrator
"""

import asyncio
import os
import random
from datetime import datetime

from .telegram import TelegramNotifier
from .lighter_trader import LighterTrader
from .aster_trader import AsterTrader


class HedgingBot:
    """Main hedging bot orchestrator"""
    
    def __init__(self):
        # Config
        self.trade_token = os.getenv('TRADE_TOKEN', 'BTC')
        self.position_size = float(os.getenv('POSITION_SIZE', '50'))
        self.leverage = int(os.getenv('LEVERAGE', '5'))
        self.sl_percent = float(os.getenv('SL_PERCENT', '10'))
        
        # Shared position size (in BTC) to ensure exact match
        self.btc_size = None
        
        rr_str = os.getenv('RR_RATIO', '1,2')
        self.rr_ratio = [int(x.strip()) for x in rr_str.split(',')]
        
        time_str = os.getenv('TIME_OPEN_CLOSE', '20,30,60')
        self.time_options = [int(x.strip()) for x in time_str.split(',')]
        
        self.enabled = os.getenv('BOT_ENABLED', 'true').lower() == 'true'
        self.auto_restart = os.getenv('AUTO_RESTART', 'false').lower() == 'true'
        
        # Components
        self.telegram = TelegramNotifier()
        self.lighter = LighterTrader()
        self.aster = AsterTrader()
        
        # State
        self.lighter_side = None
        self.aster_side = None
    
    async def setup(self):
        """Initialize all clients"""
        print("🔧 Initializing exchange clients...")
        
        await self.lighter.setup()
        
        aster_ok = await self.aster.setup()
        if not aster_ok:
            self.aster.client = None  # Explicitly mark as not available
            print("⚠️ Running Lighter only mode")
    
    def print_config(self):
        """Print configuration"""
        print("\n" + "=" * 60)
        print("🤖 HEDGING BOT - MARKET NEUTRAL STRATEGY")
        print("=" * 60)
        print(f"📊 Trading Pair: {self.trade_token}-USDT")
        print(f"💰 Position Size: ${self.position_size} per exchange")
        print(f"📈 Leverage: {self.leverage}x")
        print(f"🛡️ Stop Loss: {self.sl_percent}%")
        print(f"⚖️ R:R Ratio: {self.rr_ratio[0]}:{self.rr_ratio[1]}")
        print(f"⏱️ Time: {self.time_options} minutes")
        print(f"🔄 Auto Restart: {'✅' if self.auto_restart else '❌'}")
        print(f"📱 Telegram: {'✅' if self.telegram.enabled else '❌'}")
        print("=" * 60 + "\n")
    
    async def open_positions(self):
        """Open hedged positions"""
        # Random strategy
        self.lighter_side = random.choice(['long', 'short'])
        self.aster_side = 'short' if self.lighter_side == 'long' else 'long'
        
        if self.aster.client:
            print(f"\n🎲 Strategy: Lighter {self.lighter_side.upper()} + Aster {self.aster_side.upper()}")
            print(f"⚡ Placing orders simultaneously...")
        else:
            print(f"\n🎲 Strategy: Lighter {self.lighter_side.upper()} ONLY (Aster disabled)")
            print(f"⚡ Placing Lighter order...")
        
        # Place orders
        if self.aster.client:
            results = await asyncio.gather(
                self.lighter.place_order(self.lighter_side, self.trade_token, self.position_size, self.leverage, self.sl_percent, self.rr_ratio),
                self.aster.place_order(self.aster_side, self.trade_token, self.position_size, self.leverage, self.sl_percent, self.rr_ratio),
                return_exceptions=True
            )
            lighter_result = results[0] if not isinstance(results[0], Exception) else {'success': False, 'error': str(results[0])}
            aster_result = results[1] if not isinstance(results[1], Exception) else {'success': False, 'error': str(results[1])}
        else:
            # Lighter only
            lighter_result = await self.lighter.place_order(
                self.lighter_side, self.trade_token, self.position_size, 
                self.leverage, self.sl_percent, self.rr_ratio
            )
            if isinstance(lighter_result, Exception):
                lighter_result = {'success': False, 'error': str(lighter_result)}
            aster_result = {'success': True}  # No Aster = success
        
        lighter_ok = lighter_result.get('success', False)
        aster_ok = aster_result.get('success', False) if self.aster.client else True
        
        if lighter_ok and aster_ok:
            mode = "hedged" if self.aster.client else "single exchange"
            print(f"\n🎉 Positions opened successfully ({mode})!")
            
            msg = f"✅ <b>Opened positions</b>\n\nToken: {self.trade_token}\nSize: ${self.position_size}\nLighter: {self.lighter_side.upper()}"
            if self.aster.client:
                msg += f"\nAster: {self.aster_side.upper()}"
            
            await self.telegram.send_message(msg)
            return True
        else:
            # Rollback
            print(f"\n❌ FAILED - ROLLING BACK!")
            if not lighter_ok:
                print(f"   Lighter error: {lighter_result.get('error')}")
            if self.aster.client and not aster_ok:
                print(f"   Aster error: {aster_result.get('error')}")
            
            if lighter_ok:
                print(f"⚠️ Cancelling Lighter order...")
                await self.lighter.cancel_order(lighter_result.get('order_id'), self.trade_token)
            
            if self.aster.client and aster_ok:
                print(f"⚠️ Cancelling Aster order...")
                await self.aster.cancel_order(aster_result.get('order_id'), self.trade_token)
            
            await self.telegram.send_message(f"❌ Failed to open positions")
            return False
    
    async def close_positions(self):
        """Close all positions"""
        print(f"\n🔄 Closing positions...")
        
        results = await asyncio.gather(
            self.lighter.close_position(self.trade_token),
            self.aster.close_position() if self.aster.client else asyncio.sleep(0),
            return_exceptions=True
        )
        
        lighter_result = results[0] if not isinstance(results[0], Exception) else {'success': False, 'error': str(results[0])}
        aster_result = results[1] if not isinstance(results[1], Exception) and self.aster.client else {'success': True}
        
        lighter_ok = lighter_result.get('success', False)
        aster_ok = aster_result.get('success', False) if self.aster.client else True
        
        msg = []
        if lighter_ok:
            pnl = lighter_result.get('pnl_percent')
            msg.append(f"✅ Lighter: {pnl:+.2f}%" if pnl else "✅ Lighter closed")
            print(f"✅ Lighter closed successfully" + (f" (P&L: {pnl:+.2f}%)" if pnl else ""))
        else:
            error = lighter_result.get('error', 'Unknown error')
            msg.append(f"❌ Lighter: {error}")
            print(f"❌ Lighter close failed: {error}")
        
        if self.aster.client:
            if aster_ok:
                pnl = aster_result.get('pnl_percent')
                msg.append(f"✅ Aster: {pnl:+.2f}%" if pnl else "✅ Aster closed")
                print(f"✅ Aster closed successfully" + (f" (P&L: {pnl:+.2f}%)" if pnl else ""))
            else:
                error = aster_result.get('error', 'Unknown error')
                msg.append(f"❌ Aster: {error}")
                print(f"❌ Aster close failed: {error}")
        
        await self.telegram.send_message(f"🔄 Closed positions\n\n" + "\n".join(msg))
        
        return lighter_ok and aster_ok
    
    async def run_cycle(self):
        """Run one trading cycle"""
        print(f"\n{'=' * 60}")
        print(f"🚀 OPENING POSITIONS")
        print(f"{'=' * 60}")
        
        if not await self.open_positions():
            return False
        
        # Wait
        wait_time = random.choice(self.time_options)
        print(f"\n⏰ Holding for {wait_time} minutes...")
        
        for i in range(wait_time):
            remaining = wait_time - i
            print(f"⏳ {remaining} min remaining...", end='\r')
            await asyncio.sleep(60)
        
        print(f"\n⏰ Time's up! Closing...")
        
        await self.close_positions()
        
        return True
    
    async def run(self):
        """Main bot loop"""
        if not self.enabled:
            print("❌ Bot disabled")
            return
        
        await self.setup()
        self.print_config()
        
        await self.telegram.send_message(f"🤖 Hedging Bot Started\n\nToken: {self.trade_token}")
        
        cycle = 0
        while True:
            cycle += 1
            print(f"\n{'#' * 60}")
            print(f"# CYCLE {cycle}")
            print(f"{'#' * 60}")
            
            success = await self.run_cycle()
            
            if not success:
                print(f"❌ Cycle {cycle} failed")
            else:
                print(f"✅ Cycle {cycle} completed")
            
            if not self.auto_restart:
                break
            
            print(f"\n⏳ Waiting 30s before next cycle...")
            await asyncio.sleep(30)
        
        await self.telegram.send_message(f"🛑 Bot stopped\n\nTotal cycles: {cycle}")

