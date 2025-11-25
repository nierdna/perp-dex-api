import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@/database/entities/user.entity';
import { TelegramService } from './telegram.service';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        private readonly jwtService: JwtService,
        private readonly telegramService: TelegramService, // Injected TelegramService
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
            await this.telegramService.notifyNewUser(username, id); // Added Telegram notification
            console.log(`New user created: ${username}`);
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
        };
    }
}
