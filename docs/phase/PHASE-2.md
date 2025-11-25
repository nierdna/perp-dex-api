# Phase 2: Exchange Selection & Admin Key Management

**Duration:** 3-4 days  
**Status:** 🚧 In Progress (50%)  
**Priority:** HIGH

---

## 🎯 Objectives

1. User chọn sàn farm (Aster hoặc Lighter)
2. Hiển thị thông tin ví + QR code để deposit
3. Monitor balance real-time
4. Admin nhận notification khi balance ≥ $10
5. Admin tạo API key cho sàn tương ứng
6. Kích hoạt farming status

---

## 📋 Tasks Breakdown

### Task 2.1: Database Schema Expansion
**Duration:** 0.5 day  
**Status:** ⏳ Pending

#### Deliverables:
- [ ] Create `UserWalletEntity` (`user_wallets` table)
  ```typescript
  {
    user_id, chain, public_key,
    balance_usdc, balance_usdt,
    last_check_at
  }
  ```
- [ ] Update `ExchangeKeyEntity` (`exchange_keys` table)
  ```typescript
  {
    user_id, exchange,
    config: JSONB, // Flexible for different exchanges
    is_active
  }
  ```
- [ ] Create `HedgingConfigEntity` (`hedging_configs` table)
  ```typescript
  {
    user_id, primary_exchange, hedge_exchange,
    symbol, leverage, amount_per_order,
    status // pending_wallet | pending_setup | farming | stopped
  }
  ```

#### Files to Create/Modify:
```
manager-server/src/modules/database/entities/
  ├── user-wallet.entity.ts (NEW)
  ├── exchange-key.entity.ts (UPDATE - add JSONB config)
  └── hedging-config.entity.ts (NEW)
```

#### Migration:
```bash
# Run migration to add new tables
npm run migration:run
```

---

### Task 2.2: Exchange Selection UI
**Duration:** 1 day  
**Status:** ⏳ Pending

#### Deliverables:
- [ ] Page: `/dashboard/setup` - Chọn sàn farm
- [ ] Component: `<ExchangeCard>` 
  - Display: Exchange logo, name, description
  - Button: "Select This Exchange"
  - Styling: Card layout với hover effect
- [ ] API Integration: Save exchange choice

#### UI Flow:
```
1. User vào Dashboard → Thấy banner "Setup Required"
2. Click "Setup Now" → Navigate to /dashboard/setup
3. See 2 cards: Aster vs Lighter
4. Click "Select" → POST /hedging/config
5. Show success + wallet info
```

#### Component Example:
```tsx
<div className="grid grid-cols-2 gap-6">
  <ExchangeCard
    name="Aster"
    logo="/aster-logo.png"
    description="High volume DEX on Solana"
    onSelect={() => handleSelect('aster')}
  />
  <ExchangeCard
    name="Lighter"
    logo="/lighter-logo.png"
    description="Low fee perpetual exchange"
    onSelect={() => handleSelect('lighter')}
  />
</div>
```

#### Files to Create:
```
ui/src/app/dashboard/setup/
  └── page.tsx

ui/src/components/
  └── ExchangeCard.tsx
```

---

### Task 2.3: Wallet Info Display
**Duration:** 0.5 day  
**Status:** ⏳ Pending

#### Deliverables:
- [ ] Dashboard section: "Your Wallet"
  - Display: Public address (truncated)
  - Display: Balance (USDC + USDT)
  - QR Code for deposit
  - Button: "Copy Address"
  - Link: "View on Solscan"
- [ ] Real-time balance update (WebSocket or Polling)

#### Component:
```tsx
<WalletInfoCard
  publicKey="ABC...XYZ"
  balanceUsdc={15.50}
  balanceUsdt={0}
  onCopy={() => copy(publicKey)}
/>
```

#### Files to Create:
```
ui/src/components/
  └── WalletInfoCard.tsx
```

---

### Task 2.4: Balance Monitoring (Solana Worker)
**Duration:** 1 day  
**Status:** 🚧 In Progress

#### Deliverables:
- [ ] Solana Worker: Monitor user wallets
- [ ] Webhook: `POST /webhooks/deposit`
  - Params: `publicKey`, `amount`, `token`
- [ ] Update `user_wallets.balance_usdc`
- [ ] Notification logic:
  - If balance >= $10 && status = `pending_wallet`
  - → Update status = `pending_setup`
  - → Telegram notify admin

#### Webhook Implementation:
```typescript
// wallet-server/src/webhooks/deposit.controller.ts
@Post('deposit')
async handleDeposit(@Body() body: DepositWebhookDto) {
  const { publicKey, amount, token } = body;
  
  // 1. Find user by public_key
  const wallet = await this.walletRepo.findOne({ public_key: publicKey });
  
  // 2. Update balance
  wallet.balance_usdc += amount;
  await this.walletRepo.save(wallet);
  
  // 3. Notify manager-server
  await this.httpService.post(
    `${MANAGER_URL}/wallets/balance-updated`,
    { userId: wallet.user_id, balance: wallet.balance_usdc }
  );
}
```

#### Files to Create/Modify:
```
wallet-server/src/webhooks/
  └── deposit.controller.ts

manager-server/src/modules/api/controllers/
  └── wallet.controller.ts (receive webhook)
```

---

### Task 2.5: Enhanced Telegram Notifications
**Duration:** 0.5 day  
**Status:** ⏳ Pending

#### Deliverables:
- [ ] `TelegramService.notifyBalanceReady()`
  - Message: "User có balance ≥ $10, chờ admin setup key"
  - Include: Username, Balance, Selected exchange
  - Button (optional): Link to admin panel

