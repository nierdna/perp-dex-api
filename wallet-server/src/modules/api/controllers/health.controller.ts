import { AdminConfigRepository } from '@/database/repositories';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import {
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FormatResponseInterceptor } from '../interceptors';
import { ScanMetricsService } from '@/worker/services/scan-metrics.service';
import { RpcManagerService } from '@/worker/services/rpc-manager.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private adminConfigRepository: AdminConfigRepository,
    private scanMetricsService: ScanMetricsService,
    private rpcManagerService: RpcManagerService,
  ) { }

  funErr() {
    console.log('Test error ');
    try {
      throw new Error('Test error');
    } catch (e) {
      throw e;
    }
  }

  @Get('')
  @ResponseMessage('Hello')
  @ApiOperation({ summary: 'Basic health check endpoint' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API is healthy',
  })
  async healthCheck() {
    return 1;
  }

  @Get('check-db')
  @ApiOperation({ summary: 'Check database connection' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Database connection is healthy',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Database connection failed',
  })
  async checkDB() {
    const result = await this.adminConfigRepository.findOne({ where: {} });
    return result || { status: 'Database connected, but no admin config found' };
  }

  @Get('throw')
  @ApiOperation({ summary: 'Testing error handling' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'This endpoint always throws an error',
  })
  throwError() {
    this.funErr();
  }

  @Get('scan-metrics')
  @ApiOperation({ summary: 'Get deposit scan metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns scan performance metrics',
  })
  getScanMetrics() {
    return {
      success: true,
      data: {
        scanMetrics: this.scanMetricsService.getFormattedMetrics(),
        rpcMetrics: this.rpcManagerService.getStats(),
      },
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns system health status',
  })
  getHealthStatus() {
    const scanMetrics = this.scanMetricsService.getMetrics();
    const rpcStats = this.rpcManagerService.getStats();

    return {
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
        lastScan: scanMetrics.lastScanTimestamp,
        rpcQueueLength: rpcStats.queueLength,
      },
    };
  }
}
