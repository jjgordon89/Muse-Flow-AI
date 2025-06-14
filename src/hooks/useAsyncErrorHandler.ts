import { useCallback, useEffect, useRef } from 'react';
import { AsyncErrorHandler, ErrorSanitizer } from '../utils/errorSanitization';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface UseAsyncErrorHandlerOptions {
  component?: string;
  onError?: (error: any) => void;
  showToast?: boolean;
}

export function useAsyncErrorHandler(options: UseAsyncErrorHandlerOptions = {}) {
  const { component, onError, showToast = true } = options;
  const errorHandlerRef = useRef<AsyncErrorHandler>();

  useEffect(() => {
    errorHandlerRef.current = AsyncErrorHandler.getInstance();
  }, []);

  const reportError = useCallback((error: unknown, context?: Partial<ErrorContext>) => {
    const fullContext: ErrorContext = {
      component,
      ...context
    };

    const sanitizedError = ErrorSanitizer.sanitizeForUser(error, fullContext);
    
    // Call custom error handler if provided
    if (onError) {
      try {
        onError(sanitizedError);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Show toast notification if enabled
    if (showToast) {
      // You could integrate with a toast library here
      console.error(`Error in ${component || 'component'}:`, sanitizedError.message);
    }

    // Report to global error handler
    errorHandlerRef.current?.reportError(error, fullContext);
  }, [component, onError, showToast]);

  const wrapAsync = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T> => {
    return asyncFn().catch(error => {
      reportError(error, context);
      throw error; // Re-throw for local handling if needed
    });
  }, [reportError]);

  const safeAsync = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    fallback?: T,
    context?: Partial<ErrorContext>
  ): Promise<T | undefined> => {
    return asyncFn().catch(error => {
      reportError(error, context);
      return fallback;
    });
  }, [reportError]);

  return {
    reportError,
    wrapAsync,
    safeAsync
  };
}