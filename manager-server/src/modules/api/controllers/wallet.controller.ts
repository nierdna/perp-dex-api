import { Controller, Get, Post, Body, UseGuards, Req, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletIntegrationService } from '@/business/services/wallet-integration.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { IsString, IsNotEmpty } from 'class-validator';



@ApiTags('Wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard) // Re-enable guard
@ApiBearerAuth()
export class WalletController {
    private readonly logger = new Logger(WalletController.name);

    // In-memory cache for rate limiting (userId -> last request timestamp)
    private readonly priorityRequestCache = new Map<string, number>();
    private readonly PRIORITY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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


    @Post('priority')
    @ApiOperation({ summary: 'Request high priority scanning for user wallets' })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded. Please wait before requesting priority boost again.',
    })
    async setHighPriority(@Req() req: any) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new BadRequestException('User not authenticated');
            }

            // Rate limiting check
            const now = Date.now();
            const lastRequest = this.priorityRequestCache.get(userId);

            if (lastRequest) {
                const timeSinceLastRequest = now - lastRequest;
                const remainingTime = this.PRIORITY_COOLDOWN_MS - timeSinceLastRequest;

                if (remainingTime > 0) {
                    const minutesRemaining = Math.ceil(remainingTime / 60000);
                    this.logger.warn(`Rate limit hit for user ${userId}. ${minutesRemaining} minutes remaining.`);
                    throw new HttpException(
                        {
                            statusCode: HttpStatus.TOO_MANY_REQUESTS,
                            message: `Please wait ${minutesRemaining} minute(s) before requesting priority boost again.`,
                            error: 'Too Many Requests',
                        },
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }
            }

            this.logger.log(`POST /wallets/priority - User: ${userId}`);

            // Update cache with current timestamp
            this.priorityRequestCache.set(userId, now);

            // Forward request to wallet-server
            await this.walletService.setHighPriority(userId);

            return { success: true, message: 'High priority scanning requested' };
        } catch (error) {
            this.logger.error(`Error in setHighPriority: ${error.message}`, error.stack);
            throw error;
        }
    }
}
