import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService } from './services/openai.service';
import { DepositWebhookService } from './services/deposit-webhook.service';
import { WalletIntegrationService } from './services/wallet-integration.service';
import { DepositTransactionEntity } from '../database/entities/deposit-transaction.entity';
import { WebhookLogEntity } from '../database/entities/webhook-log.entity';
import { UserWalletEntity } from '../database/entities/user-wallet.entity';
import { WalletTransferHistoryEntity } from '../database/entities/wallet-transfer-history.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ConfigModule } from '@nestjs/config';

const services = [OpenAIService, DepositWebhookService, WalletIntegrationService];

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([
      DepositTransactionEntity,
      WebhookLogEntity,
      UserWalletEntity,
      WalletTransferHistoryEntity,
      UserEntity,
    ]),
  ],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule { }
