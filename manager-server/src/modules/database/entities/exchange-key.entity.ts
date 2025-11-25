import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('exchange_keys')
export class ExchangeKeyEntity extends BaseEntity {
    @Column({ name: 'user_id' })
    @Index()
    userId: string;

    @Column()
    exchange: string; // 'aster' | 'lighter'

    @Column({ type: 'text', name: 'api_key_enc' })
    apiKeyEnc: string;

    @Column({ type: 'text', name: 'api_secret_enc' })
    apiSecretEnc: string;

    @Column({ default: true, name: 'is_active' })
    isActive: boolean;
}
