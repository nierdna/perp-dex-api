#!/usr/bin/env python3
"""
FastAPI Backend cho Aster Trading Bot

Run: uvicorn perpsdex.aster.api.main:app --reload --host 0.0.0.0 --port 8001

⚠️ TODO: Update all endpoints with actual Aster API integration
Currently this is a template adapted from Lighter
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import sys
import os
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from perpsdex.aster.core.client import AsterClient
from perpsdex.aster.core.market import MarketData
from perpsdex.aster.core.order import OrderExecutor
from perpsdex.aster.core.risk import RiskManager
from perpsdex.aster.utils.calculator import Calculator
from perpsdex.aster.utils.config import ConfigLoader

from dotenv import load_dotenv
load_dotenv()

# FastAPI app
app = FastAPI(
    title="Aster Trading Bot API",
    description="API để control trading bot trên Aster DEX",
    version="1.0.0"
)

# CORS - cho phép frontend gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global client (singleton pattern)
_client: Optional[AsterClient] = None


# =============== MODELS ===============

class OrderRequest(BaseModel):
    symbol: str  # 'BTC-USDT', 'ETH-USDT'
    size_usd: float
    leverage: float = 1.0
    sl_percent: Optional[float] = None  # SL distance %
    rr_ratio: Optional[List[float]] = None  # [1, 2]
    limit_price: Optional[float] = None  # For limit orders


class BracketOrderRequest(BaseModel):
    symbol: str
    side: str  # 'BUY' or 'SELL'
    size_usd: float
    leverage: float = 1.0
    sl_percent: float = 3.0  # Default 3%
    rr_ratio: List[float] = [1, 2]  # Default [1, 2]
    entry_price: Optional[float] = None  # Custom entry price for calculation


# =============== HELPER FUNCTIONS ===============

async def get_client() -> AsterClient:
    """Get or create client singleton"""
    global _client
    
    if _client is None:
        # TODO: Get from .env - need to find correct env var names
        api_key = os.getenv('ASTER_API_KEY')
        secret_key = os.getenv('ASTER_SECRET_KEY')
        api_url = os.getenv('ASTER_API_URL', 'https://fapi.asterdex.com')  # ✅ Official Aster API URL
        
        if not api_key or not secret_key:
            raise HTTPException(
                status_code=500,
                detail="ASTER_API_KEY or ASTER_SECRET_KEY not configured in .env"
            )
        
        _client = AsterClient(
            api_url=api_url,
            api_key=api_key,
            secret_key=secret_key
        )
        
        # Test connection
        result = await _client.test_connection()
        if not result['success']:
            raise HTTPException(status_code=500, detail=f"Connection failed: {result.get('message')}")
        
        print("✅ Kết nối thành công đến Aster DEX")
    
    return _client


# =============== ROUTES ===============

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Aster Trading Bot API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/docs",
        "ui": "/ui_test.html"
    }


@app.get("/ui_test.html")
async def serve_ui():
    """Serve UI HTML file"""
    ui_path = Path(__file__).parent.parent / "ui_test.html"
    if not ui_path.exists():
        raise HTTPException(status_code=404, detail="UI file not found")
    return FileResponse(ui_path)


@app.get("/api/status")
async def get_status():
    """
    Check API & Aster connection status
    """
    try:
        client = await get_client()
        result = await client.test_connection()
        
        return {
            "api_status": "online",
            "aster_connection": result['success'],
            "message": result.get('message', 'OK')
        }
    except Exception as e:
        return {
            "api_status": "online",
            "aster_connection": False,
            "error": str(e)
        }


@app.get("/api/market/price/{symbol}")
async def get_price(symbol: str):
    """
    Lấy giá hiện tại
    
    Example: GET /api/market/price/BTC-USDT
    """
    try:
        client = await get_client()
        market = MarketData(client)
        
        print(f"📈 Đang lấy giá {symbol}...")
        result = await market.get_price(symbol)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        print(f"💰 Giá {symbol}:")
        print(f"   🟢 Bid: ${result['bid']:,.2f}")
        print(f"   🔴 Ask: ${result['ask']:,.2f}")
        print(f"   📊 Mid: ${result['mid']:,.2f}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/balance")
async def get_balance():
    """
    Lấy số dư tài khoản
    """
    try:
        client = await get_client()
        market = MarketData(client)
        
        print("💰 Đang lấy account balance...")
        result = await market.get_balance()
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        print(f"💰 Account Balance:")
        print(f"   💵 Available: ${result['available']:,.2f}")
        print(f"   🏦 Total: ${result['total']:,.2f}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/positions")
async def get_positions():
    """
    Lấy positions đang mở
    """
    try:
        client = await get_client()
        market = MarketData(client)
        
        print("📈 Đang kiểm tra positions...")
        result = await market.get_positions()
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        positions = result.get('positions', [])
        print(f"📊 {len(positions)} positions đang mở")
        for pos in positions:
            print(f"   - {pos['symbol']}: size={pos['size']} entry=${pos['entry_price']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/calculate")
async def calculate_order(order: BracketOrderRequest):
    """
    Calculate TP/SL preview (không place order)
    
    Body:
    {
        "symbol": "BTC-USDT",
        "side": "BUY",
        "size_usd": 100,
        "leverage": 5,
        "sl_percent": 3,
        "rr_ratio": [1, 2],
        "entry_price": 110000  // optional
    }
    """
    try:
        client = await get_client()
        
        # Get entry price: use custom price if provided, otherwise fetch from market
        if order.entry_price and order.entry_price > 0:
            entry_price = order.entry_price
        else:
            market = MarketData(client)
            price_result = await market.get_price(order.symbol)
            
            if not price_result['success']:
                raise HTTPException(status_code=400, detail="Failed to get price")
            
            # Use ask for BUY, bid for SELL
            entry_price = price_result['ask'] if order.side == 'BUY' else price_result['bid']
            print(f"🔵 Market price debug: ask={price_result.get('ask')}, bid={price_result.get('bid')}, entry_price={entry_price}")
        
        # Calculate position size (WITHOUT leverage for price calculation)
        position_size = Calculator.calculate_position_size(order.size_usd, entry_price)
        
        # Calculate position value WITH leverage
        position_value_usd = order.size_usd * order.leverage
        
        # Calculate TP/SL prices
        sl_price = Calculator.calculate_sl_from_percent(entry_price, order.side.lower(), order.sl_percent)
        tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(
            entry_price, order.side.lower(), sl_price, order.rr_ratio
        )
        
        # Calculate ACTUAL risk/reward in USD based on position size
        actual_risk_usd = tp_sl_calc['risk_amount'] * position_size
        actual_reward_usd = tp_sl_calc['reward_amount'] * position_size
        
        # Validate SL
        validation = Calculator.validate_sl_price(sl_price, entry_price, order.side.lower(), max_percent=5)
        
        return {
            "symbol": order.symbol.upper(),
            "side": order.side.lower(),
            "entry_price": entry_price,
            "position_size": position_size,
            "position_size_usd": order.size_usd,
            "position_value_with_leverage": position_value_usd,
            "leverage": order.leverage,
            "tp_price": tp_sl_calc['tp_price'],
            "sl_price": validation['adjusted_price'] if not validation['valid'] else sl_price,
            "risk_amount": actual_risk_usd,
            "reward_amount": actual_reward_usd,
            "rr_ratio": f"1:{actual_reward_usd/actual_risk_usd:.2f}",
            "sl_valid": validation['valid'],
            "sl_adjusted": not validation['valid']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/long")
async def place_long_order(order: OrderRequest):
    """
    Đặt lệnh LONG (BUY)
    
    Body:
    {
        "symbol": "BTC-USDT",
        "size_usd": 100,
        "leverage": 5,
        "sl_percent": 3,
        "rr_ratio": [1, 2]
    }
    """
    try:
        client = await get_client()
        order_executor = OrderExecutor(client)
        
        # Get current price
        market = MarketData(client)
        price_result = await market.get_price(order.symbol)
        
        if not price_result['success']:
            raise HTTPException(status_code=400, detail="Failed to get price")
        
        entry_price = price_result['ask']
        
        # Place MARKET order
        result = await order_executor.place_market_order(
            symbol=order.symbol,
            side='BUY',
            size=order.size_usd,
            leverage=order.leverage
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        # Place TP/SL if configured
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            risk_manager = RiskManager(client, order_executor)
            
            # Calculate prices
            calc = risk_manager.calculate_tp_sl_prices(
                entry_price=entry_price,
                side='BUY',
                sl_percent=order.sl_percent,
                rr_ratio=tuple(order.rr_ratio)
            )
            
            # Calculate position size and place TP/SL
            position_size = Calculator.calculate_position_size(order.size_usd, entry_price)
            print(f"🔵 TP/SL Debug: size_usd={order.size_usd}, entry_price={entry_price}, position_size={position_size}")
            tp_sl_result = await risk_manager.place_tp_sl(
                symbol=order.symbol,
                side='BUY',
                size=position_size,  # Use calculated size
                entry_price=entry_price,
                tp_price=calc['tp_price'],
                sl_price=calc['sl_price']
            )
        
        return {
            "success": True,
            "order_id": result['order_id'],
            "entry_price": entry_price,  # Use calculated entry_price, not filled_price
            "position_size": position_size,  # Use calculated position_size, not filled_size
            "side": "long",
            "tp_sl": tp_sl_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/short")
async def place_short_order(order: OrderRequest):
    """
    Đặt lệnh SHORT (SELL)
    
    Body: Same as /api/orders/long
    """
    try:
        client = await get_client()
        order_executor = OrderExecutor(client)
        
        # Get current price
        market = MarketData(client)
        price_result = await market.get_price(order.symbol)
        
        if not price_result['success']:
            raise HTTPException(status_code=400, detail="Failed to get price")
        
        entry_price = price_result['bid']
        
        # Place MARKET order
        result = await order_executor.place_market_order(
            symbol=order.symbol,
            side='SELL',
            size=order.size_usd,
            leverage=order.leverage
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        # Place TP/SL if configured
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            risk_manager = RiskManager(client, order_executor)
            
            # Calculate prices
            calc = risk_manager.calculate_tp_sl_prices(
                entry_price=entry_price,
                side='SELL',
                sl_percent=order.sl_percent,
                rr_ratio=tuple(order.rr_ratio)
            )
            
            # Place TP/SL
            tp_sl_result = await risk_manager.place_tp_sl(
                symbol=order.symbol,
                side='SELL',
                size=result['filled_size'],
                entry_price=entry_price,
                tp_price=calc['tp_price'],
                sl_price=calc['sl_price']
            )
        
        return {
            "success": True,
            "order_id": result['order_id'],
            "entry_price": result['filled_price'],
            "position_size": result['filled_size'],
            "side": "short",
            "tp_sl": tp_sl_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/limit-long")
async def place_limit_long_order(order: OrderRequest):
    """
    Đặt lệnh LIMIT LONG
    
    Body:
    {
        "symbol": "BTC-USDT",
        "size_usd": 100,
        "leverage": 5,
        "limit_price": 110000,
        "sl_percent": 3,
        "rr_ratio": [1, 2]
    }
    """
    try:
        if not order.limit_price or order.limit_price <= 0:
            raise HTTPException(status_code=400, detail="limit_price is required for limit orders")
        
        client = await get_client()
        order_executor = OrderExecutor(client)
        
        # Place LIMIT order
        result = await order_executor.place_limit_order(
            symbol=order.symbol,
            side='BUY',
            size=order.size_usd,
            price=order.limit_price,
            leverage=order.leverage
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        # Place TP/SL if configured
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            risk_manager = RiskManager(client, order_executor)
            
            # Calculate prices based on limit_price
            calc = risk_manager.calculate_tp_sl_prices(
                entry_price=order.limit_price,
                side='BUY',
                sl_percent=order.sl_percent,
                rr_ratio=tuple(order.rr_ratio)
            )
            
            # Place TP/SL
            tp_sl_result = await risk_manager.place_tp_sl(
                symbol=order.symbol,
                side='BUY',
                size=result['size'],
                entry_price=order.limit_price,
                tp_price=calc['tp_price'],
                sl_price=calc['sl_price']
            )
        
        return {
            "success": True,
            "order_id": result['order_id'],
            "entry_price": order.limit_price,
            "position_size": result['size'],
            "side": "long",
            "tp_sl": tp_sl_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/limit-short")
async def place_limit_short_order(order: OrderRequest):
    """
    Đặt lệnh LIMIT SHORT
    
    Body: Same as limit-long but SELL side
    """
    try:
        if not order.limit_price or order.limit_price <= 0:
            raise HTTPException(status_code=400, detail="limit_price is required for limit orders")
        
        client = await get_client()
        order_executor = OrderExecutor(client)
        
        # Place LIMIT order
        result = await order_executor.place_limit_order(
            symbol=order.symbol,
            side='SELL',
            size=order.size_usd,
            price=order.limit_price,
            leverage=order.leverage
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        # Place TP/SL if configured
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            risk_manager = RiskManager(client, order_executor)
            
            # Calculate prices based on limit_price
            calc = risk_manager.calculate_tp_sl_prices(
                entry_price=order.limit_price,
                side='SELL',
                sl_percent=order.sl_percent,
                rr_ratio=tuple(order.rr_ratio)
            )
            
            # Place TP/SL
            tp_sl_result = await risk_manager.place_tp_sl(
                symbol=order.symbol,
                side='SELL',
                size=result['size'],
                entry_price=order.limit_price,
                tp_price=calc['tp_price'],
                sl_price=calc['sl_price']
            )
        
        return {
            "success": True,
            "order_id": result['order_id'],
            "entry_price": order.limit_price,
            "position_size": result['size'],
            "side": "short",
            "tp_sl": tp_sl_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============== CANCEL & CLOSE ENDPOINTS ===============

@app.post("/api/orders/cancel")
async def cancel_order_endpoint(request: dict):
    """
    Cancel an order on Aster
    
    Body:
    {
        "symbol": "BTC-USDT",
        "order_id": "123456"
    }
    """
    try:
        client = await get_client()
        
        symbol = request.get('symbol')
        order_id = request.get('order_id')
        
        if not symbol or not order_id:
            raise HTTPException(status_code=400, detail="symbol and order_id are required")
        
        print(f"🗑️ Cancelling Aster order {order_id} for {symbol}")
        
        # Cancel order via Aster API
        result = await client.cancel_order(symbol=symbol, order_id=order_id)
        
        if result.get('success'):
            print(f"✅ Aster order cancelled: {order_id}")
            return {
                "success": True,
                "symbol": symbol,
                "order_id": order_id
            }
        else:
            error_msg = result.get('error', 'Unknown error')
            print(f"❌ Cancel failed: {error_msg}")
            raise HTTPException(status_code=400, detail=f"Failed to cancel order: {error_msg}")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/positions/close")
async def close_position_endpoint(request: dict):
    """
    Close an open position on Aster
    
    Body:
    {
        "symbol": "BTC-USDT"
    }
    
    Optional:
    {
        "symbol": "BTC-USDT",
        "percentage": 100  # Close 100% of position (default), or partial like 50%
    }
    """
    try:
        client = await get_client()
        
        symbol = request.get('symbol')
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol is required")
        
        close_percentage = request.get('percentage', 100)
        if close_percentage <= 0 or close_percentage > 100:
            raise HTTPException(status_code=400, detail="percentage must be between 0 and 100")
        
        print(f"🔄 Closing Aster position for {symbol}")
        
        # Get current position
        market_data = MarketData(client)
        position_result = await market_data.get_position(symbol)
        
        if not position_result.get('success'):
            raise HTTPException(status_code=400, detail="Failed to get position")
        
        position = position_result.get('position')
        if not position:
            raise HTTPException(status_code=404, detail=f"No open position found for {symbol}")
        
        position_size = position.get('positionAmt', 0)
        if position_size == 0:
            raise HTTPException(status_code=400, detail=f"Position size is 0 for {symbol}")
        
        # Determine side
        is_long = float(position_size) > 0
        abs_size = abs(float(position_size))
        
        # Calculate close size
        close_size = abs_size * (close_percentage / 100.0)
        
        print(f"📊 Position info:")
        print(f"   Size: {position_size} ({symbol})")
        print(f"   Side: {'LONG' if is_long else 'SHORT'}")
        print(f"   Closing: {close_percentage}% = {close_size}")
        
        # Place close order (reverse side with reduce_only)
        order_executor = OrderExecutor(client)
        
        # Close order is opposite side with reduce_only
        close_side = 'SELL' if is_long else 'BUY'
        
        result = await order_executor.place_market_order(
            symbol=symbol,
            side=close_side,
            size=close_size,
            reduce_only=True  # Only close position, don't open new
        )
        
        if result.get('success'):
            print(f"✅ Aster close order placed: {result.get('order_id')}")
            
            # Calculate P&L if we have entry price
            entry_price = float(position.get('entryPrice', 0))
            current_price = float(position.get('markPrice', 0))
            pnl_percent = None
            
            if entry_price > 0 and current_price > 0:
                if is_long:
                    pnl_percent = ((current_price - entry_price) / entry_price) * 100
                else:
                    pnl_percent = ((entry_price - current_price) / entry_price) * 100
            
            return {
                "success": True,
                "order_id": result.get('order_id'),
                "symbol": symbol,
                "side": "long" if is_long else "short",
                "position_size": position_size,
                "close_size": close_size,
                "close_percentage": close_percentage,
                "entry_price": entry_price,
                "close_price": current_price,
                "pnl_percent": pnl_percent
            }
        else:
            error_msg = result.get('error', 'Unknown error')
            print(f"❌ Close order failed: {error_msg}")
            raise HTTPException(status_code=400, detail=f"Failed to close position: {error_msg}")
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============== SERVER STARTUP ===============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

