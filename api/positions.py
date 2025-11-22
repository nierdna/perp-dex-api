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
        print(f"[Lighter Positions] Starting... account_index={account_index}")
        
        # Lấy trực tiếp từ Account API để xem raw data và dùng nó thay vì qua MarketData
        account_api = client.get_account_api()
        print(f"[Lighter Positions] Getting account data directly from Account API...")
        accounts_data = await account_api.account(by='index', value=str(account_index))
        
        if not accounts_data or not accounts_data.accounts:
            print(f"[Lighter Positions] ❌ No account data found")
            return []
        
        account = accounts_data.accounts[0]
        raw_positions = account.positions or []
        print(f"[Lighter Positions] Raw positions from account: {len(raw_positions)}")
        
        if not raw_positions:
            print("[Lighter Positions] ⚠️ No positions in account")
            return []
        
        # Log từng position object để xem structure
        positions_to_process = []
        for idx, raw_pos in enumerate(raw_positions):
            print(f"[Lighter Positions] Raw position {idx+1}: {raw_pos}")
            print(f"[Lighter Positions] Raw position {idx+1} type: {type(raw_pos)}")
            if hasattr(raw_pos, '__dict__'):
                print(f"[Lighter Positions] Raw position {idx+1} __dict__: {raw_pos.__dict__}")
            # Try to get all attributes
            attrs = [attr for attr in dir(raw_pos) if not attr.startswith('_')]
            print(f"[Lighter Positions] Raw position {idx+1} attributes: {attrs}")
            
            # Lighter dùng field 'position' (string), không phải 'size'
            market_id = getattr(raw_pos, 'market_id', None)
            position_str = getattr(raw_pos, 'position', '0')
            sign = getattr(raw_pos, 'sign', 1)  # 1 = long, -1 = short (có thể)
            
            # Convert position string to float
            try:
                position_float = float(position_str) if position_str is not None else 0.0
            except (ValueError, TypeError):
                print(f"[Lighter Positions] ⚠️ Cannot convert position to float: {position_str} (type: {type(position_str)})")
                position_float = 0.0
            
            # Size = position * sign (nếu sign được dùng để chỉ direction)
            # Nhưng từ logs, position='0.00119' và sign=1, có vẻ position đã là absolute value
            # Vậy size = position_float, và side được xác định sau
            size = position_float
            
            avg_entry_price = getattr(raw_pos, 'avg_entry_price', 0)
            try:
                avg_entry_price = float(avg_entry_price) if avg_entry_price is not None else 0.0
            except (ValueError, TypeError):
                avg_entry_price = 0.0
            
            # Log để debug
            print(f"[Lighter Positions] Raw position {idx+1}.position = {position_str} (type: {type(position_str)})")
            print(f"[Lighter Positions] Raw position {idx+1}.sign = {sign} (type: {type(sign)})")
            print(f"[Lighter Positions] Raw position {idx+1} converted: position_float={position_float}, size={size}")
            
            print(f"[Lighter Positions] Position {idx+1} extracted: market_id={market_id}, size={size}, entry={avg_entry_price}")
            
            # Chỉ thêm position có size != 0
            if size != 0:
                positions_to_process.append({
                    'market_id': market_id,
                    'size': size,
                    'avg_entry_price': avg_entry_price,
                    'raw': raw_pos  # Keep raw for debugging
                })
        
        print(f"[Lighter Positions] Positions with size != 0: {len(positions_to_process)}")
        
        if not positions_to_process:
            print("[Lighter Positions] ⚠️ All positions have size=0, skipping")
            return []
        
        # Use positions_to_process (đã lấy trực tiếp từ Account API)
        positions = positions_to_process
        print(f"[Lighter Positions] Processing {len(positions)} positions with size != 0...")
        
        market = LighterMarketData(
            client.get_order_api(),
            client.get_account_api()
        )
        
        # Convert market_id sang symbol và lấy giá hiện tại
        formatted_positions = []
        for idx, pos in enumerate(positions):
            market_id = pos['market_id']
            size = pos['size']
            entry_price = pos['avg_entry_price']
            raw_pos = pos.get('raw')  # Keep raw for additional fields if needed
            
            print(f"[Lighter Positions] Processing position {idx+1}: market_id={market_id}, size={size}, entry_price={entry_price}")
            
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
            try:
                print(f"[Lighter Positions] Getting price for market_id={market_id}, symbol={symbol_base}...")
                price_result = await market.get_price(market_id, symbol_base)
                print(f"[Lighter Positions] Price result: success={price_result.get('success')}, mid={price_result.get('mid')}")
                current_price = price_result.get('mid', entry_price) if price_result.get('success') else entry_price
            except Exception as price_err:
                print(f"[Lighter Positions] ⚠️ Error getting price: {price_err}, using entry_price")
                current_price = entry_price
            
            # Xác định side (dựa vào sign từ raw position, hoặc mặc định long nếu size > 0)
            if raw_pos:
                sign = getattr(raw_pos, 'sign', 1)
                # sign=1 thường là long, nhưng cần kiểm tra
                side = 'long' if sign >= 0 else 'short'
            else:
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
            
            # Tạo unique position_id từ market_id, entry_price, side
            position_id = f"lighter_{market_id}_{entry_price}_{side}"
            
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
                'position_id': position_id,  # Unique ID để đóng position cụ thể
                'market_id': market_id,  # Thêm market_id để dùng khi close
                'created_at': None  # Lighter không lưu created_at
            })
            print(f"[Lighter Positions] ✅ Added position: {symbol_base} {side} {size_abs} @ ${entry_price}")
        
        print(f"[Lighter Positions] ✅ Total formatted positions: {len(formatted_positions)}")
        return formatted_positions
        
    except Exception as e:
        import traceback
        print(f"[Lighter Positions] ❌ Exception: {e}")
        traceback.print_exc()
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
            
            # Tạo unique position_id từ symbol, entry_price, side
            position_id = f"aster_{symbol}_{entry_price}_{side}"
            
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
                'position_id': position_id,  # Unique ID để đóng position cụ thể
                'created_at': None  # Aster không lưu created_at trong position
            })
        
        return formatted_positions
        
    except Exception as e:
        print(f"[Aster] Error getting positions: {e}")
        return []


