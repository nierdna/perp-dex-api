"""
HTML UI template for Trading API
"""

HTML_TEMPLATE = """<!DOCTYPE html>
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
                  <option value="hyperliquid">hyperliquid</option>
                </select>
                <div class="muted">
                  Chọn sàn giao dịch (lighter / aster / hyperliquid).
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

                    <!-- SECOND: BALANCE -->
                    <div class="card">
                      <div class="card-header">
                        <div>
                          <div class="title">💰 Số dư tài khoản</div>
                          <div class="muted">
                            Tổng số dư từ các sàn giao dịch.
                          </div>
                        </div>
                        <button id="refresh-balance-btn" class="btn btn-secondary btn-sm refresh-btn">
                          🔄 Refresh
                        </button>
                      </div>

                      <!-- Exchange Filter for Balance -->
                      <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                        <label style="font-size: 12px; color: var(--muted);">Lọc theo sàn:</label>
                        <select id="balance-exchange-filter" style="flex: 1; max-width: 200px;">
                          <option value="">Tất cả</option>
                          <option value="lighter">Lighter</option>
                          <option value="aster">Aster</option>
                        </select>
                      </div>

                      <div id="balance-info" style="display: none;">
                        <div id="balance-list" class="orders-list"></div>
                        <div style="margin-top: 16px; padding: 12px; background: var(--input-bg); border-radius: 8px; border: 1px solid var(--border);">
                          <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; color: var(--text);">Tổng số dư:</span>
                            <span id="total-balance" style="font-size: 1.2rem; font-weight: 700; color: var(--accent);">$0.00</span>
                          </div>
                          <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--muted);">Tổng khả dụng:</span>
                            <span id="total-available" style="font-size: 1rem; font-weight: 600; color: var(--success);">$0.00</span>
                          </div>
                        </div>
                      </div>
                      <div id="balance-loading" class="empty-state">Đang tải...</div>
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

          <!-- Exchange Filter -->
          <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
            <label style="font-size: 12px; color: var(--muted);">Lọc theo sàn:</label>
            <select id="exchange-filter" style="flex: 1; max-width: 200px;">
              <option value="">Tất cả</option>
              <option value="lighter">Lighter</option>
              <option value="aster">Aster</option>
              <option value="hyperliquid">Hyperliquid</option>
            </select>
          </div>

          <div class="tabs">
            <button class="tab active" data-tab="positions">Vị thế</button>
            <button class="tab" data-tab="open">Lệnh mở</button>
            <button class="tab" data-tab="history">Lịch sử</button>
          </div>

          <div id="tab-positions" class="tab-content active">
            <div style="margin-bottom: 16px; padding: 12px; background: var(--panel); border-radius: 8px; border: 1px solid var(--border);">
              <button 
                class="btn btn-danger" 
                onclick="closeAllPositions()"
                style="width: 100%; padding: 10px; font-size: 14px; font-weight: 600;"
              >
                🔒 Đóng tất cả vị thế (100%)
              </button>
              <div style="margin-top: 8px; font-size: 11px; color: var(--muted); text-align: center;">
                Đóng tất cả positions đang hiển thị
              </div>
            </div>
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
      const exchangeFilter = document.getElementById("exchange-filter");
      const positionsList = document.getElementById("positions-list");
      const openOrdersList = document.getElementById("open-orders-list");
      const historyList = document.getElementById("history-list");

      // Get current exchange filter
      function getExchangeFilter() {
        const value = exchangeFilter.value;
        return value === "" ? null : value;
      }

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
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
              <button 
                class="btn btn-danger close-position-btn"
                data-exchange="${order.exchange}"
                data-symbol="${order.symbol_base}"
                data-position-id="${order.position_id || ''}"
                data-entry-price="${order.entry_price || 0}"
                data-side="${order.side || ''}"
                style="width: 100%; padding: 8px; font-size: 13px;"
              >
                🔒 Đóng lệnh (100%)
              </button>
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
          const exchange = getExchangeFilter();
          const url = exchange 
            ? `/api/orders/positions?exchange=${encodeURIComponent(exchange)}`
            : "/api/orders/positions";
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.positions && data.positions.length > 0) {
            positionsList.innerHTML = data.positions.map(renderPosition).join("");
            // Attach event listeners to close buttons
            positionsList.querySelectorAll('.close-position-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const exchange = this.getAttribute('data-exchange');
                const symbol = this.getAttribute('data-symbol');
                const positionId = this.getAttribute('data-position-id') || null;
                const entryPrice = parseFloat(this.getAttribute('data-entry-price')) || null;
                const side = this.getAttribute('data-side') || null;
                window.closePosition(exchange, symbol, 100, positionId, entryPrice, side);
              });
            });
          } else {
            positionsList.innerHTML = '<div class="empty-state">Không có vị thế nào đang mở.</div>';
          }
        } catch (err) {
          positionsList.innerHTML = `<div class="empty-state" style="color: var(--danger);">Lỗi: ${err.message}</div>`;
        }
      }

      // =============== BALANCE MANAGEMENT ===============
      const refreshBalanceBtn = document.getElementById("refresh-balance-btn");
      const balanceExchangeFilter = document.getElementById("balance-exchange-filter");
      const balanceInfo = document.getElementById("balance-info");
      const balanceList = document.getElementById("balance-list");
      const balanceLoading = document.getElementById("balance-loading");
      const totalBalanceEl = document.getElementById("total-balance");
      const totalAvailableEl = document.getElementById("total-available");

      // Get current balance exchange filter
      function getBalanceExchangeFilter() {
        if (!balanceExchangeFilter) return null;
        const value = balanceExchangeFilter.value;
        return value === "" ? null : value;
      }

      // Render balance item
      function renderBalance(balance) {
        const isSuccess = balance.success;
        const exchangeName = balance.exchange.toUpperCase();
        
        if (!isSuccess) {
          return `
            <div class="order-item" style="border-color: var(--danger);">
              <div class="order-header">
                <div>
                  <span class="order-exchange">${exchangeName}</span>
                </div>
                <span style="color: var(--danger); font-size: 11px;">❌ Lỗi</span>
              </div>
              <div class="order-details">
                <div class="order-detail-item">
                  <span>Lỗi:</span>
                  <span style="color: var(--danger);">${balance.error || 'Unknown error'}</span>
                </div>
              </div>
            </div>
          `;
        }

        // Lighter có collateral, Aster không có
        const hasCollateral = balance.collateral !== undefined;
        
        return `
          <div class="order-item">
            <div class="order-header">
              <div>
                <span class="order-exchange">${exchangeName}</span>
              </div>
              <span style="color: var(--success); font-size: 11px;">✅ Online</span>
            </div>
            <div class="order-details">
              <div class="order-detail-item">
                <span>Khả dụng:</span>
                <span style="color: var(--success); font-weight: 600;">$${formatNumber(balance.available)}</span>
              </div>
              ${hasCollateral ? `
              <div class="order-detail-item">
                <span>Collateral:</span>
                <span>$${formatNumber(balance.collateral)}</span>
              </div>
              ` : ''}
              <div class="order-detail-item">
                <span>Tổng:</span>
                <span style="font-weight: 600;">$${formatNumber(balance.total)}</span>
              </div>
            </div>
          </div>
        `;
      }

      // Load balance
      async function loadBalance() {
        if (!balanceLoading || !balanceInfo || !balanceList || !totalBalanceEl || !totalAvailableEl) {
          console.warn("Balance elements not found, skipping loadBalance");
          return;
        }
        
        try {
          balanceLoading.style.display = 'block';
          balanceInfo.style.display = 'none';
          
          const exchange = getBalanceExchangeFilter();
          const url = exchange
            ? `/api/balance?exchange=${encodeURIComponent(exchange)}`
            : "/api/balance";
          
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.balances && data.balances.length > 0) {
            balanceList.innerHTML = data.balances.map(renderBalance).join("");
            totalBalanceEl.textContent = '$' + formatNumber(data.total_balance);
            totalAvailableEl.textContent = '$' + formatNumber(data.total_available);
            balanceLoading.style.display = 'none';
            balanceInfo.style.display = 'block';
          } else {
            balanceLoading.innerHTML = '<div class="empty-state">Không có dữ liệu số dư.</div>';
            balanceInfo.style.display = 'none';
          }
        } catch (err) {
          balanceLoading.innerHTML = `<div class="empty-state" style="color: var(--danger);">Lỗi: ${err.message}</div>`;
          balanceInfo.style.display = 'none';
        }
      }

      // Balance exchange filter change handler
      if (balanceExchangeFilter) {
        balanceExchangeFilter.addEventListener("change", () => {
          loadBalance();
        });
      }

      // Refresh balance button
      if (refreshBalanceBtn) {
        refreshBalanceBtn.addEventListener("click", () => {
          loadBalance();
        });
      }

      // Load open orders (lệnh mở)
      async function loadOpenOrders() {
        try {
          openOrdersList.innerHTML = '<div class="empty-state">Đang tải...</div>';
          const exchange = getExchangeFilter();
          const url = exchange 
            ? `/api/orders/open?exchange=${encodeURIComponent(exchange)}`
            : "/api/orders/open";
          const res = await fetch(url);
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
          const exchange = getExchangeFilter();
          const url = exchange 
            ? `/api/orders/history?limit=50&exchange=${encodeURIComponent(exchange)}`
            : "/api/orders/history?limit=50";
          const res = await fetch(url);
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

      // Exchange filter change handler
      exchangeFilter.addEventListener("change", () => {
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
      loadBalance();
      loadPositions();
      loadOpenOrders();
      loadHistory();

      // Auto refresh every 10 seconds
      setInterval(() => {
        loadBalance(); // Refresh balance
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

      // Close position function (đóng 1 position cụ thể)
      // Make it global so onclick can access it
      window.closePosition = async function(exchange, symbol, percentage, positionId = null, entryPrice = null, side = null) {
        if (!confirm(`Bạn có chắc muốn đóng ${percentage}% position ${symbol} trên ${exchange.toUpperCase()}?`)) {
          return;
        }

        try {
          const body = {
            exchange: exchange,
            symbol: symbol,
            percentage: percentage,
          };
          
          // Thêm các field để đóng position cụ thể nếu có
          if (positionId) body.position_id = positionId;
          if (entryPrice && entryPrice > 0) body.entry_price = entryPrice;
          if (side) body.side = side;

          const response = await fetch("/api/positions/close", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            alert(`✅ Đóng lệnh thành công!\nOrder ID: ${data.order_id}\nPnL: ${data.pnl_percent ? data.pnl_percent.toFixed(2) + "%" : "N/A"}`);
            // Reload positions
            loadPositions();
          } else {
            alert(`❌ Lỗi: ${data.detail || data.error || "Unknown error"}`);
          }
        } catch (err) {
          alert(`❌ Lỗi: ${err.message}`);
        }
      }

      // Close all positions function (đóng tất cả positions đang hiển thị)
      // Make it global so onclick can access it
      window.closeAllPositions = async function() {
        const exchange = getExchangeFilter();
        
        // Lấy danh sách positions hiện tại
        let positions = [];
        try {
          const url = exchange
            ? `/api/orders/positions?exchange=${encodeURIComponent(exchange)}`
            : "/api/orders/positions";
          const response = await fetch(url);
          const data = await response.json();
          positions = data.positions || [];
        } catch (err) {
          alert(`❌ Lỗi khi lấy danh sách positions: ${err.message}`);
          return;
        }

        if (positions.length === 0) {
          alert("⚠️ Không có position nào để đóng");
          return;
        }

        const count = positions.length;
        const exchangeText = exchange ? exchange.toUpperCase() : "TẤT CẢ SÀN";
        if (!confirm(`Bạn có chắc muốn đóng ${count} position(s) trên ${exchangeText}?\n\nĐiều này sẽ đóng 100% tất cả positions đang hiển thị.`)) {
          return;
        }

        // Đóng từng position
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const pos of positions) {
          try {
            const body = {
              exchange: pos.exchange,
              symbol: pos.symbol_base,
              percentage: 100,
            };
            
            // Thêm các field để đóng position cụ thể
            if (pos.position_id) body.position_id = pos.position_id;
            if (pos.entry_price && pos.entry_price > 0) body.entry_price = pos.entry_price;
            if (pos.side) body.side = pos.side;

            const response = await fetch("/api/positions/close", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            const data = await response.json();

            if (response.ok && data.success) {
              successCount++;
            } else {
              failCount++;
              errors.push(`${pos.symbol_base} (${pos.exchange}): ${data.detail || data.error || "Unknown error"}`);
            }
          } catch (err) {
            failCount++;
            errors.push(`${pos.symbol_base} (${pos.exchange}): ${err.message}`);
          }
        }

        // Hiển thị kết quả
        let message = '✅ Đã đóng ' + successCount + '/' + count + ' position(s)';
        if (failCount > 0) {
          message += String.fromCharCode(10) + '❌ Thất bại: ' + failCount + ' position(s)';
          if (errors.length > 0) {
            const errorList = errors.slice(0, 5).join(String.fromCharCode(10));
            message += String.fromCharCode(10) + String.fromCharCode(10) + 'Chi tiết lỗi:' + String.fromCharCode(10) + errorList;
            if (errors.length > 5) {
              message += String.fromCharCode(10) + '... và ' + (errors.length - 5) + ' lỗi khác';
            }
          }
        }
        
        alert(message);
        
        // Reload positions
        // Reload positions
        loadPositions();
      }

      // Check config status on load
      async function checkConfigStatus() {
        try {
          const response = await fetch("/api/config-status");
          const status = await response.json();
          
          console.log("Exchange config status:", status);
          
          // Các ID của select box cần filter
          const selectIds = ["exchange", "filter-exchange", "filter-exchange-orders", "filter-exchange-balance"];
          
          selectIds.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            
            Array.from(select.options).forEach(option => {
               const value = option.value; // lighter, aster, hyperliquid
               // Chỉ check nếu value là key trong status
               if (value && status.hasOwnProperty(value) && status[value] === false) {
                   // Không xóa option khỏi DOM để giữ index, chỉ ẩn
                   // Nhưng Safari/Mobile có thể không support display:none option.
                   // Tốt nhất là remove hoặc disable.
                   option.disabled = true;
                   option.textContent += " (Not Configured)";
                   // move to end/hidden logic if needed, but disabled is good enough.
                   
                   // Nếu đang chọn option bị disable -> đổi sang cái khác
                   if (select.value === value) {
                       // Tìm option nào chưa bị disable
                        const available = Array.from(select.options).find(o => {
                            const val = o.value;
                            // Check if configured (or is empty/all)
                            return (!val || (status[val] !== false));
                        });
                        if (available) select.value = available.value;
                   }
               }
            });
          });
          
        } catch (err) {
          console.error("Failed to check config status:", err);
        }
      }
      
      // Call config check on load
      // document.addEventListener("DOMContentLoaded", checkConfigStatus); 
      // Nhưng script ở cuối body nên chạy luôn cũng được
      checkConfigStatus();
    </script>
  </body>
</html>
"""
