import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { WebhookRepository } from '@/database/repositories';
import { EncryptionService } from './encryption.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private webhookRepository: WebhookRepository,
        private encryptionService: EncryptionService,
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
     * Helper to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
