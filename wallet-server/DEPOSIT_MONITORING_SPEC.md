# Deposit Monitoring & Webhook System - Specification

## Tổng quan
Hệ thống giám sát deposit (nạp tiền) USDC/USDT vào ví của users trên các chain (Solana, Base, Arbitrum) và thông báo qua webhook.

---

## 1. RPC Polling Worker (Chain Listener)

### 1.1. Yêu cầu
- **Mục đích**: Giám sát balance của tất cả ví users trên các chain mỗi 30 giây
- **Phương pháp**: Polling RPC endpoints (tạm thời, sau này sẽ dùng WebSocket hoặc Webhook từ provider)
- **Scope**: Chỉ giám sát USDC và USDT (dựa trên bảng `supported_tokens`)

### 1.2. Kiến trúc

#### Service: `DepositMonitoringService`
**Location**: `src/modules/worker/services/deposit-monitoring.service.ts`

**Chức năng chính**:
1. Fetch tất cả ví cần giám sát từ DB
2. Với mỗi ví, check balance của các token được hỗ trợ
3. So sánh balance hiện tại với balance đã lưu trong DB (`wallet_balances`)
4. Nếu có sự thay đổi (tăng) → Ghi nhận deposit
5. Cập nhật balance mới vào DB
6. Trigger webhook notification

#### Cron Job Schedule
- **Interval**: 30 giây
- **Implementation**: NestJS `@Cron` decorator

```typescript
@Cron('*/30 * * * * *') // Every 30 seconds
async scanDeposits() { ... }
```

### 1.3. Logic Flow

```
1. [START] Cron trigger mỗi 30s
2. [FETCH] Load all active wallets from DB
3. [LOOP] For each wallet:
   a. Get wallet's chainId and address
   b. [FETCH] Get supported tokens for this chain
   c. [LOOP] For each supported token:
      i. [RPC] Call blockchain RPC to get current balance
      ii. [DB] Get previous balance from wallet_balances
      iii. [COMPARE] If current > previous:
           - Calculate deposit amount = current - previous
           - [CREATE] Create deposit record
           - [UPDATE] Update wallet_balances
           - [TRIGGER] Send webhook notification
4. [END] Wait for next cron cycle
```

### 1.4. RPC Integration

#### Solana (Token Balance)
```typescript
// Get SPL Token balance
const connection = new Connection(RPC_URL);
const tokenAccount = await connection.getTokenAccountsByOwner(
  new PublicKey(walletAddress),
  { mint: new PublicKey(tokenMintAddress) }
);
const balance = tokenAccount.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
```

#### EVM (Base & Arbitrum)
```typescript
// Get ERC20 Token balance
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
const balance = await contract.balanceOf(walletAddress);
const formattedBalance = ethers.formatUnits(balance, decimals);
```

### 1.5. Environment Variables
```env
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Base
BASE_RPC_URL=https://mainnet.base.org

# Arbitrum
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Monitoring
DEPOSIT_POLLING_INTERVAL=30000  # Optional: override 30s default
```

### 1.6. Database Schema - Deposit Records

#### New Entity: `DepositEntity`
**Table**: `deposits`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| wallet_id | UUID | FK to user_wallets.id |
| user_id | string | User identifier |
| chain_id | number | 901, 8453, 42161 |
| token_address | string | Token contract/mint address |
| token_symbol | string | USDC, USDT |
| amount | decimal(20,6) | Deposit amount |
| previous_balance | decimal(20,6) | Balance before deposit |
| new_balance | decimal(20,6) | Balance after deposit |
| tx_hash | string | Transaction hash (if available) |
| detected_at | timestamp | When deposit was detected |
| webhook_sent | boolean | Whether webhook was sent |
| webhook_sent_at | timestamp | When webhook was sent |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |

**Indexes**:
- `wallet_id`
- `user_id`
- `detected_at`
- `webhook_sent`

---

## 2. Webhook Registration & Notification System

### 2.1. Yêu cầu
- **Mục đích**: Cho phép external services đăng ký webhook để nhận thông báo khi có deposit
- **Authentication**: Không cần API Key (public)
- **Retry Logic**: Retry 3 lần nếu webhook call fail
- **Auto-cleanup**: Tự động xóa webhook nếu fail liên tiếp 5 lần

### 2.2. API Endpoints

#### POST `/v1/webhooks/register`
**Mô tả**: Đăng ký webhook URL để nhận deposit notifications

**Authentication**: Không yêu cầu API Key

