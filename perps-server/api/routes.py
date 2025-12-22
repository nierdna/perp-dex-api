"""
API routes
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from api.models import UnifiedOrderRequest, ClosePositionRequest
from api.orders import (
    handle_lighter_order,
    handle_aster_order,
    handle_lighter_close_position,
    handle_aster_close_position,
    handle_hyperliquid_order,
    handle_hyperliquid_close_position,
)
from api.utils import get_keys_or_env, initialize_lighter_client, initialize_aster_client, initialize_hyperliquid_client
from api.data import (
    get_lighter_positions,
    get_aster_positions,
    get_lighter_open_orders,
    get_aster_open_orders,
    get_hyperliquid_positions,
    get_hyperliquid_open_orders,
    get_hyperliquid_balance,
    get_lighter_balance,
    get_aster_balance,
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
                keys = get_keys_or_env(None, "lighter")
                if not keys.get("private_key"):
                    if exchange == "lighter":
                        print("[Positions] ⚠️ Lighter skipped: No private key found")
                else:
                    print("[Positions] Fetching Lighter positions...")
                    client = await initialize_lighter_client(keys)
                    account_index = keys.get("account_index", 0)
                    lighter_positions = await get_lighter_positions(client, account_index)
                    print(f"[Positions] Lighter: found {len(lighter_positions)} positions")
                    all_positions.extend(lighter_positions)
            except Exception as e:
                print(f"[Positions] Lighter error: {e}")
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
                keys = get_keys_or_env(None, "aster")
                if not keys.get("api_key") or not keys.get("api_secret"):
                    if exchange == "aster":
                         print("[Positions] ⚠️ Aster skipped: No keys found")
                else:
                    print("[Positions] Fetching Aster positions...")
                    client = await initialize_aster_client(keys)
                    aster_positions = await get_aster_positions(client)
                    print(f"[Positions] Aster: found {len(aster_positions)} positions")
                    all_positions.extend(aster_positions)
            except Exception as e:
                print(f"[Positions] Aster error: {e}")
                import traceback
                traceback.print_exc()
            finally:
                # Đóng client để tránh "Unclosed client session"
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        # Hyperliquid
        if exchange is None or exchange == "hyperliquid":
            client = None
            try:
                keys = get_keys_or_env(None, "hyperliquid")
                if not keys.get("private_key"):
                    if exchange == "hyperliquid":
                        print("[Positions] ⚠️ Hyperliquid skipped: No private key found")
                else:
                    print("[Positions] Fetching Hyperliquid positions...")
                    client = await initialize_hyperliquid_client(keys)
                    hyperliquid_positions = await get_hyperliquid_positions(client)
                    print(f"[Positions] Hyperliquid: found {len(hyperliquid_positions)} positions")
                    all_positions.extend(hyperliquid_positions)
            except Exception as e:
                import traceback
                print(f"[Positions] Hyperliquid error: {e}")
                # traceback.print_exc() # Giảm spam log
        
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
                if not keys.get("private_key"):
                    if exchange == "lighter":
                        print("[Open Orders] ⚠️ Lighter skipped: No private key found")
                else:
                    print("[Open Orders] Fetching Lighter open orders...")
                    client = await initialize_lighter_client(keys)
                    account_index = keys.get("account_index", 0)
                    lighter_orders = await get_lighter_open_orders(client, account_index)
                    print(f"[Open Orders] Lighter: found {len(lighter_orders)} open orders")
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
                if not keys.get("api_key") or not keys.get("api_secret"):
                    if exchange == "aster":
                         print("[Open Orders] ⚠️ Aster skipped: No keys found")
                else:
                    print("[Open Orders] Fetching Aster open orders...")
                    client = await initialize_aster_client(keys)
                    aster_orders = await get_aster_open_orders(client)
                    print(f"[Open Orders] Aster: found {len(aster_orders)} open orders")
                    all_open_orders.extend(aster_orders)
            except Exception as e:
                import traceback
                print(f"[Open Orders] Aster error: {e}")
                traceback.print_exc()
            finally:
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        # Hyperliquid
        if exchange is None or exchange == "hyperliquid":
            client = None
            try:
                keys = get_keys_or_env(None, "hyperliquid")
                if not keys.get("private_key"):
                    if exchange == "hyperliquid":
                         print("[Open Orders] ⚠️ Hyperliquid skipped: No private key found")
                else:
                    print("[Open Orders] Fetching Hyperliquid open orders...")
                    client = await initialize_hyperliquid_client(keys)
                    hyperliquid_orders = await get_hyperliquid_open_orders(client)
                    print(f"[Open Orders] Hyperliquid: found {len(hyperliquid_orders)} open orders")
                    all_open_orders.extend(hyperliquid_orders)
            except Exception as e:
                import traceback
                print(f"[Open Orders] Hyperliquid error: {e}")
                # traceback.print_exc()
        
        return {
            "open_orders": all_open_orders,
            "total": len(all_open_orders)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/balance")
async def get_balance(exchange: Optional[str] = None):
    """
    Lấy số dư tài khoản từ các sàn.
    
    Query params:
        - exchange: "lighter" | "aster" | None (tất cả)
    
    Returns:
        {
            "balances": [
                {
                    "exchange": "lighter",
                    "available": float,
                    "collateral": float,  # chỉ có Lighter
                    "total": float,
                    "success": bool,
                    "error": str (nếu có)
                },
                ...
            ],
            "total_available": float,  # Tổng available từ tất cả sàn
            "total_balance": float,    # Tổng balance từ tất cả sàn
            "count": int
        }
    """
    print(f"\n[Balance] Request: exchange={exchange}")
    all_balances = []
    
    try:
        # Lighter
        if exchange is None or exchange == "lighter":
            client = None
            try:
                keys = get_keys_or_env(None, "lighter")
                if not keys.get("private_key"):
                    if exchange == "lighter":
                         print("[Balance] ⚠️ Lighter skipped: No private key found")
                    all_balances.append({
                        'exchange': 'lighter',
                        'success': False,
                        'error': "No private key found",
                        'available': 0, 'total': 0
                    })
                else:
                    print("[Balance] Fetching Lighter balance...")
                    client = await initialize_lighter_client(keys)
                    account_index = keys.get("account_index", 0)
                    lighter_balance = await get_lighter_balance(client, account_index)
                    print(f"[Balance] Lighter: available=${lighter_balance.get('available', 0):.2f}, total=${lighter_balance.get('total', 0):.2f}")
                    all_balances.append(lighter_balance)
            except Exception as e:
                import traceback
                print(f"[Balance] Lighter error: {e}")
                traceback.print_exc()
                all_balances.append({
                    'exchange': 'lighter',
                    'available': 0,
                    'collateral': 0,
                    'total': 0,
                    'success': False,
                    'error': str(e)
                })
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
                if not keys.get("api_key") or not keys.get("api_secret"):
                    if exchange == "aster":
                         print("[Balance] ⚠️ Aster skipped: No keys found")
                    all_balances.append({
                        'exchange': 'aster',
                        'success': False,
                        'error': "No API keys found",
                        'available': 0, 'total': 0
                    })
                else:
                    print("[Balance] Fetching Aster balance...")
                    client = await initialize_aster_client(keys)
                    aster_balance = await get_aster_balance(client)
                    print(f"[Balance] Aster: available=${aster_balance.get('available', 0):.2f}, total=${aster_balance.get('total', 0):.2f}")
                    all_balances.append(aster_balance)
            except Exception as e:
                import traceback
                print(f"[Balance] Aster error: {e}")
                traceback.print_exc()
                all_balances.append({
                    'exchange': 'aster',
                    'available': 0,
                    'total': 0,
                    'wallet_balance': 0,
                    'success': False,
                    'error': str(e)
                })
            finally:
                if client and hasattr(client, 'close'):
                    try:
                        await client.close()
                    except:
                        pass
        
        # Hyperliquid
        if exchange is None or exchange == "hyperliquid":
            client = None
            try:
                keys = get_keys_or_env(None, "hyperliquid")
                if not keys.get("private_key"):
                    if exchange == "hyperliquid":
                         print("[Balance] ⚠️ Hyperliquid skipped: No private key found")
                else:
                    print("[Balance] Fetching Hyperliquid balance...")
                    client = await initialize_hyperliquid_client(keys)
                    hyperliquid_balance = await get_hyperliquid_balance(client)
                    print(f"[Balance] Hyperliquid: available=${hyperliquid_balance.get('available', 0):.2f}, total=${hyperliquid_balance.get('total', 0):.2f}")
                    all_balances.append(hyperliquid_balance)
            except Exception as e:
                import traceback
                print(f"[Balance] Hyperliquid error: {e}")
                # traceback.print_exc()
                if exchange == "hyperliquid": # Chỉ trả về error object nếu user thực sự request sàn này
                    all_balances.append({
                        'exchange': 'hyperliquid',
                        'available': 0,
                        'total': 0,
                        'account_value': 0,
                        'success': False,
                        'error': str(e)
                    })
        
        # Tính tổng
        total_available = sum(b.get('available', 0) for b in all_balances if b.get('success'))
        total_balance = sum(b.get('total', 0) for b in all_balances if b.get('success'))
        
        print(f"[Balance] Total: available=${total_available:.2f}, total=${total_balance:.2f}")
        
        return {
            "balances": all_balances,
            "total_available": total_available,
            "total_balance": total_balance,
            "count": len(all_balances)
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
        elif order.exchange == "aster":
            result = await handle_aster_order(order, keys)
        else:  # hyperliquid
            result = await handle_hyperliquid_order(order, keys)

        # Kiểm tra kết quả
        if result.get("success"):
            print("\n✅ ORDER PLACED SUCCESSFULLY")
            print(f"Order ID     : {result.get('order_id')}")
            print(f"Entry Price  : {result.get('entry_price')}")
            print(f"Position Size: {result.get('position_size')}")
            print(f"{'=' * 60}\n")
        else:
            print("\n❌ ORDER FAILED")
            print(f"Error: {result.get('error')}")
            print(f"{'=' * 60}\n")
            raise HTTPException(status_code=400, detail=result.get("error"))

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


@router.post("/api/positions/close")
async def close_position(request: ClosePositionRequest):
    """
    Đóng position (close position) cho cả Lighter và Aster
    
    Body:
    {
        "exchange": "lighter" | "aster",
        "symbol": "BTC",
        "percentage": 100,  # Optional, default: 100 (close 100%)
        "position_id": "lighter_1_80000_long",  # Optional: ID cụ thể từ /api/orders/positions
        "entry_price": 80000,  # Optional: Entry price để match position cụ thể
        "side": "long"  # Optional: Side để match position cụ thể
    }
    
    Lưu ý:
    - Nếu có nhiều position cùng symbol, dùng position_id, entry_price, hoặc side để đóng position cụ thể
    - Nếu không có, sẽ đóng position đầu tiên tìm thấy
    """
    try:
        print(f"\n{'=' * 60}")
        print("🔄 CLOSE POSITION REQUEST")
        print(f"{'=' * 60}")
        print(f"Exchange   : {request.exchange.upper()}")
        print(f"Symbol     : {request.symbol}")
        print(f"Percentage : {request.percentage}%")
        
        # Chuẩn hoá keys
        keys = get_keys_or_env(request.keys, request.exchange)
        
        # Dispatch theo sàn
        if request.exchange == "lighter":
            result = await handle_lighter_close_position(
                symbol=request.symbol,
                percentage=request.percentage,
                keys=keys,
                position_id=request.position_id,
                entry_price=request.entry_price,
                side=request.side
            )
        elif request.exchange == "aster":
            result = await handle_aster_close_position(
                symbol=request.symbol,
                percentage=request.percentage,
                keys=keys,
                position_id=request.position_id,
                entry_price=request.entry_price,
                side=request.side
            )
        else:  # hyperliquid
            result = await handle_hyperliquid_close_position(
                symbol=request.symbol,
                percentage=request.percentage,
                keys=keys,
                position_id=request.position_id,
                entry_price=request.entry_price,
                side=request.side
            )
        
        print("\n✅ POSITION CLOSED SUCCESSFULLY")
        print(f"Order ID     : {result.get('order_id')}")
        print(f"Close Price  : {result.get('close_price')}")
        print(f"PnL %        : {result.get('pnl_percent')}")
        print(f"{'=' * 60}\n")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/config-status")
async def get_config_status():
    """Trả về trạng thái cấu hình của các sàn"""
    lighter_keys = get_keys_or_env(None, "lighter")
    lighter = bool(lighter_keys.get("private_key"))
    
    aster_keys = get_keys_or_env(None, "aster")
    aster = bool(aster_keys.get("api_key") and aster_keys.get("api_secret"))
    
    hyperliquid_keys = get_keys_or_env(None, "hyperliquid")
    hyperliquid = bool(hyperliquid_keys.get("private_key"))
    
    return {
        "lighter": lighter,
        "aster": aster,
        "hyperliquid": hyperliquid
    }

