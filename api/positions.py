"""
Helper functions để lấy positions và open orders từ SDK
"""

from typing import Dict, List, Optional

from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.market import MarketData as LighterMarketData
from perpsdex.lighter.utils.config import ConfigLoader as LighterConfigLoader
from perpsdex.aster.core.client import AsterClient
from perpsdex.aster.core.market import MarketData as AsterMarketData
from perpsdex.aster.core.order import OrderExecutor as AsterOrderExecutor


async def get_lighter_positions(client: LighterClient, account_index: int) -> List[Dict]:
    """
    Lấy positions từ Lighter và tính PnL
    
    Returns:
        List[Dict]: [
            {
                'exchange': 'lighter',
                'symbol_base': 'BTC',
                'side': 'long' | 'short',
                'order_type': 'market' | 'limit',
                'size_usd': float,
                'leverage': int,
                'entry_price': float,
                'current_price': float,
                'position_size': float,
                'pnl_usd': float,
                'pnl_percent': float,
                'exchange_order_id': str,
                'created_at': str
            }
        ]
    """
    try:
        market = LighterMarketData(
            client.get_order_api(),
            client.get_account_api()
        )
        
        result = await market.get_positions(account_index)
        
        if not result.get('success'):
            return []
        
        positions = result.get('positions', [])
        if not positions:
            return []
        
        # Convert market_id sang symbol và lấy giá hiện tại
        formatted_positions = []
        for pos in positions:
            market_id = pos.get('market_id')
            size = pos.get('size', 0)
            entry_price = pos.get('avg_entry_price', 0)
            
            if size == 0:
                continue
            
            # Lấy symbol từ market_id (reverse mapping)
            try:
                # Reverse lookup từ PAIR_TO_MARKET_ID
                pair_to_market = LighterConfigLoader.PAIR_TO_MARKET_ID
                market_to_pair = {v: k for k, v in pair_to_market.items()}
                pair = market_to_pair.get(market_id)
                if pair:
                    symbol_base = pair.split('-')[0]  # BTC-USDT -> BTC
                else:
                    symbol_base = f"MARKET_{market_id}"
            except Exception:
                symbol_base = f"MARKET_{market_id}"
            
            # Lấy giá hiện tại
            price_result = await market.get_price(market_id, symbol_base)
            current_price = price_result.get('mid', entry_price) if price_result.get('success') else entry_price
            
            # Xác định side (dựa vào size: positive = long, negative = short)
            side = 'long' if size > 0 else 'short'
            size_abs = abs(size)
            
            # Tính PnL
            if side == 'long':
                pnl_usd = (current_price - entry_price) * size_abs
            else:
                pnl_usd = (entry_price - current_price) * size_abs
            
            pnl_percent = (pnl_usd / (entry_price * size_abs)) * 100 if entry_price > 0 else 0
            
            # Tính size_usd (approximate)
            size_usd = entry_price * size_abs
            
            formatted_positions.append({
                'exchange': 'lighter',
                'symbol_base': symbol_base,
                'side': side,
                'order_type': 'market',  # Lighter không lưu order_type trong position
                'size_usd': size_usd,
                'leverage': 1,  # Lighter không lưu leverage trong position
                'entry_price': entry_price,
                'current_price': current_price,
                'position_size': size_abs,
                'pnl_usd': pnl_usd,
                'pnl_percent': pnl_percent,
                'exchange_order_id': f"lighter_market_{market_id}",
                'created_at': None  # Lighter không lưu created_at
            })
        
        return formatted_positions
        
    except Exception as e:
        print(f"[Lighter] Error getting positions: {e}")
        return []


async def get_aster_positions(client: AsterClient) -> List[Dict]:
    """
    Lấy positions từ Aster (đã có PnL sẵn)
    
    Returns:
        List[Dict]: Same format as get_lighter_positions
    """
    try:
        market = AsterMarketData(client)
        result = await market.get_positions()
        
        if not result.get('success'):
            return []
        
        positions = result.get('positions', [])
        if not positions:
            return []
        
        formatted_positions = []
        for pos in positions:
            symbol = pos.get('symbol', '')
            # Remove USDT suffix: BTCUSDT -> BTC
            symbol_base = symbol.replace('USDT', '') if symbol.endswith('USDT') else symbol
            
            side_str = pos.get('side', 'LONG')
            side = 'long' if side_str == 'LONG' else 'short'
            
            entry_price = pos.get('entry_price', 0)
            size = pos.get('size', 0)
            leverage = int(pos.get('leverage', 1))
            pnl_usd = pos.get('pnl', 0)
            
            # Tính current_price từ PnL
            if side == 'long' and size > 0:
                current_price = entry_price + (pnl_usd / size)
            elif side == 'short' and size > 0:
                current_price = entry_price - (pnl_usd / size)
            else:
                current_price = entry_price
            
            # Tính size_usd
            size_usd = entry_price * size
            
            # Tính pnl_percent
            pnl_percent = (pnl_usd / size_usd) * 100 if size_usd > 0 else 0
            
            formatted_positions.append({
                'exchange': 'aster',
                'symbol_base': symbol_base,
                'side': side,
                'order_type': 'market',  # Aster không lưu order_type trong position
                'size_usd': size_usd,
                'leverage': leverage,
                'entry_price': entry_price,
                'current_price': current_price,
                'position_size': size,
                'pnl_usd': pnl_usd,
                'pnl_percent': pnl_percent,
                'exchange_order_id': f"aster_{symbol}",
                'created_at': None  # Aster không lưu created_at trong position
            })
        
        return formatted_positions
        
    except Exception as e:
        print(f"[Aster] Error getting positions: {e}")
        return []


