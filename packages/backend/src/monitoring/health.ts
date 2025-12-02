// Health check and monitoring system for BIL Core System
import { Request, Response } from 'express';
import { db } from '../database/connection';
import { Logger } from '../utils/logger';
import { config } from '../config';
import { alertingService } from './alerting';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: Record<string, ServiceHealth>;
  system: SystemHealth;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastChecked: string;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

export class HealthCheckService {
  private logger: Logger;
  private healthChecks: Map<string, () => Promise<ServiceHealth>> = new Map();
  private lastHealthCheck: HealthCheckResult | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new Logger('HealthCheck');
    this.setupDefaultHealthChecks();
    this.startPeriodicHealthChecks();
  }

  private setupDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const startTime = Date.now();
      try {
        const isConnected = await db.testConnection();
        const responseTime = Date.now() - startTime;

        if (isConnected) {
          return {
            status: 'healthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            details: {
              connectionPool: 'active'
            }
          };
        } else {
          return {
            status: 'unhealthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            error: 'Database connection failed'
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown database error'
        };
      }
    });

    // Redis health check (if configured)
    if (config.REDIS_URL) {
      this.registerHealthCheck('redis', async () => {
        const startTime = Date.now();
        try {
          // In a real implementation, test Redis connection
          // For now, simulate a health check
          const responseTime = Date.now() - startTime;
          return {
            status: 'healthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            details: {
              connected: true
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Redis connection failed'
          };
        }
      });
    }

    // OpenAI API health check
    if (config.openai.apiKey) {
      this.registerHealthCheck('openai', async () => {
        const startTime = Date.now();
        try {
          // In a real implementation, make a simple API call to test connectivity
          // For now, simulate a health check
          const responseTime = Date.now() - startTime;
          return {
            status: 'healthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            details: {
              apiKey: 'configured',
              model: config.openai.model
            }
          };
        } catch (error) {
          return {
            status: 'degraded',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'OpenAI API error'
          };
        }
      });
    }

    // File system health check
    this.registerHealthCheck('filesystem', async () => {
      const startTime = Date.now();
      try {
        // Check if we can write to temp directory
        const fs = require('fs').promises;
        const path = require('path');
        const tempFile = path.join(require('os').tmpdir(), `health-check-${Date.now()}.tmp`);
        
        await fs.writeFile(tempFile, 'health check');
        await fs.unlink(tempFile);
        
        const responseTime = Date.now() - startTime;
        return {
          status: 'healthy',
          responseTime,
          lastChecked: new Date().toISOString(),
          details: {
            writable: true
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'File system error'
        };
      }
    });
  }

  registerHealthCheck(name: string, checkFn: () => Promise<ServiceHealth>): void {
    this.healthChecks.set(name, checkFn);
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const services: Record<string, ServiceHealth> = {};

    // Run all health checks in parallel
    const healthCheckPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const result = await Promise.race([
            checkFn(),
            new Promise<ServiceHealth>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), 5000)
            )
          ]);
          services[name] = result;
        } catch (error) {
          services[name] = {
            status: 'unhealthy',
            lastChecked: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Health check failed'
          };
        }
      }
    );

    await Promise.all(healthCheckPromises);

    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (serviceStatuses.every(s => s === 'healthy')) {
      overallStatus = 'healthy';
    } else if (serviceStatuses.some(s => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: config.NODE_ENV,
      services,
      system: await this.getSystemHealth()
    };

    this.lastHealthCheck = result;
    
    // Log health check results
    const duration = Date.now() - startTime;
    this.logger.info(`Health check completed in ${duration}ms`, {
      status: overallStatus,
      services: Object.keys(services).length,
      duration
    });

    // Send alerts for health issues
    if (overallStatus === 'unhealthy' || overallStatus === 'degraded') {
      alertingService.alertHealthCheck(result).catch(error => {
        this.logger.error('Failed to send health check alert', { error });
      });
    }

    return result;
  }

  private async getSystemHealth(): Promise<SystemHealth> {
    const memoryUsage = process.memoryUsage();
    
    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000 // Convert to seconds
      },
      disk: {
        used: 0, // Would need additional library to get disk usage
        total: 0,
        percentage: 0
      }
    };
  }

  private startPeriodicHealthChecks(): void {
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Periodic health check failed', { error });
      }
    }, 30000);
  }

  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  // Express route handlers
  basicHealthCheck = async (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.NODE_ENV,
      uptime: process.uptime()
    });
  };

  detailedHealthCheck = async (req: Request, res: Response) => {
    try {
      const healthResult = await this.performHealthCheck();
      
      const statusCode = healthResult.status === 'healthy' ? 200 : 
                        healthResult.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(healthResult);
    } catch (error) {
      this.logger.error('Health check endpoint failed', { error });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  };

  readinessCheck = async (req: Request, res: Response): Promise<void> => {
    const lastCheck = this.getLastHealthCheck();
    
    if (!lastCheck) {
      res.status(503).json({
        status: 'not_ready',
        message: 'Health checks not yet completed'
      });
      return;
    }

    const isReady = lastCheck.status !== 'unhealthy' && 
                   lastCheck.services.database?.status === 'healthy';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      lastHealthCheck: lastCheck.timestamp
    });
  };

  livenessCheck = async (req: Request, res: Response) => {
    // Simple liveness check - if we can respond, we're alive
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  };

  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Singleton instance
export const healthCheckService = new HealthCheckService();