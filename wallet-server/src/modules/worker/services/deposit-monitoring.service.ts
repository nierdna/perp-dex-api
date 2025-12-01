import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { LessThan } from 'typeorm';
import {
    UserWalletRepository,
    SupportedTokenRepository,
    WalletBalanceRepository,
    DepositRepository,
} from '@/database/repositories';
import { WalletType, ScanPriority } from '@/database/entities';
import { WebhookService, TelegramService } from '@/business/services';
import { RpcManagerService } from './rpc-manager.service';
import { ScanMetricsService } from './scan-metrics.service';

// ERC20 ABI (only balanceOf function)
const ERC20_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

@Injectable()
export class DepositMonitoringService {
    private readonly logger = new Logger(DepositMonitoringService.name);
    private isScanning = false;

    // Batch processing configuration
    private readonly BATCH_SIZE: number;
    private readonly BATCH_DELAY_MS: number;

    // RPC connections
    private solanaConnection: Connection;
    private baseProvider: ethers.providers.JsonRpcProvider;
    private arbitrumProvider: ethers.providers.JsonRpcProvider;

    constructor(
        private configService: ConfigService,
        private userWalletRepository: UserWalletRepository,
        private supportedTokenRepository: SupportedTokenRepository,
        private walletBalanceRepository: WalletBalanceRepository,
        private depositRepository: DepositRepository,
        private webhookService: WebhookService,
        private telegramService: TelegramService,
        private rpcManagerService: RpcManagerService,
        private scanMetricsService: ScanMetricsService,
    ) {
        // Initialize batch configuration
        this.BATCH_SIZE = parseInt(this.configService.get('SCAN_BATCH_SIZE') || '50');
        this.BATCH_DELAY_MS = parseInt(this.configService.get('SCAN_BATCH_DELAY_MS') || '1000');

        this.initializeRpcConnections();

        this.logger.log(`📦 Batch configuration: size=${this.BATCH_SIZE}, delay=${this.BATCH_DELAY_MS}ms`);
    }

    /**
     * Initialize RPC connections
     */
    private initializeRpcConnections() {
        const solanaRpc = this.configService.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
        const baseRpc = this.configService.get('BASE_RPC_URL') || 'https://mainnet.base.org';
        const arbitrumRpc = this.configService.get('ARBITRUM_RPC_URL') || 'https://arb1.arbitrum.io/rpc';

        this.solanaConnection = new Connection(solanaRpc, 'confirmed');
        this.baseProvider = new ethers.providers.JsonRpcProvider(baseRpc);
        this.arbitrumProvider = new ethers.providers.JsonRpcProvider(arbitrumRpc);

        this.logger.log('✅ RPC connections initialized');
    }

