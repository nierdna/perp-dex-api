"""
Hyperliquid Risk Manager - Quản lý TP/SL
"""

from typing import Dict, Any, Optional
from hyperliquid.exchange import Exchange
import traceback


class HyperliquidRiskManager:
    """
    Risk Manager cho Hyperliquid
    
    Đặt Take Profit và Stop Loss orders
    """
    
    def __init__(self, exchange_api: Exchange, info_api: Any, address: str):
        """
        Args:
            exchange_api: Hyperliquid Exchange API instance
            info_api: Hyperliquid Info API instance
            address: Wallet address
        """
        self.exchange = exchange_api
        self.info = info_api
        self.address = address
    
    async def update_tp_sl(
        self,
        symbol: str,
        side: str,  # "long" or "short" of the POSITION
        tp_price: Optional[float] = None,
        sl_price: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Cập nhật TP/SL (Cancel cũ -> Đặt mới)
        
        Args:
            symbol: Symbol name
            side: Side của POSITION (Long/Short)
            tp_price: Giá TP mới
            sl_price: Giá SL mới
        """
        results = {
            "success": True,
            "cancelled": [],
            "new_tp": None,
            "new_sl": None
        }
        
        try:
            # 1. Lấy thông tin position hiện tại để biết size
            user_state = self.info.user_state(self.address)
            position_size = 0.0
            
            # Find position for symbol
            for pos in user_state.get("assetPositions", []):
                p = pos.get("position", {})
                if p.get("coin") == symbol:
                    position_size = float(p.get("szi", 0))
                    # Verify side matches
                    pos_side = "long" if position_size > 0 else "short"
                    # Nếu side truyền vào khác side position, có thể user đang muốn setup cho lệnh đang treo?
                    # Tạm thời ưu tiên size thực tế
                    break
            
            # Nếu không có position nhưng user vẫn muốn update (cho lệnh treo?)
            # Thì ta phải tìm size từ các lệnh open orders?
            # Hiện tại logic đơn giản: Lấy size từ position thực tế.
            # Nếu position_size == 0, ta không thể đặt TP/SL close position được.
            
            if position_size == 0:
                # Fallback: Check if there's an open Limit order?
                # Nhưng logic này phức tạp. Tạm thời báo lỗi hoặc cảnh báo.
                pass

            target_size = abs(position_size)
            if target_size == 0:
                return {
                    "success": False,
                    "error": f"Không tìm thấy position đang mở cho {symbol} để đặt TP/SL"
                }

            # 2. Cancel TP/SL cũ
            # Lấy open orders
            open_orders = self.info.open_orders(self.address)
            orders_to_cancel = []
            
            for order in open_orders:
                if order.get("coin") == symbol:
                    oid = order.get("oid")
                    order_type = order.get("orderType", "")
                    # Nếu là TP (Limit Reduce-only) hoặc SL (Trigger Reduce-only)
                    # Cách nhận biết: 
                    # - TP thường là Limit Order, reduceOnly = true
                    # - SL thường là Trigger Order, reduceOnly = true
                    # Tuy nhiên SDK trả về orderType có thể khác.
                    
                    is_trigger = "trigger" in str(order) or order.get("triggerCondition")
                    is_limit = order.get("limitPx") and not is_trigger
                    
                    # Logic đơn giản: Hủy tất cả lệnh Trigger và Limit ngược chiều (Close) của symbol này
                    # Long Position -> Close là Sell
                    # Short Position -> Close là Buy
                    
                    is_buy_order = order.get("side") == "B"
                    is_close_side = (side.lower() == "long" and not is_buy_order) or \
                                    (side.lower() == "short" and is_buy_order)
                    
                    if is_close_side and (order.get("reduceOnly") or is_trigger):
                        orders_to_cancel.append({"coin": symbol, "oid": oid})
            
            # Thực hiện Cancel
            if orders_to_cancel:
                print(f"[Hyperliquid] Cancelling {len(orders_to_cancel)} old TP/SL orders for {symbol}")
                for cancel_req in orders_to_cancel:
                    try:
                        self.exchange.cancel(cancel_req["coin"], cancel_req["oid"])
                        results["cancelled"].append(cancel_req["oid"])
                    except Exception as e:
                        print(f"Failed to cancel order {cancel_req['oid']}: {e}")

            # 3. Đặt lệnh mới
            # Dùng hàm place_tp_sl_orders có sẵn
            # Entry price không quan trọng cho TP/SL limit/trigger
            new_orders = await self.place_tp_sl_orders(
                symbol=symbol,
                side=side,
                size=target_size,
                entry_price=0, # Placeholder
                tp_price=tp_price,
                sl_price=sl_price
            )
            
            results["new_tp"] = new_orders.get("tp")
            results["new_sl"] = new_orders.get("sl")
            
            if not new_orders.get("success"):
                results["success"] = False
                results["error"] = new_orders.get("error", "Lỗi khi đặt lệnh mới")
            
            return results
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": f"Lỗi khi update TP/SL: {str(e)}"
            }
    
    async def place_tp_sl_orders(
        self,
        symbol: str,
        side: str,  # "long" hoặc "short"
        size: float,  # Position size (số lượng coin)
        entry_price: float,
        tp_price: Optional[float] = None,
        sl_price: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Đặt TP và SL orders
        
        Args:
            symbol: Symbol name
            side: "long" hoặc "short"
            size: Position size (số lượng coin)
            entry_price: Entry price
            tp_price: Take Profit price (optional)
            sl_price: Stop Loss price (optional)
            
        Returns:
            {
                "success": bool,
                "tp": {...},  # TP order result
                "sl": {...}   # SL order result
            }
        """
        results = {
            "success": True,
            "tp": None,
            "sl": None
        }
        
        try:
            # Place TP order
            if tp_price:
                tp_result = await self.place_tp_order(
                    symbol=symbol,
                    side=side,
                    size=size,
                    tp_price=tp_price
                )
                results["tp"] = tp_result
                if not tp_result.get("success"):
                    results["success"] = False
            
            # Place SL order
            if sl_price:
                sl_result = await self.place_sl_order(
                    symbol=symbol,
                    side=side,
                    size=size,
                    sl_price=sl_price
                )
                results["sl"] = sl_result
                if not sl_result.get("success"):
                    results["success"] = False
            
            return results
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi đặt TP/SL: {str(e)}"
            }
    
    async def place_tp_order(
        self,
        symbol: str,
        side: str,
        size: float,
        tp_price: float
    ) -> Dict[str, Any]:
        """
        Đặt Take Profit order
        
        Args:
            symbol: Symbol name
            side: "long" hoặc "short" (position side)
            size: Position size
            tp_price: Take profit price
            
        Returns:
            {"success": bool, "order_id": str, ...}
        """
        try:
            # TP = close position khi giá đạt target
            # Long TP = Sell limit tại tp_price
            # Short TP = Buy limit tại tp_price
            is_buy = side.lower() == "short"  # Reverse side để close
            
            print(f"[Hyperliquid TP] {symbol} {side} TP @ {tp_price}, size={size}")
            
            # Hyperliquid: limit order với reduce_only
            # TP = limit order at tp_price that closes position
            order_type = {"limit": {"tif": "Gtc"}}  # Good till cancel
            
            tp_result = self.exchange.order(
                name=symbol,
                is_buy=is_buy,
                sz=size,
                limit_px=float(tp_price),  # Ensure float
                order_type=order_type,
                reduce_only=True  # Chỉ close, không mở position mới
            )
            
            print(f"[Hyperliquid] TP order result: {tp_result}")
            
            if tp_result and tp_result.get("status") == "ok":
                response = tp_result.get("response", {})
                data = response.get("data", {})
                statuses = data.get("statuses", [])
                
                if statuses:
                    status_info = statuses[0]
                    resting = status_info.get("resting", {})
                    oid = resting.get("oid", "unknown")
                    
                    return {
                        "success": True,
                        "order_id": str(oid),
                        "type": "take_profit",
                        "symbol": symbol,
                        "trigger_price": tp_price,
                        "size": size
                    }
            
            return {
                "success": False,
                "error": "TP order failed",
                "raw": tp_result
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi đặt TP order: {str(e)}"
            }
    
    async def place_sl_order(
        self,
        symbol: str,
        side: str,
        size: float,
        sl_price: float
    ) -> Dict[str, Any]:
        """
        Đặt Stop Loss order
        
        Args:
            symbol: Symbol name
            side: "long" hoặc "short" (position side)
            size: Position size
            sl_price: Stop loss price
            
        Returns:
            {"success": bool, "order_id": str, ...}
        """
        try:
            # SL = close position khi giá chạm stop
            # Long SL = Sell stop tại sl_price
            # Short SL = Buy stop tại sl_price
            is_buy = side.lower() == "short"  # Reverse side
            
            print(f"[Hyperliquid SL] {symbol} {side} SL @ {sl_price}, size={size}")
            
            # Hyperliquid: trigger order với trigger_px
            # SL = stop market order that triggers at sl_price
            order_type = {"trigger": {"triggerPx": float(sl_price), "isMarket": True, "tpsl": "sl"}}
            
            sl_result = self.exchange.order(
                name=symbol,
                is_buy=is_buy,
                sz=size,
                limit_px=float(sl_price),  # Ensure float
                order_type=order_type,
                reduce_only=True
            )
            
            print(f"[Hyperliquid] SL order result: {sl_result}")
            
            if sl_result and sl_result.get("status") == "ok":
                response = sl_result.get("response", {})
                data = response.get("data", {})
                statuses = data.get("statuses", [])
                
                if statuses:
                    status_info = statuses[0]
                    resting = status_info.get("resting", {})
                    oid = resting.get("oid", "unknown")
                    
                    return {
                        "success": True,
                        "order_id": str(oid),
                        "type": "stop_loss",
                        "symbol": symbol,
                        "trigger_price": sl_price,
                        "size": size
                    }
            
            return {
                "success": False,
                "error": "SL order failed",
                "raw": sl_result
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": f"Lỗi khi đặt SL order: {str(e)}"
            }
