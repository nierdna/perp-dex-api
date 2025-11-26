# Tổng Kết: Fix Duplicate Deposit Detection

## 📋 Vấn Đề Ban Đầu

**Hiện tượng:**
- Deposits bị ghi nhận nhiều lần (duplicate)
- `previous_balance` trong bảng `deposits` luôn = 0
- Dẫn đến `amount` = `new_balance` thay vì = `new_balance - previous_balance`

**Ví dụ:**
```
Deposit 1: amount=0.015, previous_balance=0, new_balance=0.015
Deposit 2: amount=0.016, previous_balance=0, new_balance=0.016  ← SAI! Phải là 0.001
```

---

## 🔍 Nguyên Nhân Gốc Rễ

### 1. **Race Condition trong Flow Cũ**

```typescript
// Flow CŨ (SAI):
async checkTokenBalance() {
    const currentBalance = await getFromBlockchain();
    const previousBalance = await getFromDB();
    
    if (currentBalance > previousBalance) {
        await recordDeposit();           // 1. Lưu deposit
        await sendWebhook();             // 2. Gửi webhook (CÓ THỂ CHẬM!)
        await updateWalletBalance();     // 3. Update balance (SAU webhook)
    }
}
```

**Vấn đề:** Nếu scan tiếp theo chạy TRƯỚC KHI `updateWalletBalance()` hoàn thành → Đọc `previous_balance` cũ (= 0) → Duplicate!

### 2. **TypeORM Decimal Type Mismatch**

```typescript
// Entity định nghĩa SAI:
@Column({ type: 'decimal' })
balance: number;  // ❌ TypeORM decimal trả về STRING!

// Code update SAI:
await update({ balance: 0.016 });  // ❌ TypeORM không lưu được number vào decimal
// → Balance vẫn = 0 trong DB!
```

### 3. **Blockchain API Trả Về 0 Tạm Thời**

```
09:25:00 - Deposit 0.1 USDT → Balance = 0.1 ✅
09:25:30 - Scan lại → API trả về 0 (do rate limit 429)
09:25:30 - Code update balance = 0 ❌ MẤT DỮ LIỆU!
09:39:00 - Deposit mới → previous_balance = 0 (vì đã bị ghi đè)
```

### 4. **Query Không Có Ordering**

```typescript
// Nếu có nhiều bản ghi trùng:
const balanceRecord = await findOne({ where: { walletId, token } });
// → Lấy bản ghi đầu tiên (có thể là bản ghi CŨ = 0)
```

---

## ✅ Giải Pháp Đã Triển Khai

### **Fix 1: Atomic Database Update (Ưu tiên DB trước Webhook)**

```typescript
// Flow MỚI (ĐÚNG):
async checkTokenBalance() {
    const currentBalance = await getFromBlockchain();
    const previousBalance = await getFromDB();
    
    if (currentBalance > previousBalance) {
        // 1. LƯU DB NGAY (atomic)
        await saveDepositToDatabase({
            deposit: { ... },
            walletBalance: { balance: currentBalance }  // Cập nhật cùng lúc!
        });
        
        // 2. GỬI WEBHOOK BẤT ĐỒNG BỘ (không block)
        this.sendNotifications(...).catch(err => log(err));
        
        return;  // Thoát sớm, không chạy tiếp
    }
}
```

**Lợi ích:**
- `wallet_balances` được update NGAY sau khi detect deposit
- Scan tiếp theo đọc được balance mới → Không duplicate
- Webhook chậm không ảnh hưởng đến DB consistency

### **Fix 2: TypeORM Decimal Type Correction**

```typescript
// Entity ĐÚNG:
@Column({ type: 'decimal', precision: 20, scale: 6 })
balance: string;  // ✅ TypeORM decimal trả về STRING

// Code update ĐÚNG:
await update({ balance: String(0.016) });  // ✅ Convert sang string
```

### **Fix 3: Safety Check Chống API Lỗi**

```typescript
// Không update balance = 0 nếu trước đó > 0
const shouldUpdate = currentBalance > 0 || Number(balanceRecord.balance) === 0;

if (shouldUpdate) {
    await update({ balance: String(currentBalance) });
} else {
    this.logger.warn(`[SKIP UPDATE] API returned 0 but previous was ${balanceRecord.balance}`);
}
```

**Lợi ích:**
- Bảo vệ dữ liệu khỏi bị ghi đè khi API tạm thời lỗi
- Log warning để admin biết và kiểm tra

### **Fix 4: Query với Ordering**

```typescript
const balanceRecord = await findOne({
    where: { walletId, chainId, token },
    order: { updated_at: 'DESC' }  // ✅ Luôn lấy bản ghi mới nhất
});
```

### **Fix 5: Cleanup Redundant Code**

