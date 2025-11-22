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
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import json
import urllib.request

# Load environment
load_dotenv()

# Optional DB layer for logging orders
try:
    from db import (
        log_order_request,
        update_order_after_result,
        test_db_connection,
    )
except Exception as _db_import_err:
    # Không chặn server nếu DB layer lỗi, chỉ log cảnh báo
    print(f"[DB] Warning: không thể import db module: {_db_import_err}")
    log_order_request = None  # type: ignore
    update_order_after_result = None  # type: ignore
    test_db_connection = None  # type: ignore

# Import Lighter SDK
from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.market import MarketData as LighterMarketData
from perpsdex.lighter.core.order import OrderExecutor as LighterOrderExecutor
from perpsdex.lighter.core.risk import RiskManager as LighterRiskManager
from perpsdex.lighter.utils.config import ConfigLoader as LighterConfigLoader

# Import Aster SDK
from perpsdex.aster.core.client import AsterClient
from perpsdex.aster.core.market import MarketData as AsterMarketData
from perpsdex.aster.core.order import OrderExecutor as AsterOrderExecutor
from perpsdex.aster.core.risk import RiskManager as AsterRiskManager


# Lifespan event: Kiểm tra database connection khi server startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager để kiểm tra DB khi startup"""
    # Startup
    if test_db_connection is not None:
        db_status = test_db_connection()
        status_icon = "✅" if db_status["connected"] else "❌" if db_status["status"] == "failed" else "⚠️"
        print(f"\n{status_icon} [DB] {db_status['message']}")
        if not db_status["connected"]:
            print("   ⚠️  Orders sẽ KHÔNG được lưu vào database cho đến khi fix lỗi.")
    else:
        print("\n⚠️  [DB] Database module không available, skip connection check.")
    
    yield  # Server running
    
    # Shutdown (nếu cần cleanup, thêm code ở đây)
    pass


# FastAPI app
app = FastAPI(
    title="Trading API Server",
    description="API for placing orders on Lighter and Aster DEX",
    version="1.0.0",
    lifespan=lifespan,
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
    aster_api_url: Optional[str] = None


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


# =============== UNIFIED ORDER MODEL ===============

class UnifiedOrderRequest(BaseModel):
    """
    Unified trading order request - theo spec trong docs/api/api.md
    """
    # API Keys (optional - fallback to ENV)
    keys: Optional[KeysConfig] = Field(
        None, description="API keys (optional, nếu không gửi sẽ dùng ENV trên server)"
    )

    # Trading params bắt buộc
    exchange: Literal["lighter", "aster"] = Field(..., description="lighter hoặc aster")
    symbol: str = Field(..., description="Base token, ví dụ: BTC, ETH, SOL")
    side: Literal["long", "short"] = Field(..., description="Hướng lệnh: long hoặc short")
    order_type: Literal["market", "limit"] = Field(..., description="Loại lệnh: market hoặc limit")
    size_usd: float = Field(..., gt=0, description="Khối lượng vị thế theo USD (chưa nhân leverage)")
    leverage: float = Field(..., ge=1, description="Đòn bẩy (>=1)")

    # Limit specific
    limit_price: Optional[float] = Field(
        None, gt=0, description="Giá limit (bắt buộc nếu order_type = 'limit')"
    )

    # TP/SL theo GIÁ
    tp_price: Optional[float] = Field(None, gt=0, description="Giá Take Profit (optional)")
    sl_price: Optional[float] = Field(None, gt=0, description="Giá Stop Loss (optional)")

    # Quản lý lệnh
    max_slippage_percent: Optional[float] = Field(
        None, ge=0, description="Trượt giá tối đa cho lệnh market (%, optional)"
    )
    client_order_id: Optional[str] = Field(
        None, description="ID phía client để idempotent/tracking (optional)"
    )
    tag: Optional[str] = Field(
        None, description="Nhãn chiến lược / nguồn lệnh (optional)"
    )


# =============== HELPER FUNCTIONS ===============

def get_keys_or_env(keys_config: Optional[KeysConfig], exchange: str) -> dict:
    """Lấy API keys từ request hoặc fallback ENV"""
    
    if exchange == "lighter":
        return {
            "private_key": (keys_config.lighter_private_key if keys_config else None)
            or os.getenv("LIGHTER_PRIVATE_KEY")
            or os.getenv("LIGHTER_L1_PRIVATE_KEY"),
            "account_index": (keys_config.lighter_account_index if keys_config else None)
            or int(os.getenv("ACCOUNT_INDEX", 0)),
            "api_key_index": (keys_config.lighter_api_key_index if keys_config else None)
            or int(os.getenv("LIGHTER_API_KEY_INDEX", 0)),
        }
    else:  # aster
        return {
            "api_key": (keys_config.aster_api_key if keys_config else None)
            or os.getenv("ASTER_API_KEY"),
            "secret_key": (keys_config.aster_secret_key if keys_config else None)
            or os.getenv("ASTER_SECRET_KEY"),
            "api_url": (keys_config.aster_api_url if keys_config else None)
            or os.getenv("ASTER_API_URL", "https://fapi.asterdex.com"),
        }


def normalize_symbol(exchange: str, base_symbol: str) -> dict:
    """
    Chuẩn hoá symbol theo sàn, luôn input là base token (VD: BTC).

    lighter:
        - base_symbol: 'BTC'
        - pair: 'BTC-USDT'
        - market_id: từ ConfigLoader

    aster:
        - base_symbol: 'BTC'
        - symbol_pair: 'BTC-USDT'   (dùng cho UI/log)
        - symbol_api:  'BTCUSDT'    (dùng gọi REST /fapi/v1/*)
    """
    symbol = base_symbol.upper()

    if exchange == "lighter":
        pair = f"{symbol}-USDT"
        try:
            market_id = LighterConfigLoader.get_market_id_for_pair(pair)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail=f"Lighter: symbol/pair không được hỗ trợ: {pair}",
            )

        return {
            "base_symbol": symbol,
            "pair": pair,
            "market_id": market_id,
        }

    # aster
    pair = f"{symbol}-USDT"
    symbol_api = f"{symbol}USDT"
    return {
        "base_symbol": symbol,
        "symbol_pair": pair,   # ví dụ BTC-USDT cho UI/log
        "symbol_api": symbol_api,  # ví dụ BTCUSDT cho REST Aster
    }


