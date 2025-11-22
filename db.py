"""
Đơn giản hoá layer database cho việc log lệnh `/api/order`.

Hiện tại dùng SQLAlchemy sync, hỗ trợ mọi `DB_URL` SQLAlchemy-compatible.
Nếu không set `DB_URL`, các hàm log sẽ chạy no-op (không làm gì, chỉ in cảnh báo).
"""

import os
import json
import datetime as dt
from typing import Optional, Dict, Any
from urllib.parse import quote_plus

from sqlalchemy import (
    create_engine,
    MetaData,
    Table,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError


def _build_db_url() -> Optional[str]:
    """
    Build DB_URL từ các biến riêng lẻ hoặc fallback về DB_URL.
    Hỗ trợ format:
    - Ưu tiên: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE (format mới)
    - Fallback: DB_URL (trực tiếp): postgresql://user:pass@host:port/db
    """
    # Ưu tiên 1: Build từ các biến riêng (format mới, ưu tiên cao hơn)
    db_host = os.getenv("DB_HOST", "").strip()
    db_port = os.getenv("DB_PORT", "5432").strip()
    db_username = os.getenv("DB_USERNAME", "").strip()
    db_password = os.getenv("DB_PASSWORD", "").strip()
    db_database = os.getenv("DB_DATABASE", "").strip()
    
    if db_host and db_username and db_password and db_database:
        # Build PostgreSQL connection string
        # URL-encode username và password để tránh lỗi với ký tự đặc biệt (@, #, %, /, ...)
        encoded_username = quote_plus(db_username)
        encoded_password = quote_plus(db_password)
        return f"postgresql://{encoded_username}:{encoded_password}@{db_host}:{db_port}/{db_database}"
    
    # Ưu tiên 2: DB_URL trực tiếp (backward compatible, chỉ dùng nếu không có format mới)
    db_url = os.getenv("DB_URL", "").strip()
    if db_url:
        return db_url
    
    # Không có config nào
    return None


DB_URL = _build_db_url()

metadata = MetaData()
engine: Optional[Engine] = None


orders_table = Table(
    "orders",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("exchange", String(16), nullable=False),
    Column("symbol_base", String(32), nullable=False),
    Column("symbol_pair", String(64)),
    Column("side", String(8), nullable=False),
    Column("order_type", String(8), nullable=False),
    Column("size_usd", Float, nullable=False),
    Column("leverage", Float, nullable=False),
    Column("limit_price", Float),
    Column("tp_price", Float),
    Column("sl_price", Float),
    Column("max_slippage_percent", Float),
    Column("client_order_id", String(128)),
    Column("tag", String(128)),
    Column("status", String(32), nullable=False, default="pending"),
    Column("exchange_order_id", String(128)),
    Column("entry_price_requested", Float),
    Column("entry_price_filled", Float),
    Column("position_size_asset", Float),
    Column("exchange_raw_response", Text),
    Column("created_at", DateTime, default=dt.datetime.utcnow, nullable=False),
    Column(
        "updated_at",
        DateTime,
        default=dt.datetime.utcnow,
        onupdate=dt.datetime.utcnow,
        nullable=False,
    ),
)


def _init_engine() -> Optional[Engine]:
    """Khởi tạo engine nếu có DB_URL, nếu không thì trả None (no-op mode)."""
    global engine
    if engine is not None:
        return engine

    if not DB_URL:
        print(
            "[DB] Database không được cấu hình (cần DB_URL hoặc DB_HOST+DB_USERNAME+DB_PASSWORD+DB_DATABASE). "
            "Orders sẽ KHÔNG được lưu vào DB."
        )
        return None

    try:
        # Mask password trong log để tránh lộ
        masked_url = DB_URL
        if "@" in DB_URL and ":" in DB_URL.split("@")[0]:
            # postgresql://user:pass@host -> postgresql://user:***@host
            parts = DB_URL.split("@")
            if len(parts) == 2:
                user_pass = parts[0].split("://")[1] if "://" in parts[0] else parts[0]
                if ":" in user_pass:
                    user = user_pass.split(":")[0]
                    protocol = parts[0].split("://")[0] + "://" if "://" in parts[0] else ""
                    masked_url = f"{protocol}{user}:***@{parts[1]}"
        
        engine = create_engine(DB_URL, future=True)
        metadata.create_all(engine)
        # Schema đã được tạo, không cần log chi tiết (startup event sẽ log status)
    except SQLAlchemyError as e:
        print(f"[DB] Lỗi khi khởi tạo engine / tạo bảng: {e}")
        engine = None

    return engine


def log_order_request(
    exchange: str,
    symbol_base: str,
    symbol_pair: Optional[str],
    side: str,
    order_type: str,
    size_usd: float,
    leverage: float,
    limit_price: Optional[float],
    tp_price: Optional[float],
    sl_price: Optional[float],
    max_slippage_percent: Optional[float],
    client_order_id: Optional[str],
    tag: Optional[str],
    raw_request: Optional[Dict[str, Any]] = None,
) -> Optional[int]:
    """
    Tạo bản ghi order ở trạng thái 'pending' ngay khi nhận request.
    Trả về order_id trong DB (hoặc None nếu DB tắt / lỗi).
    """
    eng = _init_engine()
    if eng is None:
        return None

    try:
        with eng.begin() as conn:
            result = conn.execute(
                orders_table.insert().values(
                    exchange=exchange,
                    symbol_base=symbol_base,
                    symbol_pair=symbol_pair,
                    side=side,
                    order_type=order_type,
                    size_usd=size_usd,
                    leverage=leverage,
                    limit_price=limit_price,
                    tp_price=tp_price,
                    sl_price=sl_price,
                    max_slippage_percent=max_slippage_percent,
                    client_order_id=client_order_id,
                    tag=tag,
                    status="pending",
                    exchange_raw_response=json.dumps(
                        {"request": raw_request}, default=str
                    )
                    if raw_request is not None
                    else None,
                    created_at=dt.datetime.utcnow(),
                    updated_at=dt.datetime.utcnow(),
                )
            )
            order_id = result.inserted_primary_key[0]
            return int(order_id) if order_id is not None else None
    except SQLAlchemyError as e:
        print(f"[DB] Lỗi khi log order request: {e}")
        return None


def update_order_after_result(
    db_order_id: Optional[int],
    status: str,
    exchange_order_id: Optional[str],
    entry_price_requested: Optional[float],
    entry_price_filled: Optional[float],
    position_size_asset: Optional[float],
    raw_response: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Cập nhật lại bản ghi sau khi gọi sàn (thành công hoặc thất bại).
    Nếu db_order_id là None (DB tắt), hàm sẽ no-op.
    """
    if db_order_id is None:
        return

    eng = _init_engine()
    if eng is None:
        return

    try:
        with eng.begin() as conn:
            conn.execute(
                orders_table.update()
                .where(orders_table.c.id == db_order_id)
                .values(
                    status=status,
                    exchange_order_id=exchange_order_id,
                    entry_price_requested=entry_price_requested,
                    entry_price_filled=entry_price_filled,
                    position_size_asset=position_size_asset,
                    exchange_raw_response=json.dumps(raw_response, default=str)
                    if raw_response is not None
                    else None,
                    updated_at=dt.datetime.utcnow(),
                )
            )
    except SQLAlchemyError as e:
        print(f"[DB] Lỗi khi update order result: {e}")


def test_db_connection() -> dict:
    """
    Test kết nối database khi server startup.
    Trả về dict với status và message.
    """
    if not DB_URL:
        return {
            "status": "not_configured",
            "message": "Database không được cấu hình (cần DB_URL hoặc DB_HOST+DB_USERNAME+DB_PASSWORD+DB_DATABASE)",
            "connected": False,
        }
    
    eng = _init_engine()
    if eng is None:
        return {
            "status": "failed",
            "message": "Không thể khởi tạo database engine",
            "connected": False,
        }
    
    try:
        # Test connection bằng cách execute một query đơn giản
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        # Mask password trong URL để log
        masked_url = DB_URL
        if "@" in DB_URL and ":" in DB_URL.split("@")[0]:
            parts = DB_URL.split("@")
            if len(parts) == 2:
                user_pass = parts[0].split("://")[1] if "://" in parts[0] else parts[0]
                if ":" in user_pass:
                    user = user_pass.split(":")[0]
                    protocol = parts[0].split("://")[0] + "://" if "://" in parts[0] else ""
                    masked_url = f"{protocol}{user}:***@{parts[1]}"
        
        return {
            "status": "connected",
            "message": f"Kết nối database thành công (masked: {masked_url})",
            "connected": True,
        }
    except SQLAlchemyError as e:
        return {
            "status": "failed",
            "message": f"Lỗi khi test kết nối database: {e}",
            "connected": False,
        }
    except Exception as e:
        return {
            "status": "failed",
            "message": f"Lỗi không mong đợi: {e}",
            "connected": False,
        }



