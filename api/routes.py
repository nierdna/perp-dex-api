"""
API routes
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from api.models import UnifiedOrderRequest
from api.handlers import handle_lighter_order, handle_aster_order
from api.utils import get_keys_or_env

# Import DB functions (optional)
try:
    from db import (
        log_order_request,
        update_order_after_result,
        query_orders,
    )
except Exception:
    log_order_request = None
    update_order_after_result = None
    query_orders = None

router = APIRouter()


@router.get("/api/status")
async def get_status():
    """Health check"""
    return {
        "status": "online",
        "message": "Trading API Server is running",
    }


@router.get("/api/orders/positions")
async def get_positions(exchange: Optional[str] = None):
    """
    Lấy danh sách các vị thế đang mở (có position thực tế trên sàn) kèm PnL.
    
    TODO: Logic đang được thảo luận, tạm thời trả về mảng rỗng.
    """
    return {
        "positions": [],
        "total": 0
    }


@router.get("/api/orders/open")
async def get_open_orders(exchange: Optional[str] = None):
    """
    Lấy danh sách các lệnh mở đang chờ khớp (LIMIT, TP/SL orders).
    
    TODO: Logic đang được thảo luận, tạm thời trả về mảng rỗng.
    """
    return {
        "open_orders": [],
        "total": 0
    }


@router.get("/api/orders/history")
async def get_order_history(
    exchange: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
):
    """
    Lấy lịch sử tất cả các orders đã lưu trong database.
    """
    if query_orders is None:
        raise HTTPException(
            status_code=503,
            detail="Database module không available, không thể query orders"
        )
    
    try:
        all_orders = query_orders(
            exchange=exchange,
            status=status,
            limit=limit
        )
        
        history = [
            {
                "id": o["id"],
                "exchange": o["exchange"],
                "symbol_base": o["symbol_base"],
                "side": o["side"],
                "order_type": o["order_type"],
                "size_usd": o["size_usd"],
                "leverage": o["leverage"],
                "limit_price": o.get("limit_price"),
                "tp_price": o.get("tp_price"),
                "sl_price": o.get("sl_price"),
                "status": o["status"],
                "exchange_order_id": o.get("exchange_order_id"),
                "entry_price_filled": o.get("entry_price_filled"),
                "position_size_asset": o.get("position_size_asset"),
                "created_at": o.get("created_at"),
                "updated_at": o.get("updated_at"),
            }
            for o in all_orders
        ]
        
        return {
            "history": history,
            "total": len(history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/order")
async def place_unified_order(order: UnifiedOrderRequest):
    """
    Unified endpoint: đặt lệnh LONG/SHORT, MARKET/LIMIT, TP/SL theo GIÁ
    cho cả Lighter và Aster, theo spec trong docs/api/api.md.
    """
    db_order_id = None

    try:
        print(f"\n{'=' * 60}")
        print("📥 NEW UNIFIED ORDER REQUEST")
        print(f"{'=' * 60}")
        print(f"Exchange   : {order.exchange.upper()}")
        print(f"Symbol     : {order.symbol}")
        print(f"Side       : {order.side.upper()}")
        print(f"Order Type : {order.order_type.upper()}")
        print(f"Size (USD) : {order.size_usd}")
        print(f"Leverage   : {order.leverage}x")
        print(f"TP Price   : {order.tp_price}")
        print(f"SL Price   : {order.sl_price}")

        # Ghi log order vào DB ở trạng thái 'pending' (nếu DB được cấu hình)
        if log_order_request is not None:
            db_order_id = log_order_request(
                exchange=order.exchange,
                symbol_base=order.symbol.upper(),
                symbol_pair=None,
                side=order.side,
                order_type=order.order_type,
                size_usd=order.size_usd,
                leverage=order.leverage,
                limit_price=order.limit_price,
                tp_price=order.tp_price,
                sl_price=order.sl_price,
                max_slippage_percent=order.max_slippage_percent,
                client_order_id=order.client_order_id,
                tag=order.tag,
                raw_request=order.model_dump(),
            )

        # Chuẩn hoá keys và gửi lệnh xuống từng sàn
        keys = get_keys_or_env(order.keys, order.exchange)

        # Dispatch theo sàn
        if order.exchange == "lighter":
            result = await handle_lighter_order(order, keys)
        else:
            result = await handle_aster_order(order, keys)

        print("\n✅ ORDER PLACED SUCCESSFULLY")
        print(f"Order ID     : {result.get('order_id')}")
        print(f"Entry Price  : {result.get('entry_price')}")
        print(f"Position Size: {result.get('position_size')}")
        print(f"{'=' * 60}\n")

        # Cập nhật DB sau khi gọi sàn thành công
        if update_order_after_result is not None:
            try:
                update_order_after_result(
                    db_order_id=db_order_id,
                    status="submitted",
                    exchange_order_id=str(result.get("order_id"))
                    if result.get("order_id") is not None
                    else None,
                    entry_price_requested=float(result.get("entry_price"))
                    if result.get("entry_price") is not None
                    else None,
                    entry_price_filled=float(result.get("entry_price"))
                    if result.get("entry_price") is not None
                    else None,
                    position_size_asset=float(result.get("position_size"))
                    if result.get("position_size") is not None
                    else None,
                    raw_response=result,
                )
            except Exception as db_err:
                print(f"[DB] Warning: lỗi khi update order sau khi đặt lệnh: {db_err}")

        return result
        
    except HTTPException as http_exc:
        # Nếu đã có DB record thì cập nhật trạng thái rejected/error
        if update_order_after_result is not None:
            try:
                update_order_after_result(
                    db_order_id=db_order_id,
                    status="rejected" if http_exc.status_code == 400 else "error",
                    exchange_order_id=None,
                    entry_price_requested=None,
                    entry_price_filled=None,
                    position_size_asset=None,
                    raw_response={"detail": http_exc.detail},
                )
            except Exception as db_err:
                print(f"[DB] Warning: lỗi khi update order sau HTTPException: {db_err}")
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Cập nhật DB cho lỗi 500 nội bộ
        if update_order_after_result is not None:
            try:
                update_order_after_result(
                    db_order_id=db_order_id,
                    status="error",
                    exchange_order_id=None,
                    entry_price_requested=None,
                    entry_price_filled=None,
                    position_size_asset=None,
                    raw_response={"exception": str(e)},
                )
            except Exception as db_err:
                print(f"[DB] Warning: lỗi khi update order sau Exception: {db_err}")
        raise HTTPException(status_code=500, detail=str(e))