def validate_tp_sl(side: str, entry_price: float, tp_price: Optional[float], sl_price: Optional[float]):
    """
    Validate TP/SL theo hướng lệnh và entry/limit price.

    - LONG:  SL < entry < TP (nếu field tồn tại)
    - SHORT: TP < entry < SL (nếu field tồn tại)
    """
    if tp_price is None and sl_price is None:
        return

    # LONG
    if side == "long":
        if sl_price is not None and sl_price >= entry_price:
            raise HTTPException(
                status_code=400,
                detail=f"SL price must be < entry price cho lệnh LONG (sl={sl_price}, entry={entry_price})",
            )
        if tp_price is not None and tp_price <= entry_price:
            raise HTTPException(
                status_code=400,
                detail=f"TP price must be > entry price cho lệnh LONG (tp={tp_price}, entry={entry_price})",
            )
    else:  # SHORT
        if tp_price is not None and tp_price >= entry_price:
            raise HTTPException(
                status_code=400,
                detail=f"TP price must be < entry price cho lệnh SHORT (tp={tp_price}, entry={entry_price})",
            )
        if sl_price is not None and sl_price <= entry_price:
            raise HTTPException(
                status_code=400,
                detail=f"SL price must be > entry price cho lệnh SHORT (sl={sl_price}, entry={entry_price})",
            )


async def initialize_lighter_client(keys: dict) -> LighterClient:
    """Khởi tạo LighterClient với keys đã chuẩn hoá"""
    # Log nhẹ thông tin key đang dùng (mask private key để tránh lộ full)
    pk = keys.get("private_key")
    acc_idx = keys.get("account_index")
    api_idx = keys.get("api_key_index")

    if pk:
        masked_pk = f"{pk[:6]}...{pk[-4:]}" if len(pk) > 10 else "****"
    else:
        masked_pk = None

    print(
        f"[LighterKeys] account_index={acc_idx}, api_key_index={api_idx}, "
        f"private_key={masked_pk}"
    )

    if not pk:
        raise HTTPException(
            status_code=400,
            detail="Lighter private key không có (cần trong body hoặc ENV)",
        )

    client = LighterClient(
        private_key=pk,
        api_key_index=keys.get("api_key_index", 0),
        account_index=keys.get("account_index", 0),
    )

    result = await client.connect()
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Lighter: kết nối thất bại: {result.get('error')}",
        )

    return client


