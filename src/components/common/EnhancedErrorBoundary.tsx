import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Download } from 'lucide-react';
import { ErrorSanitizer, AsyncErrorHandler } from '../../utils/errorSanitization';

interface EnhancedErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  sanitizedError: any | null;
  showDetails: boolean;
  retryCount: number;
}

interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'app' | 'component' | 'panel';
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  maxRetries?: number;
  component?: string;
  enableErrorReporting?: boolean;
}

export class EnhancedErrorBoundary extends Component<EnhancedErrorBoundaryProps, EnhancedErrorBoundaryState> {
  private resetTimeoutId: number | null = null;
  private asyncErrorHandler: AsyncErrorHandler;

  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      sanitizedError: null,
      showDetails: false,
      retryCount: 0
    };
    
    this.asyncErrorHandler = AsyncErrorHandler.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { component, enableErrorReporting = true } = this.props;
    
    // Sanitize error for safe handling
    const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
      component: component || 'ErrorBoundary',
      action: 'component-error',
      metadata: {
        componentStack: errorInfo.componentStack,
        level: this.props.level
      }
    });

    this.setState({
      error,
      errorInfo,
      sanitizedError
    });

    // Log error details securely
    console.error('ErrorBoundary caught an error:', {
      errorId: this.state.errorId,
      component,
      level: this.props.level,
      sanitizedMessage: sanitizedError.message
    });

    // Report to global error handler
    if (enableErrorReporting) {
      this.asyncErrorHandler.reportError(error, {
        component: component || 'ErrorBoundary',
        action: 'boundary-catch',
        metadata: {
          level: this.props.level,
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount
        }
      });
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: EnhancedErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys, maxRetries = 3 } = this.props;
    const { hasError, retryCount } = this.state;

    const hasResetKeys = resetKeys && resetKeys.length > 0;
    const prevResetKeys = prevProps.resetKeys || [];
    
    if (hasError && resetOnPropsChange && hasResetKeys && retryCount < maxRetries) {
      const resetKeyChanged = resetKeys.some((key, idx) => key !== prevResetKeys[idx]);
      if (resetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return; // Don't reset if max retries exceeded
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      sanitizedError: null,
      showDetails: false,
      retryCount: retryCount + 1
    });
  };

  handleRetry = () => {
    this.resetErrorBoundary();
  };

  handleAutoRetry = () => {
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, 2000);
  };

  handleCopyError = async () => {
    const { sanitizedError, errorId } = this.state;
    
    if (sanitizedError) {
      const errorReport = {
        id: errorId,
        message: sanitizedError.message,
        timestamp: new Date().toISOString(),
        component: this.props.component,
        level: this.props.level
      };
      
      try {
        await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
      } catch (err) {
        console.error('Failed to copy error to clipboard:', err);
      }
    }
  };

  handleDownloadLog = () => {
    try {
      const logs = localStorage.getItem('error-logs');
      if (logs) {
        const blob = new Blob([logs], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download error log:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      return this.renderErrorUI();
    }

    return this.props.children;
  }

  private renderErrorUI() {
    const { level = 'component', maxRetries = 3 } = this.props;
    const { sanitizedError, showDetails, retryCount } = this.state;
    const canRetry = retryCount < maxRetries;

    if (level === 'app') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              {sanitizedError?.message || 'The application encountered an unexpected error.'}
            </p>
            
            {retryCount > 0 && (
              <p className="text-sm text-orange-600 mb-4">
                Retry attempt {retryCount} of {maxRetries}
              </p>
            )}

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Page</span>
              </button>
              
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
              )}

              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                {showDetails ? 'Hide' : 'Show'} Error Details
              </button>
            </div>

            {showDetails && (
              <div className="mt-6 text-left">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Error Information</h4>
                  <p className="text-xs text-gray-600 mb-2">ID: {this.state.errorId}</p>
                  <p className="text-xs text-gray-600 mb-2">
                    Time: {new Date(sanitizedError?.timestamp || Date.now()).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">Type: {sanitizedError?.type || 'Unknown'}</p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={this.handleCopyError}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={this.handleDownloadLog}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Log</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (level === 'panel') {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-800">Panel Error</h3>
          </div>
          <p className="text-sm text-red-700 mb-3">
            {sanitizedError?.message || 'This panel encountered an error and couldn\'t render properly.'}
          </p>
          
          {retryCount > 0 && (
            <p className="text-xs text-orange-600 mb-2">
              Retry {retryCount}/{maxRetries}
            </p>
          )}

          {canRetry && (
            <button
              onClick={this.handleRetry}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      );
    }

    // Component level error
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">Component Error</span>
          {canRetry && (
            <button
              onClick={this.handleRetry}
              className="ml-auto text-xs text-yellow-700 hover:text-yellow-900 underline"
            >
              Retry ({retryCount}/{maxRetries})
            </button>
          )}
        </div>
        {sanitizedError?.message && (
          <p className="text-xs text-yellow-700 mt-1">{sanitizedError.message}</p>
        )}
      </div>
    );
  }
}

// Higher-order component for easy wrapping with enhanced features
export function withEnhancedErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<EnhancedErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary 
      {...errorBoundaryProps}
      component={errorBoundaryProps?.component || Component.displayName || Component.name}
    >
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withEnhancedErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual error reporting with enhanced features
export function useEnhancedErrorHandler(component?: string) {
  const asyncErrorHandler = React.useRef(AsyncErrorHandler.getInstance());

  const reportError = React.useCallback((error: unknown, context?: any) => {
    const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
      component,
      ...context
    });

    asyncErrorHandler.current.reportError(error, {
      component,
      ...context
    });

    // Return sanitized error for local handling
    return sanitizedError;
  }, [component]);

  const wrapAsync = React.useCallback(<T,>(
    asyncFn: () => Promise<T>,
    context?: any
  ): Promise<T> => {
    return asyncErrorHandler.current.wrapAsync(asyncFn, {
      component,
      ...context
    });
  }, [component]);

  return { reportError, wrapAsync };
}