import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminConfigRepository, UserWalletRepository, AuditLogRepository, WalletBalanceRepository, SupportedTokenRepository, DepositRepository, WebhookRepository } from './repositories';
import { AdminConfigEntity, UserWalletEntity, AuditLogEntity, WalletBalanceEntity, SupportedTokenEntity, DepositEntity, WebhookEntity } from './entities';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [AdminConfigRepository, UserWalletRepository, AuditLogRepository, WalletBalanceRepository, SupportedTokenRepository, DepositRepository, WebhookRepository];

const services = [];

const entities = [AdminConfigEntity, UserWalletEntity, AuditLogEntity, WalletBalanceEntity, SupportedTokenEntity, DepositEntity, WebhookEntity];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => config.get('db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configDb],
    }),
  ],
  controllers: [],
  providers: [...repositories, ...services, SeedDatabase],
  exports: [...repositories, ...services],
})
export class DatabaseModule { }
