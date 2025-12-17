"""
Helper functions để lấy balance từ SDK
"""

from typing import Dict, Optional

from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.market import MarketData as LighterMarketData
from perpsdex.aster.core.client import AsterClient
from perpsdex.aster.core.market import MarketData as AsterMarketData

from api.utils import initialize_lighter_client, initialize_aster_client, get_keys_or_env


async def get_lighter_balance(client: LighterClient, account_index: int) -> Dict:
    """
    Lấy balance từ Lighter
    
    Returns:
        Dict: {
            'exchange': 'lighter',
            'available': float,
            'collateral': float,
            'total': float,
            'success': bool,
            'error': str (nếu có)
        }
    """
    try:
        market = LighterMarketData(
            client.get_order_api(),
            client.get_account_api()
        )
        
        result = await market.get_account_balance(account_index)
        
        if result.get('success'):
            return {
                'exchange': 'lighter',
                'available': result.get('available', 0),
                'collateral': result.get('collateral', 0),
                'total': result.get('total', 0),
                'success': True
            }
        else:
            return {
                'exchange': 'lighter',
                'available': 0,
                'collateral': 0,
                'total': 0,
                'success': False,
                'error': result.get('error', 'Unknown error')
            }
    except Exception as e:
        import traceback
        print(f"[Lighter Balance] ❌ Error: {e}")
        traceback.print_exc()
        return {
            'exchange': 'lighter',
            'available': 0,
            'collateral': 0,
            'total': 0,
            'success': False,
            'error': str(e)
        }


async def get_aster_balance(client: AsterClient) -> Dict:
    """
    Lấy balance từ Aster
    
    Returns:
        Dict: {
            'exchange': 'aster',
            'available': float,
            'total': float,
            'wallet_balance': float,
            'success': bool,
            'error': str (nếu có)
        }
    """
    try:
        market = AsterMarketData(client)
        result = await market.get_balance(asset='USDT')
        
        if result.get('success'):
            return {
                'exchange': 'aster',
                'available': result.get('available', 0),
                'total': result.get('total', 0),
                'wallet_balance': result.get('wallet_balance', 0),
                'success': True
            }
        else:
            return {
                'exchange': 'aster',
                'available': 0,
                'total': 0,
                'wallet_balance': 0,
                'success': False,
                'error': result.get('error', 'Unknown error')
            }
    except Exception as e:
        import traceback
        print(f"[Aster Balance] ❌ Error: {e}")
        traceback.print_exc()
        return {
            'exchange': 'aster',
            'available': 0,
            'total': 0,
            'wallet_balance': 0,
            'success': False,
            'error': str(e)
        }

