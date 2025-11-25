import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('supported_tokens')
@Unique(['chainId', 'address'])
export class SupportedTokenEntity extends BaseEntity {
    @Column({ name: 'chain_id' })
    @Index()
    chainId: number; // 901=Solana, 8453=Base, 42161=Arbitrum

    @Column()
    @Index()
    symbol: string; // 'USDC', 'USDT', 'SOL', 'ETH'

    @Column()
    name: string; // 'USD Coin', 'Tether USD'

    @Column()
    address: string; // Contract Address (EVM) or Token Mint Address (Solana)

    @Column({ type: 'int' })
    decimals: number; // Token decimals (usually 6 or 18)

    @Column({ nullable: true })
    icon?: string; // Token icon URL

    @Column({ default: true, name: 'is_active' })
    isActive: boolean; // Whether this token is currently supported
}
