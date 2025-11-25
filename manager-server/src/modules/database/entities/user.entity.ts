import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
    @Column({ unique: true })
    @Index()
    twitterId: string;

    @Column()
    username: string;

    @Column({ nullable: true })
    displayName: string;

    @Column({ nullable: true })
    avatarUrl: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 'user' })
    role: string;
}
