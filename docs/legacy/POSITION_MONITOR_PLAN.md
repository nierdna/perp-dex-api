# 📋 POSITION MONITOR IMPLEMENTATION PLAN

> **Mục đích**: Giải quyết bug của Lighter SDK với conditional TP/SL orders bằng cách implement client-side position monitoring.

---

## 🎯 VẤN ĐỀ CẦN GIẢI QUYẾT

### Bug Hiện Tại
Lighter SDK có bug nghiêm trọng với **conditional orders** (TP/SL):
- ✅ **Entry orders** hoạt động bình thường
- ❌ **TP/SL conditional orders** fill ngay lập tức thay vì chờ trigger price
- ❌ **Position bị đóng ngay** sau khi mở do TP/SL orders fill ngay
- ❌ **Không thể dùng `ORDER_TYPE_TAKE_PROFIT_LIMIT`** và `ORDER_TYPE_STOP_LOSS_LIMIT`

### Kết Quả
```json
// API response: success
{
  "success": true,
  "entry": {"tx_hash": "...", "position_size": 26.18},
  "tp_sl": {"tp_success": true, "sl_success": true}
}

// Nhưng position size = 0 (đã đóng ngay lập tức)
{
  "market_id": 25,
  "size": 0,  // ❌ Position đã bị đóng
  "avg_entry_price": 0.0
}
```

---

## 🏗️ KIẾN TRÚC GIẢI PHÁP

### Tổng Quan

```
┌─────────────────────────────────────────────────────────┐
│                   HEDGING BOT (main.py)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐              ┌──────────────┐        │
│  │   LIGHTER    │              │    ASTER     │        │
│  │   API        │              │    API       │        │
│  └──────┬───────┘              └──────────────┘        │
│         │                                               │
│         │ ✅ Entry Order Only (NO TP/SL)                │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────────┐          │
│  │      POSITION MONITOR SERVICE            │          │
│  │  • Monitor open positions                │          │
│  │  • Track TP/SL prices (in-memory)        │          │
│  │  • Check market price every 5s           │          │
│  │  • Auto close when hit TP/SL/timeout     │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Flow Hoạt Động

```
1. User gọi /api/orders/long hoặc /api/orders/short
   ↓
2. Place ENTRY order only (không đặt TP/SL)
   ↓
3. Entry order fill → Position được tạo
   ↓
4. Add position vào Position Monitor với TP/SL info
   ↓
5. Position Monitor check price mỗi 5 giây:
   ├─→ Price >= TP (LONG) hoặc Price <= TP (SHORT) → CLOSE (Take Profit)
   ├─→ Price <= SL (LONG) hoặc Price >= SL (SHORT) → CLOSE (Stop Loss)
   └─→ Timeout reached → CLOSE (Max hold time)
   ↓
6. Close position bằng reverse order (reduce_only=True)
   ↓
7. Remove position khỏi monitor
   ↓
8. Send Telegram notification
```

---

## 📐 TECHNICAL DESIGN

### 1. Position Monitor Class

**File**: `perpsdex/lighter/core/position_monitor.py`

```python
"""
Position Monitor Service
Monitors open positions and auto-closes them when TP/SL/timeout conditions are met
"""

import asyncio
from dataclasses import dataclass
from typing import Dict, Optional
import time


@dataclass
class MonitoredPosition:
    """Data structure for a monitored position"""
    market_id: int
    side: str  # 'long' or 'short'
    entry_price: float
    tp_price: float
    sl_price: float
    open_time: float  # timestamp
    timeout: int  # seconds
    position_size: float
    symbol: str
    
    def is_timeout(self) -> bool:
        """Check if position has timed out"""
        return time.time() - self.open_time >= self.timeout
    
    def should_close_tp(self, current_price: float) -> bool:
        """Check if TP condition is met"""
        if self.side == 'long':
            return current_price >= self.tp_price
        else:  # short
            return current_price <= self.tp_price
    
    def should_close_sl(self, current_price: float) -> bool:
        """Check if SL condition is met"""
        if self.side == 'long':
            return current_price <= self.sl_price
        else:  # short
            return current_price >= self.sl_price


