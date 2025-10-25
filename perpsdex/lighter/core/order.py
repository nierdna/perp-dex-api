"""
OrderExecutor - Đặt lệnh trên Lighter
"""

import time
import sys
import os

# Fix import path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.calculator import Calculator


class OrderExecutor:
    """
    Đặt lệnh entry (LONG/SHORT) trên Lighter
    
    Input:
        - signer_client: SignerClient instance
        - order_api: OrderApi instance
    
    Methods:
        - place_order(...): Đặt lệnh với đầy đủ parameters
    """
    
    def __init__(self, signer_client, order_api):
        self.signer_client = signer_client
        self.order_api = order_api
    
    async def place_order(
        self,
        side: str,
        entry_price: float,
        position_size_usd: float,
        market_id: int,
        symbol: str = None,
        leverage: float = 1.0
    ) -> dict:
        """
        Đặt lệnh LONG hoặc SHORT
        
        Input:
            - side: 'long' hoặc 'short'
            - entry_price: Giá entry
            - position_size_usd: Kích thước vị thế (USD)
            - market_id: ID của market
            - symbol: Tên symbol để hiển thị (optional)
            - leverage: Đòn bẩy (optional, default: 1)
        
        Output:
            dict: {
                'success': bool,
                'order_id': int,
                'tx_hash': str,
                'entry_price': float,
                'position_size': float,  # Số lượng coin
                'side': str,
                'error': str (nếu có)
            }
        
        Example:
            >>> result = await order_executor.place_order(
            ...     side='long',
            ...     entry_price=65000,
            ...     position_size_usd=100,
            ...     market_id=1,
            ...     symbol='BTC'
            ... )
        """
        try:
            # Validate side
            if side not in ('long', 'short'):
                return {'success': False, 'error': 'Invalid side. Use long or short'}
            
            is_long = side == 'long'
            symbol_display = symbol or f"Market {market_id}"
            
            # Tính position size
            position_size = Calculator.calculate_position_size(position_size_usd, entry_price)
            
            print(f"\n🎯 Đang đặt lệnh {side.upper()} ${position_size_usd} {symbol_display}...")
            print(f"📊 Order Details:")
            print(f"   💰 Position Size: {position_size} {symbol_display}")
            print(f"   💵 Entry Price: ${entry_price:,.2f}")
            print(f"   💸 Total Cost: ${position_size_usd:.2f}")
            print(f"   📊 Leverage: {leverage}x")
            
            # Lấy market metadata
            metadata_result = await self._get_market_metadata(market_id)
            if not metadata_result['success']:
                return metadata_result
            
            size_decimals = metadata_result['size_decimals']
            price_decimals = metadata_result['price_decimals']
            min_base_amount = metadata_result['min_base_amount']
            
            # Adjust size nếu nhỏ hơn min
            base_amount = max(position_size, min_base_amount)
            if position_size < min_base_amount:
                print(f"⚠️  Size adjusted: ${position_size_usd:.2f} → ${base_amount * entry_price:.2f} (min requirement)")
            
            # Scale theo decimals
            base_amount_int = Calculator.scale_to_int(base_amount, size_decimals)
            price_int = Calculator.scale_to_int(entry_price, price_decimals)
            
            print(f"🔧 Decimals: size={size_decimals}, price={price_decimals}, min_base={min_base_amount}")
            print(f"🔧 Scaled: base_amount_int={base_amount_int}, price_int={price_int}")
            
            # Prepare order parameters
            client_order_index = int(time.time() * 1000)
            is_ask = 0 if is_long else 1  # 0 = buy/LONG, 1 = sell/SHORT
            
            # 🎯 USE AGGRESSIVE LIMIT ORDER for instant fill
            # Set limit price with 3% slippage (within Lighter's acceptable range)
            if is_long:
                # LONG (BUY): Set limit 3% higher than market
                limit_price = entry_price * 1.03  # 3% higher
            else:
                # SHORT (SELL): Set limit 3% lower than market  
                limit_price = entry_price * 0.97  # 3% lower
            
            order_type = self.signer_client.ORDER_TYPE_LIMIT
            time_in_force = self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME  # GTC - most compatible
            reduce_only = False
            trigger_price = self.signer_client.NIL_TRIGGER_PRICE
            order_expiry = self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY
            
            # Scale limit_price to int
            limit_price_int = Calculator.scale_to_int(limit_price, price_decimals)
            
            print(f"🎯 AGGRESSIVE LIMIT ORDER (3% slippage):")
            print(f"   Market Price: ${entry_price:,.6f}")
            print(f"   Limit Price: ${limit_price:,.6f} ({'+3%' if is_long else '-3%'})")
            print(f"   Expected: Instant fill at best available price")
            
            # Create order
            created_order, send_resp, err = await self.signer_client.create_order(
                market_id,
                client_order_index,
                base_amount_int,
                limit_price_int,  # Use aggressive limit_price for instant fill
                is_ask,
                order_type,
                time_in_force,
                reduce_only,
                trigger_price,
                order_expiry,
            )
            
            # Debug output
            print(f"🔍 DEBUG:")
            print(f"   created_order: {created_order}")
            print(f"   send_resp: {send_resp}")
            print(f"   err: {err}")
            
            if err is None and send_resp:
                print("✅ Đặt lệnh thành công!")
                print(f"📝 Tx Hash: {send_resp.tx_hash}")
                
                return {
                    'success': True,
                    'order_id': getattr(created_order, 'client_order_index', None),
                    'tx_hash': send_resp.tx_hash,
                    'entry_price': entry_price,
                    'position_size': base_amount,
                    'side': side,
                }
            else:
                # Better error handling
                if send_resp and hasattr(send_resp, 'message'):
                    err_msg = send_resp.message
                elif send_resp and hasattr(send_resp, 'code'):
                    err_msg = f"Error code: {send_resp.code}"
                elif err:
                    err_msg = str(err)
                else:
                    err_msg = "Unknown error - order may not have been executed"
                    
                print(f"❌ Đặt lệnh thất bại: {err_msg}")
                return {'success': False, 'error': err_msg}
                
        except Exception as e:
            print(f"❌ Lỗi khi đặt lệnh {side}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def place_limit_order(
        self,
        side: str,
        limit_price: float,
        position_size_usd: float,
        market_id: int,
        symbol: str = None,
        leverage: float = 1.0
    ) -> dict:
        """
        Đặt lệnh LIMIT LONG hoặc SHORT
        
        Input:
            - side: 'long' hoặc 'short'
            - limit_price: Giá limit
            - position_size_usd: Kích thước vị thế (USD)
            - market_id: ID của market
            - symbol: Tên symbol để hiển thị (optional)
            - leverage: Đòn bẩy (optional, default: 1)
        
        Output:
            dict: {
                'success': bool,
                'tx_hash': str,
                'position_size': float,
                'entry_price': float
            }
        """
        try:
            # Get market metadata
            metadata_result = await self.order_api.get_market_metadata(market_id)
            if not metadata_result['success']:
                return {'success': False, 'error': 'Failed to get market metadata'}
            
            size_decimals = metadata_result['size_decimals']
            price_decimals = metadata_result['price_decimals']
            min_base_amount = metadata_result['min_base_amount']
            
            # Calculate position size
            position_size = position_size_usd / limit_price
            position_size = max(position_size, min_base_amount)
            
            # Scale to integers
            base_amount_int = Calculator.scale_to_int(position_size, size_decimals)
            price_int = Calculator.scale_to_int(limit_price, price_decimals)
            
            # Determine order direction
            is_ask = 1 if side.lower() == 'short' else 0
            
            # Generate unique order index
            client_order_index = int(time.time() * 1000)
            
            # Place LIMIT order
            order, response, error = await self.signer_client.create_order(
                market_id,
                client_order_index,
                base_amount_int,
                price_int,
                is_ask,
                self.signer_client.ORDER_TYPE_LIMIT,  # LIMIT order
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                False,  # reduce_only = False for entry
                self.signer_client.NIL_TRIGGER_PRICE,
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if error is not None or response is None:
                return {
                    'success': False,
                    'error': f"Order failed: {error}"
                }
            
            print(f"✅ LIMIT {side.upper()} order placed: {response.tx_hash}")
            print(f"📊 Order Details:")
            print(f"   💰 Position Size: {position_size} {symbol or 'tokens'}")
            print(f"   💵 Limit Price: ${limit_price}")
            print(f"   💸 Total Cost: ${position_size_usd}")
            print(f"   📊 Leverage: {leverage}x")
            
            return {
                'success': True,
                'tx_hash': response.tx_hash,
                'position_size': position_size,
                'entry_price': limit_price
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception in place_limit_order: {str(e)}"
            }
    
    async def _get_market_metadata(self, market_id: int) -> dict:
        """
        Helper: Lấy market metadata
        
        Internal method - không dùng trực tiếp từ bên ngoài
        """
        try:
            details = await self.order_api.order_book_details(market_id=market_id)
            
            if details and details.order_book_details:
                ob = details.order_book_details[0]
                return {
                    'success': True,
                    'size_decimals': ob.size_decimals,
                    'price_decimals': ob.price_decimals,
                    'min_base_amount': float(ob.min_base_amount),
                }
            else:
                return {
                    'success': False,
                    'error': 'No market metadata'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

