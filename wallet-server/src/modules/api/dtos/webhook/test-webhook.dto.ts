import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty, IsString, IsNumber, IsEnum } from 'class-validator';

export enum ChainName {
    SOLANA = 'Solana Mainnet',
    BASE = 'Base',
    ARBITRUM = 'Arbitrum One',
}

// Export enum values for easier access
export const ChainNameValues = Object.values(ChainName);

export class TestWebhookDto {
    @ApiProperty({
        description: 'Webhook URL endpoint to test',
        example: 'https://your-server.com/webhooks/deposit',
    })
    @IsUrl(
        {
            require_protocol: true,
            require_valid_protocol: true,
            protocols: ['http', 'https'],
            require_tld: false,
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

    @ApiProperty({
        description: 'Amount in USDC',
        example: 100.5,
    })
    @IsNumber()
    @IsNotEmpty()
    amount_usdc: number;

    @ApiProperty({
        description: 'Chain name',
        enum: ChainName,
        enumName: 'ChainName',
        example: ChainName.BASE,
        type: String,
    })
    @IsEnum(ChainName)
    @IsNotEmpty()
    chain_name: ChainName;

    @ApiProperty({
        description: 'User ID',
        example: 'user_123456',
    })
    @IsString()
    @IsNotEmpty()
    user_id: string;
}

