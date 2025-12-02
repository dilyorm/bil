// Structured logging utility for the BIL Core System
import { isProduction, isDevelopment } from '../config';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: any;
  requestId?: string;
  userId?: string;
  deviceId?: string;
  conversationId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableRemote?: boolean;
}

export class Logger {
  private service: string;
  private level: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private enableRemote: boolean;

  constructor(service: string, options: Partial<LoggerOptions> = {}) {
    this.service = service;
    this.level = options.level || (isDevelopment ? LogLevel.DEBUG : LogLevel.INFO);
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? isProduction;
    this.enableRemote = options.enableRemote ?? isProduction;
  }

  error(message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...(data && { data }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    };

    // Extract context from data if available
    if (data) {
      if (data.requestId) entry.requestId = data.requestId;
      if (data.userId) entry.userId = data.userId;
      if (data.deviceId) entry.deviceId = data.deviceId;
      if (data.conversationId) entry.conversationId = data.conversationId;
    }

    if (this.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.enableFile) {
      this.logToFile(entry);
    }

    if (this.enableRemote) {
      this.logToRemote(entry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private logToConsole(entry: LogEntry): void {
    const colorMap = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.DEBUG]: '\x1b[37m'  // White
    };

    const resetColor = '\x1b[0m';
    const color = colorMap[entry.level];

    if (isDevelopment) {
      // Pretty format for development
      const prefix = `${color}[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.service}]${resetColor}`;
      console.log(`${prefix} ${entry.message}`);
      
      if (entry.data) {
        console.log('  Data:', JSON.stringify(entry.data, null, 2));
      }
      
      if (entry.error) {
        console.log(`  Error: ${entry.error.name}: ${entry.error.message}`);
        if (entry.error.stack) {
          console.log(`  Stack: ${entry.error.stack}`);
        }
      }
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry));
    }
  }

  private logToFile(entry: LogEntry): void {
    // In a real implementation, this would write to log files
    // For now, we'll just use console in production mode
    if (isProduction) {
      console.log(JSON.stringify(entry));
    }
  }

  private logToRemote(entry: LogEntry): void {
    // In a real implementation, this would send to remote logging service
    // like CloudWatch, Datadog, or ELK stack
    // For now, just a placeholder
    if (entry.level === LogLevel.ERROR) {
      // Could send to error tracking service
    }
  }

  // Create child logger with additional context
  child(additionalContext: Partial<LogEntry>): Logger {
    const childLogger = new Logger(this.service, {
      level: this.level,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      enableRemote: this.enableRemote
    });

    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, data?: any, error?: Error) => {
      const mergedData = { ...additionalContext, ...data };
      originalLog(level, message, mergedData, error);
    };

    return childLogger;
  }
}

// Request logging middleware
export const requestLogger = (logger: Logger) => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to request object
    req.requestId = requestId;

    // Create child logger with request context
    req.logger = logger.child({
      requestId,
      userId: req.user?.userId,
      deviceId: req.user?.deviceId
    });

    // Log request start
    req.logger.info('Request started', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
      
      req.logger.log(level, 'Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });

    next();
  };
};

// Performance logging utility
export class PerformanceLogger {
  private logger: Logger;
  private timers: Map<string, number> = new Map();

  constructor(service: string) {
    this.logger = new Logger(`${service}:Performance`);
  }

  startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
  }

  endTimer(operation: string, additionalData?: any): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      this.logger.warn(`Timer not found for operation: ${operation}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);

    this.logger.info(`Operation completed: ${operation}`, {
      duration: `${duration}ms`,
      ...additionalData
    });

    return duration;
  }

  async measureAsync<T>(operation: string, fn: () => Promise<T>, additionalData?: any): Promise<T> {
    this.startTimer(operation);
    try {
      const result = await fn();
      this.endTimer(operation, { success: true, ...additionalData });
      return result;
    } catch (error) {
      this.endTimer(operation, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error', 
        ...additionalData 
      });
      throw error;
    }
  }
}

// Singleton logger instances
export const systemLogger = new Logger('System');
export const apiLogger = new Logger('API');
export const aiLogger = new Logger('AI');
export const syncLogger = new Logger('Sync');
export const authLogger = new Logger('Auth');