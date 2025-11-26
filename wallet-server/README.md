# Wallet Server

Dịch vụ **quản lý ví đa chuỗi** (Multi-chain Wallet Service) hỗ trợ **Solana** và **EVM chains** (Base, Arbitrum), với hệ thống **deposit monitoring tối ưu** cho 1000+ wallets.

**Tính năng chính:**
- ✅ Tạo và quản lý ví Solana & EVM
- ✅ Deposit monitoring với priority queue system
- ✅ RPC rate limiting và batch processing
- ✅ Webhook notifications cho deposits
- ✅ Comprehensive monitoring và metrics

> ⚠️ **Internal Microservice** - Không expose private keys ra ngoài  
> Chỉ hệ thống Backend được phép truy cập qua API Key authentication

---

## 🚀 Tính năng

### Wallet Management
- Tạo ví **Solana** (Ed25519) và **EVM** (secp256k1)
- Private key **mã hóa AES-256-GCM** với `MASTER_KEY`
- Hỗ trợ multi-chain: Solana, Base (8453), Arbitrum (42161)
- Một user có thể có nhiều ví (Solana + EVM)

### Deposit Monitoring (Optimized for 1000+ Wallets)
- **Priority Queue System**: HIGH/MEDIUM/LOW priority dựa trên hoạt động
- **Batch Processing**: Query database theo batches để tối ưu memory
- **RPC Rate Limiting**: Tránh bị chặn bởi RPC providers (100 req/s)
- **Auto-downgrade**: Tự động giảm priority cho wallets không hoạt động
- **90% reduction** trong RPC calls so với cách quét thông thường

### Security & Monitoring
- API Key authentication
- IP whitelist
- Rate limiting
- Audit logs
- Health check endpoints với metrics chi tiết

---

## 🧩 API Reference

### 🔸 POST `/api/v1/wallets` – Tạo ví mới

**Request**
```json
{
  "user_id": "user_123456"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "user_id": "user_123456",
    "wallets": {
      "solana": {
        "chain": "Solana Mainnet",
        "chain_id": 901,
        "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
      },
      "evm": {
        "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
        "chains": [
          {
            "chain": "Base",
            "chain_id": 8453,
            "explorer": "https://basescan.org/address/0xAbCDef..."
          },
          {
            "chain": "Arbitrum One",
            "chain_id": 42161,
            "explorer": "https://arbiscan.io/address/0xAbCDef..."
          }
        ]
      }
    }
  }
}
```

**Ghi chú:**
- Tự động tạo cả ví Solana và EVM
- EVM address giống nhau trên tất cả EVM chains
- Private key không bao giờ được trả ra

---

### 🔸 GET `/api/v1/wallets/:userId` – Lấy thông tin ví

**Response**
```json
{
  "success": true,
  "data": {
    "user_id": "user_123456",
    "wallets": {
      "solana": { ... },
      "evm": { ... }
    }
  }
}
```

---

### 🔸 POST `/api/v1/webhooks/register` – Đăng ký webhook

**Request**
```json
{
  "url": "https://your-domain.com/webhooks/deposits",
  "events": ["deposit.detected"],
  "secret": "your-webhook-secret"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "webhook_123",
    "url": "https://your-domain.com/webhooks/deposits",
    "is_active": true
  }
}
```

---

### 🔸 GET `/health/scan-metrics` – Deposit scan metrics

**Response**
```json
{
  "success": true,
  "data": {
    "scanMetrics": {
      "totalScans": 120,
      "totalWalletsScanned": 12000,
      "averageScanDuration": "12.34s",
      "totalDepositsDetected": 45,
      "errorRate": "0.83%",
      "avgRpcCallsPerScan": 500
    },
    "rpcMetrics": {
      "queueLength": 0,
      "requestsPerSecond": 85,
      "maxRequestsPerSecond": 100,
      "totalErrors": 12,
      "errorRate": "0.02%"
    }
  }
}
```

---

### 🔸 GET `/health/status` – System health

**Response**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "memory": {
      "used": 245,
      "total": 512,
      "unit": "MB"
    },
    "lastScan": "2025-11-26T10:00:00Z",
    "rpcQueueLength": 0
  }
}
```

---

## 🧱 Database Schema

### Core Tables

```typescript
// User Wallets
user_wallets {
  id: uuid
  user_id: string
  wallet_type: enum('SOLANA', 'EVM')
  address: string (unique)
  enc_priv_key: bytea (encrypted)
  enc_meta: bytea (optional)
  custodian: string (default: 'aes_gcm')
  last_activity_at: timestamp (nullable)
  scan_priority: enum('high', 'medium', 'low')
  created_at: timestamp
  updated_at: timestamp
}

