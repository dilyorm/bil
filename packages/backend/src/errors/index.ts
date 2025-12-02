// Error handling exports for BIL Core System
export * from './types';
export * from './handler';
export * from './recovery';

// Re-export commonly used error classes
export {
  BILError,
  AuthenticationError,
  ValidationError,
  AIProcessingError,
  DeviceCommunicationError,
  ExternalAPIError,
  DatabaseError,
  ErrorCategory,
  ErrorSeverity
} from './types';

export {
  GlobalErrorHandler,
  globalErrorHandler,
  errorMiddleware,
  asyncHandler
} from './handler';

export {
  RetryManager,
  CircuitBreaker,
  GracefulDegradationManager,
  AIServiceRecovery,
  retryManager,
  gracefulDegradationManager,
  aiServiceRecovery
} from './recovery';