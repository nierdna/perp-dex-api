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
        max-width: 1400px;
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 24px;
      }
      @media (max-width: 1200px) {
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
      .tabs {
        display: flex;
        gap: 8px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 16px;
      }
      .tab {
        padding: 8px 16px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
        transition: color 0.15s, border-color 0.15s;
      }
      .tab:hover {
        color: var(--text);
      }
      .tab.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
      .orders-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 500px;
        overflow-y: auto;
      }
      .order-item {
        background: var(--input-bg);
        border-radius: 10px;
        border: 1px solid var(--border);
        padding: 12px;
        font-size: 12px;
      }
      .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .order-exchange {
        font-weight: 600;
        text-transform: uppercase;
        color: var(--accent);
      }
      .order-side {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }
      .order-side.long {
        background: rgba(34, 197, 94, 0.2);
        color: var(--success);
      }
      .order-side.short {
        background: rgba(239, 68, 68, 0.2);
        color: var(--danger);
      }
      .order-details {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
        font-size: 11px;
        color: var(--muted);
      }
      .order-detail-item {
        display: flex;
        justify-content: space-between;
      }
      .pnl {
        font-weight: 600;
        font-size: 13px;
      }
      .pnl.positive {
        color: var(--success);
      }
      .pnl.negative {
        color: var(--danger);
      }
      .refresh-btn {
        padding: 4px 8px;
        font-size: 11px;
      }
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--muted);
        font-size: 13px;
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

        <!-- THIRD: ORDERS LIST -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="title">Orders</div>
              <div class="muted">
                Danh sách lệnh đang active và pending.
              </div>
            </div>
            <button id="refresh-orders-btn" class="btn btn-secondary btn-sm refresh-btn">
              🔄 Refresh
            </button>
          </div>

          <div class="tabs">
            <button class="tab active" data-tab="positions">Vị thế</button>
            <button class="tab" data-tab="open">Lệnh mở</button>
            <button class="tab" data-tab="history">Lịch sử</button>
          </div>

          <div id="tab-positions" class="tab-content active">
            <div id="positions-list" class="orders-list">
              <div class="empty-state">Đang tải...</div>
            </div>
          </div>

          <div id="tab-open" class="tab-content">
            <div id="open-orders-list" class="orders-list">
              <div class="empty-state">Đang tải...</div>
            </div>
          </div>

          <div id="tab-history" class="tab-content">
            <div id="history-list" class="orders-list">
              <div class="empty-state">Đang tải...</div>
            </div>
          </div>
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
            // Auto refresh orders after successful order
            setTimeout(() => {
              loadPositions();
              loadOpenOrders();
              loadHistory();
            }, 1000);
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

      // =============== ORDERS MANAGEMENT ===============
      const tabs = document.querySelectorAll(".tab");
      const tabContents = document.querySelectorAll(".tab-content");
      const refreshBtn = document.getElementById("refresh-orders-btn");
      const positionsList = document.getElementById("positions-list");
      const openOrdersList = document.getElementById("open-orders-list");
      const historyList = document.getElementById("history-list");

      // Tab switching
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const targetTab = tab.dataset.tab;
          tabs.forEach((t) => t.classList.remove("active"));
          tabContents.forEach((tc) => tc.classList.remove("active"));
          tab.classList.add("active");
          document.getElementById(`tab-${targetTab}`).classList.add("active");
          if (targetTab === "positions") {
            loadPositions();
          } else if (targetTab === "open") {
            loadOpenOrders();
          } else if (targetTab === "history") {
            loadHistory();
          }
        });
      });

      // Format number
      function formatNumber(num, decimals = 2) {
        if (num === null || num === undefined) return "-";
        return Number(num).toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      }

      // Format PnL
      function formatPnL(pnlUsd, pnlPercent) {
        const sign = pnlUsd >= 0 ? "+" : "";
        const colorClass = pnlUsd >= 0 ? "positive" : "negative";
        return `<span class="pnl ${colorClass}">${sign}${formatNumber(pnlUsd)} USD (${sign}${formatNumber(pnlPercent)}%)</span>`;
      }

      // Render position (vị thế)
      function renderPosition(order) {
        const pnlHtml = formatPnL(order.pnl_usd, order.pnl_percent);
        return `
          <div class="order-item">
            <div class="order-header">
              <div>
                <span class="order-exchange">${order.exchange.toUpperCase()}</span>
                <span class="order-side ${order.side}">${order.side.toUpperCase()}</span>
              </div>
              ${pnlHtml}
            </div>
            <div class="order-details">
              <div class="order-detail-item">
                <span>Symbol:</span>
                <span><strong>${order.symbol_base}</strong></span>
              </div>
              <div class="order-detail-item">
                <span>Type:</span>
                <span>${order.order_type.toUpperCase()}</span>
              </div>
              <div class="order-detail-item">
                <span>Size:</span>
                <span>$${formatNumber(order.size_usd)}</span>
              </div>
              <div class="order-detail-item">
                <span>Leverage:</span>
                <span>${order.leverage}x</span>
              </div>
              <div class="order-detail-item">
                <span>Entry:</span>
                <span>$${formatNumber(order.entry_price)}</span>
              </div>
              <div class="order-detail-item">
                <span>Current:</span>
                <span>$${formatNumber(order.current_price)}</span>
              </div>
              <div class="order-detail-item">
                <span>Position:</span>
                <span>${formatNumber(order.position_size, 6)}</span>
              </div>
              <div class="order-detail-item">
                <span>Order ID:</span>
                <span style="font-size: 10px;">${order.exchange_order_id || "-"}</span>
              </div>
            </div>
          </div>
        `;
      }

      // Render open order (lệnh mở)
      function renderOpenOrder(order) {
        return `
          <div class="order-item">
            <div class="order-header">
              <div>
                <span class="order-exchange">${order.exchange.toUpperCase()}</span>
                <span class="order-side ${order.side}">${order.side.toUpperCase()}</span>
              </div>
              <span style="font-size: 11px; color: var(--muted);">Waiting...</span>
            </div>
            <div class="order-details">
              <div class="order-detail-item">
                <span>Symbol:</span>
                <span><strong>${order.symbol_base}</strong></span>
              </div>
              <div class="order-detail-item">
                <span>Type:</span>
                <span>${order.order_type.toUpperCase()}</span>
              </div>
              <div class="order-detail-item">
                <span>Limit Price:</span>
                <span>$${formatNumber(order.limit_price)}</span>
              </div>
              <div class="order-detail-item">
                <span>Size:</span>
                <span>$${formatNumber(order.size_usd)}</span>
              </div>
              <div class="order-detail-item">
                <span>Leverage:</span>
                <span>${order.leverage}x</span>
              </div>
              ${order.tp_price ? `
              <div class="order-detail-item">
                <span>TP:</span>
                <span style="color: var(--success);">$${formatNumber(order.tp_price)}</span>
              </div>
              ` : ""}
              ${order.sl_price ? `
              <div class="order-detail-item">
                <span>SL:</span>
                <span style="color: var(--danger);">$${formatNumber(order.sl_price)}</span>
              </div>
              ` : ""}
            </div>
          </div>
        `;
      }

      // Render history order
      function renderHistoryOrder(order) {
        const statusColor = order.status === "submitted" ? "var(--success)" : 
                           order.status === "rejected" ? "var(--danger)" : "var(--muted)";
        return `
          <div class="order-item">
            <div class="order-header">
              <div>
                <span class="order-exchange">${order.exchange.toUpperCase()}</span>
                <span class="order-side ${order.side}">${order.side.toUpperCase()}</span>
                <span style="font-size: 11px; color: ${statusColor}; margin-left: 8px;">${order.status.toUpperCase()}</span>
              </div>
              <span style="font-size: 11px; color: var(--muted);">${new Date(order.created_at).toLocaleString("vi-VN")}</span>
            </div>
            <div class="order-details">
              <div class="order-detail-item">
                <span>Symbol:</span>
                <span><strong>${order.symbol_base}</strong></span>
              </div>
              <div class="order-detail-item">
                <span>Type:</span>
                <span>${order.order_type.toUpperCase()}</span>
              </div>
              <div class="order-detail-item">
                <span>Size:</span>
                <span>$${formatNumber(order.size_usd)}</span>
              </div>
              <div class="order-detail-item">
                <span>Leverage:</span>
                <span>${order.leverage}x</span>
              </div>
              ${order.limit_price ? `
              <div class="order-detail-item">
                <span>Limit:</span>
                <span>$${formatNumber(order.limit_price)}</span>
              </div>
              ` : ""}
              ${order.entry_price_filled ? `
              <div class="order-detail-item">
                <span>Entry:</span>
                <span>$${formatNumber(order.entry_price_filled)}</span>
              </div>
              ` : ""}
              ${order.position_size_asset ? `
              <div class="order-detail-item">
                <span>Position:</span>
                <span>${formatNumber(order.position_size_asset, 6)}</span>
              </div>
              ` : ""}
              ${order.exchange_order_id ? `
              <div class="order-detail-item">
                <span>Order ID:</span>
                <span style="font-size: 10px;">${order.exchange_order_id}</span>
              </div>
              ` : ""}
            </div>
          </div>
        `;
      }

      // Load positions (vị thế)
      async function loadPositions() {
        try {
          positionsList.innerHTML = '<div class="empty-state">Đang tải...</div>';
          const res = await fetch("/api/orders/positions");
          const data = await res.json();
          
          if (data.positions && data.positions.length > 0) {
            positionsList.innerHTML = data.positions.map(renderPosition).join("");
          } else {
            positionsList.innerHTML = '<div class="empty-state">Không có vị thế nào đang mở.</div>';
          }
        } catch (err) {
          positionsList.innerHTML = `<div class="empty-state" style="color: var(--danger);">Lỗi: ${err.message}</div>`;
        }
      }

      // Load open orders (lệnh mở)
      async function loadOpenOrders() {
        try {
          openOrdersList.innerHTML = '<div class="empty-state">Đang tải...</div>';
          const res = await fetch("/api/orders/open");
          const data = await res.json();
          
          if (data.open_orders && data.open_orders.length > 0) {
            openOrdersList.innerHTML = data.open_orders.map(renderOpenOrder).join("");
          } else {
            openOrdersList.innerHTML = '<div class="empty-state">Không có lệnh mở nào.</div>';
          }
        } catch (err) {
          openOrdersList.innerHTML = `<div class="empty-state" style="color: var(--danger);">Lỗi: ${err.message}</div>`;
        }
      }

      // Load history (lịch sử)
      async function loadHistory() {
        try {
          historyList.innerHTML = '<div class="empty-state">Đang tải...</div>';
          const res = await fetch("/api/orders/history?limit=50");
          const data = await res.json();
          
          if (data.history && data.history.length > 0) {
            historyList.innerHTML = data.history.map(renderHistoryOrder).join("");
          } else {
            historyList.innerHTML = '<div class="empty-state">Không có lịch sử nào.</div>';
          }
        } catch (err) {
          historyList.innerHTML = `<div class="empty-state" style="color: var(--danger);">Lỗi: ${err.message}</div>`;
        }
      }

      // Refresh button
      refreshBtn.addEventListener("click", () => {
        const activeTab = document.querySelector(".tab.active");
        const tabName = activeTab.dataset.tab;
        if (tabName === "positions") {
          loadPositions();
        } else if (tabName === "open") {
          loadOpenOrders();
        } else if (tabName === "history") {
          loadHistory();
        }
      });


      // Load initial data
      loadPositions();
      loadOpenOrders();
      loadHistory();

      // Auto refresh every 10 seconds
      setInterval(() => {
        const activeTab = document.querySelector(".tab.active");
        const tabName = activeTab.dataset.tab;
        if (tabName === "positions") {
          loadPositions();
        } else if (tabName === "open") {
          loadOpenOrders();
        } else if (tabName === "history") {
          loadHistory();
        }
      }, 10000);
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