// Wallet Balances (Cache)
wallet_balances {
  id: uuid
  wallet_id: uuid (FK)
  chain_id: int
  token: string
  balance: decimal
  created_at: timestamp
  updated_at: timestamp
}

// Deposits
deposits {
  id: uuid
  wallet_id: uuid (FK)
  user_id: string
  chain_id: int
  token_address: string
  token_symbol: string
  amount: decimal
  previous_balance: decimal
  new_balance: decimal
  detected_at: timestamp
  webhook_sent: boolean
  webhook_sent_at: timestamp
}

// Webhooks
webhooks {
  id: uuid
  url: string
  events: json
  secret: string (encrypted)
  is_active: boolean
  created_at: timestamp
}
```

---

## 🚀 Quick Start

### Yêu cầu

- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6
- pnpm

### Cài đặt

```bash
# 1. Clone repository
git clone <repo-url>
cd wallet-server

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp .env.sample .env
nano .env  # Configure required variables

# 4. Start database
docker-compose up -d postgres redis

# 5. Run migrations (auto with DB_SYNC=1)
# Database schema will be auto-created on first run

# 6. Start server
pnpm start:dev
```

---

## 🔧 Environment Variables

### Required

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=wallet_server
DB_SYNC=1  # Auto-sync schema (dev only)

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DATABASE=1

# Security
MASTER_KEY=your-super-secret-master-key-min-32-chars
WALLET_WEBHOOK_SECRET=your-webhook-secret-key

# RPC URLs
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Telegram Notifications (Optional)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-chat-id
```

### Deposit Scanning Configuration

```bash
# Batch Processing
SCAN_BATCH_SIZE=50
SCAN_BATCH_DELAY_MS=1000

# Priority-based Scan Intervals (seconds)
SCAN_HIGH_PRIORITY_INTERVAL=30
SCAN_MEDIUM_PRIORITY_INTERVAL=120
SCAN_LOW_PRIORITY_INTERVAL=300

# RPC Rate Limiting
RPC_MAX_REQUESTS_PER_SECOND=100
```

---

## 📊 Deposit Monitoring Architecture

### Priority Queue System

| Priority | Scan Interval | Condition |
|----------|---------------|-----------|
| **HIGH** | 30 seconds | Có deposit trong 1 giờ qua |
| **MEDIUM** | 2 minutes | Có deposit trong 24 giờ qua |
| **LOW** | 5 minutes | Không hoạt động > 24 giờ |

### Auto-downgrade Logic

- Cron job chạy mỗi 10 phút
- HIGH → MEDIUM sau 1 giờ không hoạt động
- MEDIUM → LOW sau 24 giờ không hoạt động
- Khi có deposit → tự động upgrade lên HIGH

### Performance Metrics

**Với 1000 wallets:**

| Metric | Before Optimization | After Optimization |
|--------|--------------------|--------------------|
| RPC calls/scan | 7,500 | ~750 (90% ↓) |
| Scan duration | 25+ minutes | < 30 seconds |
| Memory usage | High (all wallets loaded) | Low (batch pagination) |
| Rate limit hits | Frequent | None |

---

## 🔒 Security

### Private Key Protection
- Private keys **chỉ lưu dạng mã hóa** trong DB (AES-256-GCM)
- `MASTER_KEY` phải >= 32 characters
- Không log hoặc expose private key
- Audit log cho mọi thao tác nhạy cảm

### API Security
- **API Key Authentication**: Required cho mọi request
- **Rate Limiting**: 60 requests/minute (production)
- **IP Whitelist**: (Optional) Chỉ cho phép IP được cấu hình

### Webhook Security
- HMAC signature verification
- Secret key encryption trong database
- Retry mechanism với exponential backoff

---

## 🩺 Monitoring & Observability

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Basic health check |
| `GET /health/check-db` | Database connection check |
| `GET /health/scan-metrics` | Deposit scan performance metrics |
| `GET /health/status` | System status (uptime, memory, RPC queue) |

### Metrics Tracked

**Scan Metrics:**
- Total scans performed
- Average scan duration
- Total wallets scanned
- Total deposits detected
- Error rate

**RPC Metrics:**
- Requests per second
- Queue length
- Total requests processed
- Error rate

---

## 🧠 Usage Examples

### Create Wallet

```bash
curl -X POST http://localhost:3000/api/v1/wallets \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123456"}'
```

### Register Webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/register \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhooks/deposits",
    "events": ["deposit.detected"],
    "secret": "your-webhook-secret"
  }'