**Request**:
```json
{
  "url": "https://your-server.com/webhook/deposit",
  "secret": "your_webhook_secret_for_signature"
}
```

**Response**:
```json
{
  "webhook_id": "wh_abc123",
  "url": "https://your-server.com/webhook/deposit",
  "is_active": true,
  "consecutive_failures": 0,
  "created_at": "2025-11-26T04:00:00Z",
  "message": "Webhook registered successfully. Will be auto-deleted after 5 consecutive failures."
}
```

**Notes**:
- Webhook sẽ nhận TẤT CẢ deposit events (USDC và USDT) trên TẤT CẢ chains
- Không cần chỉ định `events` hoặc `chains` - đơn giản hóa
- Nếu đăng ký lại với cùng URL, sẽ reset `consecutive_failures` về 0

### 2.3. Webhook Payload Format

Khi có deposit mới, system sẽ POST đến webhook URL:

```json
{
  "event": "deposit",
  "webhook_id": "wh_abc123",
  "timestamp": "2025-11-26T04:00:00Z",
  "data": {
    "deposit_id": "dep_xyz789",
    "user_id": "user_123456",
    "wallet_id": "wallet_abc",
    "wallet_address": "0xAbCDef...",
    "chain": "Base",
    "chain_id": 8453,
    "token": {
      "symbol": "USDC",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "name": "USD Coin",
      "decimals": 6
    },
    "amount": "100.000000",
    "previous_balance": "50.000000",
    "new_balance": "150.000000",
    "tx_hash": null,
    "detected_at": "2025-11-26T04:00:00Z"
  },
  "signature": "sha256_hmac_signature_here"
}
```

### 2.4. Webhook Security

#### HMAC Signature
Mỗi webhook request sẽ có header:
```
X-Webhook-Signature: sha256=<hmac_hash>
```

