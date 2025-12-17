"""
Order handlers for Lighter, Aster, and Hyperliquid exchanges
"""

from typing import Optional
from fastapi import HTTPException

from perpsdex.lighter.core.market import MarketData as LighterMarketData
from perpsdex.lighter.core.order import OrderExecutor as LighterOrderExecutor
from perpsdex.lighter.core.risk import RiskManager as LighterRiskManager
from perpsdex.aster.core.market import MarketData as AsterMarketData
from perpsdex.aster.core.order import OrderExecutor as AsterOrderExecutor
from perpsdex.aster.core.risk import RiskManager as AsterRiskManager
from perpsdex.hyperliquid.core.market import HyperliquidMarketData
from perpsdex.hyperliquid.core.order import HyperliquidOrderExecutor
from perpsdex.hyperliquid.core.risk import HyperliquidRiskManager

from api.models import UnifiedOrderRequest
from api.utils import (
    initialize_lighter_client,
    initialize_aster_client,
    initialize_hyperliquid_client,
    normalize_symbol,
    validate_tp_sl,
)

# Import Hyperliquid handlers
from .hyperliquid import (
    handle_hyperliquid_order,
    handle_hyperliquid_close_position,
)



async def handle_lighter_order(order: UnifiedOrderRequest, keys: dict) -> dict:
    """Xử lý lệnh cho Lighter (market/limit, long/short, TP/SL theo giá)"""
    client = await initialize_lighter_client(keys)
    norm = normalize_symbol("lighter", order.symbol)
    market_id = norm["market_id"]
    symbol = norm["base_symbol"]

    market = LighterMarketData(client.get_order_api(), client.get_account_api())

    # Lấy entry_price
    if order.order_type == "market":
        price_result = await market.get_price(market_id, symbol)
        if not price_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Lighter: không lấy được giá thị trường cho {symbol}",
            )
        entry_price = price_result["ask"] if order.side == "long" else price_result["bid"]
    else:
        if not order.limit_price:
            raise HTTPException(
                status_code=400,
                detail="limit_price bắt buộc khi order_type = 'limit' cho Lighter",
            )
        entry_price = order.limit_price

    # Validate TP/SL
    validate_tp_sl(order.side, entry_price, order.tp_price, order.sl_price)

    executor = LighterOrderExecutor(client.get_signer_client(), client.get_order_api())

    if order.order_type == "market":
        result = await executor.place_order(
            side=order.side,
            entry_price=entry_price,
            position_size_usd=order.size_usd,
            market_id=market_id,
            symbol=symbol,
            leverage=order.leverage,
            max_slippage_percent=order.max_slippage_percent,
        )
    else:
        result = await executor.place_limit_order(
            side=order.side,
            limit_price=order.limit_price,
            position_size_usd=order.size_usd,
            market_id=market_id,
            symbol=symbol,
            leverage=order.leverage,
        )

    if not result or not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Lighter: đặt lệnh thất bại")
            if result
            else "Lighter: không nhận được phản hồi từ place_order",
        )

    # TP/SL nếu có
    tp_sl_info = None
    if order.tp_price or order.sl_price:
        risk_manager = LighterRiskManager(client.get_signer_client(), client.get_order_api())
        position_size = result.get("position_size") or result.get("size")
        if position_size is None:
            raise HTTPException(
                status_code=500,
                detail="Lighter: không nhận được position_size từ kết quả order",
            )

        tp_sl_result = await risk_manager.place_tp_sl_orders(
            entry_price=entry_price,
            position_size=position_size,
            side=order.side,
            tp_price=order.tp_price,
            sl_price=order.sl_price,
            market_id=market_id,
            symbol=symbol,
        )
        tp_sl_info = {
            "raw": tp_sl_result,
            "tp_price": order.tp_price,
            "sl_price": order.sl_price,
        }

    return {
        "success": True,
        "exchange": "lighter",
        "symbol": symbol,
        "side": order.side,
        "order_type": order.order_type,
        "order_id": result.get("order_id"),
        "entry_price": result.get("entry_price", entry_price),
        "position_size": result.get("position_size"),
        "size_usd": order.size_usd,
        "leverage": order.leverage,
        "tp_price": order.tp_price,
        "sl_price": order.sl_price,
        "tp_sl": tp_sl_info,
    }


async def handle_aster_order(order: UnifiedOrderRequest, keys: dict) -> dict:
    """Xử lý lệnh cho Aster (market/limit, long/short, TP/SL theo giá)"""
    client = await initialize_aster_client(keys)
    norm = normalize_symbol("aster", order.symbol)
    symbol_pair = norm["symbol_pair"]
    symbol_api = norm["symbol_api"]

    market = AsterMarketData(client)

    # Lấy entry_price
    if order.order_type == "market":
        price_result = await market.get_price(symbol_pair)
        if not price_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Aster: không lấy được giá thị trường cho {symbol_pair}",
            )
        entry_price = price_result["ask"] if order.side == "long" else price_result["bid"]
    else:
        if not order.limit_price:
            raise HTTPException(
                status_code=400,
                detail="limit_price bắt buộc khi order_type = 'limit' cho Aster",
            )
        entry_price = order.limit_price

    # Validate TP/SL
    validate_tp_sl(order.side, entry_price, order.tp_price, order.sl_price)

    executor = AsterOrderExecutor(client)
    side_str = "BUY" if order.side == "long" else "SELL"

    if order.order_type == "market":
        result = await executor.place_market_order(
            symbol=symbol_api,
            side=side_str,
            size=order.size_usd,
            leverage=order.leverage,
        )
        if not result or not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Aster: đặt lệnh MARKET thất bại")
                if result
                else "Aster: không nhận được phản hồi từ place_market_order",
            )
        position_size = result.get("filled_size", order.size_usd / entry_price)
        entry_used = result.get("filled_price", entry_price)
    else:
        result = await executor.place_limit_order(
            symbol=symbol_api,
            side=side_str,
            size=order.size_usd,
            price=order.limit_price,
            leverage=order.leverage,
        )
        if not result or not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Aster: đặt lệnh LIMIT thất bại")
                if result
                else "Aster: không nhận được phản hồi từ place_limit_order",
            )
        position_size = result.get("size", order.size_usd / entry_price)
        entry_used = entry_price

    # TP/SL nếu có
    tp_sl_info = None
    if order.tp_price or order.sl_price:
        risk_manager = AsterRiskManager(client, executor)
        tp_sl_result = await risk_manager.place_tp_sl(
            symbol=symbol_api,
            side=side_str,
            size=position_size,
            entry_price=entry_used,
            tp_price=order.tp_price,
            sl_price=order.sl_price,
        )
        tp_sl_info = {
            "raw": tp_sl_result,
            "tp_price": order.tp_price,
            "sl_price": order.sl_price,
        }

    return {
        "success": True,
        "exchange": "aster",
        "symbol": norm["base_symbol"],
        "side": order.side,
        "order_type": order.order_type,
        "order_id": result.get("order_id"),
        "entry_price": entry_used,
        "position_size": position_size,
        "size_usd": order.size_usd,
        "leverage": order.leverage,
        "tp_price": order.tp_price,
        "sl_price": order.sl_price,
        "tp_sl": tp_sl_info,
    }



async def handle_lighter_close_position(
    symbol: str,
    percentage: float,
    keys: dict,
    position_id: Optional[str] = None,
    entry_price: Optional[float] = None,
    side: Optional[str] = None
) -> dict:
    """Đóng position trên Lighter"""
    from perpsdex.lighter.utils.calculator import Calculator
    import time as time_module
    
    client = await initialize_lighter_client(keys)
    norm = normalize_symbol("lighter", symbol)
    market_id = norm["market_id"]
    symbol_base = norm["base_symbol"]
    
    # Lấy position hiện tại
    account_api = client.get_account_api()
    account_index = keys.get("account_index", 0)
    accounts_data = await account_api.account(by='index', value=str(account_index))
    
    if not accounts_data or not accounts_data.accounts:
        raise HTTPException(status_code=404, detail=f"No account found for Lighter")
    
    account = accounts_data.accounts[0]
    positions = account.positions or []
    
    # Tìm position cho market_id này
    # Nếu có position_id, entry_price, hoặc side -> match chính xác
    # Nếu không -> lấy position đầu tiên có size != 0
    position = None
    for pos in positions:
        if pos.market_id == market_id:
            position_str = getattr(pos, 'position', '0')
            try:
                position_size = float(position_str) if position_str else 0.0
            except (ValueError, TypeError):
                position_size = 0.0
            
            if position_size != 0:
                pos_side = 'long' if position_size > 0 else 'short'
                pos_entry_price = float(getattr(pos, 'avg_entry_price', 0))
                
                # Match với criteria nếu có
                if position_id:
                    # Check position_id format: lighter_{market_id}_{entry_price}_{side}
                    expected_id = f"lighter_{market_id}_{pos_entry_price}_{pos_side}"
                    if position_id != expected_id:
                        continue
                
                if entry_price is not None:
                    # Match entry_price với tolerance 0.01%
                    if abs(pos_entry_price - entry_price) / entry_price > 0.0001:
                        continue
                
                if side is not None:
                    if pos_side != side.lower():
                        continue
                
                position = {
                    'market_id': market_id,
                    'size': position_size,
                    'side': pos_side,
                    'avg_entry_price': pos_entry_price
                }
                break
    
    if not position:
        raise HTTPException(status_code=404, detail=f"No open position found for {symbol} on Lighter")
    
    # Tính close size
    close_size = abs(position['size']) * (percentage / 100.0)
    
    # Lấy giá hiện tại
    market = LighterMarketData(client.get_order_api(), client.get_account_api())
    price_result = await market.get_price(market_id, symbol_base)
    if not price_result.get('success'):
        raise HTTPException(status_code=400, detail="Failed to get current price")
    
    current_price = price_result.get('mid', price_result.get('ask', price_result.get('bid')))
    
    # Lấy market metadata
    metadata_result = await market.get_market_metadata(market_id)
    if not metadata_result.get('success'):
        raise HTTPException(status_code=400, detail=f"Failed to get market metadata: {metadata_result.get('error')}")
    
    size_decimals = metadata_result['size_decimals']
    price_decimals = metadata_result['price_decimals']
    
    # Xác định side để đóng (reverse của position)
    is_long = position['side'] == 'long'
    is_ask = 1 if is_long else 0  # LONG -> SELL, SHORT -> BUY
    
    # Tính close price với 3% slippage
    if is_long:
        close_price = current_price * 0.97  # SELL: willing to sell 3% below market
    else:
        close_price = current_price * 1.03  # BUY: willing to buy 3% above market
    
    # Scale values
    base_amount_int = Calculator.scale_to_int(close_size, size_decimals)
    price_int = Calculator.scale_to_int(close_price, price_decimals)
    
    # Generate order index
    client_order_index = int(time_module.time() * 1000)
    
    # Place close order với reduce_only=True
    order, response, error = await client.get_signer_client().create_order(
        market_id,
        client_order_index,
        base_amount_int,
        price_int,
        is_ask,
        client.get_signer_client().ORDER_TYPE_LIMIT,
        client.get_signer_client().ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
        True,  # reduce_only = True
        client.get_signer_client().NIL_TRIGGER_PRICE,
        client.get_signer_client().DEFAULT_28_DAY_ORDER_EXPIRY,
    )
    
    if error is not None or response is None:
        error_msg = str(error) if error else "Unknown error"
        raise HTTPException(status_code=400, detail=f"Failed to close position: {error_msg}")
    
    # Tính PnL
    entry_price = position['avg_entry_price']
    pnl_percent = None
    if entry_price > 0:
        if is_long:
            pnl_percent = ((current_price - entry_price) / entry_price) * 100
        else:
            pnl_percent = ((entry_price - current_price) / entry_price) * 100
    
    return {
        "success": True,
        "exchange": "lighter",
        "symbol": symbol_base,
        "tx_hash": response.tx_hash,
        "order_id": str(client_order_index),
        "side": position['side'],
        "position_size": position['size'],
        "close_size": close_size,
        "close_percentage": percentage,
        "entry_price": entry_price,
        "close_price": current_price,
        "pnl_percent": pnl_percent
    }


