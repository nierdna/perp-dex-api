"""
Hyperliquid Market Data - Lấy giá, positions, orders
"""

from typing import Dict, Any, List, Optional
from hyperliquid.info import Info


class HyperliquidMarketData:
    """
    Market Data handler cho Hyperliquid
    
    Lấy giá, positions, open orders, market info
    """
    
    def __init__(self, info_api: Info, address: str):
        """
        Args:
            info_api: Hyperliquid Info API instance
            address: Wallet address để query positions/orders
        """
        self.info = info_api
        self.address = address
    
    async def get_price(self, symbol: str) -> Dict[str, Any]:
        """
        Lấy giá hiện tại của symbol
        
        Args:
            symbol: Symbol name (VD: "BTC", "ETH")
            
        Returns:
            {
                "success": bool,
                "symbol": str,
                "bid": float,
                "ask": float,
                "mid": float,
                "mark_price": float
            }
        """
        try:
            # Lấy all mids (mid prices)
            all_mids = self.info.all_mids()
            
            if symbol not in all_mids:
                return {
                    "success": False,
                    "error": f"Symbol {symbol} không tìm thấy trong all_mids"
                }
            
            mid_price = float(all_mids[symbol])
            
            # Hyperliquid không trả bid/ask riêng trong all_mids
            # Estimate bid/ask với spread nhỏ (0.01%)
            spread = mid_price * 0.0001
            bid = mid_price - spread
            ask = mid_price + spread
            
            # Lấy meta để có mark price
            meta = self.info.meta()
            universe = meta.get("universe", [])
            
            mark_price = mid_price  # default
            for asset in universe:
                if asset.get("name") == symbol:
                    mark_price = float(asset.get("markPx", mid_price))
                    break
            
            return {
                "success": True,
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "mid": mid_price,
                "mark_price": mark_price
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi lấy giá {symbol}: {str(e)}"
            }
    
    async def get_positions(self) -> Dict[str, Any]:
        """
        Lấy danh sách positions đang mở
        
        Returns:
            {
                "success": bool,
                "positions": [
                    {
                        "symbol": str,
                        "side": "LONG"|"SHORT",
                        "size": float,  # absolute value
                        "entry_price": float,
                        "current_price": float,
                        "pnl": float,
                        "pnl_percent": float,
                        "leverage": float
                    }
                ]
            }
        """
        try:
            user_state = self.info.user_state(self.address)
            
            if not user_state:
                return {
                    "success": False,
                    "error": "Không thể lấy user state"
                }
            
            asset_positions = user_state.get("assetPositions", [])
            positions = []
            
            # Lấy current prices
            all_mids = self.info.all_mids()
            
            for pos in asset_positions:
                position_data = pos.get("position", {})
                coin = position_data.get("coin", "")
                szi = position_data.get("szi", "0")  # signed size
                entry_px = position_data.get("entryPx", "0")
                position_value = position_data.get("positionValue", "0")
                unrealized_pnl = position_data.get("unrealizedPnl", "0")
                leverage_info = position_data.get("leverage", {})
                
                # Parse values
                size_signed = float(szi)
                if size_signed == 0:
                    continue  # Skip closed positions
                
                size_abs = abs(size_signed)
                side = "LONG" if size_signed > 0 else "SHORT"
                entry_price = float(entry_px) if entry_px else 0
                pnl = float(unrealized_pnl) if unrealized_pnl else 0
                
                # Current price
                current_price = float(all_mids.get(coin, entry_price))
                
                # PnL percent
                pnl_percent = 0
                if entry_price > 0 and size_abs > 0:
                    total_value = entry_price * size_abs
                    if total_value > 0:
                        pnl_percent = (pnl / total_value) * 100
                
                # Leverage
                leverage_data = leverage_info.get("value", 1) if isinstance(leverage_info, dict) else 1
                leverage = float(leverage_data) if leverage_data else 1
                
                positions.append({
                    "symbol": coin,
                    "side": side,
                    "size": size_abs,
                    "size_signed": size_signed,
                    "entry_price": entry_price,
                    "current_price": current_price,
                    "pnl": pnl,
                    "pnl_percent": pnl_percent,
                    "leverage": leverage,
                    "position_value": float(position_value) if position_value else 0
                })
            
            return {
                "success": True,
                "positions": positions,
                "count": len(positions)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi lấy positions: {str(e)}"
            }
    
    async def get_open_orders(self) -> Dict[str, Any]:
        """
        Lấy danh sách lệnh mở (pending orders)
        
        Returns:
            {
                "success": bool,
                "orders": [
                    {
                        "order_id": str,
                        "symbol": str,
                        "side": "BUY"|"SELL",
                        "order_type": str,
                        "price": float,
                        "size": float,
                        "filled": float,
                        "remaining": float
                    }
                ]
            }
        """
        try:
            # Lấy open orders từ user state
            user_state = self.info.user_state(self.address)
            
            if not user_state:
                return {
                    "success": False,
                    "error": "Không thể lấy user state"
                }
            
            asset_positions = user_state.get("assetPositions", [])
            all_orders = []
            
            for asset in asset_positions:
                position = asset.get("position", {})
                coin = position.get("coin", "")
                
                # Open orders for this coin
                open_orders = self.info.open_orders(self.address)
                
                for order in open_orders:
                    order_coin = order.get("coin", "")
                    if order_coin != coin and coin:
                        continue
                        
                    order_id = order.get("oid", "")
                    side = "BUY" if order.get("side") == "B" else "SELL"
                    limit_px = float(order.get("limitPx", 0))
                    sz = float(order.get("sz", 0))
                    order_type = order.get("orderType", "Limit")
                    
                    all_orders.append({
                        "order_id": str(order_id),
                        "symbol": order_coin,
                        "side": side,
                        "order_type": order_type,
                        "price": limit_px,
                        "size": sz,
                        "filled": 0,  # Hyperliquid không trả filled size trong open_orders
                        "remaining": sz
                    })
            
            return {
                "success": True,
                "orders": all_orders,
                "count": len(all_orders)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi lấy open orders: {str(e)}"
            }
    
    async def get_market_info(self, symbol: str) -> Dict[str, Any]:
        """
        Lấy market metadata (size decimals, price decimals, min size...)
        
        Args:
            symbol: Symbol name
            
        Returns:
            {
                "success": bool,
                "symbol": str,
                "size_decimals": int,
                "price_decimals": int,
                "min_size": float,
                "max_leverage": int
            }
        """
        try:
            meta = self.info.meta()
            universe = meta.get("universe", [])
            
            for asset in universe:
                if asset.get("name") == symbol:
                    sz_decimals = asset.get("szDecimals", 8)
                    
                    return {
                        "success": True,
                        "symbol": symbol,
                        "size_decimals": sz_decimals,
                        "price_decimals": 5,  # Hyperliquid thường dùng 5 decimals cho price
                        "min_size": 10 ** (-sz_decimals),  # Min size based on decimals
                        "max_leverage": asset.get("maxLeverage", 50)
                    }
            
            return {
                "success": False,
                "error": f"Symbol {symbol} không tìm thấy trong meta"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi lấy market info: {str(e)}"
            }
    
    async def get_balance(self) -> Dict[str, Any]:
        """
        Lấy số dư tài khoản
        
        Returns:
            {
                "success": bool,
                "balance": float,
                "available": float,
                "margin_used": float,
                "account_value": float
            }
        """
        try:
            user_state = self.info.user_state(self.address)
            
            if not user_state:
                return {
                    "success": False,
                    "error": "Không thể lấy user state"
                }
            
            margin_summary = user_state.get("marginSummary", {})
            
            account_value = float(margin_summary.get("accountValue", 0))
            total_margin_used = float(margin_summary.get("totalMarginUsed", 0))
            total_ntl_pos = float(margin_summary.get("totalNtlPos", 0))
            total_raw_usd = float(margin_summary.get("totalRawUsd", 0))
            
            # Available = account_value - margin_used
            available = account_value - total_margin_used
            
            return {
                "success": True,
                "balance": total_raw_usd,  # Total raw USD (cash)
                "available": available,
                "margin_used": total_margin_used,
                "account_value": account_value,
                "total_position_value": total_ntl_pos
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Lỗi khi lấy balance: {str(e)}"
            }
