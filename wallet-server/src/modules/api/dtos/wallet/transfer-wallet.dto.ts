import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TransferWalletDto {
    @ApiProperty({
        description: 'The new user ID to transfer the wallet to',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    new_user_id: string;
}