async def get_lighter_open_orders(client: LighterClient, account_index: int) -> List[Dict]:
    """
    Lấy open orders từ Lighter
    
    Returns:
        List[Dict]: [
            {
                'exchange': 'lighter',
                'symbol_base': 'BTC',
                'side': 'long' | 'short',
                'order_type': 'limit',
                'size_usd': float,
                'leverage': int,
                'limit_price': float,
                'tp_price': Optional[float],
                'sl_price': Optional[float],
                'exchange_order_id': str
            }
        ]
    """
    try:
        order_api = client.get_order_api()
        
        # Lấy orders từ account
        orders_result = await order_api.orders(
            by='account_index',
            value=str(account_index),
            limit=100
        )
        
        if not orders_result or not orders_result.orders:
            return []
        
        # Filter open orders (status = pending/open)
        open_orders = []
        for order in orders_result.orders:
            status = getattr(order, 'status', 'unknown')
            # Chỉ lấy orders đang pending/open
            if status not in ['pending', 'open', 'active']:
                continue
            
            market_id = getattr(order, 'market_id', None)
            if not market_id:
                continue
            
            # Lấy symbol từ market_id (reverse mapping)
            try:
                # Reverse lookup từ PAIR_TO_MARKET_ID
                pair_to_market = LighterConfigLoader.PAIR_TO_MARKET_ID
                market_to_pair = {v: k for k, v in pair_to_market.items()}
                pair = market_to_pair.get(market_id)
                if pair:
                    symbol_base = pair.split('-')[0]  # BTC-USDT -> BTC
                else:
                    symbol_base = f"MARKET_{market_id}"
            except Exception:
                symbol_base = f"MARKET_{market_id}"
            
            is_ask = getattr(order, 'is_ask', 0)
            side = 'short' if is_ask == 1 else 'long'
            price = float(getattr(order, 'price', 0))
            size = float(getattr(order, 'size', 0))
            
            # Tính size_usd
            size_usd = price * size if price > 0 else 0
            
            open_orders.append({
                'exchange': 'lighter',
                'symbol_base': symbol_base,
                'side': side,
                'order_type': 'limit',
                'size_usd': size_usd,
                'leverage': 1,  # Lighter không lưu leverage trong order
                'limit_price': price,
                'tp_price': None,  # Lighter không lưu TP/SL trong order object
                'sl_price': None,
                'exchange_order_id': str(getattr(order, 'client_order_index', ''))
            })
        
        return open_orders
        
    except Exception as e:
        print(f"[Lighter] Error getting open orders: {e}")
        return []


async def get_aster_open_orders(client: AsterClient, symbol: Optional[str] = None) -> List[Dict]:
    """
    Lấy open orders từ Aster
    
    Returns:
        List[Dict]: Same format as get_lighter_open_orders
    """
    try:
        executor = AsterOrderExecutor(client)
        result = await executor.get_open_orders(symbol)
        
        if not result.get('success'):
            return []
        
        orders = result.get('orders', [])
        if not orders:
            return []
        
        formatted_orders = []
        for order in orders:
            symbol_full = order.get('symbol', '')
            symbol_base = symbol_full.replace('USDT', '') if symbol_full.endswith('USDT') else symbol_full
            
            side_str = order.get('side', 'BUY')
            side = 'long' if side_str == 'BUY' else 'short'
            
            order_type = order.get('type', 'LIMIT')
            order_type_lower = order_type.lower().replace('_', '')
            
            price = float(order.get('price', 0))
            orig_qty = float(order.get('origQty', 0))
            size_usd = price * orig_qty if price > 0 else 0
            
            # Aster có thể có stopPrice cho TP/SL
            stop_price = order.get('stopPrice')
            tp_price = stop_price if order_type in ['TAKE_PROFIT', 'TAKE_PROFIT_MARKET'] else None
            sl_price = stop_price if order_type in ['STOP', 'STOP_MARKET', 'STOP_LOSS', 'STOP_LOSS_MARKET'] else None
            
            formatted_orders.append({
                'exchange': 'aster',
                'symbol_base': symbol_base,
                'side': side,
                'order_type': order_type_lower,
                'size_usd': size_usd,
                'leverage': int(order.get('leverage', 1)),
                'limit_price': price,
                'tp_price': float(tp_price) if tp_price else None,
                'sl_price': float(sl_price) if sl_price else None,
                'exchange_order_id': str(order.get('orderId', ''))
            })
        
        return formatted_orders
        
    except Exception as e:
        print(f"[Aster] Error getting open orders: {e}")
        return []