async def initialize_aster_client(keys: dict) -> AsterClient:
    """Khởi tạo AsterClient với keys đã chuẩn hoá"""
    if not keys.get("api_key") or not keys.get("secret_key"):
        raise HTTPException(
            status_code=400,
            detail="Aster API keys không có (cần trong body hoặc ENV)",
        )

    client = AsterClient(
        api_url=keys["api_url"],
        api_key=keys["api_key"],
        secret_key=keys["secret_key"],
    )

    # Test kết nối nhẹ để validate key/url
    result = await client.test_connection()
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Aster: kết nối thất bại: {result.get('message')}",
        )

    return client


async def handle_lighter_order(order: UnifiedOrderRequest, keys: dict) -> dict:
    """Xử lý lệnh cho Lighter (market/limit, long/short, TP/SL theo giá)"""
    client = await initialize_lighter_client(keys)
    norm = normalize_symbol("lighter", order.symbol)
    market_id = norm["market_id"]
    symbol = norm["base_symbol"]

    market = LighterMarketData(client.get_order_api(), client.get_account_api())

    # Lấy entry_price
    if order.order_type == "market":
        price_result = await market.get_price(market_id, symbol)
        if not price_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Lighter: không lấy được giá thị trường cho {symbol}",
            )
        entry_price = (
            price_result["ask"] if order.side == "long" else price_result["bid"]
        )
    else:
        if not order.limit_price:
            raise HTTPException(
                status_code=400,
                detail="limit_price bắt buộc khi order_type = 'limit' cho Lighter",
            )
        entry_price = order.limit_price

    # Validate TP/SL theo rule
    validate_tp_sl(order.side, entry_price, order.tp_price, order.sl_price)

    executor = LighterOrderExecutor(
        client.get_signer_client(), client.get_order_api()
    )

    if order.order_type == "market":
        result = await executor.place_order(
            side=order.side,
            entry_price=entry_price,
            position_size_usd=order.size_usd,
            market_id=market_id,
            symbol=symbol,
            leverage=order.leverage,
            max_slippage_percent=order.max_slippage_percent,
        )
    else:
        result = await executor.place_limit_order(
            side=order.side,
            limit_price=order.limit_price,
            position_size_usd=order.size_usd,
            market_id=market_id,
            symbol=symbol,
            leverage=order.leverage,
        )

    if not result or not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Lighter: đặt lệnh thất bại")
            if result
            else "Lighter: không nhận được phản hồi từ place_order",
        )

    # TP/SL nếu có
    tp_sl_info = None
    if order.tp_price or order.sl_price:
        risk_manager = LighterRiskManager(
            client.get_signer_client(), client.get_order_api()
        )
        position_size = result.get("position_size") or result.get("size")
        if position_size is None:
            raise HTTPException(
                status_code=500,
                detail="Lighter: không nhận được position_size từ kết quả order",
            )

        tp_price = order.tp_price
        sl_price = order.sl_price

        tp_sl_result = await risk_manager.place_tp_sl_orders(
            entry_price=entry_price,
            position_size=position_size,
            side=order.side,
            tp_price=tp_price,
            sl_price=sl_price,
            market_id=market_id,
            symbol=symbol,
        )
        tp_sl_info = {
            "raw": tp_sl_result,
            "tp_price": tp_price,
            "sl_price": sl_price,
        }

    return {
        "success": True,
        "exchange": "lighter",
        "symbol": symbol,
        "side": order.side,
        "order_type": order.order_type,
        "order_id": result.get("order_id"),
        "entry_price": result.get("entry_price", entry_price),
        "position_size": result.get("position_size"),
        "size_usd": order.size_usd,
        "leverage": order.leverage,
        "tp_price": order.tp_price,
        "sl_price": order.sl_price,
        "tp_sl": tp_sl_info,
    }


