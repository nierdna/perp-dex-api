
const API_URL = 'http://localhost:3000/api';

// --- State ---
let strategies = [];
let positions = [];
let currentStrategyId = null;
let currentStrategyData = null; // Store current strategy data
let currentPage = 1;
let currentLimit = 10;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setInterval(() => {
        // Only refresh if global data exists (simple polling)
        // If user is editing form, maybe don't refresh entire view? 
        // For now: Just refresh.
        if (!document.getElementById('updateModal').style.display || document.getElementById('updateModal').style.display === 'none') {
            fetchData();
        }
    }, 2000);
});

// --- Core Functions ---

async function fetchData() {
    try {
        const stratRes = await fetch(`${API_URL}/strategies`);
        if (stratRes.ok) {
            strategies = await stratRes.json();
        }

        const posRes = await fetch(`${API_URL}/positions`);
        if (posRes.ok) {
            positions = await posRes.json();
        }

        render();
    } catch (e) {
        console.error("Connection Error", e);
    }
}

function render() {
    renderStrategies();
    updateForms();

    // If we are in detail mode, refresh detail data
    if (currentStrategyId) {
        fetchStrategyDetail(currentStrategyId);
    }
}



function renderStrategies() {
    const grid = document.getElementById('strategy-grid');
    grid.innerHTML = strategies.map(s => `
        <div class="strategy-card" onclick="showDetail('${s.id}')" style="cursor:pointer">
            <h3>${s.id} <span class="status-badge">RUNNING</span></h3>
            <div class="strategy-info">
                <label>Balance</label>
                <span>${formatCurrency(s.current_balance)}</span>
            </div>
            <div class="strategy-info">
                <label>PnL / ROI</label>
                <span class="${parseFloat(s.pnl) >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(s.pnl)} (${s.roi}%)
                </span>
            </div>
            <div class="strategy-info">
                <label>Initial</label>
                <span>${formatCurrency(s.initial_capital)}</span>
            </div>
            <div style="margin-top: 15px; text-align:right; font-size:12px; color:#3b82f6;">
                 Click to view history →
            </div>
        </div>
    `).join('');
}

// --- Navigation ---

window.showHome = () => {
    currentStrategyId = null;
    currentPage = 1; // Reset pagination
    document.getElementById('home-view').style.display = 'block';
    document.getElementById('detail-view').style.display = 'none';
    fetchData();
};

window.showDetail = async (id) => {
    currentStrategyId = id;
    currentPage = 1; // Reset pagination when switching strategies
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('detail-view').style.display = 'block';
    document.getElementById('detail-title').innerText = `Strategy: ${id}`;

    const select = document.getElementById('orderStrategyId');
    select.value = id;

    await fetchStrategyDetail(id);
};

async function fetchStrategyDetail(id) {
    try {
        const res = await fetch(`${API_URL}/strategies/${id}?page=${currentPage}&limit=${currentLimit}`);
        if (!res.ok) return;
        const data = await res.json();
        currentStrategyData = data; // Store for later use
        renderDetailView(data);
    } catch (e) { console.error(e); }
}

