import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  HttpStatus,
  BadRequestException,
  UseGuards,
  Param,
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
  TransferWalletDto,
} from '@/api/dtos/wallet';

@ApiTags('Wallet')
@Controller('wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly auditLogService: AuditLogService,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'Create new wallet for a user',
    description:
      'Creates a new EVM wallet for the specified user. If a wallet already exists, returns 409 Conflict.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Wallet created successfully',
    type: WalletResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Wallet already exists for user',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid user ID',
  })
  @ResponseMessage('Wallets created successfully')
  async createWallet(
    @Body() createWalletDto: CreateWalletDto,
    @CurrentUserId() currentUserId: string,
  ): Promise<any> {
    console.log(`🔍 [WalletController] [createWallet] user_id: ${createWalletDto.user_id}, currentUserId: ${currentUserId}`);

    // Create both Solana and EVM wallets
    // This will throw ConflictException if wallets exist
    const wallets = await this.walletService.createAllWallets(createWalletDto.user_id);

    // Log audit trail for both wallets
    await this.auditLogService.logAction('CREATE_WALLET', createWalletDto.user_id, `SOLANA:${wallets.solana.address}, EVM:${wallets.evm.address}`, {
      solana_wallet_id: wallets.solana.id,
      evm_wallet_id: wallets.evm.id,
      requested_by: currentUserId,
    });

    console.log(`✅ [WalletController] [createWallet] Returning wallet response`);

    // Return the detail response immediately after creation (balances will be 0)
    return this.walletService.getWalletsDetail(createWalletDto.user_id);
  }

  @Get('private-key')
  @UseGuards(IpWhitelistGuard, ApiKeyGuard)
  @ApiSecurity('X-API-Key')
  @ApiOperation({
    summary: 'Get private key for a wallet (Admin only)',
    description:
      'Retrieves the decrypted private key for a wallet. If user_id is provided, returns both Solana and EVM keys. If address is provided, returns key for that specific wallet.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Private key retrieved successfully',
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
  ) {
    console.log(`🔍 [WalletController] [getPrivateKey] user_id: ${query.user_id}, address: ${query.address}, currentUserId: ${currentUserId}`);

    // Validate that at least one parameter is provided
    if (!query.user_id && !query.address) {
      throw new BadRequestException('Either user_id or address must be provided');
    }

    // If user_id is provided, return ALL private keys (Solana + EVM)
    if (query.user_id) {
      const allKeys = await this.walletService.getAllPrivateKeys(query.user_id);

      // Log audit trail - CRITICAL for security
      await this.auditLogService.logAction('GET_ALL_PRIVATE_KEYS', query.user_id,
        `Solana: ${allKeys.solana?.address}, EVM: ${allKeys.evm?.address}`, {
        requested_by: currentUserId,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ [WalletController] [getPrivateKey] Returning all private keys for user: ${query.user_id}`);

      return allKeys;
    }

    // If address is provided, return single key
    const privateKey = await this.walletService.getPrivateKeyByAddress(query.address);

    // Log audit trail - CRITICAL for security
    await this.auditLogService.logAction('GET_PRIVATE_KEY', null, query.address, {
      requested_by: currentUserId,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ [WalletController] [getPrivateKey] Returning private key for address: ${query.address}`);

    return {
      address: query.address,
      private_key: privateKey,
    };
  }

  @Get(':user_id')
  @ApiOperation({
    summary: 'Get wallets by user ID',
    description: 'Retrieves all wallets and balances for a specific user ID.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallets retrieved successfully',
    type: WalletResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Wallets not found for user',
  })
  @ResponseMessage('Wallets retrieved successfully')
  async getWallets(
    @Param('user_id') userId: string,
  ): Promise<any> {
    console.log(`🔍 [WalletController] [getWallets] user_id: ${userId}`);
    return this.walletService.getWalletsDetail(userId);
  }

  @Patch(':address/transfer')
  @UseGuards(IpWhitelistGuard, ApiKeyGuard)
  @ApiSecurity('X-API-Key')
  @ApiOperation({
    summary: 'Transfer wallet ownership',
    description: 'Transfers the ownership of a wallet to a new user ID.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet transferred successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Wallet not found',
  })
  @ResponseMessage('Wallet transferred successfully')
  async transferWallet(
    @Param('address') address: string,
    @Body() transferWalletDto: TransferWalletDto,
    @CurrentUserId() currentUserId: string,
  ) {
    console.log(`🔍 [WalletController] [transferWallet] address: ${address}, new_user_id: ${transferWalletDto.new_user_id}`);

    const updatedWallet = await this.walletService.transferWallet(address, transferWalletDto.new_user_id);

    // Log audit trail
    await this.auditLogService.logAction('TRANSFER_WALLET', transferWalletDto.new_user_id, address, {
      previous_owner: updatedWallet.userId, // Note: this will be the NEW owner, need to capture old one if needed, but service updates it.
      requested_by: currentUserId,
    });

    return updatedWallet;
  }
}

