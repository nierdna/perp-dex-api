"""
Helper utilities for API
"""

import os
from typing import Optional
from fastapi import HTTPException

from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.utils.config import ConfigLoader as LighterConfigLoader
from perpsdex.aster.core.client import AsterClient

from api.models import KeysConfig


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
    
    Returns:
        lighter: {base_symbol, pair, market_id}
        aster: {base_symbol, symbol_pair, symbol_api}
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
        "symbol_pair": pair,
        "symbol_api": symbol_api,
    }


def validate_tp_sl(side: str, entry_price: float, tp_price: Optional[float], sl_price: Optional[float]):
    """
    Validate TP/SL theo hướng lệnh và entry/limit price.
    
    - LONG:  SL < entry < TP
    - SHORT: TP < entry < SL
    """
    if tp_price is None and sl_price is None:
        return

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
    pk = keys.get("private_key")
    acc_idx = keys.get("account_index")
    api_idx = keys.get("api_key_index")

    if pk:
        masked_pk = f"{pk[:6]}...{pk[-4:]}" if len(pk) > 10 else "****"
    else:
        masked_pk = None

    print(f"[LighterKeys] account_index={acc_idx}, api_key_index={api_idx}, private_key={masked_pk}")

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

    result = await client.test_connection()
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Aster: kết nối thất bại: {result.get('message')}",
        )

    return client

