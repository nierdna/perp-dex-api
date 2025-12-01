# Hướng dẫn Triển khai Luồng Nạp Tiền (Deposit Flow)

## Tổng quan
Hệ thống đã được cập nhật để hỗ trợ luồng nạp tiền hoàn chỉnh với khả năng chuyển nhượng ví (wallet transfer).

## Các thay đổi đã thực hiện

### 1. Database Schema (Manager Server)
- ✅ Thêm bảng `user_wallets`: Lưu địa chỉ ví của người dùng
- ✅ Thêm bảng `wallet_transfer_history`: Theo dõi lịch sử chuyển nhượng ví
- ✅ Thêm cột `balance` vào bảng `users`: Lưu số dư người dùng

### 2. Backend Services (Manager Server)
- ✅ `WalletIntegrationService`:
  - `getUserWallets()`: Lấy danh sách ví của user
  - `createWallet()`: Tạo ví mới và đồng bộ từ wallet-server
  - `transferWallet()`: Chuyển quyền sở hữu ví
  
- ✅ `DepositWebhookService`:
  - Cập nhật logic xử lý deposit để cộng tiền vào `users.balance`
  - Hỗ trợ trường hợp ví đã được chuyển nhượng

### 3. API Endpoints (Manager Server)
- ✅ `GET /wallets/me`: Lấy danh sách ví của user hiện tại
- ✅ `POST /wallets/transfer`: Chuyển quyền sở hữu ví

### 4. Wallet Server Updates
- ✅ Thêm method `transferWallet()` trong `WalletService`
- ✅ Thêm endpoint `PATCH /wallets/:address/transfer`

### 5. Frontend (UI)
- ✅ Component `DepositModal`: Hiển thị địa chỉ ví để nạp tiền
- ✅ Tích hợp vào Dashboard với nút "Deposit"
- ✅ Hiển thị số dư người dùng từ API

## Cách chạy Migration

### Bước 1: Chạy Migration SQL
\`\`\`bash
cd manager-server
psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.owzloztqmyfxupqtccdw -d dex_point -f migrations/001_add_wallet_management.sql
\`\`\`

Hoặc nếu đang dùng DB_SYNC=1, TypeORM sẽ tự động tạo bảng khi khởi động.

### Bước 2: Kiểm tra Database
\`\`\`sql
-- Kiểm tra bảng đã được tạo
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_wallets', 'wallet_transfer_history');

-- Kiểm tra cột balance
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'balance';
\`\`\`

## Luồng hoạt động

### 1. Tạo ví cho User
1. User đăng nhập vào hệ thống
2. Manager-server gọi `WalletIntegrationService.getUserWallets(userId)`
3. Nếu chưa có ví, service gọi sang wallet-server để tạo
4. Wallet-server tạo 3 ví: Solana, Base, Arbitrum
5. Manager-server lưu thông tin ví vào bảng `user_wallets`

### 2. Nạp tiền (Deposit)
1. User click nút "Deposit" trên UI
2. Modal hiển thị địa chỉ ví (lấy từ `GET /wallets/me`)
3. User chuyển USDC/USDT vào địa chỉ
4. Wallet-server phát hiện giao dịch và gửi webhook
5. Manager-server nhận webhook:
   - Tìm owner hiện tại của ví (từ `user_wallets`)
   - Cộng tiền vào `users.balance`
   - Lưu log vào `deposit_transactions`

### 3. Chuyển nhượng ví (Transfer Wallet)
1. Admin/User gọi API `POST /wallets/transfer`
2. Manager-server:
   - Cập nhật `user_id` trong `user_wallets`
   - Tạo record trong `wallet_transfer_history`
3. Wallet-server cũng cập nhật ownership (nếu cần)

## Testing

### Test 1: Tạo ví
\`\`\`bash
curl -X GET http://localhost:2567/wallets/me \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\`

### Test 2: Simulate Deposit Webhook
\`\`\`bash
curl -X POST http://localhost:2567/webhooks/deposit-callback \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: sha256=SIGNATURE" \\
  -d '{
    "data": {
      "deposit_id": "test-123",
      "user_id": "USER_ID",
      "wallet_address": "WALLET_ADDRESS",
      "chain": "Base",
      "chain_id": 8453,
      "token": {"symbol": "USDC", "address": "0x..."},
      "amount": "100.00",
      "tx_hash": "0x...",
      "detected_at": "2025-12-01T10:00:00Z"
    }
  }'
\`\`\`

### Test 3: Check Balance
\`\`\`bash
curl -X GET http://localhost:2567/auth/me \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\`

## Lưu ý quan trọng

1. **Wallet Transfer**: Khi ví được chuyển nhượng, deposit mới sẽ được cộng vào tài khoản của owner mới.

2. **Security**: 
   - Endpoint `/wallets/transfer` yêu cầu JWT authentication
   - Webhook signature phải được verify

3. **Database Sync**: 
   - Hiện tại đang bật `DB_SYNC=1` nên TypeORM tự động tạo bảng
   - Production nên tắt và dùng migration thủ công

4. **Balance Type**: 
   - Balance được lưu dưới dạng `DECIMAL(20, 8)`
   - TypeORM trả về dạng `string` để tránh mất độ chính xác

## Các bước tiếp theo (Optional)

1. ✅ Thêm API rút tiền (Withdrawal)
2. ✅ Thêm lịch sử giao dịch (Transaction History)
3. ✅ Thêm notification khi có deposit thành công
4. ✅ Thêm QR Code cho địa chỉ ví
5. ✅ Thêm validation cho số tiền tối thiểu/tối đa