function renderDetailView(data) {
    // 1. Render Stats
    const statsDiv = document.getElementById('detail-stats');
    const pnl = parseFloat(data.current_balance) - parseFloat(data.initial_capital);
    statsDiv.innerHTML = `
        <span style="color:#8f95b2">Current Balance:</span> <b style="font-size:1.2em">${formatCurrency(data.current_balance)}</b>
        <span style="margin-left:20px; color:#8f95b2">PnL:</span> <b class="${pnl >= 0 ? 'positive' : 'negative'}" style="font-size:1.2em">${formatCurrency(pnl)}</b>
        <span style="margin-left:20px; color:#8f95b2">Daily Loss Limit:</span> <b style="font-size:1.2em">${data.max_daily_loss > 0 ? data.max_daily_loss + '%' : 'OFF'}</b>
    `;

    // Populate Risk Modal default
    if (document.getElementById('riskModal').style.display === 'flex') {
        // Only update if not typing? Or just set it when opening modal.
        // Let's set it in showDetail or a separate interaction.
        // Better: Set input value when opening modal requires modifying openModal logic or adding specific handler.
        // For simplicity, let's just leave it blank or user types. 
        // Or update it here:
        if (data.max_daily_loss) document.getElementById('riskMaxLoss').placeholder = data.max_daily_loss;
    }

    // 2. Render Active Positions
    const activeTbody = document.getElementById('detail-positions-table');
    if (data.positions.length === 0) {
        activeTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#8f95b2; padding: 20px;">No active positions</td></tr>';
    } else {
        activeTbody.innerHTML = data.positions.map(p => {
            // Calc PnL
            let pnlDisplay = 'Running...';
            let pnlClass = '';

            if (data.current_price) {
                const entry = parseFloat(p.entry_price);
                const size = parseFloat(p.size);
                const current = parseFloat(data.current_price);
                let pnl = 0;

                if (p.side === 'LONG') {
                    pnl = (current - entry) / entry * size;
                } else {
                    pnl = (entry - current) / entry * size;
                }

                pnlClass = pnl >= 0 ? 'positive' : 'negative';
                pnlDisplay = formatCurrency(pnl);
            }

            // Format TP/SL
            const fmt = (val) => val ? parseFloat(val).toFixed(2) : '-';

            return `
            <tr>
                <td>${p.symbol}</td>
                <td><span class="${p.side === 'LONG' ? 'tag-long' : 'tag-short'}">${p.side}</span></td>
                <td>${formatCurrency(p.entry_price)}</td>
                <td>${formatCurrency(p.size)}</td>
                <td>${fmt(p.tp)} / ${fmt(p.sl)}</td>
                <td class="${pnlClass}">${pnlDisplay}</td>
                <td>
                    <button class="btn-sm btn-edit" onclick="openUpdateModal('${p.id}', '${p.tp}', '${p.sl}')">✏️</button>
                    <button class="btn-sm btn-close" onclick="closePosition('${p.id}')">❌</button>
                </td>
            </tr>
        `}).join('');
    }

    // 3. Render History
    const historyTbody = document.getElementById('detail-history-table');
    if (!data.recent_history || data.recent_history.length === 0) {
        historyTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#8f95b2; padding: 20px;">No trade history</td></tr>';
    } else {
        historyTbody.innerHTML = data.recent_history.map(h => `
            <tr>
                <td><span class="${h.result === 'WIN' ? 'tag-long' : 'tag-short'}">${h.result}</span></td>
                <td>${h.symbol}</td>
                <td>${h.side}</td>
                <td>${formatCurrency(h.entry_price)}</td>
                <td>${formatCurrency(h.size)}</td>
                <td>${formatCurrency(h.exit_price)}</td>
                <td class="${parseFloat(h.pnl) >= 0 ? 'positive' : 'negative'}">${formatCurrency(h.pnl)}</td>
                <td>${h.close_reason}</td>
            </tr>
        `).join('');
    }

    // 4. Update Pagination Controls
    if (data.pagination) {
        const { page, totalPages, total } = data.pagination;
        const start = total === 0 ? 0 : (page - 1) * currentLimit + 1;
        const end = Math.min(page * currentLimit, total);

        document.getElementById('page-info').innerText = `Page ${page} of ${totalPages} (Showing ${start}-${end} of ${total})`;
        document.getElementById('btn-prev').disabled = page <= 1;
        document.getElementById('btn-next').disabled = page >= totalPages;
    }
}

function updateForms() {
    const select = document.getElementById('orderStrategyId');
    if (select.children.length <= 1) {
        strategies.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = s.id;
            select.appendChild(opt);
        });
    }
}

// --- Interaction ---

