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
        # Config - Support both TRADE_TOKEN (single) and TRADE_TOKENS (multiple)
        tokens_str = os.getenv('TRADE_TOKENS') or os.getenv('TRADE_TOKEN', 'BTC')
        self.token_list = [t.strip() for t in tokens_str.split(',')]
        self.trade_token = None  # Will be selected each cycle
        
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
        
        # Balance tracking
        self.balance_before = None
        self.balance_after = None
    
    async def setup(self):
        """Initialize all clients"""
        print("🔧 Initializing exchange clients...")
        
        # Log server IP
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('https://api.ipify.org?format=json') as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        server_ip = data.get('ip')
                        print(f"🌐 Server IP: {server_ip}")
                        await self.telegram.send_message(f"🌐 Bot started on IP: {server_ip}")
        except Exception as e:
            print(f"⚠️ Could not get IP: {e}")
        
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
        
        if len(self.token_list) > 1:
            print(f"📊 Token Pool: {', '.join(self.token_list)} (random each cycle)")
        else:
            print(f"📊 Trading Pair: {self.token_list[0]}-USDT")
        
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
        # Random token selection (if multiple tokens configured)
        self.trade_token = random.choice(self.token_list)
        
        print(f"\n🎲 Selected token: {self.trade_token}-USDT")
        
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
    
    async def get_balances(self) -> dict:
        """Get current balances from both exchanges"""
        balances = {
            'lighter': None,
            'aster': None
        }
        
        try:
            # Get Lighter balance (USDC)
            lighter_result = await self.lighter.get_balance()
            if lighter_result.get('success'):
                balances['lighter'] = {
                    'asset': 'USDC',
                    'available': lighter_result.get('available', 0),
                    'total': lighter_result.get('wallet_balance', 0)
                }
            
            # Get Aster balance (USDT) if available
            if self.aster.client:
                aster_result = await self.aster.get_balance()
                if aster_result.get('success'):
                    balances['aster'] = {
                        'asset': 'USDT',
                        'available': aster_result.get('available', 0),
                        'total': aster_result.get('wallet_balance', 0)
                    }
        
        except Exception as e:
            print(f"⚠️ Error getting balances: {e}")
        
        return balances
    
    def format_balance_report(self, cycle: int, lighter_pnl: float = None, aster_pnl: float = None) -> str:
        """Format balance tracking report for Telegram"""
        if not self.balance_before or not self.balance_after:
            return ""
        
        lines = [f"📊 <b>CYCLE {cycle} COMPLETED</b>", ""]
        
        # Balance tracking section
        lines.append("💰 <b>BALANCE TRACKING:</b>")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        
        # Before opening
        lines.append("🟢 <b>Before Opening:</b>")
        
        lighter_before = self.balance_before.get('lighter')
        aster_before = self.balance_before.get('aster')
        
        if lighter_before:
            lines.append(f"  • Lighter (USDC): ${lighter_before['total']:,.2f}")
        if aster_before:
            lines.append(f"  • Aster (USDT): ${aster_before['total']:,.2f}")
        
        total_before = 0
        if lighter_before:
            total_before += lighter_before['total']
        if aster_before:
            total_before += aster_before['total']
        lines.append(f"  • <b>Total: ${total_before:,.2f}</b>")
        lines.append("")
        
        # After closing
        lines.append("🔴 <b>After Closing:</b>")
        
        lighter_after = self.balance_after.get('lighter')
        aster_after = self.balance_after.get('aster')
        
        if lighter_after:
            lines.append(f"  • Lighter (USDC): ${lighter_after['total']:,.2f}")
        if aster_after:
            lines.append(f"  • Aster (USDT): ${aster_after['total']:,.2f}")
        
        total_after = 0
        if lighter_after:
            total_after += lighter_after['total']
        if aster_after:
            total_after += aster_after['total']
        lines.append(f"  • <b>Total: ${total_after:,.2f}</b>")
        lines.append("")
        
        # Cost breakdown
        lines.append("💸 <b>COST BREAKDOWN:</b>")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        
        lighter_cost = 0
        aster_cost = 0
        
        if lighter_before and lighter_after:
            lighter_cost = lighter_before['total'] - lighter_after['total']
            lines.append(f"  • Lighter Fee: ${lighter_cost:,.2f}")
        
        if aster_before and aster_after:
            aster_cost = aster_before['total'] - aster_after['total']
            lines.append(f"  • Aster Fee: ${aster_cost:,.2f}")
        
        total_cost = lighter_cost + aster_cost
        cost_percent = (total_cost / total_before * 100) if total_before > 0 else 0
        lines.append(f"  • <b>Total Cost: ${total_cost:,.2f} ({cost_percent:.2f}%)</b>")
        lines.append("")
        
        # P&L section
        if lighter_pnl is not None or aster_pnl is not None:
            lines.append("📈 <b>P&amp;L:</b>")
            lines.append("━━━━━━━━━━━━━━━━━━━━")
            if lighter_pnl is not None:
                lines.append(f"  • Lighter: {lighter_pnl:+.2f}%")
            if aster_pnl is not None:
                lines.append(f"  • Aster: {aster_pnl:+.2f}%")
        
        return "\n".join(lines)
    
    async def close_positions(self):
        """
        Close all positions SEQUENTIALLY
        
        Flow:
        1. Close Lighter first (as it's sometimes unstable)
        2. If Lighter succeeds → close Aster
        3. If any fails → Send URGENT alert (money at risk!)
        """
        print(f"\n🔄 Closing positions...")
        
        lighter_result = None
        aster_result = None
        lighter_ok = False
        aster_ok = True  # Default true if Aster not used
        
        # Step 1: Close Lighter FIRST
        try:
            print(f"\n🔵 Step 1/2: Closing Lighter position...")
            lighter_result = await self.lighter.close_position(self.trade_token)
            lighter_ok = lighter_result.get('success', False)
            
            if lighter_ok:
                pnl = lighter_result.get('pnl_percent')
                print(f"✅ Lighter closed successfully" + (f" (P&L: {pnl:+.2f}%)" if pnl else ""))
            else:
                error = lighter_result.get('error', 'Unknown error')
                print(f"❌ Lighter close FAILED: {error}")
                
                # 🚨 CRITICAL: Send urgent alert
                await self.telegram.send_message(
                    f"🚨 <b>URGENT: LIGHTER CLOSE FAILED</b>\n\n"
                    f"⚠️ Position still OPEN on Lighter!\n"
                    f"❌ Error: {error}\n\n"
                    f"⚡ Action required: Close manually to avoid losses!"
                )
                
        except Exception as e:
            lighter_ok = False
            lighter_result = {'success': False, 'error': str(e)}
            print(f"❌ Lighter exception: {e}")
            
            await self.telegram.send_message(
                f"🚨 <b>URGENT: LIGHTER CLOSE EXCEPTION</b>\n\n"
                f"⚠️ Position still OPEN on Lighter!\n"
                f"❌ Exception: {str(e)}\n\n"
                f"⚡ Close manually NOW!"
            )
        
        # Step 2: Close Aster ONLY if Lighter succeeded
        if self.aster.client:
            if lighter_ok:
                try:
                    print(f"\n🟢 Step 2/2: Closing Aster position...")
                    aster_result = await self.aster.close_position()
                    aster_ok = aster_result.get('success', False)
                    
                    if aster_ok:
                        pnl = aster_result.get('pnl_percent')
                        print(f"✅ Aster closed successfully" + (f" (P&L: {pnl:+.2f}%)" if pnl else ""))
                    else:
                        error = aster_result.get('error', 'Unknown error')
                        print(f"❌ Aster close FAILED: {error}")
                        
                        # 🚨 CRITICAL: Send urgent alert
                        await self.telegram.send_message(
                            f"🚨 <b>URGENT: ASTER CLOSE FAILED</b>\n\n"
                            f"⚠️ Position still OPEN on Aster!\n"
                            f"✅ Lighter: Closed\n"
                            f"❌ Aster Error: {error}\n\n"
                            f"⚡ Action required: Close manually to avoid losses!"
                        )
                        
                except Exception as e:
                    aster_ok = False
                    aster_result = {'success': False, 'error': str(e)}
                    print(f"❌ Aster exception: {e}")
                    
                    await self.telegram.send_message(
                        f"🚨 <b>URGENT: ASTER CLOSE EXCEPTION</b>\n\n"
                        f"⚠️ Position still OPEN on Aster!\n"
                        f"✅ Lighter: Closed\n"
                        f"❌ Aster Exception: {str(e)}\n\n"
                        f"⚡ Close manually NOW!"
                    )
            else:
                # Lighter failed, skip Aster
                print(f"⚠️ Skipping Aster close (Lighter failed)")
                aster_ok = False
                aster_result = {'success': False, 'error': 'Skipped due to Lighter failure'}
        
        # Summary message (only if both succeeded or Aster not used)
        if lighter_ok and aster_ok:
            msg = []
            pnl = lighter_result.get('pnl_percent')
            msg.append(f"✅ Lighter: {pnl:+.2f}%" if pnl else "✅ Lighter closed")
            
            if self.aster.client and aster_result:
                pnl = aster_result.get('pnl_percent')
                msg.append(f"✅ Aster: {pnl:+.2f}%" if pnl else "✅ Aster closed")
            
            await self.telegram.send_message(f"🔄 Closed positions\n\n" + "\n".join(msg))
        
        # Return results for balance reporting
        return {
            'success': lighter_ok and aster_ok,
            'lighter_pnl': lighter_result.get('pnl_percent') if lighter_ok and lighter_result else None,
            'aster_pnl': aster_result.get('pnl_percent') if aster_ok and aster_result else None
        }
    
    async def run_cycle(self, cycle_number: int = 1):
        """Run one trading cycle with balance tracking"""
        # Get balance before opening
        print(f"\n💰 Getting balance before opening...")
        self.balance_before = await self.get_balances()
        
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
        
        close_result = await self.close_positions()
        
        # Get balance after closing
        print(f"\n💰 Getting balance after closing...")
        self.balance_after = await self.get_balances()
        
        # Send balance report to Telegram
        if self.balance_before and self.balance_after:
            report = self.format_balance_report(
                cycle=cycle_number,
                lighter_pnl=close_result.get('lighter_pnl'),
                aster_pnl=close_result.get('aster_pnl')
            )
            if report:
                await self.telegram.send_message(report)
        
        return close_result.get('success', False)
    
    async def run(self):
        """Main bot loop"""
        if not self.enabled:
            print("❌ Bot disabled")
            return
        
        await self.setup()
        self.print_config()
        
        token_info = f"Token Pool: {', '.join(self.token_list)}" if len(self.token_list) > 1 else f"Token: {self.token_list[0]}"
        await self.telegram.send_message(f"🤖 Hedging Bot Started\n\n{token_info}")
        
        cycle = 0
        while True:
            cycle += 1
            print(f"\n{'#' * 60}")
            print(f"# CYCLE {cycle}")
            print(f"{'#' * 60}")
            
            success = await self.run_cycle(cycle_number=cycle)
            
            if not success:
                print(f"❌ Cycle {cycle} failed")
            else:
                print(f"✅ Cycle {cycle} completed")
            
            if not self.auto_restart:
                break
            
            print(f"\n⏳ Waiting 30s before next cycle...")
            await asyncio.sleep(30)
        
        await self.telegram.send_message(f"🛑 Bot stopped\n\nTotal cycles: {cycle}")

