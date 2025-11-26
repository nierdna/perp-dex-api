import { Injectable, Logger } from '@nestjs/common';

interface ScanMetrics {
    totalScans: number;
    totalWalletsScanned: number;
    totalRpcCalls: number;
    totalDepositsDetected: number;
    averageScanDuration: number;
    lastScanDuration: number;
    lastScanTimestamp: Date | null;
    errors: number;
}

@Injectable()
export class ScanMetricsService {
    private readonly logger = new Logger(ScanMetricsService.name);

    private metrics: ScanMetrics = {
        totalScans: 0,
        totalWalletsScanned: 0,
        totalRpcCalls: 0,
        totalDepositsDetected: 0,
        averageScanDuration: 0,
        lastScanDuration: 0,
        lastScanTimestamp: null,
        errors: 0,
    };

    /**
     * Record a completed scan
     */
    recordScan(duration: number, walletsScanned: number) {
        this.metrics.totalScans++;
        this.metrics.totalWalletsScanned += walletsScanned;
        this.metrics.lastScanDuration = duration;
        this.metrics.lastScanTimestamp = new Date();

        // Calculate running average
        this.metrics.averageScanDuration =
            (this.metrics.averageScanDuration * (this.metrics.totalScans - 1) + duration) /
            this.metrics.totalScans;
    }

    /**
     * Record a deposit detection
     */
    recordDeposit() {
        this.metrics.totalDepositsDetected++;
    }

    /**
     * Record an error
     */
    recordError() {
        this.metrics.errors++;
    }

    /**
     * Record RPC calls
     */
    recordRpcCalls(count: number) {
        this.metrics.totalRpcCalls += count;
    }

    /**
     * Get current metrics
     */
    getMetrics(): ScanMetrics {
        return { ...this.metrics };
    }

    /**
     * Get formatted metrics for display
     */
    getFormattedMetrics() {
        return {
            ...this.metrics,
            averageScanDuration: `${this.metrics.averageScanDuration.toFixed(2)}s`,
            lastScanDuration: `${this.metrics.lastScanDuration.toFixed(2)}s`,
            errorRate: this.metrics.totalScans > 0
                ? `${((this.metrics.errors / this.metrics.totalScans) * 100).toFixed(2)}%`
                : '0%',
            avgWalletsPerScan: this.metrics.totalScans > 0
                ? Math.round(this.metrics.totalWalletsScanned / this.metrics.totalScans)
                : 0,
            avgRpcCallsPerScan: this.metrics.totalScans > 0
                ? Math.round(this.metrics.totalRpcCalls / this.metrics.totalScans)
                : 0,
        };
    }

    /**
     * Reset metrics (for testing or manual reset)
     */
    resetMetrics() {
        this.metrics = {
            totalScans: 0,
            totalWalletsScanned: 0,
            totalRpcCalls: 0,
            totalDepositsDetected: 0,
            averageScanDuration: 0,
            lastScanDuration: 0,
            lastScanTimestamp: null,
            errors: 0,
        };
        this.logger.log('📊 Metrics reset');
    }
}
