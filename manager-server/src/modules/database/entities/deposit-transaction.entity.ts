import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('deposit_transactions')
export class DepositTransactionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @Index()
    userId: string;

    @Column()
    walletAddress: string;

    @Column()
    chain: string;

    @Column()
    chainId: number;

    @Column()
    tokenSymbol: string;

    @Column()
    tokenAddress: string;

    @Column('decimal', { precision: 18, scale: 6 })
    amount: number;

    @Column({ nullable: true })
    txHash: string;

    @Column()
    depositId: string; // ID from wallet-server to prevent duplicates

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    rawData: any;
}
