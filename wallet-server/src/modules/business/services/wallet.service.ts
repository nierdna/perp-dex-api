import { Injectable, NotFoundException } from '@nestjs/common';
import { UserWalletRepository } from '@/database/repositories';
import { UserWalletEntity, WalletType } from '@/database/entities';
import { EncryptionService } from './encryption.service';
import { Wallet } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export type SupportedChain = 'SOLANA' | 'EVM';

@Injectable()
export class WalletService {
  constructor(
    private userWalletRepository: UserWalletRepository,
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
}