@app.get("/api/orders/positions")
async def get_positions(
    exchange: Optional[str] = None,
):
    """
    Lấy danh sách các vị thế đang mở (có position thực tế trên sàn) kèm PnL.
    
    TODO: Logic đang được thảo luận, tạm thời trả về mảng rỗng.
    """
    return {
        "positions": [],
        "total": 0
    }


@app.get("/api/orders/open")
async def get_open_orders(
    exchange: Optional[str] = None,
):
    """
    Lấy danh sách các lệnh mở đang chờ khớp (LIMIT, TP/SL orders).
    
    TODO: Logic đang được thảo luận, tạm thời trả về mảng rỗng.
    """
    return {
        "open_orders": [],
        "total": 0
    }


@app.get("/api/orders/history")
async def get_order_history(
    exchange: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
):
    """
    Lấy lịch sử tất cả các orders đã lưu trong database.
    
    Query params:
    - exchange: 'lighter' hoặc 'aster' (optional)
    - status: 'submitted', 'rejected', 'error', 'pending' (optional)
    - limit: số lượng orders tối đa (default: 100)
    
    Returns:
    {
        "history": [
            {
                "id": int,
                "exchange": str,
                "symbol_base": str,
                "side": str,
                "order_type": str,
                "size_usd": float,
                "leverage": float,
                "limit_price": float,
                "tp_price": float,
                "sl_price": float,
                "status": str,
                "exchange_order_id": str,
                "entry_price_filled": float,
                "position_size_asset": float,
                "created_at": str,
                "updated_at": str
            }
        ],
        "total": int
    }
    """
    if query_orders is None:
        raise HTTPException(
            status_code=503,
            detail="Database module không available, không thể query orders"
        )
    
    try:
        all_orders = query_orders(
            exchange=exchange,
            status=status,
            limit=limit
        )
        
        history = [
            {
                "id": o["id"],
                "exchange": o["exchange"],
                "symbol_base": o["symbol_base"],
                "side": o["side"],
                "order_type": o["order_type"],
                "size_usd": o["size_usd"],
                "leverage": o["leverage"],
                "limit_price": o.get("limit_price"),
                "tp_price": o.get("tp_price"),
                "sl_price": o.get("sl_price"),
                "status": o["status"],
                "exchange_order_id": o.get("exchange_order_id"),
                "entry_price_filled": o.get("entry_price_filled"),
                "position_size_asset": o.get("position_size_asset"),
                "created_at": o.get("created_at"),
                "updated_at": o.get("updated_at"),
            }
            for o in all_orders
        ]
        
        return {
            "history": history,
            "total": len(history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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

