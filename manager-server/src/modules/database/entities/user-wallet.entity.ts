import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('user_wallets')
@Index(['userId', 'chainKey'], { unique: true })
@Index(['address'], { unique: true })
export class UserWalletEntity extends BaseEntity {
    @Column({ name: 'user_id' })
    @Index()
    userId: string;

    @Column({ name: 'chain_key' }) // 'solana', 'base', 'arbitrum'
    chainKey: string;

    @Column({ name: 'chain_type' }) // 'EVM', 'SOLANA'
    chainType: string;

    @Column()
    address: string;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;
}
