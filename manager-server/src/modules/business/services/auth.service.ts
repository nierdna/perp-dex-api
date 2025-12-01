import { QueueService } from '@/queue/queue.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@/database/entities/user.entity';
import { TelegramService } from './telegram.service';
import { WalletIntegrationService } from './wallet-integration.service';
import { NotFoundException, Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        private readonly jwtService: JwtService,
        private readonly telegramService: TelegramService,
        private readonly walletIntegrationService: WalletIntegrationService,
        private readonly queueService: QueueService,
    ) { }

    async validateUser(profile: any): Promise<UserEntity> {
        const { id, username, displayName, photos } = profile;

        let user = await this.userRepository.findOne({ where: { twitterId: id } });

        if (!user) {
            user = this.userRepository.create({
                twitterId: id,
                username,
                displayName,
                avatarUrl: photos?.[0]?.value,
            });
            await this.userRepository.save(user);

            // Notify admin about new user
            await this.telegramService.notifyNewUser(username, id);
            console.log(`New user created: ${username}`);
        }

        // Ensure wallet exists for user (create if not exists)
        // We do this asynchronously to not block login
        // If wallet creation fails, user can still login
        try {
            await this.walletIntegrationService.createWallet(user.id);
            console.log(`✅ Wallet created/verified for user ${user.id}`);
        } catch (error) {
            // 409 = wallet already exists → ignore (already handled in service)
            if (error.response?.status === 409) {
                console.warn(`⚠️ Wallet already exists for user ${user.id}, skipping retry`);
            } else {
                console.error(`⚠️ Failed to create wallet for user ${user.id}:`, error.message);
                // Enqueue a background job to retry wallet creation later
                try {
                    await this.queueService.addCreateWalletJob(user.id);
                    console.log(`🕒 Enqueued wallet creation retry for user ${user.id}`);
                } catch (queueErr) {
                    console.error(`❌ Failed to enqueue wallet creation job: ${queueErr.message}`);
                }
            }
        }

        return user;
    }

    async login(user: UserEntity) {
        const payload = { sub: user.id, username: user.username };
        return {
            accessToken: this.jwtService.sign(payload),
        };
    }

    async getUserInfo(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            twitterId: user.twitterId,
            balance: user.balance || '0',
        };
    }
}
