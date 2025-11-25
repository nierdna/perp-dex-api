import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WebhookEntity } from '../entities';

@Injectable()
export class WebhookRepository extends Repository<WebhookEntity> {
    constructor(private dataSource: DataSource) {
        super(WebhookEntity, dataSource.createEntityManager());
    }
}
