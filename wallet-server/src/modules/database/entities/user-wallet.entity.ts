import { Entity, Column, Index, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum WalletType {
  SOLANA = 'SOLANA',
  EVM = 'EVM',
}

export enum ScanPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('user_wallets')
export class UserWalletEntity extends BaseEntity {
  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: WalletType,
    name: 'wallet_type',
  })
  @Index()
  walletType: WalletType;

  @Column({ unique: true })
  @Index()
  address: string;

  @Column({ type: 'bytea', name: 'enc_priv_key' })
  encPrivKey: Buffer;

  @Column({ nullable: true, type: 'bytea', name: 'enc_meta' })
  encMeta?: Buffer;

  @Column({ default: 'aes_gcm' })
  custodian: string;

  @Column({
    type: 'timestamp',
    name: 'last_activity_at',
    nullable: true
  })
  @Index()
  lastActivityAt?: Date;

  @Column({
    type: 'enum',
    enum: ScanPriority,
    name: 'scan_priority',
    default: ScanPriority.MEDIUM,
  })
  @Index()
  scanPriority: ScanPriority;

  /**
   * Normalize address to lowercase before insert (only for EVM)
   */
  @BeforeInsert()
  normalizeAddressBeforeInsert() {
    if (this.address && this.walletType === WalletType.EVM) {
      this.address = this.address.toLowerCase();
    }
  }

  /**
   * Normalize address to lowercase before update (only for EVM)
   */
  @BeforeUpdate()
  normalizeAddressBeforeUpdate() {
    if (this.address && this.walletType === WalletType.EVM) {
      this.address = this.address.toLowerCase();
    }
  }
}
