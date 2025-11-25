import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty, IsString } from 'class-validator';

export class RegisterWebhookDto {
    @ApiProperty({
        description: 'Webhook URL endpoint',
        example: 'https://your-server.com/webhooks/deposit',
    })
    @IsUrl({}, { message: 'Invalid URL format' })
    @IsNotEmpty()
    url: string;

    @ApiProperty({
        description: 'Secret for HMAC signature verification',
        example: 'your_webhook_secret_key_123',
    })
    @IsString()
    @IsNotEmpty()
    secret: string;
}
