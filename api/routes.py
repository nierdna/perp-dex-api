"""
API routes
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from api.models import UnifiedOrderRequest
from api.handlers import handle_lighter_order, handle_aster_order
from api.utils import get_keys_or_env, initialize_lighter_client, initialize_aster_client
from api.positions import (
    get_lighter_positions,
    get_aster_positions,
    get_lighter_open_orders,
    get_aster_open_orders,
)

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
    
    Call SDK để lấy positions từ exchange và tính PnL.
    """
    print(f"\n[Positions] Request: exchange={exchange}")
    all_positions = []
    
    try:
        # Lighter
        if exchange is None or exchange == "lighter":
            client = None
            try:
                print("[Positions] Fetching Lighter positions...")
                keys = get_keys_or_env(None, "lighter")
                client = await initialize_lighter_client(keys)
                account_index = keys.get("account_index", 0)
                lighter_positions = await get_lighter_positions(client, account_index)
                print(f"[Positions] Lighter: found {len(lighter_positions)} positions")
                all_positions.extend(lighter_positions)
            except Exception as e:
                import traceback
                print(f"[Positions] Lighter error: {e}")
                traceback.print_exc()
            finally:
                # Đóng client để tránh "Unclosed client session"
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        # Aster
        if exchange is None or exchange == "aster":
            client = None
            try:
                print("[Positions] Fetching Aster positions...")
                keys = get_keys_or_env(None, "aster")
                client = await initialize_aster_client(keys)
                aster_positions = await get_aster_positions(client)
                print(f"[Positions] Aster: found {len(aster_positions)} positions")
                all_positions.extend(aster_positions)
            except Exception as e:
                import traceback
                print(f"[Positions] Aster error: {e}")
                traceback.print_exc()
            finally:
                # Đóng client để tránh "Unclosed client session"
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        print(f"[Positions] Total: {len(all_positions)} positions")
        
        # Debug: Nếu không có positions, log thêm thông tin
        if len(all_positions) == 0:
            print("[Positions] ⚠️ No positions found. Check:")
            print(f"  - Exchange filter: {exchange}")
            print(f"  - Lighter keys configured: {bool(get_keys_or_env(None, 'lighter').get('private_key'))}")
            print(f"  - Aster keys configured: {bool(get_keys_or_env(None, 'aster').get('api_key'))}")
        
        return {
            "positions": all_positions,
            "total": len(all_positions)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/orders/open")
async def get_open_orders(exchange: Optional[str] = None):
    """
    Lấy danh sách các lệnh mở đang chờ khớp (LIMIT, TP/SL orders).
    
    Call SDK để lấy open orders từ exchange.
    """
    all_open_orders = []
    
    try:
        # Lighter
        if exchange is None or exchange == "lighter":
            client = None
            try:
                keys = get_keys_or_env(None, "lighter")
                client = await initialize_lighter_client(keys)
                account_index = keys.get("account_index", 0)
                lighter_orders = await get_lighter_open_orders(client, account_index)
                all_open_orders.extend(lighter_orders)
            except Exception as e:
                print(f"[Open Orders] Lighter error: {e}")
            finally:
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        # Aster
        if exchange is None or exchange == "aster":
            client = None
            try:
                keys = get_keys_or_env(None, "aster")
                client = await initialize_aster_client(keys)
                aster_orders = await get_aster_open_orders(client)
                all_open_orders.extend(aster_orders)
            except Exception as e:
                print(f"[Open Orders] Aster error: {e}")
            finally:
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        return {
            "open_orders": all_open_orders,
            "total": len(all_open_orders)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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

