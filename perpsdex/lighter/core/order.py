"""
OrderExecutor - Đặt lệnh trên Lighter
"""

import time
from ..utils.calculator import Calculator


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
            order_type = self.signer_client.ORDER_TYPE_LIMIT
            time_in_force = self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME
            reduce_only = False
            trigger_price = self.signer_client.NIL_TRIGGER_PRICE
            order_expiry = self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY
            
            # Create order
            created_order, send_resp, err = await self.signer_client.create_order(
                market_id,
                client_order_index,
                base_amount_int,
                price_int,
                is_ask,
                order_type,
                time_in_force,
                reduce_only,
                trigger_price,
                order_expiry,
            )
            
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
                err_msg = err or getattr(send_resp, 'message', 'Unknown error') if send_resp else err or 'Unknown error'
                print(f"❌ Đặt lệnh thất bại: {err_msg}")
                return {'success': False, 'error': err_msg}
                
        except Exception as e:
            print(f"❌ Lỗi khi đặt lệnh {side}: {e}")
            return {'success': False, 'error': str(e)}
    
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

