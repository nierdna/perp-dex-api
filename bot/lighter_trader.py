"""
Lighter DEX Trader
Handles all Lighter trading operations
"""

import os
import time
import sys
from pathlib import Path

# Add perpsdex to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.order import OrderExecutor
from perpsdex.lighter.core.market import MarketData
from perpsdex.lighter.core.risk import RiskManager
from perpsdex.lighter.utils.calculator import Calculator
from perpsdex.lighter.utils.config import ConfigLoader


class LighterTrader:
    """Handles Lighter DEX trading operations"""
    
    def __init__(self):
        self.client = None
        self.market_id = None
        self.order_id = None
        self.position_size = None  # Track size when opening
        self.side = None  # Track side when opening
    
    async def setup(self):
        """Initialize Lighter client"""
        private_key = os.getenv('LIGHTER_L1_PRIVATE_KEY') or os.getenv('LIGHTER_PRIVATE_KEY')
        account_index = int(os.getenv('ACCOUNT_INDEX', 0))
        
        if not private_key:
            raise ValueError("LIGHTER_PRIVATE_KEY not found in .env")
        
        self.client = LighterClient(
            private_key=private_key,
            account_index=account_index,
            api_key_index=0
        )
        
        result = await self.client.connect()
        if not result['success']:
            raise ValueError(f"Failed to connect to Lighter: {result.get('error')}")
        
        print("✅ Lighter client connected")
    
    async def place_order(self, side: str, symbol: str, size_usd: float, leverage: int, sl_percent: float, rr_ratio: list) -> dict:
        """Place order on Lighter"""
        try:
            # Get market ID
            pair = f"{symbol}-USDT"
            market_id = ConfigLoader.get_market_id_for_pair(pair)
            
            # Get price
            market = MarketData(self.client.get_order_api(), self.client.get_account_api())
            price_result = await market.get_price(market_id, symbol)
            
            if not price_result['success']:
                return {'success': False, 'error': 'Failed to get price'}
            
            entry_price = price_result['ask'] if side == 'long' else price_result['bid']
            
            # Place entry order
            executor = OrderExecutor(self.client.get_signer_client(), self.client.get_order_api())
            result = await executor.place_order(
                side=side,
                entry_price=entry_price,
                position_size_usd=size_usd,
                market_id=market_id,
                symbol=symbol,
                leverage=leverage
            )
            
            if not result['success']:
                return result
            
            # Place TP/SL
            if sl_percent and rr_ratio:
                sl_price = Calculator.calculate_sl_from_percent(entry_price, side, sl_percent)
                tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(entry_price, side, sl_price, rr_ratio)
                
                risk_manager = RiskManager(self.client.get_signer_client(), self.client.get_order_api())
                await risk_manager.place_tp_sl_orders(
                    entry_price=entry_price,
                    position_size=result['position_size'],
                    side=side,
                    tp_price=tp_sl_calc['tp_price'],
                    sl_price=sl_price,
                    market_id=market_id,
                    symbol=symbol
                )
            
            # Save tracking info
            self.market_id = market_id
            self.order_id = result.get('order_id')
            self.position_size = result.get('position_size')  # Save for close
            self.side = side  # Save for close
            
            print(f"\n📝 Lighter Position Tracking:")
            print(f"   market_id: {self.market_id}")
            print(f"   order_id: {self.order_id}")
            print(f"   position_size: {self.position_size}")
            print(f"   side: {self.side}")
            
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    async def cancel_order(self, order_id: int, symbol: str) -> bool:
        """Cancel an order"""
        try:
            pair = f"{symbol}-USDT"
            market_id = ConfigLoader.get_market_id_for_pair(pair)
            
            order, response, error = await self.client.get_signer_client().cancel_order(
                market_index=market_id,
                order_index=order_id
            )
            
            if error is None and response:
                print(f"✅ Lighter order cancelled: {response.tx_hash}")
                return True
            else:
                print(f"❌ Failed to cancel: {error}")
                return False
                
        except Exception as e:
            print(f"❌ Exception: {e}")
            return False
    
    async def get_balance(self) -> dict:
        """Get USDC balance from Lighter"""
        try:
            if not self.client:
                return {'success': False, 'error': 'Client not initialized'}
            
            market = MarketData(self.client.get_order_api(), self.client.get_account_api())
            result = await market.get_balance()
            
            # Return in same format as Aster for consistency
            if result['success']:
                return {
                    'success': True,
                    'asset': 'USDC',
                    'available': result['available'],
                    'total': result['total'],
                    'wallet_balance': result['total']
                }
            else:
                return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    async def close_position(self, symbol: str) -> dict:
        """Close tracked position"""
        try:
            print(f"\n🔍 DEBUG Lighter close_position:")
            print(f"   tracked market_id: {self.market_id}")
            print(f"   symbol: {symbol}")
            
            if not self.market_id:
                return {'success': False, 'error': 'No position tracked'}
            
            # Get positions
            market = MarketData(self.client.get_order_api(), self.client.get_account_api())
            account_index = int(os.getenv('ACCOUNT_INDEX', 0))
            positions_result = await market.get_positions(account_index)
            
            if not positions_result.get('success'):
                print(f"   ❌ Failed to get positions")
                return {'success': False, 'error': 'Failed to get positions'}
            
            print(f"   ✅ Got positions, checking...")
            all_positions = positions_result.get('positions', [])
            print(f"   Total positions: {len(all_positions)}")
            
            for i, pos in enumerate(all_positions):
                print(f"   Position {i+1}: market_id={pos.get('market_id')}, size={pos.get('size')}")
            
            position = None
            for pos in all_positions:
                if pos['market_id'] == self.market_id:
                    position = pos
                    break
            
            if not position:
                print(f"   ❌ Position with market_id={self.market_id} not found in list!")
                print(f"   💡 TIP: Position might have been closed by TP/SL or manually")
                return {'success': False, 'error': 'Position not found'}
            
            pos_size = position.get('size', 0)
            
            # ✅ FIX: Lighter API bug - use tracked size if API returns 0
            if pos_size == 0:
                print(f"   ⚠️ WARNING: API reports size=0 but position exists!")
                print(f"   💡 Using tracked size from open: {self.position_size}")
                if not self.position_size or not self.side:
                    return {'success': False, 'error': 'No tracked size - cannot close'}
                
                # Use tracked values
                position_size = self.position_size if self.side == 'long' else -self.position_size
                is_long = self.side == 'long'
                abs_size = self.position_size
            else:
                print(f"   ✅ Found position: size={pos_size}")
                position_size = pos_size
                is_long = position_size > 0
                abs_size = abs(position_size)
            
            # Get price
            price_result = await market.get_price(self.market_id, symbol)
            
            if not price_result['success']:
                return {'success': False, 'error': 'Failed to get price'}
            
            current_price = price_result['mid']
            
            # Get metadata using order_book_details
            details = await self.client.get_order_api().order_book_details(market_id=self.market_id)
            if not details or not details.order_book_details:
                return {'success': False, 'error': 'Failed to get market metadata'}
            
            ob = details.order_book_details[0]
            size_decimals = ob.size_decimals
            price_decimals = ob.price_decimals
            
            # Calculate close order
            base_amount_int = Calculator.scale_to_int(abs_size, size_decimals)
            close_price = current_price * (0.97 if is_long else 1.03)
            price_int = Calculator.scale_to_int(close_price, price_decimals)
            
            print(f"   🔄 Closing {abs_size} BTC at ${close_price:,.2f}...")
            
            # Place close order
            order, response, error = await self.client.get_signer_client().create_order(
                self.market_id,
                int(time.time() * 1000),
                base_amount_int,
                price_int,
                1 if is_long else 0,  # is_ask
                self.client.get_signer_client().ORDER_TYPE_LIMIT,
                self.client.get_signer_client().ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only
                self.client.get_signer_client().NIL_TRIGGER_PRICE,
                self.client.get_signer_client().DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if error is None and response:
                # Calculate P&L
                avg_entry = position.get('avg_entry_price', 0)
                pnl = None
                if avg_entry > 0:
                    pnl = ((current_price - avg_entry) / avg_entry * 100) if is_long else ((avg_entry - current_price) / avg_entry * 100)
                
                # Clear tracking
                self.market_id = None
                self.order_id = None
                
                return {'success': True, 'pnl_percent': pnl}
            else:
                return {'success': False, 'error': str(error)}
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

