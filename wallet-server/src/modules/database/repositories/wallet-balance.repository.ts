import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WalletBalanceEntity } from '../entities';

@Injectable()
export class WalletBalanceRepository extends Repository<WalletBalanceEntity> {
    constructor(private dataSource: DataSource) {
        super(WalletBalanceEntity, dataSource.createEntityManager());
    }
}
