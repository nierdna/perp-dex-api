import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('exchange_keys')
export class ExchangeKeyEntity extends BaseEntity {
    @Column()
    @Index()
    userId: string;

    @Column()
    exchange: string; // 'aster' | 'lighter'

    @Column({ type: 'text' })
    apiKeyEnc: string;

    @Column({ type: 'text' })
    apiSecretEnc: string;

    @Column({ default: true })
    isActive: boolean;
}
