import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService } from './services/openai.service';
import { DepositWebhookService } from './services/deposit-webhook.service';
import { DepositTransactionEntity } from '../database/entities/deposit-transaction.entity';
import { WebhookLogEntity } from '../database/entities/webhook-log.entity';
import { ConfigModule } from '@nestjs/config';

const services = [OpenAIService, DepositWebhookService];

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    TypeOrmModule.forFeature([DepositTransactionEntity, WebhookLogEntity]),
  ],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule { }
