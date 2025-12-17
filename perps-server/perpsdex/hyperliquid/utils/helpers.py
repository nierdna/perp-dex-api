"""
Hyperliquid helper utilities
"""

from typing import Dict, Any


def format_size(size: float, decimals: int = 8) -> float:
    """
    Format size theo decimals
    
    Args:
        size: Raw size
        decimals: Number of decimals
        
    Returns:
        Formatted size
    """
    return round(size, decimals)


def format_price(price: float, decimals: int = 5) -> float:
    """
    Format price theo decimals
    
    Args:
        price: Raw price
        decimals: Number of decimals
        
    Returns:
        Formatted price
    """
    return round(price, decimals)


def calculate_size_from_usd(size_usd: float, price: float) -> float:
    """
    Tính số lượng coin từ USD và giá
    
    Args:
        size_usd: Size in USD
        price: Current price
        
    Returns:
        Size in coin
    """
    if price <= 0:
        raise ValueError("Price must be > 0")
    
    return size_usd / price


def calculate_pnl(
    entry_price: float,
    current_price: float,
    size: float,
    side: str
) -> Dict[str, float]:
    """
    Tính PnL
    
    Args:
        entry_price: Entry price
        current_price: Current price
        size: Position size (absolute)
        side: "LONG" or "SHORT"
        
    Returns:
        {
            "pnl": float,
            "pnl_percent": float
        }
    """
    if entry_price <= 0 or size <= 0:
        return {"pnl": 0, "pnl_percent": 0}
    
    if side.upper() == "LONG":
        pnl = (current_price - entry_price) * size
    else:  # SHORT
        pnl = (entry_price - current_price) * size
    
    total_value = entry_price * size
    pnl_percent = (pnl / total_value) * 100 if total_value > 0 else 0
    
    return {
        "pnl": pnl,
        "pnl_percent": pnl_percent
    }
