import { Controller, Post, Body, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { WebhookService } from '@/business/services/webhook.service';
import { RegisterWebhookDto, TestWebhookDto, ChainName } from '@/api/dtos/webhook';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
    constructor(private readonly webhookService: WebhookService) { }

    @Post('register')
    @ApiOperation({
        summary: 'Register a webhook for deposit notifications',
        description:
            'Register a webhook URL to receive notifications when USDC/USDT deposits are detected. No authentication required. Webhook will be auto-deleted after 5 consecutive delivery failures.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Webhook registered successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ResponseMessage('Webhook registered successfully')
    async registerWebhook(@Body() dto: RegisterWebhookDto) {
        return this.webhookService.registerWebhook(dto.url, dto.secret);
    }

    @Post('test')
    @ApiOperation({
        summary: 'Test/Mock webhook call',
        description:
            'Send a test webhook payload to the provided URL. The payload format is 100% identical to real webhooks. This endpoint generates mock deposit data and sends it to the specified webhook URL.',
    })
    @ApiQuery({
        name: 'url',
        description: 'Webhook URL endpoint to test',
        example: 'https://your-server.com/webhooks/deposit',
        required: true,
    })
    @ApiQuery({
        name: 'secret',
        description: 'Secret for HMAC signature verification',
        example: 'your_webhook_secret_key_123',
        required: true,
    })
    @ApiQuery({
        name: 'amount_usdc',
        description: 'Amount in USDC',
        example: 100.5,
        type: Number,
        required: true,
    })
    @ApiQuery({
        name: 'chain_name',
        description: 'Chain name',
        enum: ChainName,
        enumName: 'ChainName',
        example: ChainName.BASE,
        required: true,
    })
    @ApiQuery({
        name: 'user_id',
        description: 'User ID',
        example: 'user_123456',
        required: true,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Test webhook sent successfully. Payload format is 100% identical to real webhook.',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Wallet or token not found',
    })
    @ResponseMessage('Test webhook sent successfully')
    async testWebhook(
        @Query('url') url: string,
        @Query('secret') secret: string,
        @Query('amount_usdc') amountUsdc: number,
        @Query('chain_name') chainName: ChainName,
        @Query('user_id') userId: string,
    ) {
        return this.webhookService.testWebhook(
            url,
            secret,
            Number(amountUsdc),
            chainName,
            userId,
        );
    }
}
