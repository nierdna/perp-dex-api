"""
OrderExecutor - Place orders on Aster DEX

TODO: Adapt based on actual Aster API endpoints
"""

import time
from typing import Dict, Optional


class OrderExecutor:
    """
    Đặt lệnh trên Aster DEX
    
    Input:
        - client: AsterClient instance
    
    Methods:
        - place_market_order(symbol, side, size, leverage)
        - place_limit_order(symbol, side, size, price, leverage)
        - cancel_order(order_id)
    """
    
    def __init__(self, client):
        self.client = client
    
    async def place_market_order(
        self,
        symbol: str,
        side: str,
        size: float,
        leverage: float = 1.0
    ) -> Dict:
        """
        Đặt lệnh MARKET
        
        Input:
            symbol: Trading pair (e.g., 'BTC-USDT')
            side: 'BUY' or 'SELL'
            size: Order size in USD
            leverage: Leverage multiplier
            
        Output:
            {
                'success': bool,
                'order_id': str,
                'filled_price': float,
                'filled_size': float
            }
        """
        try:
            # Convert symbol format: BTC-USDT → BTCUSDT
            symbol_no_dash = symbol.replace('-', '')
            
            # Get current price to calculate quantity
            from .market import MarketData
            market = MarketData(self.client)
            price_result = await market.get_price(symbol)
            
            if not price_result['success']:
                return {'success': False, 'error': 'Failed to get market price'}
            
            # Calculate quantity in base currency
            price = price_result['ask'] if side.upper() == 'BUY' else price_result['bid']
            quantity = size / price  # USD to base token
            
            # ✅ Dynamic precision based on token type
            # BTC/ETH: 3 decimals, SOL/BNB: 2 decimals, DOGE/SHIB: 0-1 decimals
            import math
            
            # Auto-detect precision based on quantity size
            if quantity < 0.1:  # Very small (BTC, ETH) - price > $10k
                precision = 3
                multiplier = 1000
            elif quantity < 10:  # Small-medium (SOL, BNB) - price $100-$1000
                precision = 2
                multiplier = 100
            elif quantity < 1000:  # Medium-large (DOGE high price) - price $1-$10
                precision = 1
                multiplier = 10
            else:  # Very large (DOGE, SHIB, meme) - price < $1
                precision = 0
                multiplier = 1
            
            # Floor to avoid exceeding precision
            quantity_rounded = math.floor(quantity * multiplier) / multiplier
            
            actual_usd = quantity_rounded * price
            diff_usd = abs(actual_usd - size)
            diff_percent = diff_usd / size * 100
            
            print(f"📊 Aster Order: {quantity_rounded} {symbol.split('-')[0]} = ${actual_usd:.2f} USD (precision: {precision})")
            if diff_percent > 1:
                print(f"   ℹ️ Difference: ${diff_usd:.2f} ({diff_percent:.1f}%) from target ${size:.2f}")
            
            # TODO: Set leverage (may need different endpoint or account-level setting)
            # For now, Aster may use account-default leverage or per-position leverage
            
            # Place market order
            params = {
                'symbol': symbol_no_dash,
                'side': side.upper(),
                'type': 'MARKET',
                'quantity': str(quantity_rounded)  # Convert to string
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
            
            # Return order details
            return {
                'success': True,
                'order_id': str(data.get('orderId')),
                'filled_size': float(data.get('executedQty', quantity_rounded)),  # ✅ Use filled_size
                'filled_price': float(data.get('avgPrice', price)),
                'side': side.upper()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to place market order: {str(e)}"
            }
    
    async def place_limit_order(
        self,
        symbol: str,
        side: str,
        size: float,
        price: float,
        leverage: float = 1.0,
        time_in_force: str = 'GTC'
    ) -> Dict:
        """
        Đặt lệnh LIMIT
        
        Input:
            symbol: Trading pair
            side: 'BUY' or 'SELL'
            size: Order size in USD
            price: Limit price
            leverage: Leverage multiplier
            time_in_force: 'GTC', 'IOC', 'FOK'
            
        Output:
            {
                'success': bool,
                'order_id': str,
                'price': float,
                'size': float
            }
        """
        try:
            params = {
                'symbol': symbol,
                'side': side.upper(),
                'type': 'LIMIT',
                'quantity': size,
                'price': price,
                'leverage': leverage,
                'timeInForce': time_in_force
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
                'price': float(data.get('price', 0)),
                'size': float(data.get('origQty', 0))
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to place limit order: {str(e)}"
            }
    
    async def place_stop_order(
        self,
        symbol: str,
        side: str,
        size: float,
        stop_price: float,
        order_type: str = 'STOP_LOSS',
        reduce_only: bool = False
    ) -> Dict:
        """
        Đặt lệnh STOP (Stop Loss / Take Profit)
        
        Input:
            symbol: Trading pair
            side: 'BUY' or 'SELL'
            size: Order size
            stop_price: Trigger price
            order_type: 'STOP_LOSS' or 'TAKE_PROFIT'
            reduce_only: True for TP/SL
            
        Output:
            {
                'success': bool,
                'order_id': str,
                'stop_price': float
            }
        """
        try:
            params = {
                'symbol': symbol,
                'side': side.upper(),
                'type': order_type,
                'quantity': size,
                'stopPrice': stop_price,
                'reduceOnly': reduce_only
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
                'stop_price': float(data.get('stopPrice', 0))
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to place stop order: {str(e)}"
            }
    
    async def cancel_order(self, symbol: str, order_id: str) -> Dict:
        """
        Hủy lệnh
        
        Input:
            symbol: Trading pair
            order_id: Order ID to cancel
            
        Output:
            {
                'success': bool,
                'order_id': str
            }
        """
        try:
            params = {
                'symbol': symbol,
                'orderId': order_id
            }
            
            result = await self.client._request(
                'DELETE',
                '/fapi/v1/order',
                params=params,
                signed=True
            )
            
            if not result['success']:
                return result
            
            return {
                'success': True,
                'order_id': order_id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to cancel order: {str(e)}"
            }
    
    async def get_open_orders(self, symbol: Optional[str] = None) -> Dict:
        """
        Lấy danh sách lệnh đang chờ
        
        Input:
            symbol: Trading pair (optional, None = all pairs)
            
        Output:
            {
                'success': bool,
                'orders': List[Dict]
            }
        """
        try:
            params = {}
            if symbol:
                params['symbol'] = symbol
            
            result = await self.client._request(
                'GET',
                '/fapi/v1/openOrders',
                params=params,
                signed=True
            )
            
            if not result['success']:
                return result
            
            return {
                'success': True,
                'orders': result['data']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get open orders: {str(e)}"
            }
    
    async def place_stop_order(
        self,
        symbol: str,
        side: str,
        size: float,
        stop_price: float,
        order_type: str = 'STOP_LOSS',
        reduce_only: bool = True
    ) -> Dict:
        """
        Place stop order (TP/SL) on Aster DEX
        
        Input:
            symbol: Trading pair (e.g., 'BTC-USDT')
            side: 'BUY' or 'SELL'
            size: Position size
            stop_price: Trigger price
            order_type: 'STOP_LOSS' or 'TAKE_PROFIT'
            reduce_only: True for TP/SL
            
        Output:
            {
                'success': bool,
                'order_id': str,
                'filled_size': float,
                'filled_price': float,
                'side': str
            }
        """
        try:
            # Symbol should already be in BTCUSDT format from risk.py
            symbol_no_dash = symbol
            print(f"🔵 place_stop_order: symbol={symbol}, symbol_no_dash={symbol_no_dash}")
            
            # Aster uses STOP_MARKET and TAKE_PROFIT_MARKET
            if order_type == 'STOP_LOSS':
                aster_type = 'STOP_MARKET'  # Stop Loss: STOP_MARKET
            else:  # TAKE_PROFIT
                aster_type = 'TAKE_PROFIT_MARKET'  # Take Profit: TAKE_PROFIT_MARKET
            
            # Round to tickSize (0.1) - must be divisible by 0.1
            # Use integer arithmetic to avoid floating point precision issues
            price_rounded = round(stop_price * 10) / 10
            
            # Format to 1 decimal place, but ensure it's positive
            if price_rounded <= 0:
                return {
                    'success': False,
                    'error': f'Invalid price: {price_rounded}. Must be positive.'
                }
            
            price_str = f"{price_rounded:.1f}"
            
            # Use closePosition instead of quantity + reduceOnly
            # This will close 100% of the position when triggered
            params = {
                'symbol': symbol_no_dash,
                'side': side.upper(),
                'type': aster_type,
                'stopPrice': price_str,  # Trigger price
                'closePosition': 'true',  # Close entire position
                'timeInForce': 'GTC'  # Good Till Cancelled
            }
            
            print(f"🔵 TP/SL params with closePosition: {params}")
            
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
                'order_id': str(data.get('orderId')),
                'filled_size': size,  # Return original size for reference
                'filled_price': float(data.get('avgPrice', stop_price)),
                'side': side.upper()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to place stop order: {str(e)}"
            }

