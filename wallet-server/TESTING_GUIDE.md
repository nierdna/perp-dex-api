# Deposit Monitoring & Webhook - Testing Guide

## ✅ Implementation Status

### Phase 1: Database & Entities - COMPLETED
- [x] DepositEntity
- [x] WebhookEntity  
- [x] DepositRepository
- [x] WebhookRepository
- [x] Registered in DatabaseModule

### Phase 2: RPC Polling Worker - COMPLETED
- [x] DepositMonitoringService with cron job (30s interval)
- [x] Solana token balance checker
- [x] EVM token balance checker
- [x] Balance comparison & deposit detection logic
- [x] Integrated with WebhookService

### Phase 3: Webhook System - COMPLETED
- [x] WebhookService with retry logic
- [x] Auto-delete after 5 consecutive failures
- [x] HMAC signature generation
- [x] Webhook registration API
- [x] WebhookController

---

## 🧪 Testing Steps

### 1. Register Webhook

```bash
curl -X POST http://localhost:1999/v1/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/YOUR_UNIQUE_ID",
    "secret": "test_secret_123"
  }'
```

**Expected Response:**
```json
{
  "webhook_id": "xxx-xxx-xxx",
  "url": "https://webhook.site/YOUR_UNIQUE_ID",
  "is_active": true,
  "consecutive_failures": 0,
  "created_at": "2025-11-26T...",
  "message": "Webhook registered successfully. Will be auto-deleted after 5 consecutive failures."
}
```

### 2. Create Test Wallet

```bash
curl -X POST http://localhost:1999/v1/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_001"
  }'
```

### 3. Simulate Deposit (Manual DB Update)

Since we're on testnet/devnet, you can manually update the balance to trigger deposit detection:

```sql
-- Connect to your postgres database
-- Update wallet_balances to simulate a deposit

UPDATE wallet_balances 
SET balance = 100.00, last_updated_at = NOW()
WHERE wallet_id = 'your-wallet-id' AND token = 'USDC';
```

### 4. Wait for Cron Scan

The deposit monitoring service runs every 30 seconds. Watch the logs:

```
🔍 Starting deposit scan...
📊 Monitoring X wallet(s)
💰 Deposit detected! User: test_user_001, 100 USDC on chain 8453
✅ Deposit recorded: dep_xyz
📤 Sending deposit notification to 1 webhook(s)
📡 Sending webhook to https://webhook.site/...
✅ Webhook delivered successfully
✅ Deposit scan completed in Xs
```

### 5. Check Webhook Delivery

Go to `https://webhook.site/YOUR_UNIQUE_ID` and verify the payload:

```json
{
  "event": "deposit",
  "webhook_id": "wh_abc123",
  "timestamp": "2025-11-26T04:00:00Z",
  "data": {
    "deposit_id": "dep_xyz789",
    "user_id": "test_user_001",
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
    "previous_balance": "0.000000",
    "new_balance": "100.000000",
    "tx_hash": null,
    "detected_at": "2025-11-26T..."
  },
  "signature": "sha256_hmac_signature_here"
}
```

Verify HMAC signature in your webhook receiver:
```javascript
const crypto = require('crypto');
const secret = 'test_secret_123';
const signature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');
// Compare with payload.signature
```

---

## 📊 Database Queries for Monitoring

### Check Deposits
```sql
SELECT * FROM deposits 
ORDER BY detected_at DESC 
LIMIT 10;
```

### Check Wallet Balances
```sql
SELECT 
  uw.user_id,
  wb.chain_id,
  wb.token,
  wb.balance,
  wb.last_updated_at
FROM wallet_balances wb
JOIN user_wallets uw ON wb.wallet_id = uw.id
ORDER BY wb.last_updated_at DESC;
```

### Check Registered Webhooks
```sql
SELECT 
  id,
  url,
  is_active,
  consecutive_failures,
  last_failure_at,
  created_at
FROM webhooks;
```

---

## ⚙️ Environment Variables

Add to `.env`:
```env
# RPC URLs (use free public endpoints or your own)
SOLANA_RPC_URL=https://api.devnet.solana.com
BASE_RPC_URL=https://sepolia.base.org
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Enable worker mode to run cron jobs
IS_WORKER=1
```

---

## 🔍 Troubleshooting

### Issue: Webhook not being called
- Check webhook URL is publicly accessible
- Check webhook registration succeeded
- Check deposit was actually detected (check logs)
- Check `webhooks` table has active webhook

### Issue: No deposits detected
- Verify wallet exists in `user_wallets`
- Verify supported tokens exist in `supported_tokens`
- Check RPC connection is working
- Manually update balance in DB to force detection

### Issue: Cron not running
- Make sure `IS_WORKER=1` in `.env`
- Check server logs for cron execution
- DepositMonitoringService should be registered in WorkerModule

---

## 🎯 Next Steps

1. Test with real testnet deposits (send actual USDC on Base Sepolia)
2. Monitor performance with multiple wallets
3. Test webhook retry logic (use invalid URL)
4. Test auto-delete after 5 failures
5. Add metrics/monitoring
