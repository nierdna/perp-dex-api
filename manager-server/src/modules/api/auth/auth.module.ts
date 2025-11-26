import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '@/business/services/auth.service';
import { TwitterStrategy } from './twitter.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UserEntity } from '@/database/entities/user.entity';
import { TelegramService } from '@/business/services/telegram.service';
import { WalletIntegrationService } from '@/business/services/wallet-integration.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserEntity]),
        PassportModule,
        HttpModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET_KEY'),
                signOptions: { expiresIn: '7d' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, TwitterStrategy, JwtStrategy, TelegramService, WalletIntegrationService],
    exports: [AuthService],
})
export class AuthModule { }
