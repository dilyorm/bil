// Performance monitoring and alerting system
import { Logger } from '../utils/logger';
import { applicationMetrics } from './metrics';
import { alertingService } from './alerting';

export interface PerformanceThresholds {
  responseTime: number;        // milliseconds
  memoryUsage: number;        // percentage
  cpuUsage: number;           // percentage
  errorRate: number;          // percentage
  requestRate: number;        // requests per minute
}

export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  requestRate: number;
  timestamp: Date;
}

export class PerformanceMonitor {
  private logger: Logger;
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: PerformanceMetrics | null = null;

  constructor() {
    this.logger = new Logger('PerformanceMonitor');
    
    // Default thresholds
    this.thresholds = {
      responseTime: 5000,    // 5 seconds
      memoryUsage: 80,       // 80%
      cpuUsage: 80,          // 80%
      errorRate: 5,          // 5%
      requestRate: 1000      // 1000 requests per minute
    };

    this.startMonitoring();
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info('Performance thresholds updated', { thresholds: this.thresholds });
  }

  private startMonitoring(): void {
    // Monitor performance every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkPerformance().catch(error => {
        this.logger.error('Performance monitoring failed', { error });
      });
    }, 30000);

    this.logger.info('Performance monitoring started');
  }

  private async checkPerformance(): Promise<void> {
    const metrics = await this.collectMetrics();
    this.lastMetrics = metrics;

    // Check each metric against thresholds
    await this.checkResponseTime(metrics.responseTime);
    await this.checkMemoryUsage(metrics.memoryUsage);
    await this.checkCpuUsage(metrics.cpuUsage);
    await this.checkErrorRate(metrics.errorRate);
    await this.checkRequestRate(metrics.requestRate);

    this.logger.debug('Performance metrics collected', { metrics });
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const metricsCollector = applicationMetrics.getMetricsCollector();
    
    // Get response time statistics
    const responseTimeStats = metricsCollector.getMetricStats('api.request.duration', 300000); // Last 5 minutes
    const responseTime = {
      avg: responseTimeStats?.avg || 0,
      p95: responseTimeStats?.p95 || 0,
      p99: responseTimeStats?.p99 || 0
    };

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    // CPU usage (simplified - in production, use more sophisticated monitoring)
    const cpuUsage = this.calculateCpuUsage();

    // Error rate
    const totalRequests = metricsCollector.getMetricStats('api.requests.total', 300000);
    const errorRequests = metricsCollector.getMetricStats('api.requests.errors', 300000);
    const errorRate = totalRequests?.count > 0 ? 
      ((errorRequests?.count || 0) / totalRequests.count) * 100 : 0;

    // Request rate (requests per minute)
    const requestRate = totalRequests?.count ? 
      (totalRequests.count / 5) : 0; // 5-minute window to per-minute

    return {
      responseTime,
      memoryUsage: memoryPercentage,
      cpuUsage,
      errorRate,
      requestRate,
      timestamp: new Date()
    };
  }

  private calculateCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, you'd use more sophisticated monitoring
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    
    // Convert to percentage (very simplified)
    return Math.min((totalUsage / 1000000) / 10, 100); // Rough approximation
  }

  private async checkResponseTime(responseTime: { avg: number; p95: number; p99: number }): Promise<void> {
    if (responseTime.p95 > this.thresholds.responseTime) {
      await alertingService.alertPerformance(
        'response_time_p95',
        responseTime.p95,
        this.thresholds.responseTime
      );
    }

    if (responseTime.avg > this.thresholds.responseTime * 0.7) {
      await alertingService.alertPerformance(
        'response_time_avg',
        responseTime.avg,
        this.thresholds.responseTime * 0.7
      );
    }
  }

  private async checkMemoryUsage(memoryUsage: number): Promise<void> {
    if (memoryUsage > this.thresholds.memoryUsage) {
      await alertingService.alertSystemResource(
        'memory',
        memoryUsage,
        this.thresholds.memoryUsage
      );
    }
  }

  private async checkCpuUsage(cpuUsage: number): Promise<void> {
    if (cpuUsage > this.thresholds.cpuUsage) {
      await alertingService.alertSystemResource(
        'cpu',
        cpuUsage,
        this.thresholds.cpuUsage
      );
    }
  }

  private async checkErrorRate(errorRate: number): Promise<void> {
    if (errorRate > this.thresholds.errorRate) {
      await alertingService.alertPerformance(
        'error_rate',
        errorRate,
        this.thresholds.errorRate
      );
    }
  }

  private async checkRequestRate(requestRate: number): Promise<void> {
    if (requestRate > this.thresholds.requestRate) {
      await alertingService.alertPerformance(
        'request_rate',
        requestRate,
        this.thresholds.requestRate
      );
    }
  }

  // Get current performance metrics
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.lastMetrics;
  }

  // Get performance summary
  getPerformanceSummary(): any {
    if (!this.lastMetrics) {
      return { status: 'no_data', message: 'No performance data available yet' };
    }

    const metrics = this.lastMetrics;
    const issues: string[] = [];

    if (metrics.responseTime.p95 > this.thresholds.responseTime) {
      issues.push(`High response time: ${metrics.responseTime.p95}ms`);
    }

    if (metrics.memoryUsage > this.thresholds.memoryUsage) {
      issues.push(`High memory usage: ${metrics.memoryUsage.toFixed(1)}%`);
    }

    if (metrics.cpuUsage > this.thresholds.cpuUsage) {
      issues.push(`High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`);
    }

    if (metrics.errorRate > this.thresholds.errorRate) {
      issues.push(`High error rate: ${metrics.errorRate.toFixed(1)}%`);
    }

    if (metrics.requestRate > this.thresholds.requestRate) {
      issues.push(`High request rate: ${metrics.requestRate.toFixed(0)} req/min`);
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      timestamp: metrics.timestamp,
      metrics: {
        responseTime: `${metrics.responseTime.avg.toFixed(0)}ms avg, ${metrics.responseTime.p95.toFixed(0)}ms p95`,
        memoryUsage: `${metrics.memoryUsage.toFixed(1)}%`,
        cpuUsage: `${metrics.cpuUsage.toFixed(1)}%`,
        errorRate: `${metrics.errorRate.toFixed(1)}%`,
        requestRate: `${metrics.requestRate.toFixed(0)} req/min`
      },
      issues,
      thresholds: this.thresholds
    };
  }

  // Manual performance check
  async performManualCheck(): Promise<PerformanceMetrics> {
    const metrics = await this.collectMetrics();
    this.lastMetrics = metrics;
    return metrics;
  }

  // Stop monitoring
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Performance monitoring stopped');
    }
  }

  // Restart monitoring
  restart(): void {
    this.stop();
    this.startMonitoring();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();