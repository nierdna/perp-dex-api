import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService, EncryptionService, AuditLogService, WalletService, WebhookService, TelegramService } from './services';
import { ConfigModule } from '@nestjs/config';

const services = [OpenAIService, EncryptionService, AuditLogService, WalletService, WebhookService, TelegramService];

@Module({
  imports: [DatabaseModule, ConfigModule],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule { }

