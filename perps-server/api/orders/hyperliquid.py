
from typing import Optional
from fastapi import HTTPException

from api.models import UnifiedOrderRequest
from api.utils import (
    initialize_hyperliquid_client,
    normalize_symbol,
    validate_tp_sl
)
from perpsdex.hyperliquid.core.market import HyperliquidMarketData
from perpsdex.hyperliquid.core.order import HyperliquidOrderExecutor
from perpsdex.hyperliquid.core.risk import HyperliquidRiskManager


async def handle_hyperliquid_order(order: UnifiedOrderRequest, keys: dict) -> dict:
    """Xử lý lệnh cho Hyperliquid (market/limit, long/short, TP/SL theo giá)"""
    client = await initialize_hyperliquid_client(keys)
    norm = normalize_symbol("hyperliquid", order.symbol)
    symbol = norm["symbol"]
    
    market = HyperliquidMarketData(client.get_info_api(), client.get_address())
    
    # Lấy entry_price
    if order.order_type == "market":
        price_result = await market.get_price(symbol)
        if not price_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Hyperliquid: không lấy được giá thị trường cho {symbol}",
            )
        entry_price = price_result["ask"] if order.side == "long" else price_result["bid"]
    else:
        if not order.limit_price:
            raise HTTPException(
                status_code=400,
                detail="limit_price bắt buộc khi order_type = 'limit' cho Hyperliquid",
            )
        entry_price = order.limit_price
    
    # Validate TP/SL
    validate_tp_sl(order.side, entry_price, order.tp_price, order.sl_price)
    
    executor = HyperliquidOrderExecutor(
        client.get_exchange_api(),
        client.get_info_api(),
        client.get_address()
    )
    
    if order.order_type == "market":
        result = await executor.place_market_order(
            symbol=symbol,
            side=order.side,
            size_usd=order.size_usd,
            leverage=int(order.leverage),
            max_slippage_percent=order.max_slippage_percent,
        )
    else:
        result = await executor.place_limit_order(
            symbol=symbol,
            side=order.side,
            size_usd=order.size_usd,
            limit_price=order.limit_price,
            leverage=int(order.leverage),
        )
    
    if not result:
        print("[Hyperliquid] ❌ No result returned from executor")
        raise HTTPException(
            status_code=500,
            detail="Hyperliquid: không nhận được phản hồi từ place_order"
        )

    if not result.get("success"):
        error_msg = result.get("error", "Hyperliquid: đặt lệnh thất bại")
        print(f"[Hyperliquid] ❌ Order Failed: {error_msg}")
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )

    
    # TP/SL nếu có
    tp_sl_info = None
    if order.tp_price or order.sl_price:
        risk_manager = HyperliquidRiskManager(client.get_exchange_api(), client.get_address())
        position_size = result.get("position_size") or result.get("filled_size") or result.get("size")
        
        if position_size is None:
            raise HTTPException(
                status_code=500,
                detail="Hyperliquid: không nhận được position_size từ kết quả order",
            )
        
        tp_sl_result = await risk_manager.place_tp_sl_orders(
            symbol=symbol,
            side=order.side,
            size=position_size,
            entry_price=result.get("entry_price", entry_price),
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
        "exchange": "hyperliquid",
        "symbol": symbol,
        "side": order.side,
        "order_type": order.order_type,
        "order_id": result.get("order_id"),
        "entry_price": result.get("entry_price", entry_price),
        "position_size": result.get("position_size") or result.get("filled_size"),
        "size_usd": order.size_usd,
        "leverage": order.leverage,
        "tp_price": order.tp_price,
        "sl_price": order.sl_price,
        "tp_sl": tp_sl_info,
    }


async def handle_hyperliquid_close_position(
    symbol: str,
    percentage: float,
    keys: dict,
    position_id: Optional[str] = None,
    entry_price: Optional[float] = None,
    side: Optional[str] = None
) -> dict:
    """Đóng position trên Hyperliquid"""
    client = await initialize_hyperliquid_client(keys)
    norm = normalize_symbol("hyperliquid", symbol)
    symbol_normalized = norm["symbol"]
    
    # Lấy position hiện tại
    market_data = HyperliquidMarketData(client.get_info_api(), client.get_address())
    position_result = await market_data.get_positions()
    
    if not position_result.get('success'):
        raise HTTPException(status_code=400, detail="Failed to get positions")
    
    positions = position_result.get('positions', [])
    
    print(f"[Hyperliquid Close] Looking for symbol: {symbol_normalized}")
    print(f"[Hyperliquid Close] Available positions: {[p.get('symbol') for p in positions]}")
    
    # Tìm position cho symbol này
    position = None
    for pos in positions:
        pos_symbol = pos.get('symbol', '')
        
        if pos_symbol == symbol_normalized:
            pos_size_signed = pos.get('size_signed', 0)
            if pos_size_signed != 0:
                pos_side = pos.get('side', 'LONG')
                pos_entry_price = float(pos.get('entry_price', 0))
                
                # Match với criteria nếu có
                if position_id:
                    expected_id = f"hyperliquid_{pos_symbol}_{pos_entry_price}_{pos_side.lower()}"
                    if position_id != expected_id:
                        print(f"[Hyperliquid Close] Position ID mismatch: {position_id} vs {expected_id}")
                        continue
                
                if entry_price is not None:
                    if abs(pos_entry_price - entry_price) / entry_price > 0.0001:
                        print(f"[Hyperliquid Close] Entry price mismatch: {pos_entry_price} vs {entry_price}")
                        continue
                
                if side is not None:
                    if pos_side.lower() != side.lower():
                        print(f"[Hyperliquid Close] Side mismatch: {pos_side} vs {side}")
                        continue
                
                position = pos
                print(f"[Hyperliquid Close] ✅ Found position: {pos_symbol}, size={pos.get('size')}, entry={pos_entry_price}, side={pos_side}")
                break
    
    if not position:
        print(f"[Hyperliquid Close] ❌ No position found. Available symbols: {[p.get('symbol') for p in positions]}")
        raise HTTPException(status_code=404, detail=f"No open position found for {symbol} on Hyperliquid")
    
    # Close position
    executor = HyperliquidOrderExecutor(
        client.get_exchange_api(),
        client.get_info_api(),
        client.get_address()
    )
    
    result = await executor.close_position(
        symbol=symbol_normalized,
        percentage=percentage,
        side=position.get('side', 'LONG').lower()
    )
    
    if not result.get('success'):
        error_msg = result.get('error', 'Unknown error')
        raise HTTPException(status_code=400, detail=f"Failed to close position: {error_msg}")
    
    return {
        "success": True,
        "exchange": "hyperliquid",
        "symbol": symbol_normalized,
        "order_id": result.get('order_id'),
        "side": position.get('side', 'LONG').lower(),
        "position_size": position.get('size'),
        "close_size": result.get('closed_size'),
        "close_percentage": percentage,
        "entry_price": position.get('entry_price'),
        "close_price": result.get('close_price'),
        "pnl_percent": position.get('pnl_percent')
    }
