# Wallet Server Integration Guide

This guide describes how to integrate with the Wallet Server to create wallets and receive deposit notifications.

## Authentication

Most client-facing endpoints (creating wallets, registering webhooks) are **public** and do not require authentication.

Endpoints marked as **Admin Only** (like retrieving private keys) require the `X-API-Key` header.

```http
X-API-Key: your_admin_api_key
```

## 1. Creating a Wallet

To create a wallet for a user (or retrieve an existing one), call the `/v1/wallets` endpoint. This should be done when a user logs in or registers in your main application.

**Endpoint:** `POST /v1/wallets` (Public)

**Request Body:**

```json
{
  "user_id": "string" // Unique identifier for the user in your system
}
```

**Response:**

```json
{
  "solana": {
    "address": "SolanaWalletAddress...",
    "chain": "Solana Mainnet"
  },
  "evm": {
    "address": "0xEVMWalletAddress...",
    "chain": "EVM (Base, Arbitrum)"
  }
}
```

**Note:** The Wallet Server automatically monitors these wallets for deposits.

## 2. Registering a Webhook

To receive notifications when a deposit occurs, you must register a webhook endpoint.

**Endpoint:** `POST /v1/webhooks/register`

**Request Body:**

```json
{
  "url": "https://your-server.com/api/webhooks/deposit",
  "secret": "your_shared_secret" // Used to sign the webhook payload
}
```

**Response:**

```json
{
  "id": "webhook_id",
  "url": "https://your-server.com/api/webhooks/deposit",
  "active": true
}
```

## 3. Handling Webhooks

When a deposit is detected, the Wallet Server will send a `POST` request to your registered URL.

**Headers:**

- `X-Webhook-Signature`: HMAC-SHA256 signature of the payload using your secret.

**Payload:**

```json
{
  "deposit_id": "uuid",
  "user_id": "string",
  "wallet_id": "uuid",
  "wallet_address": "string",
  "chain": "Solana Mainnet",
  "chain_id": 901,
  "token": {
    "symbol": "USDC",
    "address": "TokenAddress...",
    "decimals": 6
  },
  "amount": "100.000000",
  "tx_hash": "TransactionHash...",
  "detected_at": "2023-10-27T10:00:00.000Z"
}
```

### Verifying Signature

You should verify the signature to ensure the request came from the Wallet Server.

```typescript
import * as crypto from 'crypto';

function verifySignature(payload: any, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  return calculatedSignature === signature;
}
```

## 4. Telegram Notifications

The Wallet Server can also send notifications to a Telegram channel. Configure the following environment variables in `wallet-server/.env`:

- `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token
- `TELEGRAM_ADMIN_CHAT_ID`: Chat ID to send notifications to
- `TELEGRAM_ADMIN_TOPIC`: (Optional) Topic ID for forums

---

# Hướng Dẫn Tích Hợp Wallet Server

Tài liệu này mô tả cách tích hợp với Wallet Server để tạo ví và nhận thông báo nạp tiền.

## Xác Thực (Authentication)

Hầu hết các endpoint dành cho client (tạo ví, đăng ký webhook) là **public** và không yêu cầu xác thực.

Các endpoint được đánh dấu là **Admin Only** (như lấy private key) mới yêu cầu header `X-API-Key`.

```http
X-API-Key: your_admin_api_key
```

## 1. Tạo Ví (Creating a Wallet)

Để tạo ví cho user (hoặc lấy ví đã tồn tại), gọi endpoint `/v1/wallets`. Việc này nên được thực hiện khi user đăng nhập hoặc đăng ký trong ứng dụng chính của bạn.

**Endpoint:** `POST /v1/wallets` (Public)

**Request Body:**

```json
{
  "user_id": "string" // ID duy nhất của user trong hệ thống của bạn
}
```

**Response:**

```json
{
  "solana": {
    "address": "SolanaWalletAddress...",
    "chain": "Solana Mainnet"
  },
  "evm": {
    "address": "0xEVMWalletAddress...",
    "chain": "EVM (Base, Arbitrum)"
  }
}
```

**Lưu ý:** Wallet Server sẽ tự động theo dõi các ví này để phát hiện nạp tiền.

## 2. Đăng Ký Webhook

Để nhận thông báo khi có tiền nạp vào, bạn cần đăng ký một webhook endpoint.

**Endpoint:** `POST /v1/webhooks/register`

**Request Body:**

```json
{
  "url": "https://your-server.com/api/webhooks/deposit",
  "secret": "your_shared_secret" // Dùng để ký payload webhook
}
```

**Response:**

```json
{
  "id": "webhook_id",
  "url": "https://your-server.com/api/webhooks/deposit",
  "active": true
}
```

## 3. Xử Lý Webhook

Khi phát hiện nạp tiền, Wallet Server sẽ gửi một `POST` request tới URL bạn đã đăng ký.

**Headers:**

- `X-Webhook-Signature`: Chữ ký HMAC-SHA256 của payload, sử dụng secret key của bạn.

**Payload:**

```json
{
  "deposit_id": "uuid",
  "user_id": "string",
  "wallet_id": "uuid",
  "wallet_address": "string",
  "chain": "Solana Mainnet",
  "chain_id": 901,
  "token": {
    "symbol": "USDC",
    "address": "TokenAddress...",
    "decimals": 6
  },
  "amount": "100.000000",
  "tx_hash": "TransactionHash...",
  "detected_at": "2023-10-27T10:00:00.000Z"
}
```

### Xác Minh Chữ Ký (Verifying Signature)

Bạn nên xác minh chữ ký để đảm bảo request đến từ Wallet Server.

```typescript
import * as crypto from 'crypto';

function verifySignature(payload: any, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  return calculatedSignature === signature;
}
```

## 4. Thông Báo Telegram

Wallet Server cũng có thể gửi thông báo tới kênh Telegram. Cấu hình các biến môi trường sau trong `wallet-server/.env`:

- `TELEGRAM_BOT_TOKEN`: Token của Telegram Bot
- `TELEGRAM_ADMIN_CHAT_ID`: Chat ID để gửi thông báo
- `TELEGRAM_ADMIN_TOPIC`: (Tùy chọn) Topic ID nếu dùng forum group

