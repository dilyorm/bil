// Alerting system for critical system failures
import { Logger } from '../utils/logger';
import { BILError, ErrorSeverity } from '../errors/types';
import { HealthCheckResult, ServiceHealth } from './health';
import { config, isProduction } from '../config';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export enum AlertType {
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  SYSTEM = 'system'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

export class AlertingService {
  private logger: Logger;
  private channels: Map<string, AlertChannel> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private rateLimiter: Map<string, number> = new Map();

  constructor() {
    this.logger = new Logger('Alerting');
    this.setupDefaultChannels();
  }

  private setupDefaultChannels(): void {
    // Console alerting (always available)
    this.registerChannel('console', new ConsoleAlertChannel());

    // Email alerting (if configured)
    if (isProduction) {
      // In a real implementation, you would configure email/SMS/Slack channels
      this.logger.info('Production alerting channels would be configured here');
    }
  }

  registerChannel(name: string, channel: AlertChannel): void {
    this.channels.set(name, channel);
    this.logger.info(`Alert channel registered: ${name}`);
  }

  async sendAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date()
    };

    // Check rate limiting
    if (this.isRateLimited(fullAlert)) {
      this.logger.warn(`Alert rate limited: ${fullAlert.title}`);
      return;
    }

    // Store alert
    this.activeAlerts.set(fullAlert.id, fullAlert);
    this.alertHistory.push(fullAlert);

    // Keep history limited
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Send to all channels
    const sendPromises = Array.from(this.channels.values()).map(channel =>
      channel.send(fullAlert).catch(error => {
        this.logger.error(`Failed to send alert via ${channel.name}`, { error, alert: fullAlert });
      })
    );

    await Promise.allSettled(sendPromises);

    this.logger.info(`Alert sent: ${fullAlert.title}`, {
      alertId: fullAlert.id,
      severity: fullAlert.severity,
      type: fullAlert.type
    });
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      this.logger.warn(`Alert not found for resolution: ${alertId}`);
      return;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.activeAlerts.delete(alertId);

    this.logger.info(`Alert resolved: ${alert.title}`, { alertId });
  }

  // Alert for errors
  async alertError(error: BILError): Promise<void> {
    if (error.severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert({
        type: AlertType.ERROR,
        severity: AlertSeverity.CRITICAL,
        title: `Critical Error: ${error.code}`,
        message: error.message,
        source: 'error-handler',
        metadata: {
          errorCode: error.code,
          category: error.category,
          context: error.context,
          userMessage: error.userMessage
        }
      });
    } else if (error.severity === ErrorSeverity.HIGH) {
      await this.sendAlert({
        type: AlertType.ERROR,
        severity: AlertSeverity.WARNING,
        title: `High Severity Error: ${error.code}`,
        message: error.message,
        source: 'error-handler',
        metadata: {
          errorCode: error.code,
          category: error.category,
          context: error.context
        }
      });
    }
  }

  // Alert for health check failures
  async alertHealthCheck(healthResult: HealthCheckResult): Promise<void> {
    if (healthResult.status === 'unhealthy') {
      const failedServices = Object.entries(healthResult.services)
        .filter(([_, service]) => service.status === 'unhealthy')
        .map(([name]) => name);

      await this.sendAlert({
        type: AlertType.HEALTH_CHECK,
        severity: AlertSeverity.CRITICAL,
        title: 'System Health Check Failed',
        message: `Services failing: ${failedServices.join(', ')}`,
        source: 'health-check',
        metadata: {
          failedServices,
          healthResult
        }
      });
    } else if (healthResult.status === 'degraded') {
      const degradedServices = Object.entries(healthResult.services)
        .filter(([_, service]) => service.status === 'degraded')
        .map(([name]) => name);

      await this.sendAlert({
        type: AlertType.HEALTH_CHECK,
        severity: AlertSeverity.WARNING,
        title: 'System Performance Degraded',
        message: `Services degraded: ${degradedServices.join(', ')}`,
        source: 'health-check',
        metadata: {
          degradedServices,
          healthResult
        }
      });
    }
  }

  // Alert for performance issues
  async alertPerformance(metric: string, value: number, threshold: number): Promise<void> {
    await this.sendAlert({
      type: AlertType.PERFORMANCE,
      severity: value > threshold * 2 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      title: `Performance Alert: ${metric}`,
      message: `${metric} is ${value}, exceeding threshold of ${threshold}`,
      source: 'performance-monitor',
      metadata: {
        metric,
        value,
        threshold,
        exceedanceRatio: value / threshold
      }
    });
  }

  // Alert for system resource issues
  async alertSystemResource(resource: string, usage: number, threshold: number): Promise<void> {
    const severity = usage > 90 ? AlertSeverity.CRITICAL : 
                    usage > 80 ? AlertSeverity.WARNING : AlertSeverity.INFO;

    await this.sendAlert({
      type: AlertType.SYSTEM,
      severity,
      title: `System Resource Alert: ${resource}`,
      message: `${resource} usage is ${usage}%, threshold: ${threshold}%`,
      source: 'system-monitor',
      metadata: {
        resource,
        usage,
        threshold
      }
    });
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRateLimited(alert: Alert): boolean {
    const key = `${alert.type}_${alert.source}_${alert.title}`;
    const now = Date.now();
    const lastSent = this.rateLimiter.get(key) || 0;
    
    // Rate limit: same alert type/source/title can only be sent once per 5 minutes
    const rateLimitWindow = 5 * 60 * 1000; // 5 minutes
    
    if (now - lastSent < rateLimitWindow) {
      return true;
    }

    this.rateLimiter.set(key, now);
    return false;
  }

  // Get active alerts
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  // Get alert history
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  // Get alerts by severity
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.alertHistory.filter(alert => alert.severity === severity);
  }

  // Cleanup old alerts
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up rate limiter
    for (const [key, timestamp] of this.rateLimiter.entries()) {
      if (now - timestamp > maxAge) {
        this.rateLimiter.delete(key);
      }
    }

    // Clean up old alert history
    this.alertHistory = this.alertHistory.filter(alert => 
      now - alert.timestamp.getTime() < maxAge * 7 // Keep 7 days
    );
  }
}

