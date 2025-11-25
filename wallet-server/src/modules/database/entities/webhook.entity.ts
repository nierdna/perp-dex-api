import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('webhooks')
export class WebhookEntity extends BaseEntity {
    @Column({ unique: true })
    @Index()
    url: string; // Webhook endpoint URL

    @Column({ type: 'bytea', name: 'enc_secret' })
    encSecret: Buffer; // Encrypted secret for HMAC signature

    @Column({ default: true, name: 'is_active' })
    @Index()
    isActive: boolean; // Whether webhook is active

    @Column({ default: 0, name: 'consecutive_failures' })
    consecutiveFailures: number; // Counter for consecutive failed deliveries

    @Column({ nullable: true, type: 'timestamp', name: 'last_failure_at' })
    lastFailureAt?: Date; // When last failure occurred
}
