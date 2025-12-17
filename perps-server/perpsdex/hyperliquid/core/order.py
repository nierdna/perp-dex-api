"""
Hyperliquid Order Executor - Đặt lệnh Market/Limit
"""

from typing import Dict, Any, Optional
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
import time


class HyperliquidOrderExecutor:
    """
    Order Executor cho Hyperliquid
    
    Đặt lệnh Market/Limit, Long/Short
    """
    
    def __init__(self, exchange_api: Exchange, info_api: Info, address: str):
        """
        Args:
            exchange_api: Hyperliquid Exchange API instance
            info_api: Hyperliquid Info API instance (để lấy giá)
            address: Wallet address
        """
        self.exchange = exchange_api
        self.info = info_api
        self.address = address
    
    async def place_market_order(
        self,
        symbol: str,
        side: str,  # "long" hoặc "short"
        size_usd: float,
        leverage: Optional[int] = None,
        max_slippage_percent: Optional[float] = None,
        reduce_only: bool = False
    ) -> Dict[str, Any]:
        """
        Đặt lệnh Market
        
        Args:
            symbol: Symbol name (VD: "BTC")
            side: "long" hoặc "short"
            size_usd: Khối lượng USD
            leverage: Đòn bẩy (optional, nếu không set sẽ dùng current leverage)
            max_slippage_percent: Slippage tối đa (%)
            reduce_only: Chỉ close position (không mở mới)
            
        Returns:
            {
                "success": bool,
                "order_id": str,
                "symbol": str,
                "side": str,
                "entry_price": float,
                "position_size": float,  # số lượng coin
                "filled_price": float,
                "filled_size": float
            }
        """
        try:
            # Update leverage nếu có
            if leverage is not None and not reduce_only:
                leverage_result = self.exchange.update_leverage(leverage, symbol)
                print(f"[Hyperliquid] Update leverage {symbol} -> {leverage}x: {leverage_result}")
            
            # Lấy giá hiện tại để tính size
            all_mids = self.info.all_mids()
            if symbol not in all_mids:
                return {
                    "success": False,
                    "error": f"Symbol {symbol} không tìm thấy"
                }
            
            current_price = float(all_mids[symbol])
            
            # Tính size (số lượng coin)
            # size_usd / current_price = số lượng coin
            size = size_usd / current_price
            
            # Hyperliquid SDK: BUY = True, SELL = False
            is_buy = side.lower() == "long"
            
            # Tính slippage price
            if max_slippage_percent:
                slippage_factor = max_slippage_percent / 100.0
                if is_buy:
                    # Long: willing to buy đắt hơn
                    limit_price = current_price * (1 + slippage_factor)
                else:
                    # Short: willing to sell rẻ hơn
                    limit_price = current_price * (1 - slippage_factor)
            else:
                # Default 1% slippage
                if is_buy:
                    limit_price = current_price * 1.01
                else:
                    limit_price = current_price * 0.99
            
            print(f"[Hyperliquid Market] {symbol} {side.upper()} size={size:.6f} @ ~{current_price:.2f} (limit={limit_price:.2f})")
            
            # Đặt lệnh Market qua SDK
            # Hyperliquid không có market order trực tiếp, dùng limit với IOC (Immediate or Cancel)
            order_result = self.exchange.market_open(
                name=symbol,
                is_buy=is_buy,
                sz=size,
                px=limit_price,  # Limit price cho slippage control
                reduce_only=reduce_only
            )
            
            print(f"[Hyperliquid] Market order result: {order_result}")
            
            # Parse result
            if order_result and "status" in order_result:
                status = order_result["status"]
                
                if status == "ok":
                    response = order_result.get("response", {})
                    data = response.get("data", {})
                    statuses = data.get("statuses", [])
                    
                    if statuses and len(statuses) > 0:
                        status_info = statuses[0]
                        filled = status_info.get("filled", {})
                        
                        # Extract fill info
                        total_sz = float(filled.get("totalSz", size))
                        avg_px = float(filled.get("avgPx", current_price))
                        
                        return {
                            "success": True,
                            "order_id": str(time.time()),  # Hyperliquid không trả order_id cho market
                            "symbol": symbol,
                            "side": "long" if is_buy else "short",
                            "entry_price": avg_px,
                            "position_size": total_sz,
                            "filled_price": avg_px,
                            "filled_size": total_sz,
                            "size_usd": size_usd
                        }
                    else:
                        return {
                            "success": False,
                            "error": "Order status OK nhưng không có fill data",
                            "raw": order_result
                        }
                else:
                    # Order failed
                    return {
                        "success": False,
                        "error": f"Order failed with status: {status}",
                        "raw": order_result
                    }
            else:
                return {
                    "success": False,
                    "error": "Invalid order result format",
                    "raw": order_result
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi đặt market order: {str(e)}",
                "exception": str(e)
            }
    
    async def place_limit_order(
        self,
        symbol: str,
        side: str,  # "long" hoặc "short"
        size_usd: float,
        limit_price: float,
        leverage: Optional[int] = None,
        reduce_only: bool = False,
        post_only: bool = False
    ) -> Dict[str, Any]:
        """
        Đặt lệnh Limit
        
        Args:
            symbol: Symbol name
            side: "long" hoặc "short"
            size_usd: Khối lượng USD
            limit_price: Giá limit
            leverage: Đòn bẩy
            reduce_only: Chỉ close position
            post_only: Chỉ maker order (không ăn liquidity)
            
        Returns:
            {
                "success": bool,
                "order_id": str,
                "symbol": str,
                "side": str,
                "limit_price": float,
                "size": float
            }
        """
        try:
            # Update leverage nếu có
            if leverage is not None and not reduce_only:
                leverage_result = self.exchange.update_leverage(leverage, symbol)
                print(f"[Hyperliquid] Update leverage {symbol} -> {leverage}x: {leverage_result}")
            
            # Tính size từ USD
            size = size_usd / limit_price
            
            # BUY hoặc SELL
            is_buy = side.lower() == "long"
            
            print(f"[Hyperliquid Limit] {symbol} {side.upper()} size={size:.6f} @ {limit_price:.2f}")
            
            # Đặt lệnh Limit
            # Đặt lệnh Limit
            order_type = {"limit": {"tif": "Alo"}} if post_only else {"limit": {"tif": "Gtc"}}
            
            order_result = self.exchange.order(
                name=symbol,
                is_buy=is_buy,
                sz=size,
                limit_px=limit_price,
                order_type=order_type,
                reduce_only=reduce_only
            )
            
            print(f"[Hyperliquid] Limit order result: {order_result}")
            
            # Parse result
            if order_result and "status" in order_result:
                status = order_result["status"]
                
                if status == "ok":
                    response = order_result.get("response", {})
                    data = response.get("data", {})
                    statuses = data.get("statuses", [])
                    
                    if statuses and len(statuses) > 0:
                        status_info = statuses[0]
                        resting = status_info.get("resting", {})
                        
                        oid = resting.get("oid", str(time.time()))
                        
                        return {
                            "success": True,
                            "order_id": str(oid),
                            "symbol": symbol,
                            "side": "long" if is_buy else "short",
                            "limit_price": limit_price,
                            "size": size,
                            "size_usd": size_usd,
                            "order_type": "limit"
                        }
                    else:
                        return {
                            "success": False,
                            "error": "Limit order status OK nhưng không có resting data",
                            "raw": order_result
                        }
                else:
                    return {
                        "success": False,
                        "error": f"Limit order failed: {status}",
                        "raw": order_result
                    }
            else:
                return {
                    "success": False,
                    "error": "Invalid limit order result",
                    "raw": order_result
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi đặt limit order: {str(e)}",
                "exception": str(e)
            }
    
    async def close_position(
        self,
        symbol: str,
        percentage: float = 100,
        side: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Đóng position
        
        Args:
            symbol: Symbol name
            percentage: Phần trăm đóng (0-100)
            side: "long" hoặc "short" (optional, nếu không có sẽ lấy từ current position)
            
        Returns:
            {
                "success": bool,
                "symbol": str,
                "closed_size": float,
                "close_price": float
            }
        """
        try:
            # Lấy current position
            user_state = self.info.user_state(self.address)
            if not user_state:
                return {
                    "success": False,
                    "error": "Không thể lấy user state"
                }
            
            asset_positions = user_state.get("assetPositions", [])
            position = None
            
            for pos in asset_positions:
                position_data = pos.get("position", {})
                coin = position_data.get("coin", "")
                if coin == symbol:
                    position = position_data
                    break
            
            if not position:
                return {
                    "success": False,
                    "error": f"Không tìm thấy position cho {symbol}"
                }
            
            # Parse position
            szi = position.get("szi", "0")
            size_signed = float(szi)
            
            if size_signed == 0:
                return {
                    "success": False,
                    "error": f"Position {symbol} đã đóng (size = 0)"
                }
            
            size_abs = abs(size_signed)
            is_long = size_signed > 0
            
            # Tính close size
            close_size = size_abs * (percentage / 100.0)
            
            # Close = reverse side
            is_buy = not is_long  # Close long = sell, close short = buy
            
            # Lấy current price
            all_mids = self.info.all_mids()
            current_price = float(all_mids.get(symbol, 0))
            
            if current_price == 0:
                return {
                    "success": False,
                    "error": f"Không lấy được giá cho {symbol}"
                }
            
            # Slippage 1% để đảm bảo fill
            if is_buy:
                limit_price = current_price * 1.01
            else:
                limit_price = current_price * 0.99
            
            print(f"[Hyperliquid Close] {symbol} close_size={close_size:.6f} @ ~{current_price:.2f}")
            
            # Close position với market order (reduce_only=True)
            close_result = self.exchange.market_close(
                coin=symbol,
                sz=close_size,
                px=limit_price
            )
            
            print(f"[Hyperliquid] Close result: {close_result}")
            
            if close_result and close_result.get("status") == "ok":
                return {
                    "success": True,
                    "symbol": symbol,
                    "closed_size": close_size,
                    "close_percentage": percentage,
                    "close_price": current_price,
                    "side": "long" if is_long else "short"
                }
            else:
                return {
                    "success": False,
                    "error": "Close position failed",
                    "raw": close_result
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi close position: {str(e)}",
                "exception": str(e)
            }
