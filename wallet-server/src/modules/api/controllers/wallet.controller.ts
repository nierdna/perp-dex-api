import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { CurrentUserId } from '@/api/decorator/user.decorator';
import { WalletService } from '@/business/services/wallet.service';
import { AuditLogService } from '@/business/services/audit-log.service';
import { IpWhitelistGuard, ApiKeyGuard } from '../guards';
import {
  CreateWalletDto,
  GetPrivateKeyDto,
  WalletResponseDto,
  PrivateKeyResponseDto,
} from '@/api/dtos/wallet';

@ApiTags('Wallet')
@ApiSecurity('X-API-Key')
@Controller('wallets')
@UseGuards(IpWhitelistGuard, ApiKeyGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly auditLogService: AuditLogService,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'Create new wallet for a user',
    description:
      'Creates a new EVM wallet for the specified user. If a wallet already exists, returns the existing wallet.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet created successfully or wallet already exists',
    type: WalletResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid user ID',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - IP not whitelisted',
  })
  @ResponseMessage('Wallets created successfully')
  async createWallet(
    @Body() createWalletDto: CreateWalletDto,
    @CurrentUserId() currentUserId: string,
  ): Promise<any> {
    console.log(`🔍 [WalletController] [createWallet] user_id: ${createWalletDto.user_id}, currentUserId: ${currentUserId}`);

    // Create both Solana and EVM wallets
    const wallets = await this.walletService.createAllWallets(createWalletDto.user_id);

    // Log audit trail for both wallets
    await this.auditLogService.logAction('CREATE_WALLET', createWalletDto.user_id, `SOLANA:${wallets.solana.address}, EVM:${wallets.evm.address}`, {
      solana_wallet_id: wallets.solana.id,
      evm_wallet_id: wallets.evm.id,
      requested_by: currentUserId,
    });

    console.log(`✅ [WalletController] [createWallet] Returning wallet response`);

    return {
      user_id: createWalletDto.user_id,
      wallets: {
        solana: {
          wallet_id: wallets.solana.id,
          address: wallets.solana.address,
          type: 'SOLANA',
          chain: 'Solana Mainnet',
          chain_id: 901,
        },
        base: {
          wallet_id: wallets.evm.id,
          address: wallets.evm.address,
          type: 'EVM',
          chain: 'Base',
          chain_id: 8453,
        },
        arbitrum: {
          wallet_id: wallets.evm.id,
          address: wallets.evm.address,
          type: 'EVM',
          chain: 'Arbitrum One',
          chain_id: 42161,
        },
      },
      note: 'EVM wallets (Base & Arbitrum) share the same address and private key',
      created_at: wallets.solana.created_at.toISOString(),
    };
  }

  @Get('private-key')
  @ApiOperation({
    summary: 'Get private key for a wallet (Admin only)',
    description:
      'Retrieves the decrypted private key for a wallet. This endpoint is for admin use only and should be secured appropriately.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Private key retrieved successfully',
    type: PrivateKeyResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Either user_id or address must be provided',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Wallet not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - IP not whitelisted',
  })
  @ResponseMessage('Private key retrieved successfully')
  async getPrivateKey(
    @Query() query: GetPrivateKeyDto,
    @CurrentUserId() currentUserId: string,
  ): Promise<PrivateKeyResponseDto> {
    console.log(`🔍 [WalletController] [getPrivateKey] user_id: ${query.user_id}, address: ${query.address}, currentUserId: ${currentUserId}`);

    // Validate that at least one parameter is provided
    if (!query.user_id && !query.address) {
      throw new BadRequestException('Either user_id or address must be provided');
    }

    let privateKey: string;
    let address: string;

    // Get private key by user_id or address
    if (query.user_id) {
      privateKey = await this.walletService.getPrivateKey(query.user_id);
      const wallet = await this.walletService.getWalletByUserId(query.user_id);
      address = wallet.address;
    } else {
      privateKey = await this.walletService.getPrivateKeyByAddress(query.address);
      address = query.address;
    }

    // Log audit trail - CRITICAL for security
    await this.auditLogService.logAction('GET_PRIVATE_KEY', query.user_id, address, {
      requested_by: currentUserId,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ [WalletController] [getPrivateKey] Returning private key for address: ${address}`);

    return {
      address,
      private_key: privateKey,
    };
  }
}

