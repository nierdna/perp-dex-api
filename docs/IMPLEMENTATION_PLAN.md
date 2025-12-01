# Implementation Plan - Deposit Flow Integration

This plan outlines the steps to integrate the deposit flow between `manager-server` and `wallet-server`, and update the UI to support deposits.

## 1. Database Schema Updates (Manager Server)

### 1.1. Create `UserWalletEntity`
Create a new entity `UserWalletEntity` to store user wallet addresses in `manager-server`.
- **Table**: `user_wallets`
- **Columns**:
    - `id` (UUID, PK)
    - `user_id` (UUID, FK -> users)
    - `chain_key` (String: 'solana', 'base', 'arbitrum')
    - `chain_type` (String: 'EVM', 'SOLANA')
    - `address` (String)
    - `is_active` (Boolean, default: true)
    - `created_at`, `updated_at`

### 1.3. Create `WalletTransferHistoryEntity`
Track ownership changes when users sell/transfer wallets.
- **Table**: `wallet_transfer_history`
- **Columns**:
    - `id` (UUID, PK)
    - `wallet_address` (String)
    - `from_user_id` (UUID)
    - `to_user_id` (UUID)
    - `transferred_at` (Timestamp)
    - `reason` (String, optional)

### 1.2. Update `UserEntity`
Add a balance field to `UserEntity` to track user funds.
- **Columns**:
    - `balance` (Decimal, default: 0)

## 2. Backend Logic Implementation (Manager Server)

### 2.1. Update `WalletIntegrationService`
- **Method `createWallet(userId)`**:
    - Call `wallet-server` API (`POST /v1/wallets`).
    - Parse the response (containing Solana, Base, Arbitrum wallets).
    - Save/Upsert these wallets into `UserWalletEntity`.
    - Return the wallet details.
- **Method `getUserWallets(userId)`**:
    - Check local DB (`UserWalletEntity`).
    - If empty, call `createWallet(userId)`.
    - Return list of wallets.

### 2.3. Implement Wallet Transfer Logic
- **Service Method `transferWallet(address, newUserId)`**:
    - Verify wallet exists and belongs to current user (if applicable).
    - Update `user_id` in `user_wallets` table.
    - Create record in `wallet_transfer_history`.
    - **Sync with Wallet Server**: Call `wallet-server` to update ownership there too (to keep consistency).

### 2.4. Update `DepositWebhookService`
- **Method `handleDepositBusinessLogic`**:
    - Find user by `wallet_address` (using `UserWalletEntity`).
    - Update `UserEntity.balance` (increment by deposit amount).
    - Log the transaction (already implemented in `DepositTransactionEntity`).

### 2.3. Create `WalletController`
- **Path**: `/api/v1/wallets`
- **Endpoints**:
    - `POST /create`: Manually create wallets (idempotent).
    - `GET /me`: Get current user's wallets.

## 3. Frontend Implementation (UI)

### 3.1. Deposit Modal/Page
- Create a UI component to display user wallets.
- Fetch wallets using `GET /api/v1/wallets/me`.
- Display QR Code and Address for each chain (Solana, Base, Arbitrum).
- Add "Copy Address" button.

## 4. Verification
- Test creating a wallet via UI.
- Verify data in `user_wallets` table.
- Simulate a deposit webhook from `wallet-server`.
- Verify `users.balance` is updated.
