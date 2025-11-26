import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Service to send notifications to a Telegram channel / topic.
 * Reads bot token, chat id and optional topic id from environment variables.
 */
@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly botToken: string;
    private readonly chatId: string;
    private readonly topicId?: string;

    constructor(private configService: ConfigService) {
        this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        this.chatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
        this.topicId = this.configService.get<string>('TELEGRAM_ADMIN_TOPIC');

        if (!this.botToken || !this.chatId) {
            this.logger.warn('Telegram bot token or chat id not configured – Telegram notifications disabled');
        }
    }

    /**
     * Send a simple text message to the configured Telegram chat (or topic).
     */
    async sendMessage(message: string): Promise<void> {
        if (!this.botToken || !this.chatId) {
            this.logger.warn('⚠️ Telegram not configured - skipping notification');
            return; // silently ignore when not configured
        }

        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const payload: any = {
            chat_id: this.chatId,
            text: message,
            parse_mode: 'MarkdownV2', // Using MarkdownV2 for better formatting
        };

        if (this.topicId) {
            payload.message_thread_id = Number(this.topicId);
        }

        try {
            const response = await axios.post(url, payload);
            this.logger.log('✅ Telegram notification sent successfully');
        } catch (err) {
            const errorMsg = err.response?.data?.description || err.message;
            this.logger.error(`❌ Failed to send Telegram notification: ${errorMsg}`);
            throw new Error(`Telegram API error: ${errorMsg}`);
        }
    }

    /**
     * Escape special characters for MarkdownV2
     */
    private escapeMarkdownV2(text: string): string {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
    }

    /**
     * Helper to format a deposit alert.
     */
    formatDepositAlert(data: {
        userId: string;
        walletAddress: string;
        amount: number;
        tokenSymbol: string;
        chainName: string;
        txHash?: string | null;
    }): string {
        const { userId, walletAddress, amount, tokenSymbol, chainName } = data;

        // Escape all dynamic content
        const escapedUserId = this.escapeMarkdownV2(userId);
        const escapedWallet = this.escapeMarkdownV2(walletAddress);
        const escapedAmount = this.escapeMarkdownV2(amount.toFixed(4)); // Round to 4 decimals
        const escapedToken = this.escapeMarkdownV2(tokenSymbol);
        const escapedChain = this.escapeMarkdownV2(chainName);

        return `
🎉 *DEPOSIT RECEIVED* 🎉

👤 *User:* \`${escapedUserId}\`
💳 *Wallet:* \`${escapedWallet}\`
💰 *Amount:* *${escapedAmount} ${escapedToken}*
⛓ *Chain:* ${escapedChain}
`;
    }
}