```typescript
// XÓA: Manual date management
lastUpdatedAt: new Date()  // ❌ Không cần

// DÙNG: TypeORM auto-update
@UpdateDateColumn()
updated_at: Date;  // ✅ Tự động update
```

---

## 📊 Kết Quả

### **Trước khi fix:**
```
[09:12:00] Deposit: amount=0.026, previous=0, new=0.026
[09:13:30] Deposit: amount=0.027, previous=0, new=0.027  ← DUPLICATE!
[09:16:00] Deposit: amount=0.028, previous=0, new=0.028  ← DUPLICATE!
```

### **Sau khi fix:**
```
[09:39:00] Deposit: amount=0.032, previous=0, new=0.032
[Scan tiếp] Balance in DB = 0.032 ✅
[Nạp thêm 0.001]
[Next deposit] amount=0.001, previous=0.032, new=0.033 ✅ ĐÚNG!
```

---

## 🚀 Cách Test

### **1. Test Balance Update:**
```bash
# Nạp tiền lần 1
# Check DB:
SELECT balance FROM wallet_balances WHERE token='USDC';
# → Phải thấy balance = "0.032" (string)

# Nạp tiền lần 2 (sau 30s)
# Check logs:
[BALANCE CHECK] balanceRecord.balance: "0.032"
[DEPOSIT] previous_balance: 0.032 ✅
```

### **2. Test API Error Protection:**
```bash
# Giả lập API lỗi (tạm thời trả về 0)
# Check logs:
[SKIP UPDATE] API returned 0 but previous was 0.100000
# → Balance KHÔNG bị ghi đè!
```

### **3. Test No Duplicates:**
```sql
-- Kiểm tra không có bản ghi trùng
SELECT wallet_id, chain_id, token, COUNT(*) 
FROM wallet_balances 
GROUP BY wallet_id, chain_id, token 
HAVING COUNT(*) > 1;
-- → Phải trả về 0 rows
```

---

## 📝 Migration Notes

### **Database Changes:**

1. **Xóa column cũ (optional):**
```sql
ALTER TABLE wallet_balances DROP COLUMN IF EXISTS last_updated_at;
```

2. **Cleanup duplicates:**
```sql
DELETE FROM wallet_balances
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY wallet_id, chain_id, token
            ORDER BY updated_at DESC
        ) AS rn
        FROM wallet_balances
    ) sub
    WHERE rn > 1
);
```

### **Code Changes:**
- ✅ `wallet-balance.entity.ts`: Xóa `lastUpdatedAt`, đổi `balance: string`
- ✅ `deposit-monitoring.service.ts`: Refactor flow, thêm safety checks
- ✅ Xóa tất cả `lastUpdatedAt: new Date()`

---

## 🔮 Future Improvements

### **1. Transaction Signature Tracking**
```typescript
@Entity('deposits')
class DepositEntity {
    @Column()
    signature: string;  // Solana tx signature hoặc EVM tx hash
    
    @Index(['walletId', 'chainId', 'signature'], { unique: true })
}
```

**Lợi ích:** Prevent duplicates ở DB level, không phụ thuộc vào balance comparison.

### **2. Transaction History Scanning**
```typescript
// Thay vì so sánh balance, quét transaction history:
const txs = await getSignaturesForAddress(wallet, { limit: 100 });
for (const tx of txs) {
    if (!await depositExists(tx.signature)) {
        await recordDeposit(tx);
    }
}
```

**Lợi ích:** 
- Chính xác 100%
- Không bỏ sót deposits
- Detect được multiple deposits trong cùng 1 scan window

### **3. Explicit Database Transactions**
```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.startTransaction();
try {
    await queryRunner.manager.save(deposit);
    await queryRunner.manager.update(WalletBalance, ...);
    await queryRunner.commitTransaction();
} catch (err) {
    await queryRunner.rollbackTransaction();
}
```

**Lợi ích:** Đảm bảo atomicity mạnh mẽ hơn.

---

## 📚 Related Files

- `/wallet-server/src/modules/worker/services/deposit-monitoring.service.ts`
- `/wallet-server/src/modules/database/entities/wallet-balance.entity.ts`
- `/wallet-server/src/modules/database/entities/deposit.entity.ts`
- `/wallet-server/DEPOSIT_FIX_CHANGELOG.md`

---

## ✅ Checklist Deployment

- [x] Code đã được test trên dev
- [x] Logs hiển thị `[BALANCE CHECK]` và `[NO DEPOSIT]` đúng
- [x] Database cleanup duplicates
- [x] Server restart với code mới
- [ ] Monitor logs trong 24h đầu
- [ ] Verify không có duplicate deposits mới
- [ ] Document cho team

---

**Ngày hoàn thành:** 2025-11-26  
**Tác giả:** AI Assistant + User  
**Status:** ✅ RESOLVED
