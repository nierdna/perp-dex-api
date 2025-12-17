"""
Hyperliquid positions and orders helpers
"""

from typing import List, Dict, Any
from perpsdex.hyperliquid.core.client import HyperliquidClient
from perpsdex.hyperliquid.core.market import HyperliquidMarketData


async def get_hyperliquid_positions(client: HyperliquidClient) -> List[Dict[str, Any]]:
    """
    Lấy positions từ Hyperliquid
    
    Returns:
        List of position dicts với format chuẩn
    """
    market_data = HyperliquidMarketData(client.get_info_api(), client.get_address())
    result = await market_data.get_positions()
    
    if not result.get("success"):
        return []
    
    positions = []
    for pos in result.get("positions", []):
        # Format theo chuẩn chung
        side_lower = pos["side"].lower()
        
        positions.append({
            "exchange": "hyperliquid",
            "exchange_position_id": f"hyperliquid_{pos['symbol']}_{pos['entry_price']}_{side_lower}",
            "symbol": pos["symbol"],
            "side": side_lower,
            "size": pos["size"],
            "entry_price": pos["entry_price"],
            "current_price": pos["current_price"],
            "pnl": pos["pnl"],
            "pnl_percent": pos["pnl_percent"],
            "leverage": pos.get("leverage", 1),
        })
    
    return positions


async def get_hyperliquid_open_orders(client: HyperliquidClient) -> List[Dict[str, Any]]:
    """
    Lấy open orders từ Hyperliquid
    
    Returns:
        List of order dicts với format chuẩn
    """
    market_data = HyperliquidMarketData(client.get_info_api(), client.get_address())
    result = await market_data.get_open_orders()
    
    if not result.get("success"):
        return []
    
    orders = []
    for order in result.get("orders", []):
        side_lower = order["side"].lower()
        
        orders.append({
            "exchange": "hyperliquid",
            "exchange_order_id": order["order_id"],
            "symbol": order["symbol"],
            "side": side_lower,
            "order_type": order["order_type"].lower(),
            "price": order["price"],
            "size": order["size"],
            "filled": order.get("filled", 0),
            "remaining": order.get("remaining", order["size"]),
        })
    
    return orders


async def get_hyperliquid_balance(client: HyperliquidClient) -> Dict[str, Any]:
    """
    Lấy balance từ Hyperliquid
    
    Returns:
        Balance dict với format chuẩn
    """
    market_data = HyperliquidMarketData(client.get_info_api(), client.get_address())
    result = await market_data.get_balance()
    
    if not result.get("success"):
        return {
            "exchange": "hyperliquid",
            "available": 0,
            "total": 0,
            "account_value": 0,
            "margin_used": 0,
            "success": False,
            "error": result.get("error", "Unknown error")
        }
    
    return {
        "exchange": "hyperliquid",
        "available": result["available"],
        "total": result["account_value"],
        "account_value": result["account_value"],
        "margin_used": result["margin_used"],
        "balance": result["balance"],
        "success": True
    }
