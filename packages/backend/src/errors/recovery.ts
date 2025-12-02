// Error recovery strategies for the BIL Core System
import { BILError, ErrorCategory, ErrorSeverity } from './types';
import { Logger } from '../utils/logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export class RetryManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RetryManager');
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config: RetryOptions = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...options
    };

    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if error is not retryable
        if (error instanceof BILError && !error.retryable) {
          throw error;
        }

        if (attempt === config.maxAttempts) {
          this.logger.error(`Operation failed after ${config.maxAttempts} attempts`, { error });
          break;
        }

        const delay = this.calculateDelay(attempt, config);
        this.logger.warn(`Operation failed on attempt ${attempt}, retrying in ${delay}ms`, { error });
        
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    let delay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, options.maxDelay);

    if (options.jitter) {
      // Add random jitter to prevent thundering herd
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private logger: Logger;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {
    this.logger = new Logger(`CircuitBreaker:${name}`);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.logger.info(`Circuit breaker ${this.name} moved to HALF_OPEN state`);
      } else {
        throw new BILError({
          code: 'CIRCUIT_BREAKER_OPEN',
          message: `Circuit breaker ${this.name} is open`,
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.HIGH,
          context: { timestamp: new Date() },
          retryable: true,
          userMessage: 'Service temporarily unavailable. Please try again later.'
        });
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to fully close
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
        this.logger.info(`Circuit breaker ${this.name} moved to CLOSED state`);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.successCount = 0;
      this.logger.warn(`Circuit breaker ${this.name} moved to OPEN state from HALF_OPEN`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.logger.warn(`Circuit breaker ${this.name} moved to OPEN state due to failure threshold`);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

export class GracefulDegradationManager {
  private logger: Logger;
  private fallbackStrategies: Map<string, () => Promise<any>> = new Map();

  constructor() {
    this.logger = new Logger('GracefulDegradation');
  }

  registerFallback(serviceName: string, fallbackFn: () => Promise<any>): void {
    this.fallbackStrategies.set(serviceName, fallbackFn);
  }

  async executeWithFallback<T>(
    serviceName: string,
    primaryOperation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      this.logger.warn(`Primary operation failed for ${serviceName}, attempting fallback`, { error });

      // Try specific fallback first
      if (fallbackOperation) {
        try {
          return await fallbackOperation();
        } catch (fallbackError) {
          this.logger.error(`Fallback operation also failed for ${serviceName}`, { fallbackError });
        }
      }

      // Try registered fallback
      const registeredFallback = this.fallbackStrategies.get(serviceName);
      if (registeredFallback) {
        try {
          return await registeredFallback();
        } catch (fallbackError) {
          this.logger.error(`Registered fallback also failed for ${serviceName}`, { fallbackError });
        }
      }

      // No fallback available, re-throw original error
      throw error;
    }
  }
}

// Service-specific recovery strategies
export class AIServiceRecovery {
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  private degradationManager: GracefulDegradationManager;

  constructor() {
    this.retryManager = new RetryManager();
    this.circuitBreaker = new CircuitBreaker('ai-service', {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    });
    this.degradationManager = new GracefulDegradationManager();

    // Register fallback strategies
    this.setupFallbacks();
  }

  private setupFallbacks(): void {
    this.degradationManager.registerFallback('openai-chat', async () => {
      return "I'm experiencing technical difficulties right now. Please try again in a moment.";
    });

    this.degradationManager.registerFallback('speech-to-text', async () => {
      throw new BILError({
        code: 'STT_UNAVAILABLE',
        message: 'Speech-to-text service unavailable',
        category: ErrorCategory.AI_PROCESSING,
        severity: ErrorSeverity.MEDIUM,
        context: { timestamp: new Date() },
        retryable: true,
        userMessage: 'Voice processing is temporarily unavailable. Please try typing your message.'
      });
    });
  }

  async processWithRecovery<T>(
    operation: () => Promise<T>,
    serviceName: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return this.retryManager.executeWithRetry(async () => {
        return this.degradationManager.executeWithFallback(
          serviceName,
          operation,
          fallback
        );
      }, {
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2
      });
    });
  }
}

// Singleton instances
export const retryManager = new RetryManager();
export const gracefulDegradationManager = new GracefulDegradationManager();
export const aiServiceRecovery = new AIServiceRecovery();