import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AdminConfigRepository, SupportedTokenRepository } from '../repositories';

@Injectable()
export class SeedDatabase implements OnApplicationBootstrap {
  @Inject(AdminConfigRepository)
  private readonly adminConfigRepository: AdminConfigRepository;

  @Inject(SupportedTokenRepository)
  private readonly supportedTokenRepository: SupportedTokenRepository;

  constructor() { }

  async onApplicationBootstrap() {
    const isApi = Boolean(Number(process.env.IS_API || 0));
    if (!isApi) {
      return;
    }
    const start = Date.now();

    console.log('🌱 [SeedDatabase] Starting database seeding...');

    // Seed default API key
    await this.seedDefaultApiKey();

    // Seed supported tokens
    await this.seedSupportedTokens();

    const end = Date.now();

    console.log(`⏱️  [SeedDatabase] Time to seed database: ${(end - start) / 1000}s`);
    console.log('✅ [SeedDatabase] SEED DATABASE SUCCESSFULLY');
  }

  /**
   * Seed default API key for development/testing
   */
  private async seedDefaultApiKey() {
    console.log('🔑 [SeedDatabase] Checking API keys...');

    // Check if api_keys already exists
    const existingConfig = await this.adminConfigRepository.findOne({
      where: { key: 'api_keys' },
    });

    // Get default API key from environment or use hardcoded fallback
    const defaultApiKey = process.env.DEFAULT_API_KEY || 'mongker';

    const isCustomKey = !!process.env.DEFAULT_API_KEY;

    const apiKeysData = [
      {
        key: defaultApiKey,
        name: 'Default Development Key',
        active: true,
        created_at: new Date().toISOString(),
      },
    ];

    if (existingConfig) {
      // Always update to ensure correct key
      existingConfig.data = apiKeysData;
      await this.adminConfigRepository.save(existingConfig);
      console.log('✅ [SeedDatabase] Updated API keys config');
    } else {
      // Create new config
      const newConfig = this.adminConfigRepository.create({
        key: 'api_keys',
        data: apiKeysData,
      });
      await this.adminConfigRepository.save(newConfig);
      console.log('✅ [SeedDatabase] Created new API keys config');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (isCustomKey) {
      console.log('🔑 DEFAULT API KEY (From Environment Variable)');
    } else {
      console.log('🔑 DEFAULT API KEY (For Development/Testing Only)');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ${defaultApiKey}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    if (!isCustomKey) {
      console.log('⚠️  WARNING: Using hardcoded default key for development only!');
      console.log('    To use custom key, set DEFAULT_API_KEY in .env file');
    }
    console.log('    For production, generate secure keys using:');
    console.log('    cd scripts && pnpm run generate-api-key');
    console.log('');
  }

  /**
   * Seed supported tokens (whitelist of legitimate tokens)
   */
  private async seedSupportedTokens() {
    console.log('💎 [SeedDatabase] Seeding supported tokens...');

    const tokens = [
      // Solana Mainnet
      {
        chainId: 901,
        symbol: 'USDC',
        name: 'USD Coin',
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        icon: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
        isActive: true,
      },
      {
        chainId: 901,
        symbol: 'USDT',
        name: 'Tether USD',
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
        icon: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
        isActive: true,
      },
      // Base Mainnet
      {
        chainId: 8453,
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        icon: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
        isActive: true,
      },
      // Arbitrum One
      {
        chainId: 42161,
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
        icon: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
        isActive: true,
      },
      {
        chainId: 42161,
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: 6,
        icon: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
        isActive: true,
      },
    ];

    for (const token of tokens) {
      const existing = await this.supportedTokenRepository.findOne({
        where: { chainId: token.chainId, address: token.address },
      });

      if (!existing) {
        const entity = this.supportedTokenRepository.create(token);
        await this.supportedTokenRepository.save(entity);
        console.log(`  ✅ Added ${token.symbol} on chain ${token.chainId}`);
      } else {
        console.log(`  ⚠️  ${token.symbol} on chain ${token.chainId} already exists`);
      }
    }

    console.log('✅ [SeedDatabase] Supported tokens seeded successfully');
  }
}
