import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AdminConfigRepository } from '../repositories';

@Injectable()
export class SeedDatabase implements OnApplicationBootstrap {
  @Inject(AdminConfigRepository)
  private readonly adminConfigRepository: AdminConfigRepository;

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
}
