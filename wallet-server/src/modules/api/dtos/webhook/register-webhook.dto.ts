import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty, IsString } from 'class-validator';

export class RegisterWebhookDto {
    @ApiProperty({
        description: 'Webhook URL endpoint',
        example: 'https://your-server.com/webhooks/deposit',
    })
    @IsUrl(
        {
            require_protocol: true,
            require_valid_protocol: true,
            protocols: ['http', 'https'],
            require_tld: false, // Allow localhost and IP addresses
        },
        { message: 'Invalid URL format' },
    )
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
