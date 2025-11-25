import { ApiProperty } from '@nestjs/swagger';

export class WalletDetailDto {
  @ApiProperty({ example: 'd1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33' })
  wallet_id: string;

  @ApiProperty({ example: '0xAbCDef1234567890aBCdEF1234567890abCDef12' })
  address: string;

  @ApiProperty({ example: 'EVM' })
  type: string;

  @ApiProperty({ example: 'Base' })
  chain: string;

  @ApiProperty({ example: 8453 })
  chain_id: number;

  @ApiProperty({ example: 'https://assets.coingecko.com/coins/images/31199/standard/base.png' })
  icon: string;
}

export class WalletsMapDto {
  @ApiProperty({ type: WalletDetailDto })
  solana: WalletDetailDto;

  @ApiProperty({ type: WalletDetailDto })
  base: WalletDetailDto;

  @ApiProperty({ type: WalletDetailDto })
  arbitrum: WalletDetailDto;
}

export class WalletResponseDto {
  @ApiProperty({ example: 'user_123456' })
  user_id: string;

  @ApiProperty({ type: WalletsMapDto })
  wallets: WalletsMapDto;

  @ApiProperty({ example: 'EVM wallets (Base & Arbitrum) share the same address and private key' })
  note: string;

  @ApiProperty({ example: '2025-10-27T08:00:00Z' })
  created_at: string;
}

