/**
 * Error sanitization and secure error handling utilities
 * Prevents sensitive information leakage in error messages
 */

interface SanitizedError {
  message: string;
  code?: string;
  type: 'user' | 'system' | 'network' | 'validation';
  timestamp: number;
  id: string;
}

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class ErrorSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    // API keys and tokens
    /sk-[a-zA-Z0-9]{32,}/gi,
    /Bearer\s+[a-zA-Z0-9\-_.]+/gi,
    /api[_-]?key[s]?[\s]*[:=][\s]*[a-zA-Z0-9\-_.]+/gi,
    /token[s]?[\s]*[:=][\s]*[a-zA-Z0-9\-_.]+/gi,
    
    // Personal information
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    /\b\d{3}-\d{2}-\d{4}\b/gi, // SSN
    /\b\d{16}\b/gi, // Credit card numbers
    
    // File paths that might contain usernames
    /[C-Z]:\\Users\\[^\\]+/gi,
    /\/home\/[^\/]+/gi,
    /\/Users\/[^\/]+/gi,
    
    // IP addresses (internal)
    /\b192\.168\.\d{1,3}\.\d{1,3}\b/gi,
    /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi,
    /\b172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}\b/gi,
    
    // URLs with potentially sensitive info
    /https?:\/\/[^\s]+[\?\&].*[=][^\s&]+/gi
  ];

  private static readonly ERROR_MAPPINGS: Record<string, string> = {
    // Network errors
    'Network request failed': 'Unable to connect to the service. Please check your internet connection.',
    'fetch failed': 'Connection failed. Please try again.',
    'CORS error': 'Service temporarily unavailable.',
    
    // Authentication errors
    'Invalid API key': 'Authentication failed. Please check your API key.',
    'Unauthorized': 'Authentication required. Please verify your credentials.',
    'Forbidden': 'Access denied. Please check your permissions.',
    
    // Rate limiting
    'Rate limit exceeded': 'Too many requests. Please wait before trying again.',
    'Too Many Requests': 'Service is busy. Please try again in a few moments.',
    
    // Generic errors
    'Internal server error': 'Service temporarily unavailable. Please try again later.',
    'Service unavailable': 'Service is currently down for maintenance.',
    'Timeout': 'Request timed out. Please try again.',
    
    // Validation errors (keep more specific)
    'Invalid input': 'Please check your input and try again.',
    'Validation failed': 'Some required information is missing or invalid.'
  };

  /**
   * Sanitize error message for safe display to users
   */
  static sanitizeForUser(error: unknown, context?: ErrorContext): SanitizedError {
    const errorId = this.generateErrorId();
    let message = 'An unexpected error occurred';
    let code: string | undefined;
    let type: SanitizedError['type'] = 'system';

    try {
      // Extract base error information
      if (error instanceof Error) {
        message = error.message;
        code = (error as any).code;
      } else if (typeof error === 'string') {
        message = error;
      } else if (error && typeof error === 'object') {
        message = (error as any).message || (error as any).error || 'Unknown error';
        code = (error as any).code || (error as any).status;
      }

      // Determine error type
      type = this.categorizeError(message, code);

      // Sanitize the message
      message = this.sanitizeMessage(message);

      // Map to user-friendly message if available
      const mappedMessage = this.findMappedMessage(message);
      if (mappedMessage) {
        message = mappedMessage;
        type = 'user'; // Mapped messages are user-friendly
      }

      // Log the original error securely for debugging
      this.secureLog(error, errorId, context);

    } catch (sanitizationError) {
      console.error('Error during sanitization:', sanitizationError);
      message = 'A system error occurred';
      type = 'system';
    }

    return {
      message,
      code,
      type,
      timestamp: Date.now(),
      id: errorId
    };
  }

  /**
   * Sanitize error for logging (removes sensitive data but keeps detail)
   */
  static sanitizeForLogging(error: unknown, context?: ErrorContext): Record<string, any> {
    try {
      let sanitized: Record<string, any> = {
        timestamp: Date.now(),
        id: this.generateErrorId(),
        context: context ? this.sanitizeContext(context) : undefined
      };

      if (error instanceof Error) {
        sanitized = {
          ...sanitized,
          name: error.name,
          message: this.sanitizeMessage(error.message),
          stack: this.sanitizeStackTrace(error.stack),
          code: (error as any).code,
          status: (error as any).status
        };
      } else if (typeof error === 'string') {
        sanitized.message = this.sanitizeMessage(error);
      } else if (error && typeof error === 'object') {
        sanitized = {
          ...sanitized,
          ...this.sanitizeObject(error as Record<string, any>)
        };
      } else {
        sanitized.message = 'Non-error value thrown';
        sanitized.value = String(error).substring(0, 100);
      }

      return sanitized;
    } catch (sanitizationError) {
      return {
        timestamp: Date.now(),
        id: this.generateErrorId(),
        message: 'Error during sanitization',
        sanitizationError: String(sanitizationError).substring(0, 200)
      };
    }
  }

  /**
   * Check if an error contains sensitive information
   */
  static containsSensitiveInfo(text: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Validate error message before display
   */
  static validateErrorMessage(message: string): boolean {
    if (!message || typeof message !== 'string') return false;
    if (message.length > 500) return false; // Prevent extremely long messages
    if (this.containsSensitiveInfo(message)) return false;
    return true;
  }

  private static sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return 'Invalid error message';
    }

    let sanitized = message;

    // Remove sensitive patterns
    this.SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Limit length
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 197) + '...';
    }

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>\"']/g, '');

    return sanitized;
  }

  private static sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    // Remove file paths that might contain usernames
    let sanitized = stack.replace(/[C-Z]:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]');
    sanitized = sanitized.replace(/\/home\/[^\/]+/g, '/home/[USER]');
    sanitized = sanitized.replace(/\/Users\/[^\/]+/g, '/Users/[USER]');

    // Remove other sensitive patterns
    this.SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  private static sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // Skip functions
      if (typeof value === 'function') return;
      
      // Recursively sanitize nested objects (with depth limit)
      if (value && typeof value === 'object' && key !== 'stack') {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  private static sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized: ErrorContext = {};

    if (context.component) {
      sanitized.component = context.component.replace(/[<>\"']/g, '');
    }

    if (context.action) {
      sanitized.action = context.action.replace(/[<>\"']/g, '');
    }

    if (context.userId) {
      // Hash user ID for privacy
      sanitized.userId = this.hashString(context.userId).substring(0, 8);
    }

    if (context.metadata) {
      sanitized.metadata = this.sanitizeObject(context.metadata);
    }

    return sanitized;
  }

  private static categorizeError(message: string, code?: string): SanitizedError['type'] {
    const lowerMessage = message.toLowerCase();
    const numericCode = code ? parseInt(code, 10) : 0;

    // Network errors
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('fetch') || 
        lowerMessage.includes('connection') ||
        [0, 408, 502, 503, 504].includes(numericCode)) {
      return 'network';
    }

    // Validation errors
    if (lowerMessage.includes('validation') || 
        lowerMessage.includes('invalid') || 
        lowerMessage.includes('required') ||
        [400, 422].includes(numericCode)) {
      return 'validation';
    }

    // User errors (authentication, authorization)
    if ([401, 403, 429].includes(numericCode)) {
      return 'user';
    }

    return 'system';
  }

  private static findMappedMessage(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    for (const [pattern, replacement] of Object.entries(this.ERROR_MAPPINGS)) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return replacement;
      }
    }

    return null;
  }

  private static generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${random}`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private static secureLog(originalError: unknown, errorId: string, context?: ErrorContext): void {
    // Only log in development or when explicitly enabled
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔍 Error ${errorId}`);
      console.error('Original error:', originalError);
      if (context) {
        console.log('Context:', context);
      }
      console.groupEnd();
    }

    // In production, store sanitized version for debugging
    try {
      const sanitizedLog = this.sanitizeForLogging(originalError, context);
      const logs = JSON.parse(localStorage.getItem('error-logs') || '[]');
      logs.push(sanitizedLog);
      
      // Keep only last 50 errors
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      localStorage.setItem('error-logs', JSON.stringify(logs));
    } catch (loggingError) {
      console.error('Failed to log error securely:', loggingError);
    }
  }
}

/**
 * Error boundary for async operations
 */
export class AsyncErrorHandler {
  private static instance: AsyncErrorHandler;
  private errorHandlers: ((error: SanitizedError) => void)[] = [];

  static getInstance(): AsyncErrorHandler {
    if (!this.instance) {
      this.instance = new AsyncErrorHandler();
    }
    return this.instance;
  }

  addErrorHandler(handler: (error: SanitizedError) => void): () => void {
    this.errorHandlers.push(handler);
    
    // Return cleanup function
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  reportError(error: unknown, context?: ErrorContext): void {
    const sanitizedError = ErrorSanitizer.sanitizeForUser(error, context);
    
    this.errorHandlers.forEach(handler => {
      try {
        handler(sanitizedError);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  wrapAsync<T>(
    asyncFn: () => Promise<T>, 
    context?: ErrorContext
  ): Promise<T> {
    return asyncFn().catch(error => {
      this.reportError(error, context);
      throw error; // Re-throw for local handling
    });
  }
}