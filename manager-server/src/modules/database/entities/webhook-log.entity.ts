import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum WebhookStatus {
    SUCCESS = 'success',
    FAILED = 'failed',
    INVALID_SIGNATURE = 'invalid_signature',
}

@Entity('webhook_logs')
export class WebhookLogEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @Index()
    source: string; // e.g., 'wallet-server'

    @Column()
    endpoint: string; // e.g., '/webhooks/deposit-callback'

    @Column({ type: 'jsonb' })
    payload: any;

    @Column({ nullable: true })
    signature: string;

    @Column({
        type: 'enum',
        enum: WebhookStatus,
    })
    status: WebhookStatus;

    @Column({ nullable: true })
    errorMessage: string;

    @Column({ nullable: true })
    depositId: string; // Link to deposit_transactions if processed successfully

    @Column({ type: 'jsonb', nullable: true })
    metadata: any; // Additional info (processing time, etc.)

    @CreateDateColumn()
    receivedAt: Date;
}
