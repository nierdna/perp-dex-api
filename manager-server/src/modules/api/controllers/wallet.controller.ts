import { Controller, Get, Post, Body, UseGuards, Req, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletIntegrationService } from '@/business/services/wallet-integration.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { IsString, IsNotEmpty } from 'class-validator';

class TransferWalletDto {
    @IsString()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsNotEmpty()
    newUserId: string;
}

@ApiTags('Wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard) // Re-enable guard
@ApiBearerAuth()
export class WalletController {
    private readonly logger = new Logger(WalletController.name);

    constructor(
        private readonly walletService: WalletIntegrationService,
    ) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user wallets' })
    async getMyWallets(@Req() req: any) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                this.logger.error('User not found in request');
                throw new BadRequestException('User not authenticated');
            }
            this.logger.log(`GET /wallets/me - User: ${userId}`);
            const wallets = await this.walletService.getUserWallets(userId);
            this.logger.log(`Successfully fetched ${wallets.length} wallets for user ${userId}`);
            return wallets;
        } catch (error) {
            this.logger.error(`Error in getMyWallets: ${error.message}`, error.stack);
            throw error;
        }
    }

    @Post('transfer')
    @ApiOperation({ summary: 'Transfer wallet ownership' })
    async transferWallet(@Body() dto: TransferWalletDto, @Req() req: any) {
        try {
            const currentUserId = req.user?.id;
            this.logger.log(`Transfer wallet ${dto.address} to ${dto.newUserId} by ${currentUserId}`);
            return this.walletService.transferWallet(dto.address, dto.newUserId, currentUserId);
        } catch (error) {
            this.logger.error(`Error in transferWallet: ${error.message}`, error.stack);
            throw error;
        }
    }
}
