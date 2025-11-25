import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('deposits')
export class DepositEntity extends BaseEntity {
    @Column({ name: 'wallet_id' })
    @Index()
    walletId: string; // FK to user_wallets.id

    @Column({ name: 'user_id' })
    @Index()
    userId: string; // User identifier

    @Column({ name: 'chain_id' })
    @Index()
    chainId: number; // 901=Solana, 8453=Base, 42161=Arbitrum

    @Column({ name: 'token_address' })
    tokenAddress: string; // Token contract/mint address

    @Column({ name: 'token_symbol' })
    tokenSymbol: string; // USDC, USDT

    @Column({ type: 'decimal', precision: 20, scale: 6 })
    amount: number; // Deposit amount

    @Column({ type: 'decimal', precision: 20, scale: 6, name: 'previous_balance' })
    previousBalance: number; // Balance before deposit

    @Column({ type: 'decimal', precision: 20, scale: 6, name: 'new_balance' })
    newBalance: number; // Balance after deposit

    @Column({ nullable: true, name: 'tx_hash' })
    txHash?: string; // Transaction hash (if available)

    @Column({ type: 'timestamp', name: 'detected_at' })
    @Index()
    detectedAt: Date; // When deposit was detected

    @Column({ default: false, name: 'webhook_sent' })
    @Index()
    webhookSent: boolean; // Whether webhook was sent

    @Column({ nullable: true, type: 'timestamp', name: 'webhook_sent_at' })
    webhookSentAt?: Date; // When webhook was sent
}
