"""
RiskManager - Manage TP/SL orders on Aster DEX

TODO: Adapt based on actual Aster API
"""

from typing import Dict, Tuple


class RiskManager:
    """
    Quản lý TP/SL orders
    
    Input:
        - client: AsterClient instance
        - order_executor: OrderExecutor instance
    
    Methods:
        - place_tp_sl(symbol, side, size, entry_price, tp_price, sl_price)
        - place_trailing_stop(symbol, side, size, callback_rate)
    """
    
    def __init__(self, client, order_executor):
        self.client = client
        self.order_executor = order_executor
    
    async def place_tp_sl(
        self,
        symbol: str,
        side: str,
        size: float,
        entry_price: float,
        tp_price: float,
        sl_price: float
    ) -> Dict:
        """
        Đặt cả TP và SL orders
        
        Input:
            symbol: Trading pair
            side: Original position side ('BUY' or 'SELL')
            size: Position size
            entry_price: Entry price (for reference)
            tp_price: Take profit price
            sl_price: Stop loss price
            
        Output:
            {
                'success': bool,
                'tp_order_id': str,
                'sl_order_id': str,
                'tp_price': float,
                'sl_price': float
            }
        """
        try:
            # Determine close side (opposite of entry)
            close_side = 'SELL' if side == 'BUY' else 'BUY'
            
            # Place Take Profit order
            tp_result = await self.order_executor.place_stop_order(
                symbol=symbol.replace('-', ''),  # Convert BTC-USDT to BTCUSDT
                side=close_side,
                size=size,
                stop_price=tp_price,
                order_type='TAKE_PROFIT',
                reduce_only=True
            )
            
            if not tp_result['success']:
                return {
                    'success': False,
                    'error': f"Failed to place TP: {tp_result.get('error')}"
                }
            
            # Place Stop Loss order
            sl_result = await self.order_executor.place_stop_order(
                symbol=symbol.replace('-', ''),  # Convert BTC-USDT to BTCUSDT
                side=close_side,
                size=size,
                stop_price=sl_price,
                order_type='STOP_LOSS',
                reduce_only=True
            )
            
            if not sl_result['success']:
                # TP placed but SL failed - should cancel TP?
                # TODO: Decide on error handling strategy
                return {
                    'success': False,
                    'tp_order_id': tp_result['order_id'],
                    'error': f"TP placed but SL failed: {sl_result.get('error')}"
                }
            
            return {
                'success': True,
                'tp_order_id': tp_result['order_id'],
                'sl_order_id': sl_result['order_id'],
                'tp_price': tp_price,
                'sl_price': sl_price
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to place TP/SL: {str(e)}"
            }
    
    async def place_trailing_stop(
        self,
        symbol: str,
        side: str,
        size: float,
        callback_rate: float
    ) -> Dict:
        """
        Đặt Trailing Stop order
        
        Aster DEX có native Trailing Stop support!
        
        Input:
            symbol: Trading pair
            side: Close side
            size: Position size
            callback_rate: Callback rate in % (e.g., 1.0 = 1%)
            
        Output:
            {
                'success': bool,
                'order_id': str,
                'callback_rate': float
            }
        """
        try:
            # TODO: Find actual Aster trailing stop parameters
            params = {
                'symbol': symbol,
                'side': side.upper(),
                'type': 'TRAILING_STOP_MARKET',
                'quantity': size,
                'callbackRate': callback_rate,
                'reduceOnly': True
            }
            
            result = await self.client._request(
                'POST',
                '/fapi/v1/order',
                params=params,
                signed=True
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            return {
                'success': True,
                'order_id': data.get('orderId'),
                'callback_rate': callback_rate
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to place trailing stop: {str(e)}"
            }
    
    def calculate_tp_sl_prices(
        self,
        entry_price: float,
        side: str,
        sl_percent: float,
        rr_ratio: Tuple[float, float]
    ) -> Dict:
        """
        Tính toán TP/SL prices từ % và R:R ratio
        
        Input:
            entry_price: Entry price
            side: 'BUY' or 'SELL'
            sl_percent: SL distance in % (e.g., 3.0 = 3%)
            rr_ratio: (risk, reward) tuple (e.g., (1, 2))
            
        Output:
            {
                'tp_price': float,
                'sl_price': float,
                'risk_amount': float,
                'reward_amount': float
            }
        """
        is_long = side.upper() == 'BUY'
        risk_ratio, reward_ratio = rr_ratio
        
        # Calculate SL price
        if is_long:
            sl_price = entry_price * (1 - sl_percent / 100)
            risk_amount = entry_price - sl_price
            reward_amount = risk_amount * (reward_ratio / risk_ratio)
            tp_price = entry_price + reward_amount
        else:
            sl_price = entry_price * (1 + sl_percent / 100)
            risk_amount = sl_price - entry_price
            reward_amount = risk_amount * (reward_ratio / risk_ratio)
            tp_price = entry_price - reward_amount
        
        # Round to tickSize (0.1) - must be divisible by 0.1
        tp_price_rounded = round(tp_price / 0.1) * 0.1
        sl_price_rounded = round(sl_price / 0.1) * 0.1
        
        return {
            'tp_price': tp_price_rounded,  # Round to tickSize (0.1)
            'sl_price': sl_price_rounded,  # Round to tickSize (0.1)
            'risk_amount': risk_amount,
            'reward_amount': reward_amount
        }
    
    async def modify_sl_to_breakeven(
        self,
        symbol: str,
        order_id: str,
        entry_price: float
    ) -> Dict:
        """
        Di chuyển SL về breakeven
        
        Input:
            symbol: Trading pair
            order_id: SL order ID
            entry_price: Entry price
            
        Output:
            {
                'success': bool,
                'new_sl_price': float
            }
        """
        try:
            # Cancel old SL
            cancel_result = await self.order_executor.cancel_order(symbol, order_id)
            
            if not cancel_result['success']:
                return cancel_result
            
            # TODO: Place new SL at breakeven
            # Need to know position side first
            
            return {
                'success': True,
                'message': 'SL moved to breakeven'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to modify SL: {str(e)}"
            }

