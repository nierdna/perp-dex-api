import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { DepositTransactionEntity } from '@/database/entities/deposit-transaction.entity';
import { WebhookLogEntity, WebhookStatus } from '@/database/entities/webhook-log.entity';

@Injectable()
export class DepositWebhookService {
    private readonly logger = new Logger(DepositWebhookService.name);
    private readonly webhookSecret: string;

    constructor(
        @InjectRepository(DepositTransactionEntity)
        private readonly depositRepository: Repository<DepositTransactionEntity>,
        @InjectRepository(WebhookLogEntity)
        private readonly webhookLogRepository: Repository<WebhookLogEntity>,
        private readonly configService: ConfigService,
    ) {
        this.webhookSecret = this.configService.get<string>('WALLET_WEBHOOK_SECRET');
    }

    /**
     * Verify webhook signature from wallet-server
     */
    verifySignature(payload: any, signature: string): boolean {
        if (!this.webhookSecret) {
            this.logger.warn('WALLET_WEBHOOK_SECRET not configured');
            return false;
        }

        // Remove 'sha256=' prefix if present
        const cleanSignature = signature?.startsWith('sha256=')
            ? signature.substring(7)
            : signature;

        // Clone payload and remove signature field (wallet-server adds it after signing)
        const payloadForVerification = { ...payload };
        delete payloadForVerification.signature;

        const hmac = crypto.createHmac('sha256', this.webhookSecret);
        const calculatedSignature = hmac.update(JSON.stringify(payloadForVerification)).digest('hex');

        const isValid = calculatedSignature === cleanSignature;

        // Debug logging
        if (!isValid) {
            this.logger.error(`🔴 Signature verification failed!`);
            this.logger.error(`Received signature: ${cleanSignature}`);
            this.logger.error(`Calculated signature: ${calculatedSignature}`);
            this.logger.error(`Secret length: ${this.webhookSecret.length}`);
            this.logger.error(`Payload (without signature): ${JSON.stringify(payloadForVerification).substring(0, 200)}...`);
        } else {
            this.logger.log(`✅ Signature verified successfully`);
        }

        return isValid;
    }

    /**
     * Process deposit notification from wallet-server
     */
    async processDeposit(payload: any, signature: string): Promise<void> {
        const startTime = Date.now();
        let webhookLog: WebhookLogEntity;

        try {
            this.logger.log(`📥 Processing deposit: ${JSON.stringify(payload)}`);

            // Extract deposit data from payload.data
            const depositData = payload.data || payload;

            const {
                deposit_id,
                user_id,
                wallet_address,
                chain,
                chain_id,
                token,
                amount,
                tx_hash,
                detected_at,
            } = depositData;

            // Check if deposit already processed (idempotency)
            const existing = await this.depositRepository.findOne({
                where: { depositId: deposit_id },
            });

            if (existing) {
                this.logger.warn(`⚠️ Deposit ${deposit_id} already processed, skipping`);

                // Log as success (duplicate is not an error)
                await this.logWebhook(payload, signature, WebhookStatus.SUCCESS, null, deposit_id, {
                    processingTimeMs: Date.now() - startTime,
                    note: 'Duplicate deposit, already processed',
                });

                return;
            }

            // Save deposit transaction
            const deposit = this.depositRepository.create({
                depositId: deposit_id,
                userId: user_id,
                walletAddress: wallet_address,
                chain,
                chainId: chain_id,
                tokenSymbol: token.symbol,
                tokenAddress: token.address,
                amount: parseFloat(amount),
                txHash: tx_hash,
                rawData: payload,
            });

            await this.depositRepository.save(deposit);

            this.logger.log(`✅ Deposit saved: ${deposit_id} - ${amount} ${token.symbol} for user ${user_id}`);

            // Handle business logic
            await this.handleDepositBusinessLogic(deposit);

            // Log successful webhook
            await this.logWebhook(payload, signature, WebhookStatus.SUCCESS, null, deposit_id, {
                processingTimeMs: Date.now() - startTime,
            });

        } catch (error) {
            this.logger.error(`❌ Error processing deposit: ${error.message}`, error.stack);

            // Log failed webhook
            await this.logWebhook(payload, signature, WebhookStatus.FAILED, error.message, null, {
                processingTimeMs: Date.now() - startTime,
                errorStack: error.stack,
            });

            throw error;
        }
    }

    /**
     * Log webhook request for audit
     */
    private async logWebhook(
        payload: any,
        signature: string,
        status: WebhookStatus,
        errorMessage: string | null,
        depositId: string | null,
        metadata: any = {},
    ): Promise<void> {
        try {
            const log = this.webhookLogRepository.create({
                source: 'wallet-server',
                endpoint: '/webhooks/deposit-callback',
                payload,
                signature,
                status,
                errorMessage,
                depositId,
                metadata,
            });

            await this.webhookLogRepository.save(log);
        } catch (error) {
            this.logger.error(`Failed to log webhook: ${error.message}`);
        }
    }

    /**
     * Log invalid signature attempt (security audit)
     */
    async logInvalidSignature(payload: any, signature: string): Promise<void> {
        await this.logWebhook(
            payload,
            signature,
            WebhookStatus.INVALID_SIGNATURE,
            'Invalid webhook signature',
            null,
            {},
        );
    }

    /**
     * Handle business logic after deposit is saved
     */
    private async handleDepositBusinessLogic(deposit: DepositTransactionEntity): Promise<void> {
        // Example: Log the deposit
        this.logger.log(`💰 User ${deposit.userId} deposited ${deposit.amount} ${deposit.tokenSymbol}`);

        // TODO: Implement your business logic
        // - Credit user account
        // - Award points/bonuses
        // - Send push notification
        // - Update leaderboard
        // etc.
    }
}