    /**
     * Cron job - Scan HIGH priority wallets every 30 seconds
     */
    @Cron('*/30 * * * * *')
    async scanHighPriorityWallets() {
        if (this.isScanning) {
            this.logger.warn('⚠️ Previous scan still running, skipping HIGH priority scan...');
            return;
        }

        this.isScanning = true;
        const startTime = Date.now();

        try {
            this.logger.log('🔍 Starting HIGH priority wallet scan...');
            const count = await this.scanWalletsByPriority(ScanPriority.HIGH, 'HIGH');

            if (count > 0) {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                this.logger.log(`✅ HIGH priority scan completed in ${duration}s (${count} wallets)`);
                this.scanMetricsService.recordScan(parseFloat(duration), count);
            }
        } catch (error) {
            this.logger.error(`❌ Error during HIGH priority scan: ${error.message}`);
            this.scanMetricsService.recordError();
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Cron job - Scan MEDIUM priority wallets every 5 minutes
     */
    @Cron('0 */5 * * * *')
    async scanMediumPriorityWallets() {
        const startTime = Date.now();

        try {
            this.logger.log('🔍 Starting MEDIUM priority wallet scan...');
            const count = await this.scanWalletsByPriority(ScanPriority.MEDIUM, 'MEDIUM');

            if (count > 0) {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                this.logger.log(`✅ MEDIUM priority scan completed in ${duration}s (${count} wallets)`);
                this.scanMetricsService.recordScan(parseFloat(duration), count);
            }
        } catch (error) {
            this.logger.error(`❌ Error during MEDIUM priority scan: ${error.message}`);
            this.scanMetricsService.recordError();
        }
    }

    /**
     * Cron job - Scan LOW priority wallets every 15 minutes
     */
    @Cron('0 */15 * * * *')
    async scanLowPriorityWallets() {
        const startTime = Date.now();

        try {
            this.logger.log('🔍 Starting LOW priority wallet scan...');
            const count = await this.scanWalletsByPriority(ScanPriority.LOW, 'LOW');

            if (count > 0) {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                this.logger.log(`✅ LOW priority scan completed in ${duration}s (${count} wallets)`);
                this.scanMetricsService.recordScan(parseFloat(duration), count);
            }
        } catch (error) {
            this.logger.error(`❌ Error during LOW priority scan: ${error.message}`);
            this.scanMetricsService.recordError();
        }
    }

    /**
     * Scan wallets by priority using database pagination
     * This approach queries wallets in batches from database instead of loading all into memory
     */
    private async scanWalletsByPriority(priority: ScanPriority, priorityLabel: string): Promise<number> {
        let page = 0;
        let totalScanned = 0;
        let hasMore = true;

        this.logger.log(`🔍 Scanning ${priorityLabel} priority wallets...`);

        while (hasMore) {
            // Query batch from database with pagination
            const batch = await this.getWalletBatch(priority, page);

            if (batch.length === 0) {
                hasMore = false;
                break;
            }

            const batchNumber = page + 1;
            this.logger.log(`📦 Processing ${priorityLabel} batch ${batchNumber} (${batch.length} wallets)`);

            // Process batch in parallel
            const promises = batch.map(wallet => this.checkWalletDeposits(wallet));
            await Promise.allSettled(promises);

            totalScanned += batch.length;

            // Check if there are more wallets to scan
            if (batch.length < this.BATCH_SIZE) {
                hasMore = false;
            } else {
                // Delay between batches to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
                page++;
            }
        }

        if (totalScanned > 0) {
            this.logger.log(`✅ Scanned ${totalScanned} ${priorityLabel} priority wallets`);
        }

        return totalScanned;
    }

    /**
     * Get a batch of wallets from database with pagination
     */
    private async getWalletBatch(priority: ScanPriority, page: number): Promise<any[]> {
        const queryOptions: any = {
            where: { scanPriority: priority },
            take: this.BATCH_SIZE,
            skip: page * this.BATCH_SIZE,
            order: { lastActivityAt: 'DESC' },
        };

        return await this.userWalletRepository.find(queryOptions);
    }

    /**
     * Check deposits for a single wallet
     */
    private async checkWalletDeposits(wallet: any) {
        try {
            // Get chain ID based on wallet type
            const chainIds = wallet.walletType === WalletType.SOLANA ? [901] : [8453, 42161]; // Base, Arbitrum

            for (const chainId of chainIds) {
                // Get supported tokens for this chain
                const tokens = await this.supportedTokenRepository.find({
                    where: { chainId, isActive: true },
                });

                for (const token of tokens) {
                    await this.checkTokenBalance(wallet, token, chainId);
                }
            }
        } catch (error) {
            this.logger.error(`Error checking wallet ${wallet.id}: ${error.message}`);
        }
    }

    /**
     * Check balance for a specific token on a wallet
     */
    private async checkTokenBalance(wallet: any, token: any, chainId: number) {
        try {
            // Get current balance from blockchain
            const currentBalance = await this.getTokenBalance(
                wallet.address,
                token.address,
                token.decimals,
                chainId,
            );

            // Get previous balance from DB (order by latest update to avoid stale duplicate rows)
            const balanceRecord = await this.walletBalanceRepository.findOne({
                where: {
                    walletId: wallet.id,
                    chainId,
                    token: token.symbol,
                },
                order: { updated_at: 'DESC' },
            });

            const previousBalance = balanceRecord ? Number(balanceRecord.balance) : 0;

            this.logger.log(`[BALANCE CHECK] Wallet: ${wallet.address}, Token: ${token.symbol}, Chain: ${chainId}
                - balanceRecord found: ${!!balanceRecord}
                - balanceRecord.id: ${balanceRecord?.id || 'N/A'}
                - balanceRecord.balance (RAW from DB): "${balanceRecord?.balance}" (type: ${typeof balanceRecord?.balance})
                - previousBalance (converted): ${previousBalance}
                - currentBalance (from blockchain): ${currentBalance}
            `);

            // Check if balance increased (deposit detected)
            if (currentBalance > previousBalance) {
                const depositAmount = currentBalance - previousBalance;

                this.logger.log(
                    `💰 Deposit detected! User: ${wallet.userId}, ${depositAmount} ${token.symbol} on chain ${chainId}`,
                );

                // 1. LƯU DATABASE TRƯỚC (deposit + update balance)
                const savedDeposit = await this.saveDepositToDatabase({
                    walletId: wallet.id,
                    userId: wallet.userId,
                    chainId,
                    tokenAddress: token.address,
                    tokenSymbol: token.symbol,
                    tokenName: token.name,
                    tokenDecimals: token.decimals,
                    tokenIcon: token.icon,
                    amount: depositAmount,
                    previousBalance,
                    newBalance: currentBalance,
                    walletAddress: wallet.address,
                    balanceRecord,
                });

                // Record deposit detection in metrics
                this.scanMetricsService.recordDeposit();

                // 2. GỬI WEBHOOK & TELEGRAM SAU (async, không chờ)
                this.sendDepositNotifications(savedDeposit, {
                    userId: wallet.userId,
                    walletAddress: wallet.address,
                    chainId,
                    tokenSymbol: token.symbol,
                    tokenName: token.name,
                    tokenDecimals: token.decimals,
                    tokenIcon: token.icon,
                    tokenAddress: token.address,
                    amount: depositAmount,
                    previousBalance,
                    newBalance: currentBalance,
                }).catch(err => {
                    this.logger.error(`Failed to send notifications for deposit ${savedDeposit.id}: ${err.message}`);
                });

                return; // Deposit detected và đã xử lý, thoát sớm
            }

            // Update balance in DB (nếu không có deposit, vẫn update để track last check)
            // SAFETY: Không update balance = 0 nếu trước đó > 0 (có thể do blockchain API lỗi)
            if (balanceRecord) {
                // Chỉ update nếu:
                // 1. Balance tăng hoặc giữ nguyên
                // 2. Hoặc balance giảm NHƯNG vẫn > 0 (rút một phần)
                // KHÔNG update nếu: previousBalance > 0 nhưng currentBalance = 0 (nghi ngờ API lỗi)
                const shouldUpdate = currentBalance > 0 || Number(balanceRecord.balance) === 0;

                if (shouldUpdate) {
                    this.logger.log(`[NO DEPOSIT] Updating balance for ${wallet.address} - ${token.symbol}:
                        - Previous: ${balanceRecord.balance}
                        - Current from blockchain: ${currentBalance}
                        - Will update to: ${String(currentBalance)}
                    `);

                    await this.walletBalanceRepository.update(balanceRecord.id, {
                        balance: String(currentBalance),
                    });
                } else {
                    this.logger.warn(`[SKIP UPDATE] Blockchain returned 0 but previous balance was ${balanceRecord.balance} for ${wallet.address} - ${token.symbol}. Skipping update to prevent data loss.`);
                }
            } else {
                this.logger.log(`[NO DEPOSIT] Creating new balance record for ${wallet.address} - ${token.symbol}: ${currentBalance}`);

                // Create new balance record
                const newRecord = this.walletBalanceRepository.create({
                    walletId: wallet.id,
                    chainId,
                    token: token.symbol,
                    balance: String(currentBalance),
                });
                await this.walletBalanceRepository.save(newRecord);
            }
        } catch (error) {
            this.logger.error(
                `Error checking ${token.symbol} balance for wallet ${wallet.address} on chain ${chainId}: ${error.message}`,
            );
        }
    }

    /**
     * Get token balance from blockchain
     */
    private async getTokenBalance(
        walletAddress: string,
        tokenAddress: string,
        decimals: number,
        chainId: number,
    ): Promise<number> {
        if (chainId === 901) {
            // Solana
            return this.getSolanaTokenBalance(walletAddress, tokenAddress);
        } else {
            // EVM (Base or Arbitrum)
            return this.getEvmTokenBalance(walletAddress, tokenAddress, decimals, chainId);
        }
    }

    /**
     * Get Solana SPL token balance
     */
    private async getSolanaTokenBalance(walletAddress: string, tokenMint: string): Promise<number> {
        return this.rpcManagerService.executeRpcCall(async () => {
            try {
                const tokenAccounts = await this.solanaConnection.getParsedTokenAccountsByOwner(
                    new PublicKey(walletAddress),
                    { mint: new PublicKey(tokenMint) },
                );

                if (tokenAccounts.value.length === 0) {
                    return 0;
                }

                const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                return balance || 0;
            } catch (error) {
                // Invalid wallet address or no token account
                return 0;
            }
        });
    }

    /**
     * Get EVM ERC20 token balance
     */
    private async getEvmTokenBalance(
        walletAddress: string,
        tokenAddress: string,
        decimals: number,
        chainId: number,
    ): Promise<number> {
        return this.rpcManagerService.executeRpcCall(async () => {
            const provider = chainId === 8453 ? this.baseProvider : this.arbitrumProvider;

            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const balance = await contract.balanceOf(walletAddress);
            const formattedBalance = Number(ethers.utils.formatUnits(balance, decimals));

            return formattedBalance;
        });
    }

    /**
     * Save deposit to database ATOMICALLY (deposit + balance update together)
     * Trả về deposit record đã lưu
     */
    private async saveDepositToDatabase(data: any): Promise<any> {
        this.logger.log(`[DEBUG] saveDepositToDatabase called with:
            walletId: ${data.walletId}
            chainId: ${data.chainId}
            token: ${data.tokenSymbol}
            previousBalance: ${data.previousBalance}
            newBalance: ${data.newBalance}
            balanceRecord exists: ${!!data.balanceRecord}
            balanceRecord.id: ${data.balanceRecord?.id || 'N/A'}
        `);

        // Create deposit record
        const deposit = this.depositRepository.create({
            walletId: data.walletId,
            userId: data.userId,
            chainId: data.chainId,
            tokenAddress: data.tokenAddress,
            tokenSymbol: data.tokenSymbol,
            amount: data.amount,
            previousBalance: data.previousBalance,
            newBalance: data.newBalance,
            detectedAt: new Date(),
            webhookSent: false,
        });

        // Lưu deposit
        const savedDeposit = await this.depositRepository.save(deposit);
        this.logger.log(`✅ Deposit saved to DB: ${savedDeposit.id}`);

        // CẬP NHẬT wallet_balances NGAY (quan trọng để tránh duplicate scan!)
        if (data.balanceRecord) {
            this.logger.log(`[DEBUG] Updating existing balance record: ${data.balanceRecord.id}`);
            this.logger.log(`[DEBUG] Balance BEFORE update: ${data.balanceRecord.balance} (type: ${typeof data.balanceRecord.balance})`);
            this.logger.log(`[DEBUG] New balance to set: ${data.newBalance} (type: ${typeof data.newBalance})`);

            const updateResult = await this.walletBalanceRepository.update(data.balanceRecord.id, {
                balance: String(data.newBalance), // Convert to string for decimal type
            });

            this.logger.log(`[DEBUG] Update result: affected=${updateResult.affected}`);

            // VERIFY: Re-query để confirm update thành công
            const verifyRecord = await this.walletBalanceRepository.findOne({
                where: { id: data.balanceRecord.id }
            });
            this.logger.log(`[DEBUG] Balance AFTER update (verified): ${verifyRecord?.balance} (type: ${typeof verifyRecord?.balance})`);

            if (Number(verifyRecord?.balance) !== Number(data.newBalance)) {
                this.logger.error(`❌ CRITICAL: Balance update FAILED! Expected ${data.newBalance}, got ${verifyRecord?.balance}`);
            } else {
                this.logger.log(`✅ Balance updated SUCCESSFULLY: ${data.tokenSymbol} = ${data.newBalance}`);
            }
        } else {
            this.logger.log(`[DEBUG] Creating new balance record`);

            const newBalanceRecord = this.walletBalanceRepository.create({
                walletId: data.walletId,
                chainId: data.chainId,
                token: data.tokenSymbol,
                balance: String(data.newBalance),
            });

            const savedBalance = await this.walletBalanceRepository.save(newBalanceRecord);
            this.logger.log(`[DEBUG] New balance record saved: ${savedBalance.id}`);
            this.logger.log(`✅ New balance record created: ${data.tokenSymbol} = ${data.newBalance}`);
        }

        // UPDATE WALLET PRIORITY TO HIGH when deposit detected
        await this.userWalletRepository.update(data.walletId, {
            lastActivityAt: new Date(),
            scanPriority: ScanPriority.HIGH,
        });
        this.logger.log(`✅ Wallet priority updated to HIGH for wallet ${data.walletId}`);

        return savedDeposit;
    }

    /**
     * Send webhook and Telegram notifications AFTER database is saved
     * Chạy async, không blocking
     */
    private async sendDepositNotifications(savedDeposit: any, data: any): Promise<void> {
        // Prepare webhook payload
        const webhookPayload = {
            deposit_id: savedDeposit.id,
            user_id: data.userId,
            wallet_id: savedDeposit.walletId,
            wallet_address: data.walletAddress,
            chain: this.getChainName(data.chainId),
            chain_id: data.chainId,
            token: {
                symbol: data.tokenSymbol,
                address: data.tokenAddress,
                name: data.tokenName,
                decimals: data.tokenDecimals,
                icon: data.tokenIcon,
            },
            amount: data.amount.toFixed(6),
            previous_balance: data.previousBalance.toFixed(6),
            new_balance: data.newBalance.toFixed(6),
            tx_hash: null,
            detected_at: savedDeposit.detectedAt.toISOString(),
        };

        // Send webhook notification
        try {
            await this.webhookService.sendDepositNotification(webhookPayload);

            // Mark webhook as sent
            await this.depositRepository.update(savedDeposit.id, {
                webhookSent: true,
                webhookSentAt: new Date(),
            });

            this.logger.log(`✅ Webhook sent for deposit ${savedDeposit.id}`);
        } catch (error) {
            this.logger.error(`Failed to send webhook for deposit ${savedDeposit.id}: ${error.message}`);
        }

        // Send Telegram alert (always, even if webhook fails)
        try {
            const message = this.telegramService.formatDepositAlert({
                userId: data.userId,
                walletAddress: data.walletAddress,
                amount: data.amount,
                tokenSymbol: data.tokenSymbol,
                chainName: this.getChainName(data.chainId),
                txHash: null,
            });
            await this.telegramService.sendMessage(message);
            this.logger.log('✅ Telegram notification sent');
        } catch (error) {
            this.logger.error(`Failed to send Telegram alert: ${error.message}`);
        }
    }

    /**
     * Helper to get chain name
     */
    private getChainName(chainId: number): string {
        const chainNames = {
            901: 'Solana Mainnet',
            8453: 'Base',
            42161: 'Arbitrum One',
        };
        return chainNames[chainId] || `Chain ${chainId}`;
    }

    /**
     * Cron job - Auto-downgrade wallet priorities based on inactivity
     * Runs every 10 minutes
     */
    @Cron('0 */10 * * * *')
    async adjustWalletPriorities() {
        try {
            const now = new Date();

            // Downgrade HIGH → MEDIUM if no activity in last 30 minutes
            const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
            const highToMedium = await this.userWalletRepository.update(
                {
                    scanPriority: ScanPriority.HIGH,
                    lastActivityAt: LessThan(thirtyMinutesAgo) as any,
                },
                { scanPriority: ScanPriority.MEDIUM }
            );

            // Downgrade MEDIUM → LOW if no activity in last 1 hour
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const mediumToLow = await this.userWalletRepository.update(
                {
                    scanPriority: ScanPriority.MEDIUM,
                    lastActivityAt: LessThan(oneHourAgo) as any,
                },
                { scanPriority: ScanPriority.LOW }
            );

            if (highToMedium.affected || mediumToLow.affected) {
                this.logger.log(`✅ Wallet priorities adjusted: HIGH→MEDIUM (${highToMedium.affected}), MEDIUM→LOW (${mediumToLow.affected})`);
            }
        } catch (error) {
            this.logger.error(`❌ Error adjusting wallet priorities: ${error.message}`);
        }
    }
}