async def handle_aster_close_position(
    symbol: str,
    percentage: float,
    keys: dict,
    position_id: Optional[str] = None,
    entry_price: Optional[float] = None,
    side: Optional[str] = None
) -> dict:
    """Đóng position trên Aster"""
    client = await initialize_aster_client(keys)
    norm = normalize_symbol("aster", symbol)
    symbol_pair = norm["symbol_pair"]
    symbol_api = norm["symbol_api"]
    
    # Lấy position hiện tại
    market_data = AsterMarketData(client)
    position_result = await market_data.get_positions()
    
    if not position_result.get('success'):
        raise HTTPException(status_code=400, detail="Failed to get positions")
    
    positions = position_result.get('positions', [])
    
    print(f"[Aster Close] Looking for symbol: {symbol_api}")
    print(f"[Aster Close] Available positions: {[p.get('symbol') for p in positions]}")
    
    # Tìm position cho symbol này
    # Nếu có position_id, entry_price, hoặc side -> match chính xác
    # Nếu không -> lấy position đầu tiên có size != 0
    position = None
    for pos in positions:
        pos_symbol = pos.get('symbol', '')
        print(f"[Aster Close] Checking position: {pos_symbol} vs {symbol_api}")
        
        # So sánh symbol (cả hai đều ở dạng BTCUSDT)
        if pos_symbol == symbol_api:
            pos_size = pos.get('size', 0)
            if pos_size != 0:
                pos_side_str = pos.get('side', 'LONG')
                pos_side = 'long' if pos_side_str == 'LONG' else 'short'
                pos_entry_price = float(pos.get('entry_price', 0))
                
                # Match với criteria nếu có
                if position_id:
                    # Check position_id format: aster_{symbol}_{entry_price}_{side}
                    expected_id = f"aster_{pos_symbol}_{pos_entry_price}_{pos_side}"
                    if position_id != expected_id:
                        print(f"[Aster Close] Position ID mismatch: {position_id} vs {expected_id}")
                        continue
                
                if entry_price is not None:
                    # Match entry_price với tolerance 0.01%
                    if abs(pos_entry_price - entry_price) / entry_price > 0.0001:
                        print(f"[Aster Close] Entry price mismatch: {pos_entry_price} vs {entry_price}")
                        continue
                
                if side is not None:
                    if pos_side != side.lower():
                        print(f"[Aster Close] Side mismatch: {pos_side} vs {side}")
                        continue
                
                position = pos
                print(f"[Aster Close] ✅ Found position: {pos_symbol}, size={pos_size}, entry={pos_entry_price}, side={pos_side}")
                break
    
    if not position:
        # Log thêm để debug
        print(f"[Aster Close] ❌ No position found. Available symbols: {[p.get('symbol') for p in positions]}")
        raise HTTPException(status_code=404, detail=f"No open position found for {symbol} on Aster")
    
    # Lưu ý: get_positions() trả về 'size' (absolute value) và 'side' (LONG/SHORT)
    # Không phải 'positionAmt' như raw API response
    position_size_abs = float(position.get('size', 0))
    side_str = position.get('side', 'LONG')
    is_long = side_str == 'LONG'
    
    # Tính close size từ absolute size
    abs_size = position_size_abs
    
    # Tính close size (số lượng token cần đóng)
    close_size = abs_size * (percentage / 100.0)
    
    # Place close order (reverse side với reduce_only)
    executor = AsterOrderExecutor(client)
    close_side = 'SELL' if is_long else 'BUY'
    
    # Lấy entry_price và current_price từ position
    entry_price = float(position.get('entry_price', 0))
    current_price = float(position.get('current_price', 0))
    
    # Tính size USD từ close_size (số lượng token) và current_price
    # Dùng current_price thay vì entry_price để tính chính xác hơn
    if current_price > 0:
        close_size_usd = close_size * current_price
    elif entry_price > 0:
        close_size_usd = close_size * entry_price
    else:
        # Fallback: lấy giá từ market
        from perpsdex.aster.core.market import MarketData
        market = MarketData(client)
        price_result = await market.get_price(symbol_pair)
        if price_result.get('success'):
            market_price = price_result.get('ask' if close_side == 'BUY' else 'bid', 0)
            close_size_usd = close_size * market_price if market_price > 0 else 0
        else:
            close_size_usd = 0
    
    print(f"[Aster Close] Position details:")
    print(f"  Size: {abs_size}")
    print(f"  Side: {side_str}")
    print(f"  Entry Price: {entry_price}")
    print(f"  Current Price: {current_price}")
    print(f"  Close Size (tokens): {close_size} ({percentage}%)")
    print(f"  Close Size USD: {close_size_usd}")
    
    # Đảm bảo close_size_usd > 0
    if close_size_usd <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid close size: {close_size_usd} USD (close_size={close_size}, price={current_price or entry_price})")
    
    result = await executor.place_market_order(
        symbol=symbol_api,
        side=close_side,
        size=close_size_usd,
        reduce_only=True  # Only close position
    )
    
    if not result.get('success'):
        error_msg = result.get('error', 'Unknown error')
        raise HTTPException(status_code=400, detail=f"Failed to close position: {error_msg}")
    
    # Tính PnL từ unRealizedProfit trong position
    pnl_usd = float(position.get('pnl', 0))
    entry_price = float(position.get('entry_price', 0))
    
    # Tính current_price từ PnL và entry_price
    if entry_price > 0 and abs_size > 0:
        if is_long:
            current_price = entry_price + (pnl_usd / abs_size)
        else:
            current_price = entry_price - (pnl_usd / abs_size)
    else:
        current_price = entry_price
    
    pnl_percent = None
    if entry_price > 0:
        pnl_percent = (pnl_usd / (entry_price * abs_size)) * 100
    
    return {
        "success": True,
        "exchange": "aster",
        "symbol": norm["base_symbol"],
        "order_id": result.get('order_id'),
        "side": "long" if is_long else "short",
        "position_size": abs_size if is_long else -abs_size,  # Return signed size
        "close_size": close_size,
        "close_percentage": percentage,
        "entry_price": entry_price,
        "close_price": current_price,
        "pnl_percent": pnl_percent
    }
