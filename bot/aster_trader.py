"""
Aster DEX Trader
Handles all Aster trading operations
"""

import os
import sys
from pathlib import Path

# Add perpsdex to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from perpsdex.aster.core.client import AsterClient
from perpsdex.aster.core.order import OrderExecutor
from perpsdex.aster.core.market import MarketData
from perpsdex.aster.core.risk import RiskManager
from perpsdex.aster.utils.calculator import Calculator


class AsterTrader:
    """Handles Aster DEX trading operations"""
    
    def __init__(self):
        self.client = None
        self.symbol = None
        self.order_id = None
    
    async def setup(self):
        """Initialize Aster client"""
        api_key = os.getenv('ASTER_API_KEY')
        secret_key = os.getenv('ASTER_SECRET_KEY')
        api_url = os.getenv('ASTER_API_URL', 'https://fapi.asterdex.com')
        
        if not api_key or not secret_key:
            print("⚠️ Aster credentials not found - skipping")
            self.client = None
            return False
        
        self.client = AsterClient(
            api_url=api_url,
            api_key=api_key,
            secret_key=secret_key
        )
        
        result = await self.client.test_connection()
        if result['success']:
            print("✅ Aster client connected")
            return True
        else:
            print(f"⚠️ Aster connection failed: {result.get('error')}")
            self.client = None  # Clear invalid client
            return False
    
    async def place_order(self, side: str, symbol: str, size_usd: float, leverage: int, sl_percent: float, rr_ratio: list) -> dict:
        """Place order on Aster"""
        try:
            if not self.client:
                return {'success': False, 'error': 'Client not initialized'}
            
            symbol_full = f"{symbol}-USDT"
            
            # Get price
            market = MarketData(self.client)
            price_result = await market.get_price(symbol_full)
            
            if not price_result['success']:
                return {'success': False, 'error': 'Failed to get price'}
            
            entry_price = price_result['ask'] if side == 'long' else price_result['bid']
            
            # Place entry order (OrderExecutor expects USD, will convert to BTC internally)
            executor = OrderExecutor(self.client)
            aster_side = 'BUY' if side == 'long' else 'SELL'
            
            result = await executor.place_market_order(
                symbol=symbol_full,
                side=aster_side,
                size=size_usd,  # Pass USD directly
                leverage=leverage
            )
            
            # Calculate size for later use (TP/SL)
            calculated_size = size_usd / entry_price
            
            if not result['success']:
                return result
            
            # Place TP/SL
            if sl_percent and rr_ratio:
                sl_price = Calculator.calculate_sl_from_percent(entry_price, aster_side, sl_percent)
                tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(entry_price, aster_side, sl_price, tuple(rr_ratio))
                
                # Get size from result (API returns 'filled_size', not 'size')
                filled_size = result.get('filled_size') or result.get('size') or calculated_size
                
                risk_manager = RiskManager(self.client, executor)
                await risk_manager.place_tp_sl(
                    symbol=symbol_full,
                    side=aster_side,
                    size=filled_size,
                    entry_price=entry_price,
                    tp_price=tp_sl_calc['tp_price'],
                    sl_price=sl_price
                )
            
            # Save tracking
            self.symbol = symbol_full
            self.order_id = result.get('order_id') or result.get('orderId')
            
            result['entry_price'] = entry_price
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order"""
        try:
            if not self.client:
                return False
            
            symbol_full = f"{symbol}-USDT"
            result = await self.client.cancel_order(symbol=symbol_full, order_id=order_id)
            
            if result.get('success'):
                print(f"✅ Aster order cancelled")
                return True
            else:
                print(f"❌ Failed: {result.get('error')}")
                return False
                
        except Exception as e:
            print(f"❌ Exception: {e}")
            return False
    
    async def close_position(self) -> dict:
        """Close tracked position"""
        try:
            print(f"\n🔍 DEBUG Aster close_position:")
            print(f"   tracked symbol: {self.symbol}")
            
            if not self.symbol or not self.client:
                return {'success': False, 'error': 'No position tracked'}
            
            # Get all positions
            market = MarketData(self.client)
            positions_result = await market.get_positions()
            
            if not positions_result.get('success'):
                print(f"   ❌ Failed to get positions")
                return {'success': False, 'error': 'Failed to get positions'}
            
            print(f"   ✅ Got positions, checking...")
            all_positions = positions_result.get('positions', [])
            print(f"   Total positions: {len(all_positions)}")
            
            for i, pos in enumerate(all_positions):
                pos_amt = pos.get('positionAmt')
                print(f"   Position {i+1}: symbol={pos.get('symbol')}, positionAmt={pos_amt}")
            
            # Find our position (filter non-zero positions from processed list)
            target_symbol = self.symbol.replace('-', '')  # BTC-USDT → BTCUSDT
            print(f"   Looking for symbol: {target_symbol}")
            
            # Use processed positions list (already filtered by get_positions)
            processed_positions = positions_result.get('positions', [])
            print(f"   Processed (non-zero) positions: {len(processed_positions)}")
            
            for i, pos in enumerate(processed_positions):
                print(f"   Processed {i+1}: symbol={pos.get('symbol')}, size={pos.get('size')}")
            
            position = None
            for pos in processed_positions:
                if pos.get('symbol') == target_symbol:
                    position = pos
                    break
            
            if not position:
                print(f"   ❌ Position with symbol={target_symbol} not found in processed list!")
                return {'success': False, 'error': 'Position not found or already closed'}
            
            # Use 'size' from processed position (already absolute value)
            abs_size = float(position.get('size', 0))
            side = position.get('side', 'LONG')
            is_long = side == 'LONG'
            
            print(f"   ✅ Found position: size={abs_size}, side={side}")
            
            # Place close order using direct API (closePosition)
            print(f"   🔄 Closing {abs_size} {self.symbol}...")
            
            # Use Binance-style close position API
            params = {
                'symbol': self.symbol.replace('-', ''),  # BTCUSDT
                'side': 'SELL' if is_long else 'BUY',
                'type': 'MARKET',
                'quantity': str(abs_size),
                'reduceOnly': 'true'  # String, not bool
            }
            
            api_result = await self.client._request(
                'POST',
                '/fapi/v1/order',
                params=params,
                signed=True
            )
            
            result = api_result if api_result.get('success') else {'success': False, 'error': api_result.get('error')}
            
            if result.get('success'):
                # Calculate P&L
                entry_price = float(position.get('entryPrice', 0))
                current_price = float(position.get('markPrice', entry_price))
                pnl = None
                
                if entry_price > 0 and current_price > 0:
                    pnl = ((current_price - entry_price) / entry_price * 100) if is_long else ((entry_price - current_price) / entry_price * 100)
                
                # Clear tracking
                self.symbol = None
                self.order_id = None
                
                return {'success': True, 'pnl_percent': pnl}
            else:
                return {'success': False, 'error': result.get('error')}
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

