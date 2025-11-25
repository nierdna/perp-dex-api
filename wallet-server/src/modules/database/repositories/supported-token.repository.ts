import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupportedTokenEntity } from '../entities';

@Injectable()
export class SupportedTokenRepository extends Repository<SupportedTokenEntity> {
    constructor(private dataSource: DataSource) {
        super(SupportedTokenEntity, dataSource.createEntityManager());
    }
}
