import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface QueuedRequest {
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

@Injectable()
export class RpcManagerService {
    private readonly logger = new Logger(RpcManagerService.name);
    private requestQueue: QueuedRequest[] = [];
    private isProcessing = false;
    private readonly MAX_REQUESTS_PER_SECOND: number;
    private requestCount = 0;
    private lastResetTime = Date.now();
    private totalRequestsProcessed = 0;
    private totalErrors = 0;

    constructor(private configService: ConfigService) {
        this.MAX_REQUESTS_PER_SECOND = parseInt(
            this.configService.get('RPC_MAX_REQUESTS_PER_SECOND') || '100'
        );

        this.logger.log(`🚀 RPC Manager initialized with rate limit: ${this.MAX_REQUESTS_PER_SECOND} req/s`);
    }

    /**
     * Execute an RPC call with rate limiting
     */
    async executeRpcCall<T>(rpcCall: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                execute: rpcCall,
                resolve,
                reject,
            });

            this.processQueue();
        });
    }

    /**
     * Process queued RPC requests with rate limiting
     */
    private async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;

        this.isProcessing = true;

        while (this.requestQueue.length > 0) {
            // Reset counter every second
            const now = Date.now();
            if (now - this.lastResetTime >= 1000) {
                this.requestCount = 0;
                this.lastResetTime = now;
            }

            // Check rate limit
            if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
                // Wait until next second
                const waitTime = 1000 - (now - this.lastResetTime);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            const request = this.requestQueue.shift();
            if (request) {
                this.requestCount++;
                this.totalRequestsProcessed++;

                try {
                    const result = await request.execute();
                    request.resolve(result);
                } catch (error) {
                    this.totalErrors++;
                    this.logger.error(`RPC call failed: ${error.message}`);
                    request.reject(error);
                }
            }
        }

        this.isProcessing = false;
    }

    /**
     * Get RPC manager statistics
     */
    getStats() {
        return {
            queueLength: this.requestQueue.length,
            requestsPerSecond: this.requestCount,
            maxRequestsPerSecond: this.MAX_REQUESTS_PER_SECOND,
            totalRequestsProcessed: this.totalRequestsProcessed,
            totalErrors: this.totalErrors,
            errorRate: this.totalRequestsProcessed > 0
                ? (this.totalErrors / this.totalRequestsProcessed * 100).toFixed(2) + '%'
                : '0%',
        };
    }
}
