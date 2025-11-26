import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('wallet_balances')
@Unique(['walletId', 'chainId', 'token'])
export class WalletBalanceEntity extends BaseEntity {
    @Column({ name: 'wallet_id' })
    @Index()
    walletId: string; // FK to user_wallets.id

    @Column({ name: 'chain_id' })
    @Index()
    chainId: number; // 900=Solana, 8453=Base, 42161=Arbitrum

    @Column()
    token: string; // 'USDC', 'USDT', 'SOL', 'ETH'

    @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
    balance: string; // TypeORM decimal returns string, not number


    @Column({ type: 'timestamp', nullable: true, name: 'last_updated_at' })
    lastUpdatedAt: Date;
}