class PositionMonitor:
    """
    Background service that monitors open positions and auto-closes them
    based on TP/SL/timeout conditions
    """
    
    def __init__(self, signer_client, order_api, market_data, check_interval: int = 5):
        """
        Args:
            signer_client: Lighter SignerClient for placing orders
            order_api: Lighter OrderAPI for getting market data
            market_data: MarketData instance for price queries
            check_interval: Seconds between price checks (default: 5)
        """
        self.signer_client = signer_client
        self.order_api = order_api
        self.market_data = market_data
        self.check_interval = check_interval
        
        self.positions: Dict[int, MonitoredPosition] = {}
        self.lock = asyncio.Lock()
        self.running = False
        self.monitor_task: Optional[asyncio.Task] = None
    
    async def add_position(
        self,
        market_id: int,
        side: str,
        entry_price: float,
        tp_price: float,
        sl_price: float,
        timeout: int,
        position_size: float,
        symbol: str
    ):
        """Add a position to monitor"""
        async with self.lock:
            self.positions[market_id] = MonitoredPosition(
                market_id=market_id,
                side=side,
                entry_price=entry_price,
                tp_price=tp_price,
                sl_price=sl_price,
                open_time=time.time(),
                timeout=timeout,
                position_size=position_size,
                symbol=symbol
            )
        
        print(f"✅ Added {side.upper()} position to monitor:")
        print(f"   Market: {symbol} (ID: {market_id})")
        print(f"   Entry: ${entry_price:.6f}")
        print(f"   TP: ${tp_price:.6f}")
        print(f"   SL: ${sl_price:.6f}")
        print(f"   Timeout: {timeout}s")
    
    async def remove_position(self, market_id: int):
        """Remove a position from monitoring"""
        async with self.lock:
            if market_id in self.positions:
                del self.positions[market_id]
                print(f"🗑️ Removed position {market_id} from monitor")
    
    def get_positions(self) -> Dict[int, MonitoredPosition]:
        """Get all monitored positions"""
        return self.positions.copy()
    
    async def start(self):
        """Start the monitoring service"""
        if self.running:
            print("⚠️ Position Monitor already running")
            return
        
        self.running = True
        self.monitor_task = asyncio.create_task(self._monitor_loop())
        print("🚀 Position Monitor started")
    
    async def stop(self):
        """Stop the monitoring service"""
        if not self.running:
            return
        
        self.running = False
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        print("🛑 Position Monitor stopped")
    
    async def _monitor_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                await self._check_all_positions()
            except Exception as e:
                print(f"❌ Error in monitor loop: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    async def _check_all_positions(self):
        """Check all monitored positions"""
        positions = self.get_positions()
        
        for market_id, position in positions.items():
            try:
                await self._check_position(market_id, position)
            except Exception as e:
                print(f"❌ Error checking position {market_id}: {e}")
    
    async def _check_position(self, market_id: int, position: MonitoredPosition):
        """Check a single position and close if conditions are met"""
        
        # Get current price
        price_result = await self.market_data.get_price(market_id, position.symbol)
        if not price_result['success']:
            print(f"⚠️ Failed to get price for {position.symbol}")
            return
        
        current_price = price_result['mid']
        
        # Check timeout
        if position.is_timeout():
            print(f"⏰ Position {position.symbol} timed out")
            await self._close_position(market_id, position, "TIMEOUT", current_price)
            return
        
        # Check TP
        if position.should_close_tp(current_price):
            print(f"🎯 TP hit for {position.symbol}")
            await self._close_position(market_id, position, "TAKE_PROFIT", current_price)
            return
        
        # Check SL
        if position.should_close_sl(current_price):
            print(f"🛡️ SL hit for {position.symbol}")
            await self._close_position(market_id, position, "STOP_LOSS", current_price)
            return
    
    async def _close_position(
        self,
        market_id: int,
        position: MonitoredPosition,
        reason: str,
        current_price: float
    ):
        """Close a position"""
        print(f"🔄 Closing {position.side.upper()} position {position.symbol} ({reason})")
        
        # Get market metadata for scaling
        metadata_result = await self.order_api.get_market_metadata(market_id)
        if not metadata_result['success']:
            print(f"❌ Failed to get market metadata for {market_id}")
            return
        
        size_decimals = metadata_result['size_decimals']
        price_decimals = metadata_result['price_decimals']
        
        # Calculate close order parameters
        from perpsdex.lighter.utils.calculator import Calculator
        
        base_amount_int = Calculator.scale_to_int(position.position_size, size_decimals)
        
        # Set aggressive limit price for immediate fill (3% slippage)
        if position.side == 'long':
            # Close LONG = SELL
            # Willing to sell 3% below market
            close_price = current_price * 0.97
            is_ask = 1
        else:
            # Close SHORT = BUY
            # Willing to buy 3% above market
            close_price = current_price * 1.03
            is_ask = 0
        
        price_int = Calculator.scale_to_int(close_price, price_decimals)
        
        # Generate unique order index
        client_order_index = int(time.time() * 1000)
        
        # Place close order
        try:
            order, response, error = await self.signer_client.create_order(
                market_id,
                client_order_index,
                base_amount_int,
                price_int,
                is_ask,
                self.signer_client.ORDER_TYPE_LIMIT,
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only = True (only close position)
                self.signer_client.NIL_TRIGGER_PRICE,
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if error is None and response:
                print(f"✅ Close order placed: {response.tx_hash}")
                print(f"   Reason: {reason}")
                print(f"   Entry: ${position.entry_price:.6f}")
                print(f"   Exit: ${current_price:.6f}")
                
                # Calculate P&L
                if position.side == 'long':
                    pnl_percent = ((current_price - position.entry_price) / position.entry_price) * 100
                else:
                    pnl_percent = ((position.entry_price - current_price) / position.entry_price) * 100
                
                print(f"   P&L: {pnl_percent:+.2f}%")
                
                # Remove from monitoring
                await self.remove_position(market_id)
            else:
                print(f"❌ Failed to place close order: {error}")
        
        except Exception as e:
            print(f"❌ Exception closing position: {e}")
```

---

## 🔧 INTEGRATION VÀO API ENDPOINTS

### 2. Update Lighter API Main

**File**: `perpsdex/lighter/api/main.py`

#### 2.1. Initialize Position Monitor (Global Instance)

```python
# Add at top of file after imports
from perpsdex.lighter.core.position_monitor import PositionMonitor

# Global Position Monitor instance
position_monitor: Optional[PositionMonitor] = None

@app.on_event("startup")
async def startup_event():
    """Initialize Position Monitor on startup"""
    global position_monitor
    
    # Will be initialized when first client connects
    print("🚀 Lighter API Server started")

async def get_position_monitor() -> PositionMonitor:
    """Get or create Position Monitor instance"""
    global position_monitor
    
    if position_monitor is None:
        client = await get_client()
        market = MarketData(client.get_order_api(), client.get_account_api())
        
        position_monitor = PositionMonitor(
            signer_client=client.get_signer_client(),
            order_api=client.get_order_api(),
            market_data=market,
            check_interval=5  # Check every 5 seconds
        )
        
        # Start monitoring
        await position_monitor.start()
    
    return position_monitor
```

#### 2.2. Update `/api/orders/long` Endpoint

```python
@app.post("/api/orders/long")
async def place_long_order(order: OrderRequest):
    """Đặt lệnh LONG (với Position Monitor thay vì TP/SL orders)"""
    try:
        client = await get_client()
        market = MarketData(client.get_order_api(), client.get_account_api())
        
        # ... existing code to check balance, get price ...
        
        # Place ENTRY order only (NO TP/SL)
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
        
        # Calculate TP/SL prices (for Position Monitor)
        tp_sl_result = None
        if order.sl_percent and order.rr_ratio:
            sl_price = Calculator.calculate_sl_from_percent(entry_price, 'long', order.sl_percent)
            tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(
                entry_price, 'long', sl_price, order.rr_ratio
            )
            calculated_tp_price = tp_sl_calc['tp_price']
            calculated_sl_price = sl_price
            
            # Add to Position Monitor (instead of placing TP/SL orders)
            monitor = await get_position_monitor()
            
            # Get timeout from env (or use default)
            import os
            timeout = int(os.getenv('TIME_OPEN_CLOSE', 3600))  # Default 1 hour
            
            await monitor.add_position(
                market_id=market_id,
                side='long',
                entry_price=entry_price,
                tp_price=calculated_tp_price,
                sl_price=calculated_sl_price,
                timeout=timeout,
                position_size=result['position_size'],
                symbol=order.symbol.upper()
            )
            
            tp_sl_result = {
                'success': True,
                'method': 'position_monitor',
                'tp_price': calculated_tp_price,
                'sl_price': calculated_sl_price,
                'entry_price': entry_price,
                'timeout': timeout
            }
        
        return {
            "success": True,
            "entry": {
                "tx_hash": result['tx_hash'],
                "entry_price": result['entry_price'],
                "position_size": result['position_size'],
                "side": result['side']
            },
            "tp_sl": tp_sl_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 2.3. Update `/api/orders/short` Endpoint

```python
@app.post("/api/orders/short")
async def place_short_order(order: OrderRequest):
    """Đặt lệnh SHORT (với Position Monitor thay vì TP/SL orders)"""
    # Similar logic as LONG, but with side='short'
    # ... (same structure as above)
```

---

## 🧪 TESTING PLAN

### Test Cases

#### 1. TP Hit Test
```bash
# Place LONG order
curl -X POST 'http://localhost:8000/api/orders/long' \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"DOGE","size_usd":5,"leverage":5,"sl_percent":3,"rr_ratio":[1,2]}'

# Monitor logs để xem:
# - Position được add vào monitor
# - Price checks mỗi 5s
# - Khi price >= TP → auto close
```

#### 2. SL Hit Test
```bash
# Place SHORT order
curl -X POST 'http://localhost:8000/api/orders/short' \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"DOGE","size_usd":5,"leverage":5,"sl_percent":3,"rr_ratio":[1,2]}'

# Wait for price movement hit SL
```

#### 3. Timeout Test
```bash
# Set short timeout in .env
TIME_OPEN_CLOSE=60  # 1 minute

# Place order và wait 1 phút
# → Position should auto-close
```

#### 4. Multiple Positions Test
```bash
# Open 3 positions on different markets
# - BTC LONG
# - ETH SHORT
# - DOGE LONG

# Verify all 3 are monitored correctly
# Verify they close independently
```

---

## 📊 MONITORING & HEALTH CHECKS

### Add Monitoring Endpoints

```python
@app.get("/api/monitor/status")
async def get_monitor_status():
    """Get Position Monitor status"""
    monitor = await get_position_monitor()
    
    positions = monitor.get_positions()
    
    return {
        "running": monitor.running,
        "check_interval": monitor.check_interval,
        "monitored_positions": len(positions),
        "positions": [
            {
                "market_id": p.market_id,
                "symbol": p.symbol,
                "side": p.side,
                "entry": p.entry_price,
                "tp": p.tp_price,
                "sl": p.sl_price,
                "open_time": p.open_time,
                "timeout": p.timeout,
                "time_remaining": p.timeout - (time.time() - p.open_time)
            }
            for p in positions.values()
        ]
    }

@app.post("/api/monitor/stop/{market_id}")
async def manual_stop_monitor(market_id: int):
    """Manually remove a position from monitoring"""
    monitor = await get_position_monitor()
    await monitor.remove_position(market_id)
    return {"success": True, "message": f"Position {market_id} removed from monitor"}
```

---

## ⚠️ CONSIDERATIONS & LIMITATIONS

### Pros ✅
1. **Bypass Lighter SDK bug hoàn toàn**
2. **Full control** over TP/SL logic
3. **Flexible**: Có thể add trailing stop, partial TP, multiple TP levels
4. **Reliable**: Không phụ thuộc vào buggy conditional orders
5. **Visible**: Position vẫn hiển thị bình thường trên Lighter UI

### Cons ❌
1. **Delay ~5 seconds**: Không real-time như exchange-side TP/SL
2. **Service dependency**: Nếu service crash → mất TP/SL protection
3. **Network dependency**: Mất connection → không check được price
4. **Resource usage**: Cần chạy background loop liên tục

### Mitigations 🛡️
1. **Docker auto-restart**: Container tự động restart nếu crash
2. **Health checks**: Monitor service health, alert qua Telegram
3. **Graceful shutdown**: Save monitored positions to disk khi shutdown
4. **Recovery on startup**: Load lại monitored positions khi start
5. **Redundancy**: Có thể chạy multiple instances với shared state (Redis)

---

## 🚀 DEPLOYMENT

### Docker Integration

```yaml
# docker-compose.yml
services:
  lighter-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - POSITION_MONITOR_ENABLED=true
      - POSITION_MONITOR_INTERVAL=5
      - TIME_OPEN_CLOSE=3600
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/monitor/status"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Environment Variables

```bash
# .env
POSITION_MONITOR_ENABLED=true
POSITION_MONITOR_INTERVAL=5  # seconds between checks
TIME_OPEN_CLOSE=3600  # max position hold time (seconds)
```

---

## 📈 FUTURE ENHANCEMENTS

### Phase 2 Features
1. **Trailing Stop Loss**: SL price follows market price
2. **Partial TP**: Close 50% at TP1, 50% at TP2
3. **Break-even Stop**: Move SL to entry after X% profit
4. **Position Recovery**: Save/load monitored positions từ database
5. **Multiple TP levels**: TP1, TP2, TP3 với partial closes
6. **Risk Management**: Max concurrent positions, max risk per position

### Phase 3 Advanced
1. **Distributed Monitoring**: Multiple monitor instances với Redis coordination
2. **Advanced Analytics**: Track P&L, win rate, avg hold time
3. **ML-based Exit**: Use ML model để predict optimal exit time
4. **Cross-exchange Hedging**: Monitor positions trên cả Lighter và Aster

---

## 📚 REFERENCES

### Related Files
- `perpsdex/lighter/core/position_monitor.py` (TẠO MỚI)
- `perpsdex/lighter/api/main.py` (CẬP NHẬT)
- `perpsdex/lighter/core/order.py` (ĐÃ CẬP NHẬT - aggressive LIMIT orders)
- `perpsdex/lighter/core/risk.py` (DEPRECATED - conditional orders)

### Bug Reports
- **Lighter SDK Bug**: Conditional orders (TP/SL) fill immediately instead of waiting for trigger price
- **Issue**: `ORDER_TYPE_TAKE_PROFIT_LIMIT` và `ORDER_TYPE_STOP_LOSS_LIMIT` không hoạt động đúng
- **Workaround**: Client-side position monitoring (this plan)

---

## ✅ CHECKLIST TRƯỚC KHI IMPLEMENT

- [ ] Backup code hiện tại
- [ ] Test aggressive LIMIT orders (3% slippage) hoạt động stable
- [ ] Confirm entry orders fill successfully và position được tạo
- [ ] Setup monitoring/logging infrastructure
- [ ] Prepare Telegram notifications cho close events
- [ ] Document rollback plan nếu có issue

---

**Created**: 2025-10-22  
**Status**: PLANNED (chưa implement)  
**Priority**: HIGH (critical for hedging bot functionality)  
**Estimated Time**: ~65 minutes implementation + 20 minutes testing

