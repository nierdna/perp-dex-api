import { Controller, Post, Body, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { WebhookService } from '@/business/services/webhook.service';
import { RegisterWebhookDto } from '@/api/dtos/webhook';

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
}