// Console alert channel
class ConsoleAlertChannel implements AlertChannel {
  name = 'console';

  async send(alert: Alert): Promise<void> {
    const colorMap = {
      [AlertSeverity.INFO]: '\x1b[36m',      // Cyan
      [AlertSeverity.WARNING]: '\x1b[33m',   // Yellow
      [AlertSeverity.CRITICAL]: '\x1b[31m',  // Red
      [AlertSeverity.EMERGENCY]: '\x1b[35m'  // Magenta
    };

    const resetColor = '\x1b[0m';
    const color = colorMap[alert.severity];

    console.log(`${color}🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.title}${resetColor}`);
    console.log(`   Message: ${alert.message}`);
    console.log(`   Source: ${alert.source}`);
    console.log(`   Time: ${alert.timestamp.toISOString()}`);
    
    if (alert.metadata) {
      console.log(`   Metadata:`, JSON.stringify(alert.metadata, null, 2));
    }
    
    console.log(''); // Empty line for readability
  }
}

// Email alert channel (placeholder implementation)
class EmailAlertChannel implements AlertChannel {
  name = 'email';

  async send(alert: Alert): Promise<void> {
    // In a real implementation, this would send emails via SendGrid, SES, etc.
    console.log(`📧 Email alert would be sent: ${alert.title}`);
  }
}

// Slack alert channel (placeholder implementation)
class SlackAlertChannel implements AlertChannel {
  name = 'slack';

  async send(alert: Alert): Promise<void> {
    // In a real implementation, this would send to Slack via webhook
    console.log(`💬 Slack alert would be sent: ${alert.title}`);
  }
}

// Singleton instance
export const alertingService = new AlertingService();

// Cleanup interval
setInterval(() => {
  alertingService.cleanup();
}, 60 * 60 * 1000); // Every hour