Computed as:
```typescript
const signature = crypto
  .createHmac('sha256', webhook.secret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

Bên nhận webhook cần verify signature này.

### 2.5. Database Schema - Webhooks

#### Entity: `WebhookEntity`
**Table**: `webhooks`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| url | string | Webhook endpoint URL (unique) |
| secret | string (encrypted) | Secret for HMAC signature |
| is_active | boolean | Whether webhook is active |
| consecutive_failures | number | Counter for consecutive failed deliveries |
| last_failure_at | timestamp | When last failure occurred |
| created_at | timestamp | |
| updated_at | timestamp | |

**Indexes**:
- `url` (unique)
- `is_active`

**Notes**:
- Đơn giản hóa: Không lưu `events` và `chains` - mọi webhook nhận tất cả deposit
- `consecutive_failures`: Reset về 0 khi delivery thành công
- Tự động xóa khi `consecutive_failures >= 5`

### 2.6. Retry & Auto-Delete Logic

```typescript
async sendWebhook(webhook, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': this.generateSignature(payload, webhook.secret),
        },
        timeout: 5000, // 5s timeout
      });
      
      if (response.status >= 200 && response.status < 300) {
        // Success - reset consecutive failures
        await this.webhookRepository.update(webhook.id, {
          consecutive_failures: 0,
        });
        return { success: true, attempt };
      }
    } catch (error) {
      if (attempt === maxRetries) {
        // All retries failed - increment consecutive_failures
        const newCount = webhook.consecutive_failures + 1;
        
        if (newCount >= 5) {
          // Auto-delete webhook after 5 consecutive failures
          await this.webhookRepository.delete(webhook.id);
          console.log(`🗑️ Auto-deleted webhook ${webhook.id} after 5 consecutive failures`);
        } else {
          // Update failure counter
          await this.webhookRepository.update(webhook.id, {
            consecutive_failures: newCount,
            last_failure_at: new Date(),
          });
        }
        
        return { success: false, attempt, error, consecutive_failures: newCount };
      }
      // Wait before retry: 2^attempt seconds (exponential backoff)
      await this.sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

---

## 3. Implementation Plan

### Phase 1: Database & Entities (1 day)
- [ ] Create `DepositEntity`
- [ ] Create `WebhookEntity`
- [ ] Create `WebhookDeliveryEntity` (optional)
- [ ] Create repositories
- [ ] Run migrations

### Phase 2: RPC Polling Worker (2 days)
- [ ] Create `DepositMonitoringService`
- [ ] Implement Solana token balance checker
- [ ] Implement EVM (Base/Arbitrum) token balance checker
- [ ] Implement balance comparison logic
- [ ] Create deposit records on detection
- [ ] Update `wallet_balances` table
- [ ] Add cron job scheduler
- [ ] Test with various scenarios

### Phase 3: Webhook System (1.5 days)
- [ ] Create `WebhookService`
- [ ] Implement webhook registration API (public, no auth)
- [ ] Implement HMAC signature generation
- [ ] Implement webhook delivery with retry
- [ ] Implement auto-delete logic (5 consecutive failures)
- [ ] Test webhook notifications

### Phase 4: Integration & Testing (1 day)
- [ ] Integrate deposit detection → webhook trigger
- [ ] End-to-end testing
- [ ] Performance testing (handle hundreds of wallets)
- [ ] Documentation update

---

## 4. Configuration & Environment

```env
# RPC URLs
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Monitoring
DEPOSIT_POLLING_INTERVAL=30000  # 30 seconds
DEPOSIT_MONITORING_ENABLED=true

# Webhook
WEBHOOK_TIMEOUT=5000  # 5 seconds
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=2000  # Base delay for exponential backoff
```

---

## 5. Potential Issues & Solutions

### Issue 1: RPC Rate Limiting
**Problem**: Public RPC có rate limit, nếu có nhiều ví sẽ bị block

**Solutions**:
- Use multiple RPC providers (rotation)
- Implement request queue với rate limiting
- Sau này: Migrate sang paid RPC hoặc self-hosted node
- Hoặc dùng dịch vụ như Helius (Solana), Alchemy/Infura (EVM)

### Issue 2: False Positives
**Problem**: Balance tăng không phải do deposit mà do return từ withdrawal

**Solutions**:
- Track transaction hash để verify
- Implement transaction history scanning thay vì chỉ check balance
- Có thể thêm flag `deposit_type: 'detected' | 'confirmed'`

### Issue 3: Missed Deposits (Polling gap)
**Problem**: Nếu có deposit và withdrawal trong khoảng 30s, có thể miss

**Solutions**:
- Giảm polling interval xuống 10-15s nếu cần
- Sau này migrate sang WebSocket hoặc blockchain indexer
- Log tất cả balance changes để audit

### Issue 4: Webhook Failures
**Problem**: External service down → không nhận được notification

**Solutions**:
- Retry logic 3 lần với exponential backoff (đã implement)
- **Auto-delete**: Tự động xóa webhook sau 5 lần fail liên tiếp
- Deposit vẫn được lưu trong DB, có thể query lại nếu cần
- Service có thể đăng ký lại webhook khi đã khôi phục

---

## 6. Example Usage Flow

### Scenario: User nạp 100 USDC vào Base

1. **User sends**: 100 USDC to their Base wallet address
2. **Transaction confirms** on blockchain
3. **After ≤30s**: Cron job runs
4. **Worker checks**: Base wallet's USDC balance
5. **Detects**: Balance increased from 50 → 150 USDC
6. **Creates**: Deposit record in DB
7. **Updates**: `wallet_balances` table
8. **Triggers**: Webhook notification to registered URL
9. **External service receives**: Webhook payload
10. **External service verifies**: HMAC signature
11. **External service processes**: Credit user's account

---

## 7. API Examples

### Register Webhook
```bash
curl -X POST http://localhost:1999/v1/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://manager-server.com/webhooks/deposit",
    "secret": "my_super_secret_key_123"
  }'
```

**Response**:
```json
{
  "webhook_id": "wh_abc123",
  "url": "https://manager-server.com/webhooks/deposit",
  "is_active": true,
  "consecutive_failures": 0,
  "created_at": "2025-11-26T04:00:00Z",
  "message": "Webhook registered successfully. Will be auto-deleted after 5 consecutive failures."
}
```

### Receive Webhook (External Service)
```javascript
// Express.js example
app.post('/webhooks/deposit', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', 'my_super_secret_key_123')
    .update(payload)
    .digest('hex');
  
  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process deposit
  const { data } = req.body;
  console.log(`Deposit detected: ${data.amount} ${data.token.symbol} for user ${data.user_id}`);
  
  // Credit user account
  // ...
  
  res.status(200).send('OK');
});
```

---

## 8. Monitoring & Alerts

### Metrics to Track
- Number of deposits detected per hour
- Average deposit detection latency
- Webhook delivery success rate
- Webhook delivery latency
- RPC request failures
- Balance check errors

### Alerts
- Alert if no deposits detected for X hours (potential worker issue)
- Alert if webhook success rate < 90%
- Alert if RPC errors > 10% of requests

---

Bạn review và cho feedback nhé! Tôi sẽ điều chỉnh spec nếu cần trước khi bắt đầu implement.
