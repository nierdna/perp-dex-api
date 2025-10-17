"""
MarketData - Get price, balance, positions from Aster DEX

TODO: Adapt based on actual Aster API endpoints
"""

from typing import Dict, Optional


class MarketData:
    """
    Lấy dữ liệu thị trường từ Aster DEX
    
    Input:
        - client: AsterClient instance
    
    Methods:
        - get_price(symbol): Lấy giá hiện tại
        - get_balance(): Lấy số dư tài khoản
        - get_positions(): Lấy positions đang mở
    """
    
    def __init__(self, client):
        self.client = client
    
    async def get_price(self, symbol: str) -> Dict:
        """
        Lấy giá hiện tại của symbol
        
        Input:
            symbol: Trading pair (e.g., 'BTC-USDT')
            
        Output:
            {
                'success': bool,
                'bid': float,
                'ask': float,
                'mid': float
            }
        """
        try:
            # ✅ Use correct Aster API endpoint structure
            result = await self.client._request(
                'GET',
                f'/fapi/v1/ticker/{symbol}',
                signed=False
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            # TODO: Adapt based on actual response format
            return {
                'success': True,
                'bid': float(data.get('bid', 0)),
                'ask': float(data.get('ask', 0)),
                'mid': (float(data.get('bid', 0)) + float(data.get('ask', 0))) / 2
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get price: {str(e)}"
            }
    
    async def get_balance(self) -> Dict:
        """
        Lấy số dư tài khoản
        
        Output:
            {
                'success': bool,
                'available': float,
                'total': float,
                'collateral': float
            }
        """
        try:
            # TODO: Find actual Aster endpoint
            # ✅ Use correct Aster API endpoint structure
            result = await self.client._request(
                'GET',
                '/fapi/v1/account',
                signed=True
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            # TODO: Adapt based on actual response format
            return {
                'success': True,
                'available': float(data.get('availableBalance', 0)),
                'total': float(data.get('totalBalance', 0)),
                'collateral': float(data.get('collateral', 0))
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get balance: {str(e)}"
            }
    
    async def get_positions(self) -> Dict:
        """
        Lấy positions đang mở
        
        Output:
            {
                'success': bool,
                'positions': [
                    {
                        'symbol': str,
                        'size': float,
                        'entry_price': float,
                        'leverage': float,
                        'pnl': float
                    }
                ]
            }
        """
        try:
            # TODO: Find actual Aster endpoint
            # ✅ Use correct Aster API endpoint structure
            result = await self.client._request(
                'GET',
                '/fapi/v1/positions',
                signed=True
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            # TODO: Adapt based on actual response format
            positions = []
            for pos in data.get('positions', []):
                positions.append({
                    'symbol': pos.get('symbol'),
                    'size': float(pos.get('size', 0)),
                    'entry_price': float(pos.get('entryPrice', 0)),
                    'leverage': float(pos.get('leverage', 1)),
                    'pnl': float(pos.get('unrealizedPnl', 0))
                })
            
            return {
                'success': True,
                'positions': positions
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get positions: {str(e)}"
            }
    
    async def get_market_info(self, symbol: str) -> Dict:
        """
        Lấy thông tin chi tiết về market
        
        Input:
            symbol: Trading pair
            
        Output:
            {
                'success': bool,
                'min_size': float,
                'max_size': float,
                'tick_size': float,
                'max_leverage': int
            }
        """
        try:
            # TODO: Find actual Aster endpoint
            result = await self.client._request(
                'GET',
                f'/fapi/v1/markets/{symbol}',
                signed=False
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            return {
                'success': True,
                'min_size': float(data.get('minOrderSize', 0)),
                'max_size': float(data.get('maxOrderSize', 0)),
                'tick_size': float(data.get('tickSize', 0)),
                'max_leverage': int(data.get('maxLeverage', 100))
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get market info: {str(e)}"
            }

