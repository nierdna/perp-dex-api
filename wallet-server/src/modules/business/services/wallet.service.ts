import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserWalletRepository, WalletBalanceRepository } from '@/database/repositories';
import { UserWalletEntity, WalletType, WalletBalanceEntity } from '@/database/entities';
import { EncryptionService } from './encryption.service';
import { Wallet } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export type SupportedChain = 'SOLANA' | 'EVM';

@Injectable()
export class WalletService {
  constructor(
    private userWalletRepository: UserWalletRepository,
    private walletBalanceRepository: WalletBalanceRepository,
    private encryptionService: EncryptionService,
  ) { }

  /**
   * Convert chain string to WalletType enum
   */
  private getWalletType(chain: SupportedChain): WalletType {
    return chain === 'SOLANA' ? WalletType.SOLANA : WalletType.EVM;
  }

  /**
   * Create a new wallet for a user
   * If wallet already exists, return existing wallet
   */
  async createWallet(userId: string, chain: SupportedChain = 'EVM'): Promise<UserWalletEntity> {
    console.log(`🔍 [WalletService] [createWallet] Creating ${chain} wallet for userId: ${userId}`);

    const walletType = this.getWalletType(chain);

    // Check if wallet already exists
    const existingWallet = await this.userWalletRepository.findOne({
      where: { userId, walletType },
    });

    if (existingWallet) {
      console.log(`⚠️ [WalletService] [createWallet] Wallet already exists for userId: ${userId}, type: ${walletType}`);
      return existingWallet;
    }

    let address: string;
    let privateKey: string;

    if (chain === 'SOLANA') {
      // Generate Solana keypair
      const keypair = Keypair.generate();
      address = keypair.publicKey.toBase58();
      privateKey = bs58.encode(keypair.secretKey);
    } else {
      // Generate EVM wallet (for Base, Arbitrum)
      const wallet = Wallet.createRandom();
      address = wallet.address;
      privateKey = wallet.privateKey;
    }

    console.log(`✅ [WalletService] [createWallet] Generated ${chain} wallet with address: ${address}`);

    // Encrypt private key
    const { ciphertext } = this.encryptionService.encryptPrivateKey(privateKey);

    // Create wallet entity
    const walletEntity = this.userWalletRepository.create({
      userId,
      walletType,
      address,
      encPrivKey: ciphertext,
      custodian: 'aes_gcm',
    });

    // Save to database
    const savedWallet = await this.userWalletRepository.save(walletEntity);

    console.log(`✅ [WalletService] [createWallet] Wallet saved with id: ${savedWallet.id}`);

    return savedWallet;
  }

  /**
   * Create all wallets (SOLANA + EVM) for a user at once
   * Returns both wallet addresses
   */
  async createAllWallets(userId: string): Promise<{ solana: UserWalletEntity; evm: UserWalletEntity }> {
    console.log(`🔍 [WalletService] [createAllWallets] Creating all wallets for userId: ${userId}`);

    // Check if ANY wallet exists for this user
    const existingWallets = await this.userWalletRepository.find({
      where: { userId },
    });

    if (existingWallets.length > 0) {
      throw new ConflictException(`Wallets already exist for user: ${userId}`);
    }

    // Create Solana wallet
    const solanaWallet = await this.createWallet(userId, 'SOLANA');

    // Create EVM wallet
    const evmWallet = await this.createWallet(userId, 'EVM');

    console.log(`✅ [WalletService] [createAllWallets] All wallets created for userId: ${userId}`);
    console.log(`   - Solana: ${solanaWallet.address}`);
    console.log(`   - EVM: ${evmWallet.address}`);

    return {
      solana: solanaWallet,
      evm: evmWallet,
    };
  }

