#!/usr/bin/env python3
"""
Trading API Server - For 3rd party integration

Endpoints:
- POST /api/order/market - Place market order
- POST /api/order/limit - Place limit order  
- POST /api/order/close - Close position (TODO)

Run: python api_server.py
Or: uvicorn api_server:app --host 0.0.0.0 --port 8080 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Literal
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Add bot directory to path
sys.path.insert(0, str(Path(__file__).parent))

from bot.lighter_trader import LighterTrader
from bot.aster_trader import AsterTrader

# FastAPI app
app = FastAPI(
    title="Trading API Server",
    description="API for placing orders on Lighter and Aster DEX",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============== MODELS ===============

class KeysConfig(BaseModel):
    """API Keys configuration"""
    lighter_private_key: Optional[str] = None
    lighter_account_index: Optional[int] = None
    lighter_api_key_index: Optional[int] = None
    aster_api_key: Optional[str] = None
    aster_secret_key: Optional[str] = None


class MarketOrderRequest(BaseModel):
    """Market order request"""
    # API Keys (optional - fallback to ENV)
    keys: Optional[KeysConfig] = Field(None, description="API keys (optional if configured in ENV)")
    
    # Trading params
    exchange: Literal["lighter", "aster"] = Field(..., description="lighter or aster")
    symbol: str = Field(..., description="BTC, ETH, SOL, etc")
    side: Literal["long", "short"] = Field(..., description="long or short")
    size_usd: float = Field(..., gt=0, description="Position size in USD")
    leverage: int = Field(default=5, ge=1, le=100, description="Leverage (1-100)")
    
    # TP/SL (optional)
    tp_price: Optional[float] = Field(None, gt=0, description="Take profit price")
    sl_price: Optional[float] = Field(None, gt=0, description="Stop loss price")


class LimitOrderRequest(BaseModel):
    """Limit order request"""
    # API Keys (optional - fallback to ENV)
    keys: Optional[KeysConfig] = Field(None, description="API keys (optional if configured in ENV)")
    
    # Trading params
    exchange: Literal["lighter", "aster"] = Field(..., description="lighter or aster")
    symbol: str = Field(..., description="BTC, ETH, SOL, etc")
    side: Literal["long", "short"] = Field(..., description="long or short")
    size_usd: float = Field(..., gt=0, description="Position size in USD")
    leverage: int = Field(default=5, ge=1, le=100, description="Leverage (1-100)")
    limit_price: float = Field(..., gt=0, description="Entry price for limit order")
    
    # TP/SL (optional)
    tp_price: Optional[float] = Field(None, gt=0, description="Take profit price")
    sl_price: Optional[float] = Field(None, gt=0, description="Stop loss price")


class ClosePositionRequest(BaseModel):
    """Close position request"""
    # API Keys (optional - fallback to ENV)
    keys: Optional[KeysConfig] = Field(None, description="API keys (optional if configured in ENV)")
    
    # Close params
    exchange: Literal["lighter", "aster"] = Field(..., description="lighter or aster")
    symbol: str = Field(..., description="BTC, ETH, SOL, etc")


# =============== HELPER FUNCTIONS ===============

def get_keys_or_env(keys_config: Optional[KeysConfig], exchange: str) -> dict:
    """Get API keys from request or fallback to ENV"""
    
    if exchange == "lighter":
        return {
            'private_key': (keys_config.lighter_private_key if keys_config else None) or os.getenv('LIGHTER_PRIVATE_KEY') or os.getenv('LIGHTER_L1_PRIVATE_KEY'),
            'account_index': (keys_config.lighter_account_index if keys_config else None) or int(os.getenv('ACCOUNT_INDEX', 0)),
            'api_key_index': (keys_config.lighter_api_key_index if keys_config else None) or int(os.getenv('LIGHTER_API_KEY_INDEX', 0))
        }
    else:  # aster
        return {
            'api_key': (keys_config.aster_api_key if keys_config else None) or os.getenv('ASTER_API_KEY'),
            'secret_key': (keys_config.aster_secret_key if keys_config else None) or os.getenv('ASTER_SECRET_KEY'),
            'api_url': os.getenv('ASTER_API_URL', 'https://fapi.asterdex.com')
        }


async def initialize_lighter_trader(keys: dict) -> LighterTrader:
    """Initialize Lighter trader with provided keys"""
    if not keys['private_key']:
        raise HTTPException(status_code=400, detail="Lighter private key not provided and not found in ENV")
    
    trader = LighterTrader()
    # Temporarily set ENV for trader initialization
    original_key = os.getenv('LIGHTER_PRIVATE_KEY')
    original_l1_key = os.getenv('LIGHTER_L1_PRIVATE_KEY')
    original_account = os.getenv('ACCOUNT_INDEX')
    
    try:
        os.environ['LIGHTER_PRIVATE_KEY'] = keys['private_key']
        os.environ['LIGHTER_L1_PRIVATE_KEY'] = keys['private_key']
        os.environ['ACCOUNT_INDEX'] = str(keys['account_index'])
        
        await trader.setup()
        return trader
    finally:
        # Restore original ENV
        if original_key:
            os.environ['LIGHTER_PRIVATE_KEY'] = original_key
        if original_l1_key:
            os.environ['LIGHTER_L1_PRIVATE_KEY'] = original_l1_key
        if original_account:
            os.environ['ACCOUNT_INDEX'] = original_account


async def initialize_aster_trader(keys: dict) -> AsterTrader:
    """Initialize Aster trader with provided keys"""
    if not keys['api_key'] or not keys['secret_key']:
        raise HTTPException(status_code=400, detail="Aster API keys not provided and not found in ENV")
    
    trader = AsterTrader()
    # Temporarily set ENV for trader initialization
    original_api_key = os.getenv('ASTER_API_KEY')
    original_secret = os.getenv('ASTER_SECRET_KEY')
    original_url = os.getenv('ASTER_API_URL')
    
    try:
        os.environ['ASTER_API_KEY'] = keys['api_key']
        os.environ['ASTER_SECRET_KEY'] = keys['secret_key']
        os.environ['ASTER_API_URL'] = keys['api_url']
        
        await trader.setup()
        return trader
    finally:
        # Restore original ENV
        if original_api_key:
            os.environ['ASTER_API_KEY'] = original_api_key
        if original_secret:
            os.environ['ASTER_SECRET_KEY'] = original_secret
        if original_url:
            os.environ['ASTER_API_URL'] = original_url




# =============== ROUTES ===============

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Trading API Server",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }


@app.get("/api/status")
async def get_status():
    """Health check"""
    return {
        "status": "online",
        "message": "Trading API Server is running"
    }


@app.post("/api/order/market")
async def place_market_order(order: MarketOrderRequest):
    """
    Place a MARKET order on Lighter or Aster
    
    Example:
    {
        "exchange": "lighter",
        "symbol": "BTC",
        "side": "long",
        "size_usd": 200,
        "leverage": 5,
        "tp_price": 110000,
        "sl_price": 100000
    }
    
    With custom keys:
    {
        "keys": {
            "lighter_private_key": "0x...",
            "lighter_account_index": 198336
        },
        "exchange": "lighter",
        "symbol": "BTC",
        ...
    }
    """
    try:
        print(f"\n{'='*60}")
        print(f"📥 NEW MARKET ORDER REQUEST")
        print(f"{'='*60}")
        print(f"Exchange: {order.exchange.upper()}")
        print(f"Symbol: {order.symbol}")
        print(f"Side: {order.side.upper()}")
        print(f"Size: ${order.size_usd}")
        print(f"Leverage: {order.leverage}x")
        
        # Get keys
        keys = get_keys_or_env(order.keys, order.exchange)
        
        # Initialize trader
        if order.exchange == "lighter":
            trader = await initialize_lighter_trader(keys)
            
            # Only place TP/SL if explicitly provided
            if order.tp_price and order.sl_price:
                # Calculate sl_percent from prices
                entry_price = order.tp_price  # Will be updated after order
                sl_percent = 10  # Will be calculated properly
                rr_ratio = [1, 2]
            else:
                # No TP/SL - just place entry order
                sl_percent = None
                rr_ratio = None
            
            # Place order
            result = await trader.place_order(
                side=order.side,
                symbol=order.symbol,
                size_usd=order.size_usd,
                leverage=order.leverage,
                sl_percent=sl_percent,
                rr_ratio=rr_ratio
            )
            
        else:  # aster
            trader = await initialize_aster_trader(keys)
            
            # Only place TP/SL if explicitly provided
            if order.tp_price and order.sl_price:
                sl_percent = 10  # Will be calculated properly
                rr_ratio = [1, 2]
            else:
                # No TP/SL - just place entry order
                sl_percent = None
                rr_ratio = None
            
            # Place order
            result = await trader.place_order(
                side=order.side,
                symbol=order.symbol,
                size_usd=order.size_usd,
                leverage=order.leverage,
                sl_percent=sl_percent,
                rr_ratio=rr_ratio
            )
        
        if not result.get('success'):
            error_msg = result.get('error', 'Unknown error')
            print(f"❌ Order failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        print(f"\n✅ ORDER PLACED SUCCESSFULLY")
        print(f"Order ID: {result.get('order_id')}")
        print(f"Entry Price: ${result.get('entry_price', 0):,.2f}")
        print(f"Position Size: {result.get('position_size', 0)}")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "exchange": order.exchange,
            "symbol": order.symbol,
            "side": order.side,
            "order_id": result.get('order_id'),
            "entry_price": result.get('entry_price'),
            "position_size": result.get('position_size'),
            "size_usd": order.size_usd,
            "leverage": order.leverage,
            "tp_sl_placed": bool(order.tp_price and order.sl_price)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/order/limit")
async def place_limit_order(order: LimitOrderRequest):
    """
    Place a LIMIT order on Lighter or Aster
    
    Example:
    {
        "exchange": "aster",
        "symbol": "BTC",
        "side": "long",
        "size_usd": 200,
        "leverage": 5,
        "limit_price": 108000,
        "tp_price": 110000,
        "sl_price": 106000
    }
    """
    try:
        print(f"\n{'='*60}")
        print(f"📥 NEW LIMIT ORDER REQUEST")
        print(f"{'='*60}")
        print(f"Exchange: {order.exchange.upper()}")
        print(f"Symbol: {order.symbol}")
        print(f"Side: {order.side.upper()}")
        print(f"Size: ${order.size_usd}")
        print(f"Limit Price: ${order.limit_price:,.2f}")
        print(f"Leverage: {order.leverage}x")
        
        # Note: Lighter doesn't support traditional LIMIT orders easily
        if order.exchange == "lighter":
            raise HTTPException(
                status_code=501,
                detail="Limit orders on Lighter not yet implemented. Use market orders instead."
            )
        
        # Get keys
        keys = get_keys_or_env(order.keys, order.exchange)
        
        # Initialize Aster trader
        trader = await initialize_aster_trader(keys)
        
        # TODO: Implement limit order for Aster
        raise HTTPException(
            status_code=501,
            detail="Limit orders not yet fully implemented. Coming soon!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/order/close")
async def close_position(request: ClosePositionRequest):
    """
    Close an open position
    
    Example:
    {
        "exchange": "lighter",
        "symbol": "BTC"
    }
    
    With custom keys:
    {
        "keys": {
            "lighter_private_key": "0x...",
            "lighter_account_index": 198336
        },
        "exchange": "lighter",
        "symbol": "BTC"
    }
    """
    try:
        print(f"\n{'='*60}")
        print(f"📥 CLOSE POSITION REQUEST")
        print(f"{'='*60}")
        print(f"Exchange: {request.exchange.upper()}")
        print(f"Symbol: {request.symbol}")
        
        # Get keys
        keys = get_keys_or_env(request.keys, request.exchange)
        
        # Initialize trader
        if request.exchange == "lighter":
            trader = await initialize_lighter_trader(keys)
            result = await trader.close_position(request.symbol)
        else:  # aster
            trader = await initialize_aster_trader(keys)
            result = await trader.close_position()
        
        if not result.get('success'):
            error_msg = result.get('error', 'Unknown error')
            print(f"❌ Close failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        print(f"\n✅ POSITION CLOSED SUCCESSFULLY")
        if result.get('pnl_percent') is not None:
            print(f"P&L: {result['pnl_percent']:+.2f}%")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "exchange": request.exchange,
            "symbol": request.symbol,
            "pnl_percent": result.get('pnl_percent'),
            "message": "Position closed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============== SERVER STARTUP ===============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('API_PORT', 8080))
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║          🚀 TRADING API SERVER                           ║
╠══════════════════════════════════════════════════════════╣
║  Port: {port}                                                ║
║  Docs: http://localhost:{port}/docs                        ║
║  Status: http://localhost:{port}/api/status                ║
╠══════════════════════════════════════════════════════════╣
║  Endpoints:                                              ║
║    POST /api/order/market - Place market order           ║
║    POST /api/order/limit  - Place limit order            ║
║    POST /api/order/close  - Close position               ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

