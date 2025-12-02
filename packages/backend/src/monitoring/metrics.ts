// Application performance monitoring and metrics collection
import { Logger } from '../utils/logger';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string> | undefined;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface TimerMetric {
  name: string;
  startTime: number;
  tags?: Record<string, string> | undefined;
}

export class MetricsCollector {
  private logger: Logger;
  private metrics: Map<string, MetricData[]> = new Map();
  private activeTimers: Map<string, TimerMetric> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  constructor() {
    this.logger = new Logger('Metrics');
    this.startMetricsReporting();
  }

  // Counter metrics (incrementing values)
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const currentValue = this.counters.get(key) || 0;
    this.counters.set(key, currentValue + value);

    this.recordMetric({
      name,
      value: currentValue + value,
      timestamp: new Date(),
      tags,
      type: 'counter'
    });
  }

  // Gauge metrics (current value)
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);

    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'gauge'
    });
  }

  // Histogram metrics (distribution of values)
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'histogram'
    });
  }

  // Timer metrics
  startTimer(name: string, tags?: Record<string, string>): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeTimers.set(timerId, {
      name,
      startTime: Date.now(),
      tags
    });

    return timerId;
  }

  endTimer(timerId: string): number {
    const timer = this.activeTimers.get(timerId);
    if (!timer) {
      this.logger.warn(`Timer not found: ${timerId}`);
      return 0;
    }

    const duration = Date.now() - timer.startTime;
    this.activeTimers.delete(timerId);

    this.recordMetric({
      name: timer.name,
      value: duration,
      timestamp: new Date(),
      tags: timer.tags,
      type: 'timer'
    });

    return duration;
  }

  // Measure function execution time
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const timerId = this.startTimer(name, tags);
    try {
      const result = await fn();
      this.endTimer(timerId);
      this.incrementCounter(`${name}.success`, 1, tags);
      return result;
    } catch (error) {
      this.endTimer(timerId);
      this.incrementCounter(`${name}.error`, 1, tags);
      throw error;
    }
  }

  private recordMetric(metric: MetricData): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricHistory = this.metrics.get(metric.name)!;
    metricHistory.push(metric);

    // Keep only last 1000 entries per metric to prevent memory issues
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }
  }

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    return `${name}[${tagString}]`;
  }

  // Get metric statistics
  getMetricStats(name: string, timeWindow?: number): any {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    const relevantMetrics = metrics.filter(m => 
      m.timestamp.getTime() >= windowStart
    );

    if (relevantMetrics.length === 0) {
      return null;
    }

    const values = relevantMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate percentiles
    const sortedValues = [...values].sort((a, b) => a - b);
    const p50 = this.percentile(sortedValues, 0.5);
    const p95 = this.percentile(sortedValues, 0.95);
    const p99 = this.percentile(sortedValues, 0.99);

    return {
      count: relevantMetrics.length,
      sum,
      avg,
      min,
      max,
      p50,
      p95,
      p99,
      timeWindow: timeWindow || 'all'
    };
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  // Get all current metrics
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    // Add counters
    for (const [key, value] of this.counters.entries()) {
      result[`counter.${key}`] = value;
    }

    // Add gauges
    for (const [key, value] of this.gauges.entries()) {
      result[`gauge.${key}`] = value;
    }

    // Add metric statistics
    for (const [name] of this.metrics.entries()) {
      const stats = this.getMetricStats(name, 300000); // Last 5 minutes
      if (stats) {
        result[`stats.${name}`] = stats;
      }
    }

    return result;
  }

  private startMetricsReporting(): void {
    // Report metrics every minute
    setInterval(() => {
      const metrics = this.getAllMetrics();
      this.logger.info('Metrics report', { metrics });
    }, 60000);
  }
}

// Application-specific metrics
export class ApplicationMetrics {
  private metrics: MetricsCollector;

  constructor() {
    this.metrics = new MetricsCollector();
  }

  // API metrics
  recordAPIRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    const tags = { endpoint, method, status: statusCode.toString() };
    
    this.metrics.incrementCounter('api.requests.total', 1, tags);
    this.metrics.recordHistogram('api.request.duration', duration, tags);
    
    if (statusCode >= 400) {
      this.metrics.incrementCounter('api.requests.errors', 1, tags);
    }
  }

  // AI processing metrics
  recordAIProcessing(operation: string, duration: number, success: boolean, tokens?: number): void {
    const tags = { operation, success: success.toString() };
    
    this.metrics.incrementCounter('ai.requests.total', 1, tags);
    this.metrics.recordHistogram('ai.processing.duration', duration, tags);
    
    if (tokens) {
      this.metrics.recordHistogram('ai.tokens.used', tokens, tags);
    }

    if (!success) {
      this.metrics.incrementCounter('ai.requests.errors', 1, tags);
    }
  }

  // Device sync metrics
  recordDeviceSync(action: string, deviceType: string, success: boolean): void {
    const tags = { action, deviceType, success: success.toString() };
    
    this.metrics.incrementCounter('sync.operations.total', 1, tags);
    
    if (!success) {
      this.metrics.incrementCounter('sync.operations.errors', 1, tags);
    }
  }

  // Database metrics
  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean): void {
    const tags = { operation, table, success: success.toString() };
    
    this.metrics.incrementCounter('db.queries.total', 1, tags);
    this.metrics.recordHistogram('db.query.duration', duration, tags);
    
    if (!success) {
      this.metrics.incrementCounter('db.queries.errors', 1, tags);
    }
  }

  // Authentication metrics
  recordAuthentication(action: string, success: boolean, method?: string): void {
    const tags = { action, success: success.toString(), ...(method && { method }) };
    
    this.metrics.incrementCounter('auth.attempts.total', 1, tags);
    
    if (!success) {
      this.metrics.incrementCounter('auth.attempts.failed', 1, tags);
    }
  }

  // System metrics
  updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    this.metrics.setGauge('system.memory.heap_used', memoryUsage.heapUsed);
    this.metrics.setGauge('system.memory.heap_total', memoryUsage.heapTotal);
    this.metrics.setGauge('system.memory.external', memoryUsage.external);
    this.metrics.setGauge('system.uptime', process.uptime());
    
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.metrics.setGauge('system.cpu.user', cpuUsage.user);
    this.metrics.setGauge('system.cpu.system', cpuUsage.system);
  }

  // Get metrics collector for custom metrics
  getMetricsCollector(): MetricsCollector {
    return this.metrics;
  }

  // Express middleware for automatic API metrics
  apiMetricsMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordAPIRequest(
          req.route?.path || req.path,
          req.method,
          res.statusCode,
          duration
        );
      });
      
      next();
    };
  }
}

// Singleton instance
export const applicationMetrics = new ApplicationMetrics();

// Start system metrics collection
setInterval(() => {
  applicationMetrics.updateSystemMetrics();
}, 30000); // Every 30 seconds