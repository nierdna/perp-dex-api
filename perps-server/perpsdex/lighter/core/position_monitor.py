"""
Position Monitor - Theo dõi và tự động close position khi TP/SL hit
"""

import asyncio
import time
from typing import Optional


class PositionMonitor:
    """
    Monitor positions và tự động close khi:
    - Profit >= TP threshold
    - Loss >= SL threshold  
    - Time >= max duration
    """
    
    def __init__(self, order_api, signer_client):
        self.order_api = order_api
        self.signer_client = signer_client
        
    async def monitor_position(
        self,
        market_id: int,
        entry_price: float,
        position_size: float,
        side: str,
        tp_percent: float = 3.0,
        sl_percent: float = 3.0,
        max_duration_seconds: int = 1800,  # 30 phút
        check_interval: int = 10  # Check mỗi 10s
    ) -> dict:
        """
        Monitor position và close khi đạt điều kiện
        
        Args:
            market_id: ID của market
            entry_price: Giá entry
            position_size: Size của position
            side: 'long' hoặc 'short'
            tp_percent: % take profit (default 3%)
            sl_percent: % stop loss (default 3%)
            max_duration_seconds: Thời gian tối đa giữ position (default 30 phút)
            check_interval: Kiểm tra mỗi N giây (default 10s)
            
        Returns:
            dict: {
                'closed': bool,
                'reason': str,  # 'tp', 'sl', 'timeout'
                'exit_price': float,
                'pnl': float,
                'pnl_percent': float
            }
        """
        is_long = side.lower() == 'long'
        start_time = time.time()
        
        # Tính giá TP/SL
        if is_long:
            tp_price = entry_price * (1 + tp_percent / 100)
            sl_price = entry_price * (1 - sl_percent / 100)
        else:
            tp_price = entry_price * (1 - tp_percent / 100)
            sl_price = entry_price * (1 + sl_percent / 100)
        
        print(f"\n🔍 Bắt đầu monitor position {side.upper()}:")
        print(f"   Entry: ${entry_price:,.2f}")
        print(f"   📈 TP Target: ${tp_price:,.2f} (+{tp_percent}%)")
        print(f"   🛡️ SL Target: ${sl_price:,.2f} (-{sl_percent}%)")
        print(f"   ⏰ Max Duration: {max_duration_seconds}s")
        print(f"   🔄 Check Interval: {check_interval}s")
        
        check_count = 0
        
        while True:
            check_count += 1
            elapsed_time = time.time() - start_time
            
            # 1. Check timeout
            if elapsed_time >= max_duration_seconds:
                print(f"\n⏰ Timeout reached after {elapsed_time:.0f}s")
                result = await self._close_position(
                    market_id, position_size, side, entry_price, 'timeout'
                )
                return result
            
            # 2. Get current price
            try:
                order_book = await self.order_api.order_book(market_id=market_id, limit=1)
                if not order_book or not order_book.order_book:
                    print(f"⚠️  Cannot get order book, retry...")
                    await asyncio.sleep(check_interval)
                    continue
                
                book = order_book.order_book[0]
                current_price = float(book.best_ask) if is_long else float(book.best_bid)
                
                # Calculate PnL
                if is_long:
                    pnl = (current_price - entry_price) / entry_price * 100
                else:
                    pnl = (entry_price - current_price) / entry_price * 100
                
                print(f"#{check_count} | ⏰ {elapsed_time:.0f}s | 💰 ${current_price:,.2f} | PnL: {pnl:+.2f}%")
                
                # 3. Check TP
                if is_long and current_price >= tp_price:
                    print(f"\n🎯 TAKE PROFIT HIT! ${current_price:,.2f} >= ${tp_price:,.2f}")
                    result = await self._close_position(
                        market_id, position_size, side, entry_price, 'tp', current_price
                    )
                    return result
                elif not is_long and current_price <= tp_price:
                    print(f"\n🎯 TAKE PROFIT HIT! ${current_price:,.2f} <= ${tp_price:,.2f}")
                    result = await self._close_position(
                        market_id, position_size, side, entry_price, 'tp', current_price
                    )
                    return result
                
                # 4. Check SL
                if is_long and current_price <= sl_price:
                    print(f"\n🛑 STOP LOSS HIT! ${current_price:,.2f} <= ${sl_price:,.2f}")
                    result = await self._close_position(
                        market_id, position_size, side, entry_price, 'sl', current_price
                    )
                    return result
                elif not is_long and current_price >= sl_price:
                    print(f"\n🛑 STOP LOSS HIT! ${current_price:,.2f} >= ${sl_price:,.2f}")
                    result = await self._close_position(
                        market_id, position_size, side, entry_price, 'sl', current_price
                    )
                    return result
                
            except Exception as e:
                print(f"⚠️  Error checking price: {e}")
            
            # Sleep until next check
            await asyncio.sleep(check_interval)
    
    async def _close_position(
        self,
        market_id: int,
        position_size: float,
        side: str,
        entry_price: float,
        reason: str,
        exit_price: Optional[float] = None
    ) -> dict:
        """
        Close position bằng reverse order
        """
        try:
            is_long = side.lower() == 'long'
            
            # Get market metadata
            details = await self.order_api.order_book_details(market_id=market_id)
            if not details or not details.order_book_details:
                return {'success': False, 'error': 'Cannot get market metadata'}
            
            ob = details.order_book_details[0]
            size_decimals = ob.size_decimals
            price_decimals = ob.price_decimals
            
            # Get current price if not provided
            if exit_price is None:
                order_book = await self.order_api.order_book(market_id=market_id, limit=1)
                if order_book and order_book.order_book:
                    book = order_book.order_book[0]
                    exit_price = float(book.best_bid) if is_long else float(book.best_ask)
                else:
                    exit_price = entry_price  # Fallback
            
            # Scale values
            from perpsdex.lighter.utils.calculator import Calculator
            base_amount_int = Calculator.scale_to_int(position_size, size_decimals)
            price_int = Calculator.scale_to_int(exit_price, price_decimals)
            
            # Create close order (reverse direction)
            client_order_index = int(time.time() * 1000)
            is_ask = 1 if is_long else 0  # Reverse: LONG -> SELL, SHORT -> BUY
            
            print(f"\n🔄 Closing {side.upper()} position:")
            print(f"   Size: {position_size}")
            print(f"   Exit Price: ${exit_price:,.2f}")
            print(f"   Reason: {reason.upper()}")
            
            created_order, send_resp, err = await self.signer_client.create_order(
                market_id,
                client_order_index,
                base_amount_int,
                price_int,
                is_ask,
                self.signer_client.ORDER_TYPE_LIMIT,
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only = True (close only)
                self.signer_client.NIL_TRIGGER_PRICE,
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if err is None and send_resp:
                # Calculate PnL
                if is_long:
                    pnl = (exit_price - entry_price) * position_size
                    pnl_percent = (exit_price - entry_price) / entry_price * 100
                else:
                    pnl = (entry_price - exit_price) * position_size
                    pnl_percent = (entry_price - exit_price) / entry_price * 100
                
                print(f"✅ Position closed successfully!")
                print(f"📊 PnL: ${pnl:+.2f} ({pnl_percent:+.2f}%)")
                print(f"📝 Tx Hash: {send_resp.tx_hash}")
                
                return {
                    'success': True,
                    'closed': True,
                    'reason': reason,
                    'exit_price': exit_price,
                    'pnl': pnl,
                    'pnl_percent': pnl_percent,
                    'tx_hash': send_resp.tx_hash
                }
            else:
                print(f"❌ Failed to close position: {err}")
                return {
                    'success': False,
                    'closed': False,
                    'error': str(err)
                }
                
        except Exception as e:
            print(f"❌ Error closing position: {e}")
            return {
                'success': False,
                'closed': False,
                'error': str(e)
            }