#### Message Format:
```
💰 User Balance Ready

👤 User: @mr_mmon
💵 Balance: $15.50
🎯 Exchange: Aster

⚠️ Action Required:
Create API Key for Aster exchange
```

#### Files to Modify:
```
manager-server/src/modules/business/services/
  └── telegram.service.ts
```

---

### Task 2.6: Admin API Endpoints
**Duration:** 1 day  
**Status:** ⏳ Pending

#### Endpoints to Implement:

**1. `GET /admin/users/pending-setup`**
- Description: List users chờ admin tạo key
- Filter: `balance >= 10 && status = 'pending_setup'`
- Response:
  ```json
  [
    {
      "userId": "uuid",
      "username": "mr_mmon",
      "balance": 15.50,
      "exchange": "aster",
      "publicKey": "ABC...XYZ",
      "status": "pending_setup"
    }
  ]
  ```

**2. `POST /admin/exchange-keys`**
- Description: Admin tạo API key cho user
- Request:
  ```json
  {
    "userId": "uuid",
    "exchange": "aster",
    "config": {
      "api_key": "...",
      "secret_key": "...",
      "api_url": "https://fapi.asterdex.com"
    }
  }
  ```
- Logic:
  - Validate config structure
  - Encrypt keys (AES-256)
  - Save to `exchange_keys` table
  - Update `hedging_configs.status = 'farming'`
  - Telegram notify user: "Farming started!"
- Response:
  ```json
  {
    "success": true,
    "message": "API key created, farming started"
  }
  ```

**3. `GET /admin/exchange-keys/:userId`**
- Description: View current keys (masked)
- Response:
  ```json
  {
    "exchange": "aster",
    "apiKey": "abc***xyz",
    "createdAt": "2025-11-26T10:00:00Z"
  }
  ```

#### Files to Create:
```
manager-server/src/modules/api/controllers/
  └── admin.controller.ts

manager-server/src/modules/business/services/
  └── admin.service.ts
```

---

### Task 2.7: Admin Panel (Option A - Telegram Bot)
**Duration:** 0.5 day  
**Status:** ⏳ Pending

#### Deliverables:
- [ ] Telegram Bot Commands:
  - `/pending` - List users chờ setup
  - `/addkey` - Start key creation flow
  - `/balance [username]` - Check balance
- [ ] Interactive flow:
  ```
  Admin: /addkey @mr_mmon aster
  Bot: Send me the API config in JSON format
  Admin: {"api_key": "...", "secret_key": "..."}
  Bot: ✅ Key created! Farming started for @mr_mmon
  ```

#### Files to Create:
```
manager-server/src/modules/business/services/
  └── telegram-commands.service.ts
```

---

### Task 2.8: Status Flow Implementation
**Duration:** 0.5 day  
**Status:** ⏳ Pending

#### State Machine:
```
pending_wallet → (deposit ≥ $10) → pending_setup
pending_setup → (admin create key) → farming
farming → (stop/error) → stopped
```

#### Triggers:
1. **pending_wallet → pending_setup**
   - Event: Webhook deposit detected
   - Condition: `balance >= 10`
   
2. **pending_setup → farming**
   - Event: Admin POST `/admin/exchange-keys`
   - Condition: Valid config submitted

#### Files to Modify:
```
manager-server/src/modules/business/services/
  └── hedging.service.ts
```

---

## ✅ Acceptance Criteria

### User Flow:
- [ ] User login → Tự động có wallet
- [ ] User chọn sàn → Status = `pending_wallet`
- [ ] User deposit ≥ $10 → Status = `pending_setup`, Admin notified
- [ ] Admin tạo key → Status = `farming`
- [ ] Dashboard hiển thị status đúng

### Admin Flow:
- [ ] Admin nhận Telegram khi user mới
- [ ] Admin nhận Telegram khi balance ready
- [ ] Admin có tools (bot/panel) để tạo key
- [ ] Tạo key thành công → User được notify

---

## 🧪 Test Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC1: Select Exchange | Login → Setup → Select Aster | Status = pending_wallet, wallet displayed |
| TC2: Deposit Detection | Nạp $15 vào ví | Balance updated, Telegram notify admin |
| TC3: Admin Create Key | POST /admin/exchange-keys | Status = farming, user notified |
| TC4: Invalid Config | Submit wrong JSON | 400 error, status unchanged |
| TC5: Duplicate Key | Try create key 2 lần | 409 conflict error |

---

## 🐛 Known Issues

### Issue 1: Balance Update Delay
**Problem:** Solana Devnet có delay ~1-2 phút  
**Workaround:** Set polling interval = 30s  
**Status:** Acceptable for MVP

---

## 📦 Dependencies

### New Packages:
```bash
# manager-server
pnpm add crypto-js @types/crypto-js  # For encryption

# ui
pnpm add qrcode.react  # For QR code display
```

---

## 🚀 Deployment Notes

### Environment Variables to Add:
```bash
# manager-server
ENCRYPTION_KEY=<32-byte-hex-string>

# wallet-server
MANAGER_SERVER_URL=http://localhost:2567
WEBHOOK_SECRET=<shared-secret>
```

---

## 🔗 Related Documentation

- [SPECIFICATION.md](../SPECIFICATION.md) - Section 3.3 (Edge Cases)
- [API.md](../API.md) - Admin endpoints
- [Solana Worker Setup](../../wallet-server/README.md)

---

## 📝 Notes for Phase 3

**Handoff Items:**
- Database schema hoàn chỉnh với user_wallets, hedging_configs
- Exchange selection flow tested
- Admin key creation working
- Status transitions stable

**Prerequisites for Phase 3:**
- Perps Server cần nhận API keys từ Manager
- Manager cần trigger farming API
- Stats API cần endpoint để track volume

---

**Target Completion:** 2025-11-28  
**Current Progress:** 50%
