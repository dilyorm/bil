// Global error handler for the BIL Core System
import { Request, Response, NextFunction } from 'express';
import { BILError, ErrorCategory, ErrorSeverity, ErrorContext } from './types';
import { Logger } from '../utils/logger';
import { isProduction } from '../config';
import { alertingService } from '../monitoring/alerting';

export interface ErrorHandlerOptions {
  logger?: Logger;
  enableStackTrace?: boolean;
  enableErrorReporting?: boolean;
}

export class GlobalErrorHandler {
  private logger: Logger;
  private enableStackTrace: boolean;
  private enableErrorReporting: boolean;

  constructor(options: ErrorHandlerOptions = {}) {
    this.logger = options.logger || new Logger('ErrorHandler');
    this.enableStackTrace = options.enableStackTrace ?? !isProduction;
    this.enableErrorReporting = options.enableErrorReporting ?? isProduction;
  }

  // Express error handler middleware
  handleError = (error: Error, req: Request, res: Response, next: NextFunction) => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(error);
    }

    const context = this.buildErrorContext(req);
    const bilError = this.normalizeToBILError(error, context);

    // Log the error
    this.logError(bilError, req);

    // Report error if enabled
    if (this.enableErrorReporting) {
      this.reportError(bilError);
    }

    // Send alert for critical errors
    if (bilError.severity === ErrorSeverity.CRITICAL || bilError.severity === ErrorSeverity.HIGH) {
      alertingService.alertError(bilError).catch(alertError => {
        this.logger.error('Failed to send error alert', { alertError });
      });
    }

    // Send response
    this.sendErrorResponse(bilError, res);
  };

  // Handle async errors
  handleAsyncError = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // Handle WebSocket errors
  handleWebSocketError = (error: Error, socket: any, context: Partial<ErrorContext> = {}) => {
    const fullContext: ErrorContext = {
      timestamp: new Date(),
      deviceId: socket.deviceId,
      userId: socket.userId,
      ...context
    };

    const bilError = this.normalizeToBILError(error, fullContext);
    
    this.logError(bilError);
    
    if (this.enableErrorReporting) {
      this.reportError(bilError);
    }

    // Send alert for critical WebSocket errors
    if (bilError.severity === ErrorSeverity.CRITICAL || bilError.severity === ErrorSeverity.HIGH) {
      alertingService.alertError(bilError).catch(alertError => {
        this.logger.error('Failed to send WebSocket error alert', { alertError });
      });
    }

    // Send error to client
    socket.emit('error', {
      code: bilError.code,
      message: bilError.userMessage,
      retryable: bilError.retryable,
      timestamp: bilError.context.timestamp
    });
  };

  // Convert any error to BILError
  private normalizeToBILError(error: Error, context: ErrorContext): BILError {
    if (error instanceof BILError) {
      return error;
    }

    // Map common error types
    if (error.name === 'ValidationError') {
      return new BILError({
        code: 'VALIDATION_ERROR',
        message: error.message,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        context,
        originalError: error,
        retryable: false,
        userMessage: 'Invalid input provided. Please check your data and try again.'
      });
    }

    if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
      return new BILError({
        code: 'UNAUTHORIZED',
        message: error.message,
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.MEDIUM,
        context,
        originalError: error,
        retryable: false,
        userMessage: 'You are not authorized to perform this action.'
      });
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      return new BILError({
        code: 'NETWORK_ERROR',
        message: error.message,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        context,
        originalError: error,
        retryable: true,
        userMessage: 'Network connection error. Please try again.'
      });
    }

    if (error.message.includes('database') || error.message.includes('SQL')) {
      return new BILError({
        code: 'DATABASE_ERROR',
        message: error.message,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.CRITICAL,
        context,
        originalError: error,
        retryable: true,
        userMessage: 'Database error occurred. Please try again.'
      });
    }

    // Default unknown error
    return new BILError({
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      context,
      originalError: error,
      retryable: true,
      userMessage: 'An unexpected error occurred. Please try again.'
    });
  }

  private buildErrorContext(req: Request): ErrorContext {
    return {
      requestId: req.headers['x-request-id'] as string,
      endpoint: `${req.method} ${req.path}`,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: (req as any).user?.userId,
      deviceId: (req as any).user?.deviceId,
      timestamp: new Date(),
      additionalData: {
        query: req.query,
        params: req.params,
        body: this.sanitizeRequestBody(req.body)
      }
    };
  }

  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private logError(error: BILError, req?: Request): void {
    const logData = {
      error: error.toJSON(),
      request: req ? {
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeRequestBody(req.body)
      } : undefined
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error('Critical error occurred', logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error('High severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn('Medium severity error', logData);
        break;
      case ErrorSeverity.LOW:
        this.logger.info('Low severity error', logData);
        break;
    }
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private reportError(error: BILError): void {
    // In a real implementation, this would send to error reporting service
    // like Sentry, Bugsnag, or custom error tracking
    if (error.severity === ErrorSeverity.CRITICAL) {
      console.error('CRITICAL ERROR REPORTED:', error.toJSON());
      // Send alert to monitoring system
    }
  }

  private sendErrorResponse(error: BILError, res: Response): void {
    const statusCode = this.getHttpStatusCode(error);
    
    const response: any = {
      error: true,
      code: error.code,
      message: error.userMessage,
      category: error.category,
      retryable: error.retryable,
      timestamp: error.context.timestamp
    };

    // Include additional details in development
    if (!isProduction) {
      response.details = {
        originalMessage: error.message,
        stack: this.enableStackTrace ? error.stack : undefined,
        context: error.context
      };
    }

    res.status(statusCode).json(response);
  }

  private getHttpStatusCode(error: BILError): number {
    switch (error.category) {
      case ErrorCategory.AUTHENTICATION:
        return 401;
      case ErrorCategory.AUTHORIZATION:
        return 403;
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.AI_PROCESSING:
      case ErrorCategory.EXTERNAL_API:
        return 503;
      case ErrorCategory.DATABASE:
      case ErrorCategory.SYSTEM:
        return 500;
      case ErrorCategory.NETWORK:
        return 502;
      default:
        return 500;
    }
  }
}

// Singleton instance
export const globalErrorHandler = new GlobalErrorHandler();

// Express middleware function
export const errorMiddleware = globalErrorHandler.handleError;

// Async wrapper function
export const asyncHandler = globalErrorHandler.handleAsyncError;