  /**
   * Get wallet details with balances for a user
   */
  async getWalletsDetail(userId: string): Promise<any> {
    const solanaWallet = await this.userWalletRepository.findOne({ where: { userId, walletType: WalletType.SOLANA } });
    const evmWallet = await this.userWalletRepository.findOne({ where: { userId, walletType: WalletType.EVM } });

    if (!solanaWallet || !evmWallet) {
      throw new NotFoundException(`Wallets not found for user: ${userId}`);
    }

    // Helper to get balances
    const getBalances = async (walletId: string, chainId: number) => {
      const balances = await this.walletBalanceRepository.find({
        where: { walletId, chainId },
      });

      const usdc = balances.find(b => b.token === 'USDC')?.balance || 0;
      const usdt = balances.find(b => b.token === 'USDT')?.balance || 0;

      return {
        amount_usdc: Number(usdc),
        amount_usdt: Number(usdt),
        amount_usd: Number(usdc) + Number(usdt),
      };
    };

    const solanaBalances = await getBalances(solanaWallet.id, 901);
    const baseBalances = await getBalances(evmWallet.id, 8453);
    const arbitrumBalances = await getBalances(evmWallet.id, 42161);

    return {
      user_id: userId,
      wallets: {
        solana: {
          wallet_id: solanaWallet.id,
          address: solanaWallet.address,
          type: 'SOLANA',
          chain: 'Solana Mainnet',
          chain_id: 901,
          icon: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
          ...solanaBalances,
        },
        base: {
          wallet_id: evmWallet.id,
          address: evmWallet.address,
          type: 'EVM',
          chain: 'Base',
          chain_id: 8453,
          icon: 'https://assets.coingecko.com/coins/images/31199/standard/base.png',
          ...baseBalances,
        },
        arbitrum: {
          wallet_id: evmWallet.id,
          address: evmWallet.address,
          type: 'EVM',
          chain: 'Arbitrum One',
          chain_id: 42161,
          icon: 'https://assets.coingecko.com/coins/images/16547/standard/arbitrum.png',
          ...arbitrumBalances,
        },
      },
      note: 'EVM wallets (Base & Arbitrum) share the same address and private key',
      created_at: solanaWallet.created_at.toISOString(), // Assuming created at same time
    };
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: string, chain: SupportedChain = 'EVM'): Promise<UserWalletEntity> {
    console.log(`🔍 [WalletService] [getWalletByUserId] Getting ${chain} wallet for userId: ${userId}`);

    const walletType = this.getWalletType(chain);

    const wallet = await this.userWalletRepository.findOne({
      where: { userId, walletType },
    });

    if (!wallet) {
      console.log(`🔴 [WalletService] [getWalletByUserId] Wallet not found for userId: ${userId}, type: ${walletType}`);
      throw new NotFoundException(`Wallet not found for user: ${userId} on chain: ${chain}`);
    }

    console.log(`✅ [WalletService] [getWalletByUserId] Found wallet with address: ${wallet.address}`);

    return wallet;
  }

  /**
   * Get wallet by address
   */
  async getWalletByAddress(address: string): Promise<UserWalletEntity> {
    // Normalize address to lowercase for comparison only if it looks like EVM
    const normalizedAddress = address.startsWith('0x') ? address.toLowerCase() : address;
    console.log(`🔍 [WalletService] [getWalletByAddress] Getting wallet for address: ${normalizedAddress}`);

    const wallet = await this.userWalletRepository.findOne({
      where: { address: normalizedAddress },
    });

    if (!wallet) {
      console.log(`🔴 [WalletService] [getWalletByAddress] Wallet not found for address: ${normalizedAddress}`);
      throw new NotFoundException(`Wallet not found for address: ${normalizedAddress}`);
    }

    console.log(`✅ [WalletService] [getWalletByAddress] Found wallet with userId: ${wallet.userId}`);

    return wallet;
  }

  /**
   * Get private key (decrypted) from wallet
   * WARNING: Only for admin use!
   */
  async getPrivateKey(userId: string): Promise<string> {
    console.log(`🔍 [WalletService] [getPrivateKey] Getting private key for userId: ${userId}`);

    const wallet = await this.getWalletByUserId(userId);

    // Decrypt private key
    const privateKey = this.encryptionService.decryptPrivateKey(
      wallet.encPrivKey,
    );

    console.log(`✅ [WalletService] [getPrivateKey] Private key decrypted successfully`);

    return privateKey;
  }

  /**
   * Get private key by address (decrypted) from wallet
   * WARNING: Only for admin use!
   */
  async getPrivateKeyByAddress(address: string): Promise<string> {
    console.log(`🔍 [WalletService] [getPrivateKeyByAddress] Getting private key for address: ${address}`);

    const wallet = await this.getWalletByAddress(address);

    // Decrypt private key
    const privateKey = this.encryptionService.decryptPrivateKey(
      wallet.encPrivKey,
    );

    console.log(`✅ [WalletService] [getPrivateKeyByAddress] Private key decrypted successfully`);

    return privateKey;
  }

  /**
   * Get ALL private keys (Solana + EVM) for a user
   * WARNING: Only for admin use!
   */
  async getAllPrivateKeys(userId: string) {
    console.log(`🔍 [WalletService] [getAllPrivateKeys] Getting all private keys for userId: ${userId}`);

    // Get all wallets for this user
    const wallets = await this.userWalletRepository.find({
      where: { userId },
    });

    if (wallets.length === 0) {
      throw new NotFoundException(`No wallets found for user: ${userId}`);
    }

    const result: any = {};

    for (const wallet of wallets) {
      const privateKey = this.encryptionService.decryptPrivateKey(wallet.encPrivKey);

      if (wallet.walletType === WalletType.SOLANA) {
        result.solana = {
          address: wallet.address,
          private_key: privateKey,
        };
      } else if (wallet.walletType === WalletType.EVM) {
        result.evm = {
          address: wallet.address,
          private_key: privateKey,
        };
      }
    }

    console.log(`✅ [WalletService] [getAllPrivateKeys] Retrieved ${wallets.length} private key(s)`);

    return result;
  }

  /**
   * Transfer wallet ownership to another user
   */
  async transferWallet(address: string, newUserId: string): Promise<UserWalletEntity> {
    console.log(`🔍 [WalletService] [transferWallet] Transferring wallet ${address} to newUserId: ${newUserId}`);

    const wallet = await this.getWalletByAddress(address);

    wallet.userId = newUserId;
    const updatedWallet = await this.userWalletRepository.save(wallet);

    console.log(`✅ [WalletService] [transferWallet] Wallet transferred successfully`);
    return updatedWallet;
  }
}

