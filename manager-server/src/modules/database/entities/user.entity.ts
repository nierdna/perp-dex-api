import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
    @Column({ unique: true, name: 'twitter_id' })
    @Index()
    twitterId: string;

    @Column()
    username: string;

    @Column({ nullable: true, name: 'display_name' })
    displayName: string;

    @Column({ nullable: true, name: 'avatar_url' })
    avatarUrl: string;

    @Column({ default: true, name: 'is_active' })
    isActive: boolean;

    @Column({ default: 'user' })
    role: string;

    @Column({ type: 'decimal', precision: 20, scale: 8, default: '0' })
    balance: string;
}
