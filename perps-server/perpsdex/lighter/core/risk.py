"""
RiskManager - Quản lý TP/SL orders
"""

import time
import sys
import os

# Fix import path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.calculator import Calculator


class RiskManager:
    """
    Quản lý Take Profit và Stop Loss orders
    
    Input:
        - signer_client: SignerClient instance
        - order_api: OrderApi instance
    
    Methods:
        - place_tp_order(...): Đặt Take Profit order
        - place_sl_order(...): Đặt Stop Loss order
        - place_tp_sl_orders(...): Đặt cả TP và SL
    """
    
    def __init__(self, signer_client, order_api):
        self.signer_client = signer_client
        self.order_api = order_api
    
    async def place_tp_sl_orders(
        self,
        entry_price: float,
        position_size: float,
        side: str,
        tp_price: float,
        sl_price: float,
        market_id: int,
        symbol: str = None,
        validate_sl: bool = True,
        max_sl_percent: float = 5.0
    ) -> dict:
        """
        Đặt cả TP và SL orders
        
        Input:
            - entry_price: Giá entry
            - position_size: Kích thước vị thế (số lượng coin)
            - side: 'long' hoặc 'short'
            - tp_price: Giá Take Profit
            - sl_price: Giá Stop Loss
            - market_id: ID của market
            - symbol: Tên symbol để hiển thị (optional)
            - validate_sl: Có validate SL không (default: True)
            - max_sl_percent: % SL tối đa cho phép (default: 5%)
        
        Output:
            dict: {
                'success': bool,
                'tp_success': bool,
                'sl_success': bool,
                'tp_tx_hash': str,
                'sl_tx_hash': str,
                'results': list,
                'error': str (nếu có)
            }
        
        Example:
            >>> result = await risk_manager.place_tp_sl_orders(
            ...     entry_price=65000,
            ...     position_size=0.001,
            ...     side='long',
            ...     tp_price=69000,
            ...     sl_price=63000,
            ...     market_id=1,
            ...     symbol='BTC'
            ... )
        """
        try:
            is_long = side.lower() == 'long'
            symbol_display = symbol or f"Market {market_id}"
            
            # Validate SL nếu cần
            if validate_sl:
                validation = Calculator.validate_sl_price(sl_price, entry_price, side, max_sl_percent)
                if not validation['valid']:
                    sl_price = validation['adjusted_price']
                    print(f"⚠️  SL price adjusted from ${validation['original_percent']:.2f}% to ${validation['adjusted_percent']:.2f}%")
                    print(f"    New SL: ${sl_price:,.2f}")
            
            print(f"\n🎯 Đang đặt TP/SL orders cho {symbol_display}...")
            print(f"   📈 Take Profit: ${tp_price:,.2f}")
            print(f"   🛡️ Stop Loss: ${sl_price:,.2f}")
            
            # Get market metadata
            metadata_result = await self._get_market_metadata(market_id)
            if not metadata_result['success']:
                return metadata_result
            
            size_decimals = metadata_result['size_decimals']
            price_decimals = metadata_result['price_decimals']
            min_base_amount = metadata_result['min_base_amount']
            
            # Scale position size
            base_amount = max(position_size, min_base_amount)
            base_amount_int = Calculator.scale_to_int(base_amount, size_decimals)
            
            results = []
            
            # Place Take Profit order
            tp_result = await self._place_tp_order(
                tp_price=tp_price,
                base_amount_int=base_amount_int,
                price_decimals=price_decimals,
                is_long=is_long,
                market_id=market_id
            )
            results.append(tp_result)
            
            # Place Stop Loss order
            sl_result = await self._place_sl_order(
                sl_price=sl_price,
                entry_price=entry_price,
                base_amount_int=base_amount_int,
                price_decimals=price_decimals,
                is_long=is_long,
                market_id=market_id
            )
            results.append(sl_result)
            
            tp_success = tp_result['success']
            sl_success = sl_result['success']
            
            return {
                'success': True,
                'tp_success': tp_success,
                'sl_success': sl_success,
                'tp_tx_hash': tp_result.get('tx_hash'),
                'sl_tx_hash': sl_result.get('tx_hash'),
                'results': results
            }
            
        except Exception as e:
            print(f"❌ Lỗi khi đặt TP/SL: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _place_tp_order(
        self,
        tp_price: float,
        base_amount_int: int,
        price_decimals: int,
        is_long: bool,
        market_id: int
    ) -> dict:
        """
        Helper: Đặt Take Profit order
        
        Internal method
        """
        try:
            tp_client_order_index = int(time.time() * 1000) + 1
            tp_price_int = Calculator.scale_to_int(tp_price, price_decimals)
            
            # TP order: opposite direction to close position
            tp_is_ask = 1 if is_long else 0  # LONG -> sell to close, SHORT -> buy to close
            
            # 🎯 CONDITIONAL ORDER: TAKE_PROFIT_LIMIT
            # trigger_price = tp_price → Kích hoạt khi market price >= tp_price
            # limit_price = tp_price → Sau khi active, đặt SELL limit @ tp_price
            print(f"📈 Đặt TP order:")
            print(f"   Type: TAKE_PROFIT_LIMIT (conditional)")
            print(f"   Trigger: ${tp_price:,.2f} (kích hoạt khi market >= trigger)")
            print(f"   Limit: ${tp_price:,.2f} (đặt SELL @ limit sau khi active)")
            
            tp_order, tp_resp, tp_err = await self.signer_client.create_order(
                market_id,
                tp_client_order_index,
                base_amount_int,
                tp_price_int,  # limit_price
                tp_is_ask,
                self.signer_client.ORDER_TYPE_TAKE_PROFIT_LIMIT,  # Conditional order
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only = True
                tp_price_int,  # trigger_price = tp_price (kích hoạt khi market >= trigger)
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if tp_err is None and tp_resp:
                print(f"✅ Take Profit order placed: {tp_resp.tx_hash}")
                return {'type': 'tp', 'success': True, 'tx_hash': tp_resp.tx_hash}
            else:
                print(f"❌ Take Profit order failed: {tp_err}")
                return {'type': 'tp', 'success': False, 'error': str(tp_err)}
                
        except Exception as e:
            return {'type': 'tp', 'success': False, 'error': str(e)}
    
    async def _place_sl_order(
        self,
        sl_price: float,
        entry_price: float,
        base_amount_int: int,
        price_decimals: int,
        is_long: bool,
        market_id: int
    ) -> dict:
        """
        Helper: Đặt Stop Loss order với retry logic
        
        Internal method
        """
        try:
            sl_client_order_index = int(time.time() * 1000) + 2
            sl_price_int = Calculator.scale_to_int(sl_price, price_decimals)
            
            # SL order: same direction as TP (to close position)
            sl_is_ask = 1 if is_long else 0
            
            # 🎯 CONDITIONAL ORDER: STOP_LOSS_LIMIT
            # trigger_price = sl_price → Kích hoạt khi market price <= sl_price (LONG) hoặc >= sl_price (SHORT)
            # limit_price = sl_price → Sau khi active, đặt SELL/BUY limit @ sl_price
            print(f"🛡️ Đặt SL order:")
            print(f"   Type: STOP_LOSS_LIMIT (conditional)")
            print(f"   Trigger: ${sl_price:,.2f} (kích hoạt khi market {'<=' if is_long else '>='} trigger)")
            print(f"   Limit: ${sl_price:,.2f} (đặt {'SELL' if is_long else 'BUY'} @ limit sau khi active)")
            
            sl_order, sl_resp, sl_err = await self.signer_client.create_order(
                market_id,
                sl_client_order_index,
                base_amount_int,
                sl_price_int,  # limit_price
                sl_is_ask,
                self.signer_client.ORDER_TYPE_STOP_LOSS_LIMIT,  # Conditional order
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only = True
                sl_price_int,  # trigger_price = sl_price (kích hoạt khi market hit trigger)
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if sl_err is None and sl_resp:
                print(f"✅ Stop Loss order placed: {sl_resp.tx_hash}")
                return {'type': 'sl', 'success': True, 'tx_hash': sl_resp.tx_hash}
            else:
                print(f"❌ Stop Loss order failed: {sl_err}")
                
                # Retry với 2% nếu lỗi "accidental price"
                if "accidental price" in str(sl_err).lower():
                    print("🔄 Retrying with 2% SL...")
                    retry_sl_price = entry_price * 0.98 if is_long else entry_price * 1.02
                    retry_result = await self._retry_sl_order(
                        retry_sl_price,
                        base_amount_int,
                        price_decimals,
                        sl_is_ask,
                        market_id,
                        sl_client_order_index + 10
                    )
                    return retry_result
                
                return {'type': 'sl', 'success': False, 'error': str(sl_err)}
                
        except Exception as e:
            return {'type': 'sl', 'success': False, 'error': str(e)}
    
    async def _retry_sl_order(
        self,
        retry_sl_price: float,
        base_amount_int: int,
        price_decimals: int,
        sl_is_ask: int,
        market_id: int,
        order_index: int
    ) -> dict:
        """
        Helper: Retry SL order với giá khác
        
        Internal method
        """
        try:
            retry_sl_price_int = Calculator.scale_to_int(retry_sl_price, price_decimals)
            
            sl_order2, sl_resp2, sl_err2 = await self.signer_client.create_order(
                market_id,
                order_index,
                base_amount_int,
                retry_sl_price_int,
                sl_is_ask,
                self.signer_client.ORDER_TYPE_STOP_LOSS_LIMIT,  # ✅ FIXED: Use SL type
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,
                retry_sl_price_int,  # ✅ FIXED: trigger_price
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if sl_err2 is None and sl_resp2:
                print(f"✅ Stop Loss order placed (retry): {sl_resp2.tx_hash}")
                return {'type': 'sl', 'success': True, 'tx_hash': sl_resp2.tx_hash}
            else:
                print(f"❌ Stop Loss retry also failed: {sl_err2}")
                return {'type': 'sl', 'success': False, 'error': str(sl_err2)}
                
        except Exception as e:
            return {'type': 'sl', 'success': False, 'error': str(e)}
    
    async def _get_market_metadata(self, market_id: int) -> dict:
        """
        Helper: Lấy market metadata
        
        Internal method
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

