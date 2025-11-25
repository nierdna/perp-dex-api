import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot = require('node-telegram-bot-api');

@Injectable()
export class TelegramService implements OnModuleInit {
    private bot: TelegramBot;
    private adminChatId: string;
    private adminTopicId: string;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        this.adminChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
        this.adminTopicId = this.configService.get<string>('TELEGRAM_ADMIN_TOPIC');

        if (token) {
            this.bot = new TelegramBot(token, { polling: false });
            console.log('Telegram Bot initialized');
        } else {
            console.warn('TELEGRAM_BOT_TOKEN not found');
        }
    }

    async sendMessage(message: string) {
        if (this.bot && this.adminChatId) {
            try {
                const options: any = { parse_mode: 'HTML' };

                // Add topic/thread ID if configured
                if (this.adminTopicId) {
                    options.message_thread_id = parseInt(this.adminTopicId);
                }

                await this.bot.sendMessage(this.adminChatId, message, options);
            } catch (error) {
                console.error('Failed to send Telegram message:', error);
            }
        }
    }

    async notifyNewUser(username: string, twitterId: string) {
        const message =
            `🎉 <b>New User Registered</b>

👤 <b>Username:</b> @${username}
🔑 <b>Twitter ID:</b> ${twitterId}

⚠️ <b>Action Required:</b>
Please setup API Keys for this user in the admin panel.`;

        await this.sendMessage(message);
    }

}
