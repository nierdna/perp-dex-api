import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('wallet_transfer_history')
export class WalletTransferHistoryEntity extends BaseEntity {
    @Column({ name: 'wallet_address' })
    @Index()
    walletAddress: string;

    @Column({ name: 'from_user_id', nullable: true })
    fromUserId: string;

    @Column({ name: 'to_user_id' })
    @Index()
    toUserId: string;

    @Column({ name: 'transferred_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    transferredAt: Date;

    @Column({ nullable: true })
    reason: string;
}
