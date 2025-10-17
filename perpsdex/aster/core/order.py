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
            # TODO: Find actual Aster endpoint and parameters
            params = {
                'symbol': symbol,
                'side': side.upper(),
                'type': 'MARKET',
                'quantity': size,
                'leverage': leverage
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
            
            # TODO: Adapt based on actual response format
            return {
                'success': True,
                'order_id': data.get('orderId'),
                'filled_price': float(data.get('avgPrice', 0)),
                'filled_size': float(data.get('executedQty', 0))
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

