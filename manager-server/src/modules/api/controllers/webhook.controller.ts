import { Controller, Post, Body, Headers, HttpStatus, BadRequestException, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DepositWebhookService } from '@/business/services/deposit-webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
    constructor(private readonly depositWebhookService: DepositWebhookService) { }

    @Post('deposit-callback')
    @SkipThrottle() // Skip rate limiting for webhooks
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Receive deposit notifications from wallet-server',
        description: 'This endpoint receives webhook notifications when a deposit is detected by the wallet-server.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Webhook processed successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid signature or payload',
    })
    async handleDepositWebhook(
        @Body() payload: any,
        @Headers('x-webhook-signature') signature: string,
    ) {
        // Verify signature
        const isValid = this.depositWebhookService.verifySignature(payload, signature);

        if (!isValid) {
            // Still log the invalid attempt
            await this.depositWebhookService.logInvalidSignature(payload, signature);
            throw new BadRequestException('Invalid webhook signature');
        }

        // Process deposit
        await this.depositWebhookService.processDeposit(payload, signature);

        return { success: true };
    }
}
