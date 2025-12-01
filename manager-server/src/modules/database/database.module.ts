import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminConfigRepository } from './repositories';
import { AdminConfigEntity } from './entities/admin-config.entity';
import { DepositTransactionEntity } from './entities/deposit-transaction.entity';
import { WebhookLogEntity } from './entities/webhook-log.entity';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [AdminConfigRepository];

const services = [];

import { UserEntity } from './entities/user.entity';
import { UserWalletEntity } from './entities/user-wallet.entity';
import { WalletTransferHistoryEntity } from './entities/wallet-transfer-history.entity';

const entities = [
  AdminConfigEntity,
  DepositTransactionEntity,
  WebhookLogEntity,
  UserEntity,
  UserWalletEntity,
  WalletTransferHistoryEntity
];

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
