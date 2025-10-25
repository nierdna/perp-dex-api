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
import aiohttp  # Only for Telegram notifications
from datetime import datetime

# Load environment variables
load_dotenv()

# Add perpsdex modules to path
sys.path.insert(0, str(Path(__file__).parent))

# Import Lighter modules directly
from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.order import OrderExecutor as LighterOrderExecutor
from perpsdex.lighter.core.market import MarketData as LighterMarketData
from perpsdex.lighter.core.risk import RiskManager as LighterRiskManager
from perpsdex.lighter.utils.calculator import Calculator as LighterCalculator
from perpsdex.lighter.utils.config import ConfigLoader as LighterConfigLoader

# Import Aster modules directly
from perpsdex.aster.core.client import AsterClient
from perpsdex.aster.core.order import OrderExecutor as AsterOrderExecutor
from perpsdex.aster.core.market import MarketData as AsterMarketData
from perpsdex.aster.core.risk import RiskManager as AsterRiskManager
from perpsdex.aster.utils.calculator import Calculator as AsterCalculator


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
        
        # Exchange clients (initialized in async setup)
        self.lighter_client = None
        self.aster_client = None
        
        # Order tracking - Store FULL order info để chỉ đóng orders mà bot mở
        self.lighter_order = None  # Full order response
        self.aster_order = None    # Full order response
        self.lighter_side = None
        self.aster_side = None
        
        # Track specific identifiers
        self.lighter_order_id = None
        self.lighter_market_id = None
        self.aster_order_id = None
        self.aster_symbol = None
    
    async def setup_clients(self):
        """Initialize exchange clients"""
        print("🔧 Initializing exchange clients...")
        
        # Initialize Lighter client
        lighter_private_key = os.getenv('LIGHTER_L1_PRIVATE_KEY') or os.getenv('LIGHTER_PRIVATE_KEY')
        lighter_account_index = int(os.getenv('ACCOUNT_INDEX', 0))
        
        if not lighter_private_key:
            raise ValueError("LIGHTER_L1_PRIVATE_KEY or LIGHTER_PRIVATE_KEY not found in .env")
        
        self.lighter_client = LighterClient(
            private_key=lighter_private_key,
            account_index=lighter_account_index,
            api_key_index=0
        )
        
        # Connect to Lighter
        result = await self.lighter_client.connect()
        if not result['success']:
            raise ValueError(f"Failed to connect to Lighter: {result.get('error')}")
        
        print("✅ Lighter client connected")
        
        # Initialize Aster client
        aster_api_key = os.getenv('ASTER_API_KEY')
        aster_secret_key = os.getenv('ASTER_SECRET_KEY')
        aster_api_url = os.getenv('ASTER_API_URL', 'https://fapi.asterdex.com')
        
        if aster_api_key and aster_secret_key:
            self.aster_client = AsterClient(
                api_url=aster_api_url,
                api_key=aster_api_key,
                secret_key=aster_secret_key
            )
            
            # Test Aster connection
            result = await self.aster_client.test_connection()
            if result['success']:
                print("✅ Aster client connected")
            else:
                print(f"⚠️ Aster connection failed: {result.get('error')}")
                self.aster_client = None
        else:
            print("⚠️ Aster credentials not found - running Lighter only")
            self.aster_client = None
    
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
        """Place order on Lighter DEX - Direct SDK call"""
        try:
            print(f"🔵 Placing {side.upper()} order on Lighter...")
            
            # Get market ID
            pair = f"{self.trade_token}-USDT"
            market_id = LighterConfigLoader.get_market_id_for_pair(pair)
            
            # Get market data
            market = LighterMarketData(
                self.lighter_client.get_order_api(),
                self.lighter_client.get_account_api()
            )
            
            # Get current price
            price_result = await market.get_price(market_id, self.trade_token)
            if not price_result['success']:
                return {
                    'success': False,
                    'exchange': 'lighter',
                    'side': side,
                    'error': 'Failed to get price'
                }
            
            entry_price = price_result['ask'] if side == 'long' else price_result['bid']
            
            # Place entry order
            executor = LighterOrderExecutor(
                self.lighter_client.get_signer_client(),
                self.lighter_client.get_order_api()
            )
            
            result = await executor.place_order(
                side=side,
                entry_price=entry_price,
                position_size_usd=self.position_size,
                market_id=market_id,
                symbol=self.trade_token,
                leverage=self.leverage
            )
            
            if not result['success']:
                return {
                    'success': False,
                    'exchange': 'lighter',
                    'side': side,
                    'error': result.get('error')
                }
            
            # Place TP/SL
            tp_sl_result = None
            if self.sl_percent and self.rr_ratio:
                sl_price = LighterCalculator.calculate_sl_from_percent(
                    entry_price, side, self.sl_percent
                )
                tp_sl_calc = LighterCalculator.calculate_tp_sl_from_rr_ratio(
                    entry_price, side, sl_price, self.rr_ratio
                )
                
                risk_manager = LighterRiskManager(
                    self.lighter_client.get_signer_client(),
                    self.lighter_client.get_order_api()
                )
                
                tp_sl_result = await risk_manager.place_tp_sl_orders(
                    entry_price=entry_price,
                    position_size=result['position_size'],
                    side=side,
                    tp_price=tp_sl_calc['tp_price'],
                    sl_price=sl_price,
                    market_id=market_id,
                    symbol=self.trade_token
                )
            
            print(f"✅ Lighter {side.upper()} order placed")
            print(f"🔍 DEBUG result keys: {result.keys()}")
            print(f"🔍 DEBUG order_id: {result.get('order_id')}")
            
            return {
                'success': True,
                'exchange': 'lighter',
                'side': side,
                'order_id': result.get('order_id'),  # client_order_index for cancellation
                'tx_hash': result.get('tx_hash'),
                'entry_price': result['entry_price'],
                'position_size': result['position_size'],
                'tp_sl': tp_sl_result
            }
            
        except Exception as e:
            print(f"❌ Lighter exception: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'exchange': 'lighter',
                'side': side,
                'error': str(e)
            }
    
    async def place_aster_order(self, side: str) -> dict:
        """Place order on Aster DEX - Direct SDK call"""
        try:
            print(f"🟠 Placing {side.upper()} order on Aster...")
            print(f"🔍 DEBUG: aster_client exists: {self.aster_client is not None}")
            
            if not self.aster_client:
                print("❌ Aster client not initialized")
                return {
                    'success': False,
                    'exchange': 'aster',
                    'side': side,
                    'error': 'Aster client not initialized'
                }
            
            symbol = f"{self.trade_token}-USDT"
            
            # Get market data
            market = AsterMarketData(self.aster_client)
            price_result = await market.get_price(symbol)
            
            if not price_result['success']:
                return {
                    'success': False,
                    'exchange': 'aster',
                    'side': side,
                    'error': 'Failed to get price'
                }
            
            # Use ask for long, bid for short
            entry_price = price_result['ask'] if side == 'long' else price_result['bid']
            
            # Place entry order
            executor = AsterOrderExecutor(self.aster_client)
            
            aster_side = 'BUY' if side == 'long' else 'SELL'
            result = await executor.place_market_order(
                symbol=symbol,
                side=aster_side,
                size=self.position_size / entry_price,  # Convert USD to size
                leverage=self.leverage
            )
            
            if not result['success']:
                return {
                    'success': False,
                    'exchange': 'aster',
                    'side': side,
                    'error': result.get('error')
                }
            
            # Place TP/SL
            tp_sl_result = None
            if self.sl_percent and self.rr_ratio:
                sl_price = AsterCalculator.calculate_sl_from_percent(
                    entry_price, aster_side, self.sl_percent
                )
                tp_sl_calc = AsterCalculator.calculate_tp_sl_from_rr_ratio(
                    entry_price, aster_side, sl_price, tuple(self.rr_ratio)
                )
                
                risk_manager = AsterRiskManager(self.aster_client, executor)
                
                tp_sl_result = await risk_manager.place_tp_sl(
                    symbol=symbol,
                    side=aster_side,
                    size=result['size'],
                    entry_price=entry_price,
                    tp_price=tp_sl_calc['tp_price'],
                    sl_price=sl_price
                )
            
            print(f"✅ Aster {side.upper()} order placed")
            
            # Get order_id for tracking
            order_id = result.get('order_id') or result.get('orderId')
            
            return {
                'success': True,
                'exchange': 'aster',
                'side': side,
                'order_id': order_id,  # For cancellation
                'entry_price': entry_price,
                'position_size': result.get('size'),
                'tp_sl': tp_sl_result
            }
            
        except Exception as e:
            print(f"❌ Aster exception: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'exchange': 'aster',
                'side': side,
                'error': str(e)
            }
    
    async def cancel_order(self, exchange: str, order_id: str, symbol: str = None) -> bool:
        """Cancel an order - Direct SDK call"""
        try:
            print(f"⚠️ Attempting to cancel {exchange} order {order_id}")
            
            if exchange.lower() == 'lighter':
                if not self.lighter_client:
                    print("❌ Lighter client not initialized")
                    return False
                
                # Get market_id
                pair = f"{symbol or self.trade_token}-USDT"
                market_id = LighterConfigLoader.get_market_id_for_pair(pair)
                
                # Cancel via SDK
                order, response, error = await self.lighter_client.get_signer_client().cancel_order(
                    market_index=market_id,
                    order_index=order_id
                )
                
                if error is None and response:
                    print(f"✅ Lighter order cancelled: {response.tx_hash}")
                    return True
                else:
                    print(f"❌ Failed to cancel Lighter order: {error}")
                    return False
            
            elif exchange.lower() == 'aster':
                if not self.aster_client:
                    print("❌ Aster client not initialized")
                    return False
                
                symbol_full = f"{symbol or self.trade_token}-USDT"
                
                # Cancel via Aster client
                result = await self.aster_client.cancel_order(
                    symbol=symbol_full,
                    order_id=order_id
                )
                
                if result.get('success'):
                    print(f"✅ Aster order cancelled")
                    return True
                else:
                    print(f"❌ Failed to cancel Aster order: {result.get('error')}")
                    return False
            
            else:
                print(f"❌ Unknown exchange: {exchange}")
            return False
        
        except Exception as e:
            print(f"❌ Exception cancelling {exchange} order: {e}")
            return False
    
    async def close_positions(self) -> bool:
        """Close all positions"""
        print(f"\n🔄 Closing all positions...")
        
        # Close positions on both exchanges simultaneously
        results = await asyncio.gather(
            self.close_lighter_position(),
            self.close_aster_position(),
            return_exceptions=True
        )
        
        lighter_result = results[0] if not isinstance(results[0], Exception) else {'success': False, 'error': str(results[0])}
        aster_result = results[1] if not isinstance(results[1], Exception) else {'success': False, 'error': str(results[1])}
        
        lighter_success = lighter_result.get('success', False)
        aster_success = aster_result.get('success', False)
        
        # Send Telegram notification
        status_msg = []
        if lighter_success:
            pnl = lighter_result.get('pnl_percent')
            pnl_str = f" (P&L: {pnl:+.2f}%)" if pnl else ""
            status_msg.append(f"✅ Lighter {self.lighter_side.upper()}: Closed{pnl_str}")
        else:
            error = lighter_result.get('error', 'Unknown')
            status_msg.append(f"❌ Lighter: {error}")
        
        if aster_success:
            pnl = aster_result.get('pnl_percent')
            pnl_str = f" (P&L: {pnl:+.2f}%)" if pnl else ""
            status_msg.append(f"✅ Aster {self.aster_side.upper()}: Closed{pnl_str}")
        else:
            error = aster_result.get('error', 'Unknown')
            status_msg.append(f"❌ Aster: {error}")
        
        await self.telegram.send_message(
            f"🔄 <b>Closing Positions</b>\n\n"
            f"Token: {self.trade_token}\n"
            f"Size: ${self.position_size}\n\n"
            + "\n".join(status_msg)
        )
        
        return lighter_success and aster_success
    
    async def close_lighter_position(self) -> dict:
        """Close Lighter position - CHỈ close position mà bot mở - Direct SDK"""
        try:
            # Verify có position được track không
            if not self.lighter_market_id:
                print(f"⚠️ No Lighter position tracked by this bot")
                return {
                    'success': False,
                    'error': 'No position tracked'
                }
            
            if not self.lighter_client:
                return {
                    'success': False,
                    'error': 'Lighter client not initialized'
                }
            
            print(f"🔵 Closing Lighter position (Market ID: {self.lighter_market_id})...")
            
            # Get current position
            account_api = self.lighter_client.get_account_api()
            account_index = int(os.getenv('ACCOUNT_INDEX', 0))
            
            account_result = await account_api.get_account_balance(account_index)
            if not account_result['success']:
                return {'success': False, 'error': 'Failed to get account balance'}
            
            # Find position for this market
            position = None
            for pos in account_result.get('positions', []):
                if pos['market_id'] == self.lighter_market_id:
                    position = pos
                    break
            
            if not position or position.get('size') == 0:
                print(f"⚠️ No open position found on market {self.lighter_market_id}")
                return {'success': False, 'error': 'Position already closed or not found'}
            
            position_size = position.get('size', 0)
            is_long = position_size > 0
            abs_size = abs(position_size)
            avg_entry_price = position.get('avg_entry_price', 0)
            
            # Get current price
            market = LighterMarketData(
                self.lighter_client.get_order_api(),
                self.lighter_client.get_account_api()
            )
            price_result = await market.get_price(self.lighter_market_id, self.trade_token)
            if not price_result['success']:
                return {'success': False, 'error': 'Failed to get current price'}
            
            current_price = price_result['mid']
            
            # Get market metadata
            metadata_result = await self.lighter_client.get_order_api().get_market_metadata(self.lighter_market_id)
            if not metadata_result['success']:
                return {'success': False, 'error': 'Failed to get market metadata'}
            
            size_decimals = metadata_result['size_decimals']
            price_decimals = metadata_result['price_decimals']
            
            # Calculate close order
            base_amount_int = LighterCalculator.scale_to_int(abs_size, size_decimals)
            
            if is_long:
                close_price = current_price * 0.97  # SELL 3% below
                is_ask = 1
            else:
                close_price = current_price * 1.03  # BUY 3% above
                is_ask = 0
            
            price_int = LighterCalculator.scale_to_int(close_price, price_decimals)
            client_order_index = int(time.time() * 1000)
            
            # Place close order
            order, response, error = await self.lighter_client.get_signer_client().create_order(
                self.lighter_market_id,
                client_order_index,
                base_amount_int,
                price_int,
                is_ask,
                self.lighter_client.get_signer_client().ORDER_TYPE_LIMIT,
                self.lighter_client.get_signer_client().ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only
                self.lighter_client.get_signer_client().NIL_TRIGGER_PRICE,
                self.lighter_client.get_signer_client().DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if error is None and response:
                # Calculate P&L
                pnl_percent = None
                if avg_entry_price > 0:
                    if is_long:
                        pnl_percent = ((current_price - avg_entry_price) / avg_entry_price) * 100
                    else:
                        pnl_percent = ((avg_entry_price - current_price) / avg_entry_price) * 100
                
                print(f"✅ Lighter position closed")
                print(f"   Market ID: {self.lighter_market_id}")
                print(f"   Side: {'LONG' if is_long else 'SHORT'}")
                if pnl_percent is not None:
                    print(f"   P&L: {pnl_percent:+.2f}%")
                
                # Clear tracking
                self.lighter_order_id = None
                self.lighter_market_id = None
                
                return {
                    'success': True,
                    'pnl_percent': pnl_percent
                }
            else:
                print(f"❌ Failed to close Lighter position: {error}")
                return {'success': False, 'error': str(error)}
        
        except Exception as e:
            print(f"❌ Exception closing Lighter position: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }
    
    async def close_aster_position(self) -> dict:
        """Close Aster position - CHỈ close position mà bot mở - Direct SDK"""
        try:
            # Verify có position được track không
            if not self.aster_symbol:
                print(f"⚠️ No Aster position tracked by this bot")
                return {
                    'success': False,
                    'error': 'No position tracked'
                }
            
            if not self.aster_client:
                return {
                    'success': False,
                    'error': 'Aster client not initialized'
                }
            
            print(f"🟠 Closing Aster position ({self.aster_symbol})...")
            
            # Get current position
            market = AsterMarketData(self.aster_client)
            position_result = await market.get_position(self.aster_symbol)
            
            if not position_result.get('success'):
                return {'success': False, 'error': 'Failed to get position'}
            
            position = position_result.get('position')
            if not position or float(position.get('positionAmt', 0)) == 0:
                print(f"⚠️ No open position found for {self.aster_symbol}")
                return {'success': False, 'error': 'Position already closed or not found'}
            
            position_size = float(position.get('positionAmt', 0))
            is_long = position_size > 0
            abs_size = abs(position_size)
            entry_price = float(position.get('entryPrice', 0))
            current_price = float(position.get('markPrice', entry_price))
            
            # Place close order (reverse side with reduce_only)
            executor = AsterOrderExecutor(self.aster_client)
            close_side = 'SELL' if is_long else 'BUY'
            
            result = await executor.place_market_order(
                symbol=self.aster_symbol,
                side=close_side,
                size=abs_size,
                reduce_only=True
            )
            
            if result.get('success'):
                # Calculate P&L
                pnl_percent = None
                if entry_price > 0 and current_price > 0:
                    if is_long:
                        pnl_percent = ((current_price - entry_price) / entry_price) * 100
                    else:
                        pnl_percent = ((entry_price - current_price) / entry_price) * 100
                
                print(f"✅ Aster position closed")
                print(f"   Symbol: {self.aster_symbol}")
                print(f"   Side: {'LONG' if is_long else 'SHORT'}")
                if pnl_percent is not None:
                    print(f"   P&L: {pnl_percent:+.2f}%")
                
                # Clear tracking
                self.aster_order_id = None
                self.aster_symbol = None
                
                return {
                    'success': True,
                    'pnl_percent': pnl_percent
                }
            else:
                print(f"❌ Failed to close Aster position: {result.get('error')}")
                return {'success': False, 'error': result.get('error')}
        
    except Exception as e:
            print(f"❌ Exception closing Aster position: {e}")
        import traceback
        traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }
    
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
            # ✅ Both orders successful - SAVE FULL INFO
            self.lighter_order = lighter_result
            self.aster_order = aster_result
            self.lighter_side = lighter_side
            self.aster_side = aster_side
            
            # Track specific IDs để chỉ đóng đúng positions này
            self.lighter_order_id = lighter_result.get('order_id')
            self.aster_order_id = aster_result.get('order_id')
            self.aster_symbol = f"{self.trade_token}-USDT"  # Aster format
            
            # Get market_id từ config cho Lighter
            from perpsdex.lighter.utils.config import ConfigLoader
            pair = f"{self.trade_token}-USDT"
            self.lighter_market_id = ConfigLoader.get_market_id_for_pair(pair)
            
            print(f"\n🎉 ✅ HEDGED POSITION OPENED SUCCESSFULLY!")
            print(f"\n📊 Lighter ({lighter_side.upper()}):")
            print(f"   Order ID: {lighter_result.get('order_id')}")
            print(f"   Market ID: {self.lighter_market_id}")
            print(f"   Entry: ${lighter_result.get('entry_price')}")
            print(f"   Size: {lighter_result.get('position_size')}")
            
            print(f"\n📊 Aster ({aster_side.upper()}):")
            print(f"   Order ID: {aster_result.get('order_id')}")
            print(f"   Symbol: {self.aster_symbol}")
            print(f"   Entry: ${aster_result.get('entry_price')}")
            print(f"   Size: {aster_result.get('position_size')}")
            
            print(f"\n🔐 Position Tracking Enabled:")
            print(f"   Bot will ONLY close these specific positions")
            print(f"   Other positions on same markets will NOT be affected")
            
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
        
        # Initialize clients first
        try:
            print("🔍 DEBUG: Starting setup_clients...")
            await self.setup_clients()
            print("🔍 DEBUG: setup_clients completed")
        except Exception as e:
            print(f"❌ Failed to setup clients: {e}")
            import traceback
            traceback.print_exc()
        return
    
        print("🔍 DEBUG: About to print config...")
        try:
            self.print_config()
            print("🔍 DEBUG: Config printed")
        except Exception as e:
            print(f"❌ Error printing config: {e}")
            import traceback
            traceback.print_exc()
        
        # Initial notification
        print("🔍 DEBUG: Sending Telegram notification...")
        try:
            await self.telegram.send_message(
                f"🤖 <b>Hedging Bot Started</b>\n\n"
                f"Token: {self.trade_token}\n"
                f"Position Size: ${self.position_size}\n"
                f"Leverage: {self.leverage}x\n"
                f"R:R: {self.rr_ratio[0]}:{self.rr_ratio[1]}\n"
                f"Time Options: {self.time_options} min\n"
                f"Auto Restart: {'✅' if self.auto_restart else '❌'}"
            )
            print("🔍 DEBUG: Telegram sent")
        except Exception as e:
            print(f"⚠️ Telegram notification failed: {e}")
        
        print("🔍 DEBUG: Starting main loop...")
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