async def handle_aster_order(order: UnifiedOrderRequest, keys: dict) -> dict:
    """Xử lý lệnh cho Aster (market/limit, long/short, TP/SL theo giá)"""
    client = await initialize_aster_client(keys)
    norm = normalize_symbol("aster", order.symbol)
    symbol_pair = norm["symbol_pair"]      # BTC-USDT
    symbol_api = norm["symbol_api"]        # BTCUSDT

    market = AsterMarketData(client)

    # Lấy entry_price
    if order.order_type == "market":
        price_result = await market.get_price(symbol_pair)
        if not price_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Aster: không lấy được giá thị trường cho {symbol_pair}",
            )
        entry_price = price_result["ask"] if order.side == "long" else price_result["bid"]
    else:
        if not order.limit_price:
            raise HTTPException(
                status_code=400,
                detail="limit_price bắt buộc khi order_type = 'limit' cho Aster",
            )
        entry_price = order.limit_price

    # Validate TP/SL
    validate_tp_sl(order.side, entry_price, order.tp_price, order.sl_price)

    executor = AsterOrderExecutor(client)
    side_str = "BUY" if order.side == "long" else "SELL"

    if order.order_type == "market":
        result = await executor.place_market_order(
            symbol=symbol_api,
            side=side_str,
            size=order.size_usd,
            leverage=order.leverage,
        )
        if not result or not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Aster: đặt lệnh MARKET thất bại")
                if result
                else "Aster: không nhận được phản hồi từ place_market_order",
            )
        position_size = result.get("filled_size", order.size_usd / entry_price)
        entry_used = result.get("filled_price", entry_price)
    else:
        result = await executor.place_limit_order(
            symbol=symbol_api,
            side=side_str,
            size=order.size_usd,
            price=order.limit_price,
            leverage=order.leverage,
        )
        if not result or not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Aster: đặt lệnh LIMIT thất bại")
                if result
                else "Aster: không nhận được phản hồi từ place_limit_order",
            )
        position_size = result.get("size", order.size_usd / entry_price)
        entry_used = entry_price

    # TP/SL nếu có
    tp_sl_info = None
    if order.tp_price or order.sl_price:
        risk_manager = AsterRiskManager(client, executor)
        tp_price = order.tp_price
        sl_price = order.sl_price

        tp_sl_result = await risk_manager.place_tp_sl(
            symbol=symbol_api,
            side=side_str,
            size=position_size,
            entry_price=entry_used,
            tp_price=tp_price,
            sl_price=sl_price,
        )
        tp_sl_info = {
            "raw": tp_sl_result,
            "tp_price": tp_price,
            "sl_price": sl_price,
        }

    return {
        "success": True,
        "exchange": "aster",
        "symbol": norm["base_symbol"],
        "side": order.side,
        "order_type": order.order_type,
        "order_id": result.get("order_id"),
        "entry_price": entry_used,
        "position_size": position_size,
        "size_usd": order.size_usd,
        "leverage": order.leverage,
        "tp_price": order.tp_price,
        "sl_price": order.sl_price,
        "tp_sl": tp_sl_info,
    }


