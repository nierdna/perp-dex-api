#!/usr/bin/env python3
"""
Trading API Server - For 3rd party integration

Endpoints:
- POST /api/order - Unified order endpoint (Long/Short, Market/Limit, TP/SL)
- GET /api/orders/positions - Get active positions
- GET /api/orders/open - Get open orders (pending)
- GET /api/orders/history - Get order history

Run: python api_server.py
Or: uvicorn api_server:app --host 0.0.0.0 --port 8080 --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import json
import urllib.request

# Load environment
load_dotenv()

# Optional DB layer for logging orders
try:
    from db import test_db_connection
except Exception as _db_import_err:
    print(f"[DB] Warning: không thể import db module: {_db_import_err}")
    test_db_connection = None  # type: ignore

# Import routes from api module
from api.routes import router


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




# Include routes from api module
app.include_router(router)

# =============== UI ROUTE ===============

# Import UI template
from api.ui import HTML_TEMPLATE


@app.get("/", response_class=HTMLResponse)
async def root():
    """Simple HTML UI để đặt lệnh qua /api/order"""
    return HTML_TEMPLATE


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
    
    # Tắt reload để tránh lỗi ModuleNotFoundError với multiprocessing spawn
    # Nếu cần reload, dùng: uvicorn api_server:app --reload
    uvicorn.run(
        app,  # Pass app object trực tiếp (không dùng import string)
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=False  # Tắt reload để tránh lỗi import
    )

