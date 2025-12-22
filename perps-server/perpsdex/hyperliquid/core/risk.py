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
    
    def __init__(self, exchange_api: Exchange, address: str):
        """
        Args:
            exchange_api: Hyperliquid Exchange API instance
            address: Wallet address
        """
        self.exchange = exchange_api
        self.address = address
    
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
