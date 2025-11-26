import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WalletIntegrationService {
    private readonly logger = new Logger(WalletIntegrationService.name);
    private readonly walletServerUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.walletServerUrl = this.configService.get<string>('WALLET_SERVER_URL');
    }

    async createWallet(userId: string) {
        if (!this.walletServerUrl) {
            this.logger.warn('Wallet server URL not configured');
            return;
        }

        try {
            const url = `${this.walletServerUrl}/v1/wallets`;
            // Call wallet server to create/get wallet
            // Based on wallet-server API, POST /v1/wallets with { user_id: string }
            // No API Key required for this public endpoint
            const response = await firstValueFrom(
                this.httpService.post(
                    url,
                    { user_id: userId }
                ),
            );
            this.logger.log(`✅ Wallet created/retrieved for user ${userId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ Failed to create wallet for user ${userId}: ${error.message}`);
            if (error.response) {
                this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
            }
        }
    }
}
