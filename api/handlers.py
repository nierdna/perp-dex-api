"""
Order handlers for Lighter and Aster exchanges
"""

from fastapi import HTTPException

from perpsdex.lighter.core.market import MarketData as LighterMarketData
from perpsdex.lighter.core.order import OrderExecutor as LighterOrderExecutor
from perpsdex.lighter.core.risk import RiskManager as LighterRiskManager
from perpsdex.aster.core.market import MarketData as AsterMarketData
from perpsdex.aster.core.order import OrderExecutor as AsterOrderExecutor
from perpsdex.aster.core.risk import RiskManager as AsterRiskManager

from api.models import UnifiedOrderRequest
from api.utils import (
    initialize_lighter_client,
    initialize_aster_client,
    normalize_symbol,
    validate_tp_sl,
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

