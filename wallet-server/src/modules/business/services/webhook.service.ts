import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { WebhookRepository, UserWalletRepository, SupportedTokenRepository } from '@/database/repositories';
import { EncryptionService } from './encryption.service';
import { WalletType } from '@/database/entities/user-wallet.entity';
import axios from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private webhookRepository: WebhookRepository,
        private encryptionService: EncryptionService,
        private userWalletRepository: UserWalletRepository,
        private supportedTokenRepository: SupportedTokenRepository,
    ) { }

    /**
     * Register a new webhook
     */
    async registerWebhook(url: string, secret: string) {
        this.logger.log(`📝 Registering webhook: ${url}`);

        // Check if webhook with this URL already exists
        const existing = await this.webhookRepository.findOne({ where: { url } });

        if (existing) {
            // Reset consecutive failures if re-registering
            await this.webhookRepository.update(existing.id, {
                consecutiveFailures: 0,
                isActive: true,
            });

            this.logger.log(`✅ Webhook already exists, reset failure counter for: ${url}`);

            return {
                webhook_id: existing.id,
                url: existing.url,
                is_active: true,
                consecutive_failures: 0,
                created_at: existing.created_at.toISOString(),
                message: 'Webhook registered successfully. Will be auto-deleted after 5 consecutive failures.',
            };
        }

        // Encrypt secret
        const { ciphertext } = this.encryptionService.encryptPrivateKey(secret);

        // Create new webhook
        const webhook = this.webhookRepository.create({
            url,
            encSecret: ciphertext,
            isActive: true,
            consecutiveFailures: 0,
        });

        const saved = await this.webhookRepository.save(webhook);

        this.logger.log(`✅ Webhook registered successfully: ${url}`);

        return {
            webhook_id: saved.id,
            url: saved.url,
            is_active: saved.isActive,
            consecutive_failures: saved.consecutiveFailures,
            created_at: saved.created_at.toISOString(),
            message: 'Webhook registered successfully. Will be auto-deleted after 5 consecutive failures.',
        };
    }

    /**
     * Send webhook notification for a deposit
     */
    async sendDepositNotification(depositData: any) {
        // Get all active webhooks
        const webhooks = await this.webhookRepository.find({
            where: { isActive: true },
        });

        if (webhooks.length === 0) {
            this.logger.warn('⚠️ No active webhooks to notify');
            return;
        }

        this.logger.log(`📤 Sending deposit notification to ${webhooks.length} webhook(s)`);

        // Send to all webhooks in parallel
        const promises = webhooks.map(webhook => this.sendWebhook(webhook, depositData));
        await Promise.allSettled(promises);
    }

    /**
     * Send webhook with retry logic
     */
    private async sendWebhook(webhook: any, depositData: any, maxRetries = 3) {
        const payload = {
            event: 'deposit',
            webhook_id: webhook.id,
            timestamp: new Date().toISOString(),
            data: depositData,
        };

        // Decrypt secret for signature
        const secret = this.encryptionService.decryptPrivateKey(webhook.encSecret);

        // Generate HMAC signature
        const signature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        payload['signature'] = signature;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.log(`📡 Sending webhook to ${webhook.url} (attempt ${attempt}/${maxRetries})`);

                const response = await axios.post(webhook.url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': `sha256=${signature}`,
                    },
                    timeout: 5000, // 5s timeout
                });

                if (response.status >= 200 && response.status < 300) {
                    // Success - reset consecutive failures
                    await this.webhookRepository.update(webhook.id, {
                        consecutiveFailures: 0,
                    });

                    this.logger.log(`✅ Webhook delivered successfully to ${webhook.url}`);
                    return { success: true, attempt };
                }
            } catch (error) {
                this.logger.error(`❌ Webhook delivery failed to ${webhook.url} (attempt ${attempt}): ${error.message}`);

                if (attempt === maxRetries) {
                    // All retries failed - increment consecutive_failures
                    const newCount = webhook.consecutiveFailures + 1;

                    if (newCount >= 5) {
                        // Auto-delete webhook after 5 consecutive failures
                        await this.webhookRepository.delete(webhook.id);
                        this.logger.warn(`🗑️ Auto-deleted webhook ${webhook.id} (${webhook.url}) after 5 consecutive failures`);
                    } else {
                        // Update failure counter
                        await this.webhookRepository.update(webhook.id, {
                            consecutiveFailures: newCount,
                            lastFailureAt: new Date(),
                        });

                        this.logger.warn(`⚠️ Webhook ${webhook.url} now has ${newCount} consecutive failure(s)`);
                    }

                    return { success: false, attempt, error: error.message, consecutive_failures: newCount };
                }

                // Wait before retry: 2^attempt seconds (exponential backoff)
                await this.sleep(Math.pow(2, attempt) * 1000);
            }
        }
    }

    /**
     * Test/Mock webhook - Send test webhook payload to provided URL
     * Payload format is 100% identical to real webhook
     */
    async testWebhook(
        url: string,
        secret: string,
        amountUsdc: number,
        chainName: string,
        userId: string,
    ) {
        this.logger.log(`🎭 [WebhookService] [testWebhook] Testing webhook for user: ${userId}, chain: ${chainName}, amount: ${amountUsdc}`);

        // Map chain name to chain ID
        const chainMap: Record<string, { chainId: number; chainName: string }> = {
            'Solana Mainnet': { chainId: 901, chainName: 'Solana Mainnet' },
            'Base': { chainId: 8453, chainName: 'Base' },
            'Arbitrum One': { chainId: 42161, chainName: 'Arbitrum One' },
        };

        const chainInfo = chainMap[chainName];
        if (!chainInfo) {
            throw new NotFoundException(`Invalid chain name: ${chainName}. Supported: Solana Mainnet, Base, Arbitrum One`);
        }

        // Get wallet for user
        const walletType = chainInfo.chainId === 901 ? WalletType.SOLANA : WalletType.EVM;
        const wallet = await this.userWalletRepository.findOne({
            where: { userId, walletType },
        });

        if (!wallet) {
            throw new NotFoundException(`Wallet not found for user: ${userId} on chain: ${chainName}`);
        }

        // Get USDC token info for chain
        const token = await this.supportedTokenRepository.findOne({
            where: { chainId: chainInfo.chainId, symbol: 'USDC' },
        });

        if (!token) {
            throw new NotFoundException(`USDC token not found for chain: ${chainName}`);
        }

        // Generate mock deposit data (100% same format as real webhook)
        const depositId = uuidv4();
        const previousBalance = 0; // Mock previous balance
        const newBalance = previousBalance + amountUsdc;
        const detectedAt = new Date();

        const depositData = {
            deposit_id: depositId,
            user_id: userId,
            wallet_id: wallet.id,
            wallet_address: wallet.address,
            chain: chainInfo.chainName,
            chain_id: chainInfo.chainId,
            token: {
                symbol: token.symbol,
                address: token.address,
                name: token.name,
                decimals: token.decimals,
                icon: token.icon || undefined,
            },
            amount: amountUsdc.toFixed(6),
            previous_balance: previousBalance.toFixed(6),
            new_balance: newBalance.toFixed(6),
            tx_hash: null,
            detected_at: detectedAt.toISOString(),
        };

        // Create webhook payload (100% same format as real webhook)
        const payload = {
            event: 'deposit',
            webhook_id: 'mock_webhook_test',
            timestamp: new Date().toISOString(),
            data: depositData,
        };

        // Generate HMAC signature (same as real webhook)
        const signature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        payload['signature'] = signature;

        // Send webhook to provided URL
        try {
            this.logger.log(`📡 [WebhookService] [testWebhook] Sending test webhook to ${url}`);

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': `sha256=${signature}`,
                },
                timeout: 10000, // 10s timeout for test
            });

            this.logger.log(`✅ [WebhookService] [testWebhook] Test webhook delivered successfully to ${url}`);

            return {
                success: true,
                status_code: response.status,
                payload,
                response: response.data,
            };
        } catch (error) {
            this.logger.error(`❌ [WebhookService] [testWebhook] Test webhook failed: ${error.message}`);

            return {
                success: false,
                error: error.message,
                payload, // Return payload even if delivery failed
            };
        }
    }

    /**
     * Helper to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