def log_public_ip():
    """Log public IP của server (hỗ trợ debug API key / IP whitelist)."""
    try:
        with urllib.request.urlopen("https://api.ipify.org?format=json", timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            ip = data.get("ip")
            if ip:
                print(f"🌐 Public IP (api.ipify.org): {ip}")
            else:
                print("⚠️ Không đọc được IP public từ api.ipify.org (response không có 'ip').")
    except Exception as e:
        print(f"⚠️ Không thể lấy IP public từ api.ipify.org: {e}")




# =============== ROUTES ===============

@app.get("/", response_class=HTMLResponse)
async def root():
    """Simple HTML UI để đặt lệnh qua /api/order"""
    return """
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Trading API UI</title>
    <style>
      :root {
        --bg: #0b1020;
        --panel: #141a2e;
        --accent: #3b82f6;
        --accent-soft: rgba(59, 130, 246, 0.15);
        --text: #e5e7eb;
        --muted: #9ca3af;
        --danger: #ef4444;
        --success: #22c55e;
        --border: #1f2937;
        --input-bg: #111827;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        background: radial-gradient(circle at top, #111827, #020617);
        color: var(--text);
      }
      .page {
        min-height: 100vh;
        display: flex;
        align-items: stretch;
        justify-content: center;
        padding: 32px 16px;
      }
      .shell {
        width: 100%;
        max-width: 1120px;
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 24px;
      }
      @media (max-width: 900px) {
        .shell {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .card {
        background: linear-gradient(135deg, #111827, #020617);
        border-radius: 16px;
        border: 1px solid var(--border);
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.85);
        padding: 20px 22px;
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pill {
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: var(--muted);
      }
      .badge-online {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--success);
      }
      .badge-online-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--success);
        box-shadow: 0 0 8px rgba(34, 197, 94, 0.7);
      }
      .section-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--muted);
        margin: 16px 0 8px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 16px;
      }
      .grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px 12px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
      }
      .field label {
        color: var(--muted);
      }
      .input,
      select {
        background: var(--input-bg);
        border-radius: 10px;
        border: 1px solid #1f2937;
        padding: 7px 10px;
        color: var(--text);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        width: 100%;
      }
      .input:focus,
      select:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.6);
      }
      .input::placeholder {
        color: #4b5563;
      }
      .muted {
        font-size: 11px;
        color: var(--muted);
      }
      .row {
        display: flex;
        gap: 10px;
      }
      .row > * {
        flex: 1;
      }
      .btn {
        border-radius: 999px;
        border: none;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: background 0.15s, transform 0.08s, box-shadow 0.15s;
      }
      .btn-primary {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
        box-shadow: 0 10px 30px rgba(37, 99, 235, 0.6);
      }
      .btn-primary:hover {
        background: linear-gradient(135deg, #60a5fa, #2563eb);
        transform: translateY(-1px);
      }
      .btn-primary:active {
        transform: translateY(0);
        box-shadow: 0 6px 18px rgba(37, 99, 235, 0.6);
      }
      .btn-secondary {
        background: rgba(15, 23, 42, 0.9);
        color: var(--muted);
        border: 1px solid var(--border);
      }
      .btn-sm {
        padding: 5px 10px;
        font-size: 11px;
      }
      .btn[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
      }
      .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 16px;
        gap: 10px;
        flex-wrap: wrap;
      }
      .chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .chip {
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        padding: 2px 8px;
        font-size: 11px;
        color: var(--muted);
      }
      details {
        margin-top: 12px;
        background: rgba(15, 23, 42, 0.85);
        border-radius: 12px;
        border: 1px dashed #374151;
        padding: 8px 10px 10px;
      }
      details summary {
        font-size: 12px;
        color: var(--muted);
        cursor: pointer;
        user-select: none;
      }
      details[open] summary {
        color: var(--accent);
      }
      .preview,
      .output {
        background: var(--input-bg);
        border-radius: 12px;
        border: 1px solid #1f2937;
        padding: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        color: #d1d5db;
        max-height: 320px;
        overflow: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .tag-success {
        color: var(--success);
      }
      .tag-error {
        color: var(--danger);
      }
      .status-line {
        font-size: 12px;
        margin-bottom: 6px;
      }
      .status-line span {
        font-weight: 500;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="shell">
        <!-- LEFT: FORM -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="title">
                Trading API UI
                <span class="pill">/api/order</span>
              </div>
              <div class="muted">
                Đặt lệnh LONG/SHORT, MARKET/LIMIT với TP/SL theo giá.
              </div>
            </div>
            <div class="badge-online">
              <span class="badge-online-dot"></span>
              Server
            </div>
          </div>

          <form id="order-form">
            <div class="section-title">Cấu hình lệnh</div>
            <div class="grid">
              <div class="field">
                <label>Exchange</label>
                <select id="exchange">
                  <option value="lighter">lighter</option>
                  <option value="aster">aster</option>
                </select>
                <div class="muted">
                  Chọn sàn giao dịch (lighter / aster).
                </div>
              </div>
              <div class="field">
                <label>Symbol</label>
                <input
                  id="symbol"
                  class="input"
                  placeholder="BTC, ETH, SOL..."
                  value="BTC"
                />
                <div class="muted">
                  Base token, server tự convert sang cặp phù hợp.
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="field">
                <label>Side</label>
                <select id="side">
                  <option value="long">long</option>
                  <option value="short">short</option>
                </select>
              </div>
              <div class="field">
                <label>Order Type</label>
                <select id="order_type">
                  <option value="market">market</option>
                  <option value="limit">limit</option>
                </select>
              </div>
            </div>

            <div class="section-title">Kích thước & giá</div>
            <div class="grid-3">
              <div class="field">
                <label>Size (USD)</label>
                <input
                  id="size_usd"
                  type="number"
                  min="0"
                  step="1"
                  class="input"
                  value="100"
                />
              </div>
              <div class="field">
                <label>Leverage</label>
                <input
                  id="leverage"
                  type="number"
                  min="1"
                  step="1"
                  class="input"
                  value="5"
                />
              </div>
              <div class="field">
                <label>Limit Price</label>
                <input
                  id="limit_price"
                  type="number"
                  step="0.001"
                  class="input"
                  placeholder="Chỉ dùng cho limit"
                />
              </div>
            </div>

            <div class="section-title">TP / SL (giá)</div>
            <div class="grid">
              <div class="field">
                <label>TP Price</label>
                <input
                  id="tp_price"
                  type="number"
                  step="0.001"
                  class="input"
                  placeholder="VD: 105000"
                />
              </div>
              <div class="field">
                <label>SL Price</label>
                <input
                  id="sl_price"
                  type="number"
                  step="0.001"
                  class="input"
                  placeholder="VD: 95000"
                />
              </div>
            </div>

            <details>
              <summary>Advanced options</summary>
              <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 10px;">
                <div class="row">
                  <div class="field">
                    <label>Max slippage (%)</label>
                    <input
                      id="max_slippage_percent"
                      type="number"
                      step="0.1"
                      min="0"
                      class="input"
                      placeholder="Chỉ áp dụng cho market"
                    />
                  </div>
                  <div class="field">
                    <label>Client Order ID</label>
                    <input
                      id="client_order_id"
                      class="input"
                      placeholder="optional"
                    />
                  </div>
                </div>
                <div class="field">
                  <label>Tag / Strategy ID</label>
                  <input
                    id="tag"
                    class="input"
                    placeholder="VD: grid_v1, ui_manual..."
                  />
                </div>

                <details>
                  <summary>Override API keys (optional)</summary>
                  <div
                    style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;"
                  >
                    <div class="muted">
                      Nếu không nhập, server sẽ dùng ENV trên backend.
                    </div>
                    <div class="field">
                      <label>Lighter Private Key</label>
                      <input
                        id="lighter_private_key"
                        class="input"
                        placeholder="0x..."
                      />
                    </div>
                    <div class="row">
                      <div class="field">
                        <label>Lighter Account Index</label>
                        <input
                          id="lighter_account_index"
                          type="number"
                          min="0"
                          step="1"
                          class="input"
                        />
                      </div>
                      <div class="field">
                        <label>Lighter API Key Index</label>
                        <input
                          id="lighter_api_key_index"
                          type="number"
                          min="0"
                          step="1"
                          class="input"
                        />
                      </div>
                    </div>
                    <div class="row">
                      <div class="field">
                        <label>Aster API Key</label>
                        <input
                          id="aster_api_key"
                          class="input"
                          placeholder="ASTER_API_KEY"
                        />
                      </div>
                      <div class="field">
                        <label>Aster Secret Key</label>
                        <input
                          id="aster_secret_key"
                          class="input"
                          placeholder="ASTER_SECRET_KEY"
                        />
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </details>

            <div class="actions">
              <button id="submit-btn" type="submit" class="btn btn-primary">
                <span>Place Order</span>
              </button>
              <div class="chips">
                <span class="chip">POST /api/order</span>
                <span class="chip">JSON payload</span>
              </div>
            </div>
          </form>
        </div>

        <!-- RIGHT: PREVIEW & RESPONSE -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="title">Preview & Response</div>
              <div class="muted">
                Xem payload gửi đi và kết quả trả về từ API.
              </div>
            </div>
          </div>

          <div class="section-title">Payload preview</div>
          <div id="preview" class="preview">{}</div>

          <div class="section-title" style="margin-top: 16px;">Kết quả</div>
          <div id="status-line" class="status-line">
            Chưa gửi request.
          </div>
          <div id="output" class="output">Chưa có dữ liệu.</div>
        </div>
      </div>
    </div>

    <script>
      const form = document.getElementById("order-form");
      const previewEl = document.getElementById("preview");
      const outputEl = document.getElementById("output");
      const statusLine = document.getElementById("status-line");
      const submitBtn = document.getElementById("submit-btn");

      const fields = [
        "exchange",
        "symbol",
        "side",
        "order_type",
        "size_usd",
        "leverage",
        "limit_price",
        "tp_price",
        "sl_price",
        "max_slippage_percent",
        "client_order_id",
        "tag",
        "lighter_private_key",
        "lighter_account_index",
        "lighter_api_key_index",
        "aster_api_key",
        "aster_secret_key",
      ];

      function getValue(id) {
        const el = document.getElementById(id);
        if (!el) return undefined;
        if (el.type === "number") {
          const v = el.value.trim();
          if (v === "") return undefined;
          return Number(v);
        }
        const v = el.value.trim();
        return v === "" ? undefined : v;
      }

      function buildPayload() {
        const payload = {
          exchange: getValue("exchange"),
          symbol: getValue("symbol"),
          side: getValue("side"),
          order_type: getValue("order_type"),
          size_usd: getValue("size_usd"),
          leverage: getValue("leverage"),
        };

        const limitPrice = getValue("limit_price");
        if (limitPrice !== undefined) payload.limit_price = limitPrice;

        const tp = getValue("tp_price");
        const sl = getValue("sl_price");
        if (tp !== undefined) payload.tp_price = tp;
        if (sl !== undefined) payload.sl_price = sl;

        const slippage = getValue("max_slippage_percent");
        if (slippage !== undefined) payload.max_slippage_percent = slippage;

        const clientId = getValue("client_order_id");
        if (clientId !== undefined) payload.client_order_id = clientId;

        const tag = getValue("tag");
        if (tag !== undefined) payload.tag = tag;

        // Keys
        const keys = {};
        const lighterPK = getValue("lighter_private_key");
        const lighterAcc = getValue("lighter_account_index");
        const lighterApiIndex = getValue("lighter_api_key_index");
        const asterKey = getValue("aster_api_key");
        const asterSecret = getValue("aster_secret_key");

        if (lighterPK !== undefined) keys.lighter_private_key = lighterPK;
        if (lighterAcc !== undefined) keys.lighter_account_index = lighterAcc;
        if (lighterApiIndex !== undefined)
          keys.lighter_api_key_index = lighterApiIndex;
        if (asterKey !== undefined) keys.aster_api_key = asterKey;
        if (asterSecret !== undefined) keys.aster_secret_key = asterSecret;

        if (Object.keys(keys).length > 0) {
          payload.keys = keys;
        }

        return payload;
      }

      function updatePreview() {
        const payload = buildPayload();
        previewEl.textContent = JSON.stringify(payload, null, 2);
      }

      // Update preview on input changes
      fields.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", updatePreview);
        el.addEventListener("change", updatePreview);
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = buildPayload();

        // Validate cơ bản phía client
        if (!payload.symbol) {
          alert("Symbol không được để trống");
          return;
        }
        if (!payload.size_usd || payload.size_usd <= 0) {
          alert("Size USD phải > 0");
          return;
        }
        if (!payload.leverage || payload.leverage < 1) {
          alert("Leverage phải >= 1");
          return;
        }
        if (payload.order_type === "limit" && !payload.limit_price) {
          alert("Limit price là bắt buộc cho lệnh LIMIT");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Đang gửi...";
        statusLine.innerHTML =
          '<span class="tag-success">Đang gửi request...</span>';
        outputEl.textContent = "";

        try {
          const res = await fetch("/api/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json().catch(() => null);
          if (res.ok) {
            statusLine.innerHTML =
              '<span class="tag-success">Success</span> HTTP ' + res.status;
            outputEl.textContent = JSON.stringify(data, null, 2);
          } else {
            statusLine.innerHTML =
              '<span class="tag-error">Error</span> HTTP ' + res.status;
            outputEl.textContent = JSON.stringify(data || {}, null, 2);
          }
        } catch (err) {
          statusLine.innerHTML =
            '<span class="tag-error">Network error</span>';
          outputEl.textContent = String(err);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Place Order";
        }
      });

      // Initial preview
      updatePreview();
    </script>
  </body>
</html>
    """


@app.get("/api/status")
async def get_status():
    """Health check"""
    return {
        "status": "online",
        "message": "Trading API Server is running",
    }


@app.post("/api/order")
async def place_unified_order(order: UnifiedOrderRequest):
    """
    Unified endpoint: đặt lệnh LONG/SHORT, MARKET/LIMIT, TP/SL theo GIÁ
    cho cả Lighter và Aster, theo spec trong docs/api/api.md.
    """
    db_order_id = None

    try:
        print(f"\n{'=' * 60}")
        print("📥 NEW UNIFIED ORDER REQUEST")
        print(f"{'=' * 60}")
        print(f"Exchange   : {order.exchange.upper()}")
        print(f"Symbol     : {order.symbol}")
        print(f"Side       : {order.side.upper()}")
        print(f"Order Type : {order.order_type.upper()}")
        print(f"Size (USD) : {order.size_usd}")
        print(f"Leverage   : {order.leverage}x")
        print(f"TP Price   : {order.tp_price}")
        print(f"SL Price   : {order.sl_price}")

        # Ghi log order vào DB ở trạng thái 'pending' (nếu DB được cấu hình)
        if log_order_request is not None:
            db_order_id = log_order_request(
                exchange=order.exchange,
                symbol_base=order.symbol.upper(),
                symbol_pair=None,  # sẽ bổ sung nếu cần mapping chi tiết hơn
                side=order.side,
                order_type=order.order_type,
                size_usd=order.size_usd,
                leverage=order.leverage,
                limit_price=order.limit_price,
                tp_price=order.tp_price,
                sl_price=order.sl_price,
                max_slippage_percent=order.max_slippage_percent,
                client_order_id=order.client_order_id,
                tag=order.tag,
                raw_request=order.model_dump(),
            )

        # Chuẩn hoá keys và gửi lệnh xuống từng sàn
        keys = get_keys_or_env(order.keys, order.exchange)

        # Dispatch theo sàn
        if order.exchange == "lighter":
            result = await handle_lighter_order(order, keys)
        else:
            result = await handle_aster_order(order, keys)

        print("\n✅ ORDER PLACED SUCCESSFULLY")
        print(f"Order ID     : {result.get('order_id')}")
        print(f"Entry Price  : {result.get('entry_price')}")
        print(f"Position Size: {result.get('position_size')}")
        print(f"{'=' * 60}\n")

        # Cập nhật DB sau khi gọi sàn thành công
        if update_order_after_result is not None:
            try:
                update_order_after_result(
                    db_order_id=db_order_id,
                    status="submitted",
                    exchange_order_id=str(result.get("order_id"))
                    if result.get("order_id") is not None
                    else None,
                    entry_price_requested=float(result.get("entry_price"))
                    if result.get("entry_price") is not None
                    else None,
                    entry_price_filled=float(result.get("entry_price"))
                    if result.get("entry_price") is not None
                    else None,
                    position_size_asset=float(result.get("position_size"))
                    if result.get("position_size") is not None
                    else None,
                    raw_response=result,
                )
            except Exception as db_err:
                print(f"[DB] Warning: lỗi khi update order sau khi đặt lệnh: {db_err}")

        return result
        
    except HTTPException as http_exc:
        # Nếu đã có DB record thì cập nhật trạng thái rejected/error
        if update_order_after_result is not None:
            try:
                update_order_after_result(
                    db_order_id=db_order_id,
                    status="rejected" if http_exc.status_code == 400 else "error",
                    exchange_order_id=None,
                    entry_price_requested=None,
                    entry_price_filled=None,
                    position_size_asset=None,
                    raw_response={"detail": http_exc.detail},
                )
            except Exception as db_err:
                print(f"[DB] Warning: lỗi khi update order sau HTTPException: {db_err}")
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        # Cập nhật DB cho lỗi 500 nội bộ
        if update_order_after_result is not None:
            try:
                update_order_after_result(
                    db_order_id=db_order_id,
                    status="error",
                    exchange_order_id=None,
                    entry_price_requested=None,
                    entry_price_filled=None,
                    position_size_asset=None,
                    raw_response={"exception": str(e)},
                )
            except Exception as db_err:
                print(f"[DB] Warning: lỗi khi update order sau Exception: {db_err}")
        raise HTTPException(status_code=500, detail=str(e))


# =============== SERVER STARTUP ===============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('API_PORT', 8080))
    
    print(
        f"""
╔══════════════════════════════════════════════════════════╗
║          🚀 TRADING API SERVER                           ║
╠══════════════════════════════════════════════════════════╣
║  Port: {port:<48}║
║  Docs: http://localhost:{port}/docs                      ║
║  Status: http://localhost:{port}/api/status              ║
╠══════════════════════════════════════════════════════════╣
║  Unified Endpoint:                                      ║
║    POST /api/order - Long/Short, Market/Limit, TP/SL    ║
╚══════════════════════════════════════════════════════════╝
    """
    )

    # Log IP public để hỗ trợ cấu hình whitelist trên Aster, v.v.
    log_public_ip()
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

