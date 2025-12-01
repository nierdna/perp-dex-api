import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserWalletEntity } from '@/database/entities/user-wallet.entity';
import { WalletTransferHistoryEntity } from '@/database/entities/wallet-transfer-history.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@Injectable()
export class WalletIntegrationService {
    private readonly logger = new Logger(WalletIntegrationService.name);
    private readonly walletServerUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectRepository(UserWalletEntity)
        private readonly userWalletRepository: Repository<UserWalletEntity>,
        @InjectRepository(WalletTransferHistoryEntity)
        private readonly transferHistoryRepository: Repository<WalletTransferHistoryEntity>,
        private readonly dataSource: DataSource,
    ) {
        this.walletServerUrl = this.configService.get<string>('WALLET_SERVER_URL');
    }

    /**
     * Get wallets for a user. If not found locally, try to create/fetch from wallet-server.
     */
    async getUserWallets(userId: string) {
        try {
            this.logger.log(`Getting wallets for user: ${userId}`);

            // 1. Check local DB
            const wallets = await this.userWalletRepository.find({
                where: { userId, isActive: true },
            });

            if (wallets.length > 0) {
                this.logger.log(`Found ${wallets.length} wallets in DB for user ${userId}`);
                return wallets;
            }

            // 2. If no wallets, call wallet-server to create/fetch
            this.logger.log(`No wallets found in DB, creating new wallets for user ${userId}`);
            return this.createWallet(userId);
        } catch (error) {
            this.logger.error(`Error in getUserWallets for user ${userId}:`, error.stack);
            throw error;
        }
    }

    async createWallet(userId: string) {
        if (!this.walletServerUrl) {
            this.logger.warn('Wallet server URL not configured');
            return [];
        }

        try {
            const url = `${this.walletServerUrl}/v1/wallets`;
            this.logger.log(`Calling wallet-server: POST ${url}`);

            const response = await firstValueFrom(
                this.httpService.post(url, { user_id: userId }),
            );

            this.logger.log(`Wallet-server response status: ${response.status}`);
            const data = response.data;

            // Log the actual response structure
            this.logger.debug(`Wallet-server response data: ${JSON.stringify(data).substring(0, 500)}`);

            if (!data || !data.wallets) {
                this.logger.error(`Invalid response from wallet-server. Data: ${JSON.stringify(data)}`);
                return [];
            }

            const walletsToSave: UserWalletEntity[] = [];

            // Process Solana
            if (data.wallets.solana) {
                walletsToSave.push(this.userWalletRepository.create({
                    userId,
                    chainKey: 'solana',
                    chainType: 'SOLANA',
                    address: data.wallets.solana.address,
                    icon: data.wallets.solana.icon,
                }));
            }

            // Process Base (EVM)
            if (data.wallets.base) {
                walletsToSave.push(this.userWalletRepository.create({
                    userId,
                    chainKey: 'base',
                    chainType: 'EVM',
                    address: data.wallets.base.address,
                    icon: data.wallets.base.icon,
                }));
            }

            // Process Arbitrum (EVM)
            if (data.wallets.arbitrum) {
                walletsToSave.push(this.userWalletRepository.create({
                    userId,
                    chainKey: 'arbitrum',
                    chainType: 'EVM',
                    address: data.wallets.arbitrum.address,
                    icon: data.wallets.arbitrum.icon,
                }));
            }

            this.logger.log(`Saving ${walletsToSave.length} wallets to database`);

            // Save using upsert to handle existing
            await this.userWalletRepository.upsert(walletsToSave, ['userId', 'chainKey']);

            this.logger.log(`✅ Wallets synced for user ${userId}`);
            return walletsToSave;

        } catch (error) {
            // If wallet already exists (409), fetch it instead
            if (error.response?.status === 409) {
                // 409 Conflict – wallet already exists on wallet‑server
                // Fetch the existing wallets and return them without trying to insert again
                this.logger.log(`Wallet already exists in wallet-server, fetching existing wallet for user ${userId}`);
                try {
                    const getUrl = `${this.walletServerUrl}/v1/wallets/${userId}`;
                    this.logger.log(`Calling wallet-server: GET ${getUrl}`);
                    const getResponse = await firstValueFrom(this.httpService.get(getUrl));
                    const data = getResponse.data;
                    this.logger.debug(`Fetched wallet data: ${JSON.stringify(data).substring(0, 500)}`);
                    if (!data || !data.wallets) {
                        this.logger.error(`Invalid response from wallet-server. Data: ${JSON.stringify(data)}`);
                        return [];
                    }
                    const walletsToReturn: UserWalletEntity[] = [];
                    if (data.wallets.solana) {
                        walletsToReturn.push(this.userWalletRepository.create({
                            userId,
                            chainKey: 'solana',
                            chainType: 'SOLANA',
                            address: data.wallets.solana.address,
                            icon: data.wallets.solana.icon,
                        }));
                    }
                    if (data.wallets.base) {
                        walletsToReturn.push(this.userWalletRepository.create({
                            userId,
                            chainKey: 'base',
                            chainType: 'EVM',
                            address: data.wallets.base.address,
                            icon: data.wallets.base.icon,
                        }));
                    }
                    if (data.wallets.arbitrum) {
                        walletsToReturn.push(this.userWalletRepository.create({
                            userId,
                            chainKey: 'arbitrum',
                            chainType: 'EVM',
                            address: data.wallets.arbitrum.address,
                            icon: data.wallets.arbitrum.icon,
                        }));
                    }
                    // Không thực hiện upsert để tránh duplicate key
                    this.logger.log(`Returning ${walletsToReturn.length} wallets fetched from wallet‑server`);
                    return walletsToReturn;
                } catch (fetchError) {
                    this.logger.error(`❌ Failed to fetch existing wallet: ${fetchError.message}`);
                    throw fetchError;
                }
            }

            this.logger.error(`❌ Failed to create wallet for user ${userId}: ${error.message}`);
            if (error.response) {
                this.logger.error(`Response status: ${error.response.status}`);
                this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }


    /**
     * Set high priority for user wallets
     */
    async setHighPriority(userId: string) {
        if (!this.walletServerUrl) {
            this.logger.warn('Wallet server URL not configured');
            return;
        }

        try {
            const url = `${this.walletServerUrl}/v1/wallets/${userId}/priority`;
            this.logger.log(`Calling wallet-server: POST ${url}`);

            await firstValueFrom(this.httpService.post(url, {}));
            this.logger.log(`✅ Set high priority for user ${userId} successfully`);
        } catch (error) {
            this.logger.error(`❌ Failed to set high priority for user ${userId}: ${error.message}`);
            // Don't throw error to client, just log it as this is an optimization
        }
    }
}