```

### Check Scan Metrics

```bash
curl http://localhost:3000/health/scan-metrics
```

---

## 📦 Deployment

### Docker

```bash
# Build image
docker build -t wallet-server:latest .

# Run container
docker run --env-file .env -p 3000:3000 wallet-server:latest
```

### Production Checklist

- [ ] Set `DB_SYNC=0` (use migrations instead)
- [ ] Configure production RPC URLs (Alchemy, Infura)
- [ ] Set strong `MASTER_KEY` (>= 32 chars)
- [ ] Enable IP whitelist
- [ ] Setup monitoring (Prometheus + Grafana)
- [ ] Configure Telegram alerts
- [ ] Backup database daily
- [ ] Rotate `MASTER_KEY` every 90 days

---

## 🔐 Operational Rules

- Mỗi `user_id` có thể có nhiều ví (1 Solana + 1 EVM)
- EVM address giống nhau trên tất cả EVM chains
- Deposit scan chạy mỗi 30 giây (configurable)
- Wallet priority tự động điều chỉnh dựa trên hoạt động
- Backup database hàng ngày (encrypted private keys)
- Monitor RPC usage để tránh vượt quá rate limit

---

## 📚 Documentation

- `QUICK_START.md` - Hướng dẫn chạy nhanh
- `API_KEY_SETUP.md` - Setup API keys
- `TESTING_GUIDE.md` - Testing deposits
- `INTEGRATION_GUIDE.md` - Tích hợp webhook

---

## 🗺️ Roadmap

- [x] Multi-chain support (Solana + EVM)
- [x] Deposit monitoring với priority queue
- [x] RPC rate limiting
- [x] Webhook notifications
- [x] Comprehensive monitoring
- [ ] Transaction signing API
- [ ] Batch balance queries
- [ ] Key rotation automation
- [ ] Multi-signature wallets
- [ ] Hardware wallet integration

---

## 🧾 License

**© 2025 LYNX Payment**  
Internal Service – Do not expose to end users.

---

## 🆘 Support

For issues or questions:
- Check documentation in `/docs`
- Review health metrics at `/health/scan-metrics`
- Check logs for detailed error messages
  
Các API chính gồm:
- **Tạo ví mới** cho user.
- **Kiểm tra số dư ví** (ETH + ERC20 token).

> ⚠️ Đây là service nội bộ (internal microservice). Không bao giờ trả về private key qua API.  
> Chỉ hệ thống Backend (NestJS) được phép truy cập qua xác thực JWT nội bộ.

---

## 🚀 Tính năng

- Tạo ví EVM (EOA) theo chuẩn `secp256k1` dùng thư viện `ethers`.
- Private key được **mã hoá bằng AES-256-GCM** với `MASTER_KEY`.
- Hỗ trợ nhiều network: Ethereum, Base, Arbitrum, Optimism…
- Truy vấn số dư ETH và token ERC-20 từ RPC.
- Bảo mật với JWT, IP allowlist, rate limit.
- Audit log cho mọi hành động nhạy cảm.

## 🧩 API Reference

### 🔸 POST `/v1/wallets` – Tạo ví mới

**Request**
```json
{
  "user_id": "user_123456"
}
```

**Response**
```json
{
  "wallet_id": "d1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33",
  "user_id": "user_123456",
  "chain_id": 8453,
  "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
  "created_at": "2025-10-27T08:00:00Z"
}
```

**Ghi chú**
- Nếu ví đã tồn tại, trả 200 cùng địa chỉ hiện có.
- Private key không bao giờ được trả ra.

---

### 🔸 GET `/v1/wallets/balance`

Tham số: `user_id` hoặc `address`  
Ví dụ:  
`/v1/wallets/balance?user_id=user_123456`  
hoặc  
`/v1/wallets/balance?address=0x1234...`

**Response**
```json
{
  "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
  "chain_id": 8453,
  "native": {
    "symbol": "ETH",
    "decimals": 18,
    "wei": "123450000000000000",
    "human": "0.12345"
  },
  "tokens": [
    {
      "symbol": "USDC",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "decimals": 6,
      "raw": "25000000",
      "human": "25.000000"
    }
  ],
  "as_of": "2025-10-27T08:01:30Z"
}
```

---

## 🧱 Lược đồ cơ sở dữ liệu (Prisma)

```prisma
model UserWallet {
  id             String   @id @default(uuid())
  userId         String   @unique
  chainId        Int
  address        String   @unique
  encPrivKey     Bytes
  encMeta        Bytes?
  custodian      String   // aes_gcm
  createdAt      DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(uuid())
  action    String
  userId    String?
  address   String?
  metadata  Json?
  createdAt DateTime @default(now())
}
```

---

## 🚀 Quick Start

**Muốn chạy ngay?** → Xem `QUICK_START.md`

## 🧰 Chạy dự án

### Yêu cầu

- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6
- pnpm

### Cài đặt & Cấu hình

```bash
# 1. Cài đặt phụ thuộc
pnpm install

