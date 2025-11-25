import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { UserWalletRepository } from '@/database/repositories';
import { WalletType } from '@/database/entities';

@Injectable()
export class SolanaWorkerService implements OnModuleInit {
    private readonly logger = new Logger(SolanaWorkerService.name);
    private connection: Connection;
    private isRunning = false;

    constructor(
        private configService: ConfigService,
        private userWalletRepository: UserWalletRepository,
    ) { }

    onModuleInit() {
        const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.startWorker();
    }

    async startWorker() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.log('🚀 Solana Worker started listening on Devnet...');

        // In a real production environment, we would use a more robust method 
        // like Helius webhooks or a dedicated indexer.
        // For this prototype, we will poll for recent signatures or use onLogs for specific addresses.
        // However, monitoring ALL user addresses via WebSocket might hit limits.
        // A simple approach for "Devnet" demo:
        // Periodically check balance of all active wallets (inefficient but works for small scale)
        // OR: Use onLogs for the specific program if we were interacting with a contract.
        // Since we are just detecting SOL transfers, we can use `onAccountChange` for active wallets.

        // For now, let's just log that it's running. 
        // Real implementation would require a list of addresses to watch.
        this.watchWallets();
    }

    async watchWallets() {
        // Fetch all Solana wallets
        // Note: This is heavy for DB if many users. Should be optimized.
        const wallets = await this.userWalletRepository.find({
            where: { walletType: WalletType.SOLANA },
        });

        this.logger.log(`👀 Watching ${wallets.length} Solana wallets...`);

        for (const wallet of wallets) {
            try {
                // Validate address format before using
                let pubKey: PublicKey;
                try {
                    pubKey = new PublicKey(wallet.address);
                } catch (e) {
                    this.logger.warn(`⚠️ Skipping invalid wallet address: ${wallet.address} (Invalid Format)`);
                    continue;
                }

                this.connection.onAccountChange(
                    pubKey,
                    (updatedAccountInfo, context) => {
                        this.logger.log(`💰 Balance changed for ${wallet.address}: ${updatedAccountInfo.lamports} lamports`);
                        // Trigger webhook or update balance logic here
                        this.handleDeposit(wallet.userId, updatedAccountInfo.lamports);
                    },
                    'confirmed',
                );
            } catch (error) {
                this.logger.error(`Failed to watch wallet ${wallet.address}: ${error.message}`);
            }
        }
    }

    async handleDeposit(userId: string, lamports: number) {
        // Logic to notify Manager Server or update DB
        this.logger.log(`✅ Deposit detected for User ${userId}: ${lamports / 1e9} SOL`);
        // TODO: Call Manager Server Webhook
    }
}
