#!/usr/bin/env python3
"""
FastAPI Backend cho Lighter Trading Bot

Run: uvicorn perpsdex.lighter.api.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sys
import os
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.market import MarketData
from perpsdex.lighter.core.order import OrderExecutor
from perpsdex.lighter.core.risk import RiskManager
from perpsdex.lighter.utils.calculator import Calculator
from perpsdex.lighter.utils.config import ConfigLoader

from dotenv import load_dotenv
load_dotenv()

# FastAPI app
app = FastAPI(
    title="Lighter Trading Bot API",
    description="API để control trading bot trên Lighter DEX",
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
_client: Optional[LighterClient] = None


# =============== MODELS ===============

class OrderRequest(BaseModel):
    symbol: str  # 'BTC', 'ETH'
    size_usd: float
    leverage: float = 1.0
    sl_percent: Optional[float] = None  # SL distance %
    rr_ratio: Optional[List[float]] = None  # [1, 2]


class BracketOrderRequest(BaseModel):
    symbol: str
    side: str  # 'long' or 'short'
    size_usd: float
    leverage: float = 1.0
    sl_percent: float = 3.0  # Default 3%
    rr_ratio: List[float] = [1, 2]  # Default [1, 2]


# =============== HELPER FUNCTIONS ===============

async def get_client() -> LighterClient:
    """Get or create client singleton"""
    global _client
    
    if _client is None:
        private_key = os.getenv('LIGHTER_PRIVATE_KEY')
        if not private_key:
            raise HTTPException(status_code=500, detail="LIGHTER_PRIVATE_KEY not configured")
        
        account_index = int(os.getenv('ACCOUNT_INDEX', 0))
        
        _client = LighterClient(
            private_key=private_key,
            account_index=account_index,
            api_key_index=0
        )
        
        result = await _client.connect()
        if not result['success']:
            raise HTTPException(status_code=500, detail=f"Connection failed: {result.get('error')}")
    
    return _client


def get_market_id(symbol: str) -> int:
    """Convert symbol to market_id"""
    pair = f"{symbol}-USDT"
    return ConfigLoader.get_market_id_for_pair(pair)


# =============== ENDPOINTS ===============

@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "message": "Lighter Trading Bot API",
        "version": "1.0.0"
    }


@app.get("/api/market/price/{symbol}")
async def get_price(symbol: str):
    """
    Lấy giá của symbol
    
    Example: GET /api/market/price/BTC
    """
    try:
        client = await get_client()
        market = MarketData(client.get_order_api(), client.get_account_api())
        
        market_id = get_market_id(symbol.upper())
        result = await market.get_price(market_id, symbol.upper())
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        return {
            "symbol": symbol.upper(),
            "bid": result['bid'],
            "ask": result['ask'],
            "mid": result['mid'],
            "market_id": market_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/balance")
async def get_balance():
    """
    Lấy account balance
    
    Example: GET /api/market/balance
    """
    try:
        client = await get_client()
        market = MarketData(client.get_order_api(), client.get_account_api())
        
        account_index = int(os.getenv('ACCOUNT_INDEX', 0))
        result = await market.get_account_balance(account_index)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        return {
            "available": result['available'],
            "collateral": result['collateral'],
            "total": result['total']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/positions")
async def get_positions():
    """
    Lấy danh sách positions đang mở
    
    Example: GET /api/positions
    """
    try:
        client = await get_client()
        market = MarketData(client.get_order_api(), client.get_account_api())
        
        account_index = int(os.getenv('ACCOUNT_INDEX', 0))
        result = await market.get_positions(account_index)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        return {
            "count": result['count'],
            "positions": result['positions']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/long")
async def place_long_order(order: OrderRequest):
    """
    Đặt lệnh LONG
    
    Body:
    {
        "symbol": "BTC",
        "size_usd": 100,
        "leverage": 5,
        "sl_percent": 3,
        "rr_ratio": [1, 2]
    }
    """
    try:
        client = await get_client()
        
        # Check keys mismatch
        if client.has_keys_mismatch():
            raise HTTPException(status_code=403, detail="Keys mismatch - Cannot place orders. Fix API keys first.")
        
        # Get price
        market = MarketData(client.get_order_api(), client.get_account_api())
        market_id = get_market_id(order.symbol.upper())
        
        price_result = await market.get_price(market_id, order.symbol.upper())
        if not price_result['success']:
            raise HTTPException(status_code=400, detail="Failed to get price")
        
        entry_price = price_result['ask']
        
        # Place entry order
        executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
        result = await executor.place_order(
            side='long',
            entry_price=entry_price,
            position_size_usd=order.size_usd,
            market_id=market_id,
            symbol=order.symbol.upper(),
            leverage=order.leverage
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        # Place TP/SL nếu có config
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            sl_price = Calculator.calculate_sl_from_percent(entry_price, 'long', order.sl_percent)
            tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(
                entry_price, 'long', sl_price, order.rr_ratio
            )
            
            risk_manager = RiskManager(client.get_signer_client(), client.get_order_api())
            tp_sl_result = await risk_manager.place_tp_sl_orders(
                entry_price=entry_price,
                position_size=result['position_size'],
                side='long',
                tp_price=tp_sl_calc['tp_price'],
                sl_price=sl_price,
                market_id=market_id,
                symbol=order.symbol.upper()
            )
        
        return {
            "success": True,
            "entry": {
                "tx_hash": result['tx_hash'],
                "entry_price": result['entry_price'],
                "position_size": result['position_size'],
                "side": result['side']
            },
            "tp_sl": tp_sl_result if tp_sl_result else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/orders/short")
async def place_short_order(order: OrderRequest):
    """
    Đặt lệnh SHORT
    
    Body: Same as /api/orders/long
    """
    try:
        client = await get_client()
        
        if client.has_keys_mismatch():
            raise HTTPException(status_code=403, detail="Keys mismatch - Cannot place orders")
        
        # Get price
        market = MarketData(client.get_order_api(), client.get_account_api())
        market_id = get_market_id(order.symbol.upper())
        
        price_result = await market.get_price(market_id, order.symbol.upper())
        if not price_result['success']:
            raise HTTPException(status_code=400, detail="Failed to get price")
        
        entry_price = price_result['bid']  # SHORT → sell at bid
        
        # Place entry order
        executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
        result = await executor.place_order(
            side='short',
            entry_price=entry_price,
            position_size_usd=order.size_usd,
            market_id=market_id,
            symbol=order.symbol.upper(),
            leverage=order.leverage
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        # Place TP/SL nếu có config
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            sl_price = Calculator.calculate_sl_from_percent(entry_price, 'short', order.sl_percent)
            tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(
                entry_price, 'short', sl_price, order.rr_ratio
            )
            
            risk_manager = RiskManager(client.get_signer_client(), client.get_order_api())
            tp_sl_result = await risk_manager.place_tp_sl_orders(
                entry_price=entry_price,
                position_size=result['position_size'],
                side='short',
                tp_price=tp_sl_calc['tp_price'],
                sl_price=sl_price,
                market_id=market_id,
                symbol=order.symbol.upper()
            )
        
        return {
            "success": True,
            "entry": {
                "tx_hash": result['tx_hash'],
                "entry_price": result['entry_price'],
                "position_size": result['position_size'],
                "side": result['side']
            },
            "tp_sl": tp_sl_result if tp_sl_result else None
        }
        
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
        "symbol": "ETH",
        "side": "long",
        "size_usd": 100,
        "leverage": 5,
        "sl_percent": 3,
        "rr_ratio": [1, 2]
    }
    """
    try:
        client = await get_client()
        
        # Get price
        market = MarketData(client.get_order_api(), client.get_account_api())
        market_id = get_market_id(order.symbol.upper())
        
        price_result = await market.get_price(market_id, order.symbol.upper())
        if not price_result['success']:
            raise HTTPException(status_code=400, detail="Failed to get price")
        
        entry_price = price_result['ask'] if order.side == 'long' else price_result['bid']
        
        # Calculate position size
        position_size = Calculator.calculate_position_size(order.size_usd, entry_price)
        
        # Calculate TP/SL
        sl_price = Calculator.calculate_sl_from_percent(entry_price, order.side, order.sl_percent)
        tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(
            entry_price, order.side, sl_price, order.rr_ratio
        )
        
        # Validate SL
        validation = Calculator.validate_sl_price(sl_price, entry_price, order.side, max_percent=5)
        
        return {
            "symbol": order.symbol.upper(),
            "side": order.side,
            "entry_price": entry_price,
            "position_size": position_size,
            "position_size_usd": order.size_usd,
            "leverage": order.leverage,
            "tp_price": tp_sl_calc['tp_price'],
            "sl_price": validation['adjusted_price'] if not validation['valid'] else sl_price,
            "risk_amount": tp_sl_calc['risk_amount'],
            "reward_amount": tp_sl_calc['reward_amount'],
            "rr_ratio": f"1:{tp_sl_calc['reward_amount']/tp_sl_calc['risk_amount']:.2f}",
            "sl_valid": validation['valid'],
            "sl_adjusted": not validation['valid']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/status")
async def get_status():
    """
    Kiểm tra API status và connection
    """
    try:
        client = await get_client()
        
        return {
            "api_status": "online",
            "connection": "connected",
            "keys_mismatch": client.has_keys_mismatch(),
            "can_trade": not client.has_keys_mismatch()
        }
        
    except Exception as e:
        return {
            "api_status": "online",
            "connection": "error",
            "error": str(e),
            "can_trade": False
        }


@app.get("/api/markets")
async def get_supported_markets():
    """
    Lấy danh sách tất cả pairs được support
    
    Returns: List of supported pairs với market_id và category
    """
    import json
    from pathlib import Path
    
    # Load từ lighter_markets.json nếu có
    markets_file = Path(__file__).parent.parent / 'lighter_markets.json'
    
    if markets_file.exists():
        with open(markets_file, 'r') as f:
            markets_data = json.load(f)
        
        # Group by category
        categories = {
            'major': [],
            'defi': [],
            'layer1_2': [],
            'meme': [],
            'other': []
        }
        
        for m in markets_data:
            symbol = m['symbol']
            market_info = {
                'symbol': symbol,
                'market_id': m['market_id'],
                'price': m['mid'],
                'pair': f"{symbol}-USDT"
            }
            
            # Categorize
            if symbol in ['BTC', 'SOL', 'BNB']:
                categories['major'].append(market_info)
            elif symbol in ['AAVE', 'UNI', 'LINK', 'GMX', 'LTC', 'BCH', 'CRV', 'LDO', 'DYDX', 'ONDO', 'PENDLE']:
                categories['defi'].append(market_info)
            elif symbol in ['AVAX', 'ARB', 'OP', 'DOT', 'APT', 'SUI', 'NEAR', 'SEI', 'TIA', 'MNT', 'BERA']:
                categories['layer1_2'].append(market_info)
            elif symbol in ['DOGE', 'WIF', 'TRUMP', '1000PEPE', '1000SHIB', '1000BONK', '1000FLOKI', 'POPCAT', 'FARTCOIN']:
                categories['meme'].append(market_info)
            else:
                categories['other'].append(market_info)
        
        return {
            "total": len(markets_data),
            "categories": categories,
            "note": "ETH-USDT is NOT available on Lighter DEX"
        }
    else:
        # Fallback to hardcoded list
        return {
            "total": 66,
            "note": "Run get_all_markets.py to generate full list",
            "major": ["BTC", "SOL", "BNB"],
            "eth_available": False
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

