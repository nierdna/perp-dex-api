"""
Pydantic models for API requests/responses
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal


class KeysConfig(BaseModel):
    """API Keys configuration"""
    lighter_private_key: Optional[str] = None
    lighter_account_index: Optional[int] = None
    lighter_api_key_index: Optional[int] = None
    aster_api_key: Optional[str] = None
    aster_secret_key: Optional[str] = None
    aster_api_url: Optional[str] = None
    hyperliquid_private_key: Optional[str] = None
    hyperliquid_testnet: Optional[bool] = False
    hyperliquid_account_address: Optional[str] = None


class MarketOrderRequest(BaseModel):
    """Market order request"""
    keys: Optional[KeysConfig] = Field(None, description="API keys (optional if configured in ENV)")
    exchange: Literal["lighter", "aster", "hyperliquid"] = Field(..., description="lighter, aster, or hyperliquid")
    symbol: str = Field(..., description="BTC, ETH, SOL, etc")
    side: Literal["long", "short"] = Field(..., description="long or short")
    size_usd: float = Field(..., gt=0, description="Position size in USD")
    leverage: int = Field(default=5, ge=1, le=100, description="Leverage (1-100)")
    tp_price: Optional[float] = Field(None, gt=0, description="Take profit price")
    sl_price: Optional[float] = Field(None, gt=0, description="Stop loss price")


class LimitOrderRequest(BaseModel):
    """Limit order request"""
    keys: Optional[KeysConfig] = Field(None, description="API keys (optional if configured in ENV)")
    exchange: Literal["lighter", "aster"] = Field(..., description="lighter or aster")
    symbol: str = Field(..., description="BTC, ETH, SOL, etc")
    side: Literal["long", "short"] = Field(..., description="long or short")
    size_usd: float = Field(..., gt=0, description="Position size in USD")
    leverage: int = Field(default=5, ge=1, le=100, description="Leverage (1-100)")
    limit_price: float = Field(..., gt=0, description="Entry price for limit order")
    tp_price: Optional[float] = Field(None, gt=0, description="Take profit price")
    sl_price: Optional[float] = Field(None, gt=0, description="Stop loss price")


class ClosePositionRequest(BaseModel):
    """Close position request"""
    keys: Optional[KeysConfig] = Field(None, description="API keys (optional if configured in ENV)")
    exchange: Literal["lighter", "aster"] = Field(..., description="lighter or aster")
    symbol: str = Field(..., description="BTC, ETH, SOL, etc")
    percentage: Optional[float] = Field(100, ge=0, le=100, description="Percentage to close (0-100, default: 100)")
    # Optional: Để đóng position cụ thể thay vì tất cả positions cùng symbol
    position_id: Optional[str] = Field(None, description="ID của position cụ thể (exchange_order_id từ /api/orders/positions)")
    entry_price: Optional[float] = Field(None, description="Entry price để match position cụ thể (nếu có nhiều position cùng symbol)")
    side: Optional[Literal["long", "short"]] = Field(None, description="Side để match position cụ thể (nếu có nhiều position cùng symbol)")


class UnifiedOrderRequest(BaseModel):
    """
    Unified trading order request - theo spec trong docs/api/api.md
    """
    keys: Optional[KeysConfig] = Field(
        None, description="API keys (optional, nếu không gửi sẽ dùng ENV trên server)"
    )
    exchange: Literal["lighter", "aster", "hyperliquid"] = Field(..., description="lighter, aster, hoặc hyperliquid")
    symbol: str = Field(..., description="Base token, ví dụ: BTC, ETH, SOL")
    side: Literal["long", "short"] = Field(..., description="Hướng lệnh: long hoặc short")
    order_type: Literal["market", "limit"] = Field(..., description="Loại lệnh: market hoặc limit")
    size_usd: float = Field(..., gt=0, description="Khối lượng vị thế theo USD (chưa nhân leverage)")
    leverage: float = Field(..., ge=1, description="Đòn bẩy (>=1)")
    limit_price: Optional[float] = Field(None, gt=0, description="Giá limit (bắt buộc nếu order_type = 'limit')")
    tp_price: Optional[float] = Field(None, gt=0, description="Giá Take Profit (optional)")
    sl_price: Optional[float] = Field(None, gt=0, description="Giá Stop Loss (optional)")
    max_slippage_percent: Optional[float] = Field(None, ge=0, description="Trượt giá tối đa cho lệnh market (%, optional)")
    client_order_id: Optional[str] = Field(None, description="ID phía client để idempotent/tracking (optional)")
    tag: Optional[str] = Field(None, description="Nhãn chiến lược / nguồn lệnh (optional)")

