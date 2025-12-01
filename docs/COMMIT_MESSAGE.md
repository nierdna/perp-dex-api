feat: Implement deposit flow with wallet management and transfer support

## Backend Changes (Manager Server)

### Database Schema
- Add `user_wallets` table to store user wallet addresses
- Add `wallet_transfer_history` table to track ownership changes
- Add `balance` column to `users` table for USD balance tracking

### Services
- **WalletIntegrationService**: 
  - `getUserWallets()`: Fetch user wallets from local DB or create via wallet-server
  - `createWallet()`: Sync wallet creation with wallet-server
  - `transferWallet()`: Transfer wallet ownership with history tracking
  
- **DepositWebhookService**:
  - Update deposit logic to credit balance to current wallet owner
  - Support wallet transfer scenarios

### API Endpoints
- `GET /wallets/me`: Get current user's wallets
- `POST /wallets/transfer`: Transfer wallet ownership (requires auth)

### Module Updates
- Register new entities in DatabaseModule
- Add WalletIntegrationService to BusinessModule
- Import BusinessModule in AuthModule to resolve dependencies

## Backend Changes (Wallet Server)

### Services
- Add `transferWallet()` method to WalletService

### API Endpoints
- `PATCH /wallets/:address/transfer`: Update wallet ownership

## Frontend Changes (UI)

### Components
- **DepositModal**: Display wallet addresses with copy functionality
  - Shows Solana, Base, and Arbitrum addresses
  - Copy to clipboard feature
  - Chain icons and info

### Dashboard Updates
- Add "Deposit" button
- Display real-time user balance from API
- Integrate DepositModal

## Documentation
- Add migration SQL script
- Create comprehensive deployment guide

## Key Features
- ✅ Multi-chain wallet support (Solana, Base, Arbitrum)
- ✅ Automatic balance crediting on deposit
- ✅ Wallet ownership transfer with history
- ✅ Webhook signature verification
- ✅ Transaction idempotency
- ✅ User-friendly deposit UI

## Migration Required
Run `migrations/001_add_wallet_management.sql` or restart with DB_SYNC=1