async def get_lighter_open_orders(client: LighterClient, account_index: int) -> List[Dict]:
    """
    Lấy open orders từ Lighter (từ DB vì SDK không có method trực tiếp)
    
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
    print(f"[Lighter Open Orders] Starting... account_index={account_index}")
    
    # Lighter SDK không có method để lấy open orders trực tiếp
    # Cần query từ DB các lệnh LIMIT/TP/SL đang ở trạng thái 'submitted' hoặc 'pending'
    # và chưa có position_size_asset > 0
    
    # Import query_orders nếu chưa có
    try:
        from db import query_orders as _query_orders
    except Exception as _db_import_err:
        print(f"[Lighter Open Orders] ⚠️ DB module not available: {_db_import_err}")
        return []
    
    try:
        print("[Lighter Open Orders] Querying DB for submitted/pending LIMIT/TP/SL orders...")
        lighter_open_orders_db = _query_orders(
            exchange="lighter",
            status="submitted",  # Hoặc 'pending' nếu muốn hiển thị cả lệnh chưa gửi
            order_type=["limit", "take_profit", "stop_loss"]
        )
        
        print(f"[Lighter Open Orders] Found {len(lighter_open_orders_db)} orders from DB")
        
        formatted_open_orders = []
        for order in lighter_open_orders_db:
            # Chỉ lấy các lệnh chưa khớp hoặc khớp 1 phần nhỏ
            position_size = order.get("position_size_asset", 0) or 0
            if position_size == 0:
                formatted_open_orders.append({
                    "exchange": "lighter",
                    "symbol_base": order.get("symbol_base"),
                    "side": order.get("side"),
                    "order_type": order.get("order_type"),
                    "size_usd": order.get("size_usd"),
                    "leverage": order.get("leverage"),
                    "limit_price": order.get("limit_price"),
                    "tp_price": order.get("tp_price"),
                    "sl_price": order.get("sl_price"),
                    "client_order_id": order.get("client_order_id"),
                    "exchange_order_id": order.get("exchange_order_id"),
                    "created_at": order.get("created_at"),
                })
        
        print(f"[Lighter Open Orders] ✅ Returning {len(formatted_open_orders)} open orders from DB")
        return formatted_open_orders
        
    except Exception as e:
        import traceback
        print(f"[Lighter Open Orders] ❌ Error getting open orders: {e}")
        traceback.print_exc()
        return []


async def get_aster_open_orders(client: AsterClient, symbol: Optional[str] = None) -> List[Dict]:
    """
    Lấy open orders từ Aster
    
    Returns:
        List[Dict]: Same format as get_lighter_open_orders
    """
    try:
        print(f"[Aster Open Orders] Starting... symbol={symbol}")
        executor = AsterOrderExecutor(client)
        
        print(f"[Aster Open Orders] Calling executor.get_open_orders(symbol={symbol})...")
        result = await executor.get_open_orders(symbol)
        
        print(f"[Aster Open Orders] Raw result: {result}")
        print(f"[Aster Open Orders] Result success: {result.get('success')}")
        print(f"[Aster Open Orders] Result orders: {result.get('orders')}")
        
        if not result.get('success'):
            error_msg = result.get('message', 'Unknown error')
            print(f"[Aster Open Orders] ❌ Failed: {error_msg}")
            return []
        
        orders = result.get('orders', [])
        print(f"[Aster Open Orders] Found {len(orders)} orders")
        if not orders:
            print("[Aster Open Orders] ⚠️ No orders found")
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
        
        print(f"[Aster Open Orders] ✅ Returning {len(formatted_orders)} formatted orders")
        return formatted_orders
        
    except Exception as e:
        import traceback
        print(f"[Aster Open Orders] ❌ Error getting open orders: {e}")
        traceback.print_exc()
        return []