document.getElementById('createStrategyForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('newStratId').value;
    const capital = document.getElementById('newStratCapital').value;

    await fetch(`${API_URL}/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, capital })
    });

    closeModal('strategyModal');
    fetchData();
};

document.getElementById('placeOrderForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
        strategyId: document.getElementById('orderStrategyId').value,
        symbol: document.getElementById('orderSymbol').value,
        side: document.getElementById('orderSide').value,
        size: document.getElementById('orderSize').value,
        sl: document.getElementById('orderSL').value || null,
        tp: document.getElementById('orderTP').value || null,
    };

    const res = await fetch(`${API_URL}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const json = await res.json();
    if (json.error) alert(json.error);
    else {
        closeModal('orderModal');
        // Refresh detail if viewing
        if (currentStrategyId && currentStrategyId === body.strategyId) {
            fetchStrategyDetail(currentStrategyId);
        }
        fetchData();
    }
};

document.getElementById('updatePositionForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('updatePosId').value;
    const sl = document.getElementById('updateSL').value;
    const tp = document.getElementById('updateTP').value;

    const res = await fetch(`${API_URL}/position/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, sl, tp })
    });

    const json = await res.json();
    if (json.error) alert(json.error);
    else {
        closeModal('updateModal');
        fetchData(); // Will refresh detail view via render()
    }

};

document.getElementById('riskForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentStrategyId) return;

    const maxLoss = parseFloat(document.getElementById('riskMaxLoss').value) || 0;
    const maxPosSize = parseFloat(document.getElementById('riskMaxPosSize').value) || 0;
    const maxOpenPos = parseInt(document.getElementById('riskMaxOpenPos').value) || 0;

    // Validation
    if (maxLoss < 0 || maxLoss > 100) {
        alert("❌ Max Daily Loss must be between 0-100%");
        return;
    }
    if (maxPosSize < 0 || maxPosSize > 100) {
        alert("❌ Max Position Size must be between 0-100%");
        return;
    }
    if (maxOpenPos < 0) {
        alert("❌ Max Open Positions cannot be negative");
        return;
    }

    const res = await fetch(`${API_URL}/strategies/risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: currentStrategyId,
            max_daily_loss: maxLoss,
            max_position_size: maxPosSize,
            max_open_positions: maxOpenPos
        })
    });

    const json = await res.json();
    if (json.error) alert(json.error);
    else {
        alert("Risk settings updated! 🛡️");
        closeModal('riskModal');
        fetchData();
    }
};

// Actions
window.closePosition = async (id) => {
    if (!confirm("Are you sure you want to close this position?")) return;

    const res = await fetch(`${API_URL}/position/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });

    const json = await res.json();
    if (json.error) alert(json.error);
    else {
        fetchData();
    }
};

window.closeAllPositions = async () => {
    if (!currentStrategyId) return;
    if (!confirm(`Are you sure you want to CLOSE ALL positions for ${currentStrategyId}?`)) return;

    const res = await fetch(`${API_URL}/position/close-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: currentStrategyId })
    });

    const json = await res.json();
    if (json.error) alert(json.error);
    else {
        // alert(`Closed ${json.count} positions.`); // Optional feedback
        fetchData();
    }
};

window.openUpdateModal = (id, tp, sl) => {
    document.getElementById('updatePosId').value = id;
    document.getElementById('updateTP').value = tp && tp !== 'null' ? tp : '';
    document.getElementById('updateSL').value = sl && sl !== 'null' ? sl : '';
    openModal('updateModal');
};

window.openRiskModal = () => {
    if (!currentStrategyData) return;

    // Pre-fill form with current values
    document.getElementById('riskMaxLoss').value = currentStrategyData.max_daily_loss || '';
    document.getElementById('riskMaxPosSize').value = currentStrategyData.max_position_size || '';
    document.getElementById('riskMaxOpenPos').value = currentStrategyData.max_open_positions || '';

    openModal('riskModal');
};

// Pagination
window.changePage = (delta) => {
    if (!currentStrategyId) return;
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    fetchStrategyDetail(currentStrategyId);
};

// Utils
function formatCurrency(num) {
    if (!num && num !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

// Modals
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; }
