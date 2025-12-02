// Error types and classifications for the BIL Core System

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  AI_PROCESSING = 'ai_processing',
  DEVICE_COMMUNICATION = 'device_communication',
  DATA_INTEGRATION = 'data_integration',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  NETWORK = 'network',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string | undefined;
  deviceId?: string | undefined;
  conversationId?: string | undefined;
  requestId?: string | undefined;
  endpoint?: string | undefined;
  userAgent?: string | undefined;
  ip?: string | undefined;
  timestamp: Date;
  additionalData?: Record<string, any> | undefined;
}

export interface ErrorDetails {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  originalError?: Error | undefined;
  stack?: string;
  retryable: boolean;
  userMessage: string;
}

export class BILError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly originalError?: Error | undefined;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'BILError';
    this.code = details.code;
    this.category = details.category;
    this.severity = details.severity;
    this.context = details.context;
    this.retryable = details.retryable;
    this.userMessage = details.userMessage;
    this.originalError = details.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BILError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      stack: this.stack,
      originalError: this.originalError?.message
    };
  }
}

// Specific error classes
export class AuthenticationError extends BILError {
  constructor(message: string, context: ErrorContext, originalError?: Error | undefined) {
    super({
      code: 'AUTH_FAILED',
      message,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.MEDIUM,
      context,
      originalError: originalError || undefined,
      retryable: false,
      userMessage: 'Authentication failed. Please check your credentials.'
    });
  }
}

export class ValidationError extends BILError {
  constructor(message: string, context: ErrorContext, field?: string) {
    super({
      code: 'VALIDATION_FAILED',
      message,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      context: {
        ...context,
        additionalData: { field }
      },
      retryable: false,
      userMessage: 'Invalid input provided. Please check your data and try again.'
    });
  }
}

export class AIProcessingError extends BILError {
  constructor(message: string, context: ErrorContext, originalError?: Error | undefined) {
    super({
      code: 'AI_PROCESSING_FAILED',
      message,
      category: ErrorCategory.AI_PROCESSING,
      severity: ErrorSeverity.HIGH,
      context,
      originalError: originalError || undefined,
      retryable: true,
      userMessage: 'I\'m having trouble processing your request. Please try again in a moment.'
    });
  }
}

export class DeviceCommunicationError extends BILError {
  constructor(message: string, context: ErrorContext, originalError?: Error | undefined) {
    super({
      code: 'DEVICE_COMM_FAILED',
      message,
      category: ErrorCategory.DEVICE_COMMUNICATION,
      severity: ErrorSeverity.MEDIUM,
      context,
      originalError: originalError || undefined,
      retryable: true,
      userMessage: 'Device communication error. Please check your connection.'
    });
  }
}

export class ExternalAPIError extends BILError {
  constructor(message: string, context: ErrorContext, apiName: string, originalError?: Error | undefined) {
    super({
      code: 'EXTERNAL_API_FAILED',
      message,
      category: ErrorCategory.EXTERNAL_API,
      severity: ErrorSeverity.HIGH,
      context: {
        ...context,
        additionalData: { apiName }
      },
      originalError: originalError || undefined,
      retryable: true,
      userMessage: 'External service temporarily unavailable. Please try again later.'
    });
  }
}

export class DatabaseError extends BILError {
  constructor(message: string, context: ErrorContext, originalError?: Error | undefined) {
    super({
      code: 'DATABASE_ERROR',
      message,
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.CRITICAL,
      context,
      originalError: originalError || undefined,
      retryable: true,
      userMessage: 'Database error occurred. Please try again.'
    });
  }
}