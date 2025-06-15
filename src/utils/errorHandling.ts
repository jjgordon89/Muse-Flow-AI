/**
 * Comprehensive error handling utilities for consistent error management
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  DATABASE = 'database',
  AI_SERVICE = 'ai_service',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
  BUSINESS_LOGIC = 'business_logic'
}

export interface ErrorContext {
  component?: string;
  function?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code?: string;
  originalError?: Error;
  context?: ErrorContext;
  stack?: string;
  isRetryable?: boolean;
  userMessage?: string;
}

export class AppErrorHandler {
  private static errorHandlers: Map<ErrorCategory, (error: AppError) => void> = new Map();
  private static errorReporters: Array<(error: AppError) => Promise<void>> = [];

  /**
   * Create a standardized application error
   */
  static createError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: {
      code?: string;
      originalError?: Error;
      context?: ErrorContext;
      isRetryable?: boolean;
      userMessage?: string;
    } = {}
  ): AppError {
    const error: AppError = {
      id: this.generateErrorId(),
      message,
      category,
      severity,
      ...(options.code && { code: options.code }),
      ...(options.originalError && { originalError: options.originalError }),
      context: {
        ...options.context,
        timestamp: new Date()
      },
      ...(options.originalError?.stack && { stack: options.originalError.stack }),
      isRetryable: options.isRetryable ?? false,
      userMessage: options.userMessage || this.generateUserMessage(category)
    };

    return error;
  }

  /**
   * Handle an error based on its category and severity
   */
  static async handleError(error: AppError): Promise<void> {
    try {
      // Log the error
      this.logError(error);

      // Execute category-specific handler
      const handler = this.errorHandlers.get(error.category);
      if (handler) {
        handler(error);
      }

      // Report to external services for high/critical errors
      if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
        await this.reportError(error);
      }

      // Trigger monitoring alerts for critical errors
      if (error.severity === ErrorSeverity.CRITICAL) {
        this.triggerAlert(error);
      }

    } catch (handlingError) {
      console.error('Error handling failed:', handlingError);
      // Fallback logging
      console.error('Original error:', error);
    }
  }

  /**
   * Wrap async functions with error handling
   */
  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: ErrorContext,
    category: ErrorCategory = ErrorCategory.SYSTEM
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const appError = this.createError(
          error instanceof Error ? error.message : 'Unknown error',
          category,
          ErrorSeverity.MEDIUM,
          {
            originalError: error instanceof Error ? error : new Error(String(error)),
            context
          }
        );
        
        await this.handleError(appError);
        throw appError;
      }
    };
  }

  /**
   * Wrap sync functions with error handling
   */
  static wrapSync<T extends any[], R>(
    fn: (...args: T) => R,
    context: ErrorContext,
    category: ErrorCategory = ErrorCategory.SYSTEM
  ) {
    return (...args: T): R => {
      try {
        return fn(...args);
      } catch (error) {
        const appError = this.createError(
          error instanceof Error ? error.message : 'Unknown error',
          category,
          ErrorSeverity.MEDIUM,
          {
            originalError: error instanceof Error ? error : new Error(String(error)),
            context
          }
        );
        
        // Handle synchronously for sync functions
        this.handleError(appError).catch(console.error);
        throw appError;
      }
    };
  }

  /**
   * Register error handler for specific categories
   */
  static registerErrorHandler(category: ErrorCategory, handler: (error: AppError) => void): void {
    this.errorHandlers.set(category, handler);
  }

  /**
   * Register error reporter
   */
  static registerErrorReporter(reporter: (error: AppError) => Promise<void>): void {
    this.errorReporters.push(reporter);
  }

  /**
   * Create error boundary for React components
   */
  static createErrorBoundary(component: string) {
    return {
      componentDidCatch: (error: Error, errorInfo: any) => {
        const appError = this.createError(
          error.message,
          ErrorCategory.SYSTEM,
          ErrorSeverity.HIGH,
          {
            originalError: error,
            context: {
              component,
              metadata: errorInfo
            }
          }
        );
        
        this.handleError(appError);
      }
    };
  }

  /**
   * Retry logic with exponential backoff
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
      retryCondition?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      retryCondition = () => true
    } = options;

    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !retryCondition(error)) {
          throw error;
        }
        
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  private static generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateUserMessage(category: ErrorCategory): string {
    const userMessages = {
      [ErrorCategory.VALIDATION]: 'Please check your input and try again.',
      [ErrorCategory.NETWORK]: 'Network connection issue. Please check your internet connection.',
      [ErrorCategory.DATABASE]: 'Database temporarily unavailable. Please try again later.',
      [ErrorCategory.AI_SERVICE]: 'AI service temporarily unavailable. Please try again later.',
      [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please log in again.',
      [ErrorCategory.PERMISSION]: 'You do not have permission to perform this action.',
      [ErrorCategory.SYSTEM]: 'System error occurred. Please try again later.',
      [ErrorCategory.USER_INPUT]: 'Invalid input provided. Please check and try again.',
      [ErrorCategory.BUSINESS_LOGIC]: 'Operation cannot be completed. Please check the requirements.'
    };

    return userMessages[category] || 'An unexpected error occurred. Please try again.';
  }

  private static logError(error: AppError): void {
    const logData = {
      errorId: error.id,
      message: error.message,
      category: error.category,
      severity: error.severity,
      code: error.code,
      context: error.context,
      stack: error.stack
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        console.info('Application Error:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('Application Error:', logData);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        console.error('Application Error:', logData);
        break;
      default:
        console.log('Application Error:', logData);
    }
  }

  private static async reportError(error: AppError): Promise<void> {
    const reportPromises = this.errorReporters.map(async (reporter) => {
      try {
        await reporter(error);
      } catch (reportingError) {
        console.error('Error reporting failed:', reportingError);
      }
    });

    await Promise.allSettled(reportPromises);
  }

  private static triggerAlert(error: AppError): void {
    // In a real application, this would trigger alerts through:
    // - Email notifications
    // - Slack/Teams messages
    // - PagerDuty/Opsgenie
    // - SMS alerts
    console.error('CRITICAL ERROR ALERT:', {
      errorId: error.id,
      message: error.message,
      context: error.context,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Validation error helper
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Network error helper
 */
export class NetworkError extends Error {
  constructor(message: string, public status?: number, public url?: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Database error helper
 */
export class DatabaseError extends Error {
  constructor(message: string, public operation?: string, public table?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * AI Service error helper
 */
export class AIServiceError extends Error {
  constructor(message: string, public provider?: string, public model?: string) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Initialize default error handlers
AppErrorHandler.registerErrorHandler(ErrorCategory.VALIDATION, (error) => {
  // Could integrate with form validation libraries
  console.warn('Validation error:', error.message);
});

AppErrorHandler.registerErrorHandler(ErrorCategory.NETWORK, (error) => {
  // Could retry network requests or switch to offline mode
  console.warn('Network error:', error.message);
});

AppErrorHandler.registerErrorHandler(ErrorCategory.DATABASE, (error) => {
  // Could trigger database reconnection or fallback to cache
  console.error('Database error:', error.message);
});

AppErrorHandler.registerErrorHandler(ErrorCategory.AI_SERVICE, (error) => {
  // Could fallback to different AI provider or cached responses
  console.error('AI Service error:', error.message);
});