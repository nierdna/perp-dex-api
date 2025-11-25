import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DepositEntity } from '../entities';

@Injectable()
export class DepositRepository extends Repository<DepositEntity> {
    constructor(private dataSource: DataSource) {
        super(DepositEntity, dataSource.createEntityManager());
    }
}
