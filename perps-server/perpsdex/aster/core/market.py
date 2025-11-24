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
            # ✅ Aster uses /fapi/v1/ticker/24hr with symbol param (no dash)
            # Convert BTC-USDT to BTCUSDT
            symbol_no_dash = symbol.replace('-', '')
            
            result = await self.client._request(
                'GET',
                f'/fapi/v1/ticker/24hr?symbol={symbol_no_dash}',
                signed=False
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            # Aster returns: lastPrice, bidPrice, askPrice (or just lastPrice)
            last_price = float(data.get('lastPrice', 0))
            bid = float(data.get('bidPrice', last_price))
            ask = float(data.get('askPrice', last_price))
            
            return {
                'success': True,
                'bid': bid if bid > 0 else last_price * 0.9995,  # Mock bid/ask if not available
                'ask': ask if ask > 0 else last_price * 1.0005,
                'mid': last_price
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get price: {str(e)}"
            }
    
    async def get_balance(self, asset: str = 'USDT') -> Dict:
        """
        Lấy số dư tài khoản
        
        Input:
            asset: Asset to get balance for (default: 'USDT')
        
        Output:
            {
                'success': bool,
                'asset': str,
                'available': float,
                'total': float,
                'wallet_balance': float
            }
        """
        try:
            # ✅ Use Binance-style /fapi/v1/balance endpoint
            result = await self.client._request(
                'GET',
                '/fapi/v1/balance',
                signed=True
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            # Aster returns array of balances (Binance-style)
            # Find the requested asset
            balance_info = None
            if isinstance(data, list):
                for balance in data:
                    if balance.get('asset') == asset:
                        balance_info = balance
                        break
            
            if not balance_info:
                return {
                    'success': False,
                    'error': f'Asset {asset} not found in balance'
                }
            
            return {
                'success': True,
                'asset': asset,
                'available': float(balance_info.get('availableBalance', 0)),
                'total': float(balance_info.get('balance', 0)),
                'wallet_balance': float(balance_info.get('balance', 0))
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
            # ✅ Binance-style uses /fapi/v1/positionRisk
            result = await self.client._request(
                'GET',
                '/fapi/v1/positionRisk',
                signed=True
            )
            
            if not result['success']:
                return result
            
            data = result['data']
            
            # ✅ Aster returns array directly (Binance-style)
            positions = []
            pos_list = data if isinstance(data, list) else data.get('positions', [])
            
            for pos in pos_list:
                # Filter out empty positions (positionAmt == 0)
                pos_amt = float(pos.get('positionAmt', 0))
                if pos_amt != 0:
                    positions.append({
                        'symbol': pos.get('symbol'),
                        'size': abs(pos_amt),
                        'entry_price': float(pos.get('entryPrice', 0)),
                        'leverage': float(pos.get('leverage', 1)),
                        'pnl': float(pos.get('unRealizedProfit', 0)),
                        'side': 'LONG' if pos_amt > 0 else 'SHORT'
                    })
            
            return {
                'success': True,
                'count': len(positions),
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