# 2. Tạo file .env từ mẫu
cp env.example.txt .env

# 3. Cấu hình các biến quan trọng trong .env
# MASTER_KEY: Khóa mã hóa private key (bắt buộc)
# IP_WHITELIST: Danh sách IP được phép truy cập (bắt buộc)
nano .env

# 4. Start server
pnpm start:dev  # Development
# hoặc
pnpm build && pnpm start:prod  # Production
```

### Cấu hình Environment Variables

**Bắt buộc:**

```bash
# Mã hóa private keys
MASTER_KEY=your-super-secret-master-key-change-this

# IP whitelist (comma-separated)
IP_WHITELIST=127.0.0.1,192.168.1.100

# JWT secret
JWT_SECRET_KEY=your-jwt-secret
```

### Cấu hình API Keys

**Development (Tự động):**
- Khi chạy lần đầu, 1 API key mặc định sẽ được tự động tạo
- Có thể set custom key trong `.env`: `DEFAULT_API_KEY=your-key-here`
- Nếu không set, dùng key mặc định: `mongker`
- Dùng ngay không cần setup thêm

**Production (Generate key mới):**

```bash
# 1. Generate API keys
cd scripts
pnpm install
pnpm run generate-api-key

# 2. Setup keys trong database
psql -U postgres -d wallet_server -f setup-api-keys.sql
# Hoặc làm theo hướng dẫn trong API_KEY_SETUP.md
```

**Chi tiết:** 
- Bảo mật: `WALLET_SETUP.md`
- API Keys: `API_KEY_SETUP.md`

### Docker

```bash
docker build -t wallets_server:latest .
docker run --env-file .env -p 8080:8080 wallets_server:latest
```

---

## 🔒 Bảo mật

- Private key **chỉ lưu dạng mã hoá** trong DB bằng AES-256-GCM với `MASTER_KEY`.  
- Không log hoặc expose private key.  
- **API Key Authentication**: Yêu cầu API key hợp lệ (lưu trong database) cho mọi request.
- **IP Whitelist**: Chỉ cho phép các IP được cấu hình trong `IP_WHITELIST` truy cập API.
- Rate limiting cho tất cả endpoints.
- Audit log chi tiết cho mọi thao tác nhạy cảm (tạo ví, lấy private key).

---

## 🩺 Healthcheck & Observability

| Endpoint | Mô tả |
|-----------|--------|
| `/healthz` | Kiểm tra tình trạng server (HTTP 200 nếu OK). |
| `/metrics` | (Tùy chọn) Prometheus metrics: latency, RPC, error count. |

---

## 🧠 Ví dụ sử dụng cURL

```bash
export API_KEY="wsk_your_generated_api_key_here"

# Tạo ví
curl -X POST http://localhost:3000/v1/wallets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123456"}'

# Lấy private key (admin only)
curl -X GET "http://localhost:3000/v1/wallets/private-key?user_id=user_123456" \
  -H "X-API-Key: $API_KEY"
```

---

## 📦 Deployment gợi ý

- **Database**: PostgreSQL (RDS/Aiven).
- **Key storage**: AES-256-GCM với MASTER_KEY (lưu trong environment variables).
- **RPC provider**: Alchemy, Infura, hoặc self-host.
- **Container**: Docker + Railway / Render / AWS ECS.
- **Monitoring**: Prometheus + Grafana hoặc Sentry.

---

## 🔐 Quy tắc vận hành

- Mỗi `user_id` chỉ có một ví duy nhất trên mỗi `CHAIN_ID`.
- Chạy healthcheck định kỳ 30s.
- Rotation `MASTER_KEY` mỗi 90 ngày (re-encrypt tất cả private keys trong DB).
- Backup DB hàng ngày (không chứa private key plaintext).
- Log mọi request tạo ví hoặc truy vấn balance.

---

## 🧾 License

**© 2025 Pre-TGE Platform**  
Internal Service – Do not expose to end users.  
Không public private key, không sử dụng ngoài phạm vi nội bộ.

---

## 🗺️ Roadmap

- [ ] Hỗ trợ multi-chain (Arbitrum, Optimism, Solana module riêng)
- [ ] Batch balance query
- [ ] Webhook khi số dư thay đổi
- [ ] Key rotation job (re-encrypt AES blob)
- [ ] Attestation proof: “No private key exposure”
