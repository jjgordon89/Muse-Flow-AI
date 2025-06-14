/**
 * Comprehensive logging and monitoring service
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  component?: string;
  action?: string;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    memoryUsage?: number;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  maxStorageEntries: number;
  remoteEndpoint?: string;
  sessionId?: string;
  userId?: string;
  component?: string;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private remoteQueue: LogEntry[] = [];

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: process.env.NODE_ENV === 'development',
      enableStorage: true,
      enableRemote: false,
      maxStorageEntries: 1000,
      ...config,
    };

    this.sessionId = config.sessionId || this.generateSessionId();
    this.setupRemoteLogging();
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  setComponent(component: string): void {
    this.config.component = component;
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('fatal', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  performance(message: string, duration: number, metadata?: Record<string, any>): void {
    this.log('info', message, {
      ...metadata,
      performance: {
        duration,
        memoryUsage: this.getMemoryUsage(),
      },
    });
  }

  startTimer(label: string): () => void {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    return () => {
      const duration = performance.now() - startTime;
      const memoryDelta = this.getMemoryUsage() - startMemory;

      this.performance(`Timer: ${label}`, duration, {
        memoryDelta,
        label,
      });
    };
  }

  logUserAction(action: string, metadata?: Record<string, any>): void {
    this.info(`User action: ${action}`, {
      ...metadata,
      type: 'user-action',
      action,
    });
  }

  logApiCall(
    method: string,
    url: string,
    status: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = status >= 400 ? 'error' : 'info';
    this.log(level, `API ${method} ${url} - ${status}`, {
      ...metadata,
      type: 'api-call',
      method,
      url,
      status,
      performance: { duration },
    });
  }

  flush(): Promise<void> {
    return this.sendRemoteLogs();
  }

  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let logs = [...this.logBuffer];

    if (level) {
      const minPriority = this.levelPriority[level];
      logs = logs.filter(log => this.levelPriority[log.level] >= minPriority);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  exportLogs(): string {
    return JSON.stringify(this.getLogs(), null, 2);
  }

  clearLogs(): void {
    this.logBuffer = [];
    this.remoteQueue = [];
    
    if (this.config.enableStorage) {
      localStorage.removeItem('app-logs');
    }
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (this.levelPriority[level] < this.levelPriority[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      component: metadata?.component || this.config.component,
      action: metadata?.action,
      userId: this.config.userId,
      sessionId: this.sessionId,
      metadata: metadata ? { ...metadata } : undefined,
      error: metadata?.error,
      performance: metadata?.performance,
    };

    // Remove internal fields from metadata
    if (entry.metadata) {
      delete entry.metadata.component;
      delete entry.metadata.action;
      delete entry.metadata.error;
      delete entry.metadata.performance;
      
      if (Object.keys(entry.metadata).length === 0) {
        entry.metadata = undefined;
      }
    }

    this.logBuffer.push(entry);
    this.enforceStorageLimit();

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.config.enableStorage) {
      this.logToStorage(entry);
    }

    if (this.config.enableRemote) {
      this.queueForRemote(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] ${entry.level.toUpperCase()}`;
    const component = entry.component ? ` [${entry.component}]` : '';
    const action = entry.action ? ` (${entry.action})` : '';
    
    const message = `${prefix}${component}${action}: ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.metadata || '');
        break;
      case 'info':
        console.info(message, entry.metadata || '');
        break;
      case 'warn':
        console.warn(message, entry.metadata || '');
        break;
      case 'error':
      case 'fatal':
        console.error(message, entry.error || entry.metadata || '');
        break;
    }
  }

  private logToStorage(entry: LogEntry): void {
    try {
      const stored = localStorage.getItem('app-logs');
      const logs: LogEntry[] = stored ? JSON.parse(stored) : [];
      
      logs.push(entry);
      
      // Keep only recent logs
      if (logs.length > this.config.maxStorageEntries) {
        logs.splice(0, logs.length - this.config.maxStorageEntries);
      }
      
      localStorage.setItem('app-logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to store log entry:', error);
    }
  }

  private queueForRemote(entry: LogEntry): void {
    this.remoteQueue.push(entry);
    
    // Send logs in batches
    if (this.remoteQueue.length >= 10) {
      this.sendRemoteLogs();
    }
  }

  private async sendRemoteLogs(): Promise<void> {
    if (!this.config.remoteEndpoint || this.remoteQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.remoteQueue];
    this.remoteQueue = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      // Re-queue logs if sending fails
      this.remoteQueue.unshift(...logsToSend);
      console.error('Failed to send remote logs:', error);
    }
  }

  private setupRemoteLogging(): void {
    if (!this.config.enableRemote) return;

    // Send logs on page unload
    window.addEventListener('beforeunload', () => {
      this.sendRemoteLogs();
    });

    // Send logs periodically
    setInterval(() => {
      this.sendRemoteLogs();
    }, 30000); // Every 30 seconds
  }

  private enforceStorageLimit(): void {
    if (this.logBuffer.length > this.config.maxStorageEntries) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxStorageEntries);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }
}

// Global logger instance
export const logger = Logger.getInstance({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableConsole: true,
  enableStorage: true,
  enableRemote: false, // Enable in production with proper endpoint
});