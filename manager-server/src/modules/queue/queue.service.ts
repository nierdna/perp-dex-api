import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAME, QUEUE_PROCESSOR } from '@/shared/constants/queue';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  constructor(
    @InjectQueue(QUEUE_NAME.USER)
    private userQueue: Queue,
  ) { }

  async fetchDataWhenSignUp(username: string) {
    this.logger.log(`🚀 fetchDataWhenSignUp for username: ${username}`);
    await this.userQueue.add(
      QUEUE_PROCESSOR.USER.FETCH_DATA_WHEN_SIGN_UP,
      { username },
      { removeOnComplete: 20, removeOnFail: true },
    );
  }

  // New method to enqueue wallet creation retry
  async addCreateWalletJob(userId: string) {
    this.logger.log(`🕒 Enqueue create wallet job for user ${userId}`);
    await this.userQueue.add(
      QUEUE_PROCESSOR.USER.CREATE_WALLET,
      { userId },
      { removeOnComplete: 20, removeOnFail: true },
    );
  }
}
