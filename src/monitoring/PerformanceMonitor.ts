import { IMonitoringService, AnalyticsEvent, PerformanceMetric, ErrorEvent, HealthStatus, TimeRange, Analytics, PerformanceReport, Report, ReportType, ReportOptions } from '../architecture/interfaces/IServices';

interface MetricCollector {
  name: string;
  collect(): Promise<number>;
  unit: string;
  tags?: Record<string, string>;
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration: number; // in seconds
  enabled: boolean;
  actions: AlertAction[];
}

interface AlertAction {
  type: 'email' | 'webhook' | 'log';
  config: Record<string, any>;
}

interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: number;
  triggered: Date;
  resolved?: Date;
  status: 'active' | 'resolved';
}

export class PerformanceMonitor implements IMonitoringService {
  readonly name = 'PerformanceMonitor';
  
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private events: AnalyticsEvent[] = [];
  private errors: ErrorEvent[] = [];
  private collectors: MetricCollector[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private isCollecting = false;
  private collectionInterval?: NodeJS.Timeout | undefined;

  constructor() {
    this.setupDefaultCollectors();
    this.setupDefaultAlertRules();
  }

  async initialize(): Promise<void> {
    console.log('Initializing Performance Monitor...');
    this.startCollection();
  }

  async destroy(): Promise<void> {
    this.stopCollection();
    this.clearData();
  }

  async isHealthy(): Promise<boolean> {
    return this.isCollecting;
  }

  // Event Tracking
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    this.events.push({
      ...event,
      timestamp: event.timestamp || new Date()
    });

    // Limit memory usage by keeping only recent events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }

    // Track specific performance-related events
    if (event.type === 'page_load' && event.properties['loadTime']) {
      await this.trackPerformance({
        name: 'page_load_time',
        value: event.properties['loadTime'],
        unit: 'ms',
        timestamp: event.timestamp
      });
    }
  }

  // Performance Metrics
  async trackPerformance(metric: PerformanceMetric): Promise<void> {
    const metricArray = this.metrics.get(metric.name) || [];
    metricArray.push({
      ...metric,
      timestamp: metric.timestamp || new Date()
    });
    
    this.metrics.set(metric.name, metricArray);

    // Limit memory usage
    if (metricArray.length > 1000) {
      this.metrics.set(metric.name, metricArray.slice(-500));
    }

    // Check alert rules
    await this.checkAlertRules(metric);
  }

  // Error Tracking
  async trackError(error: ErrorEvent): Promise<void> {
    this.errors.push({
      ...error,
      timestamp: error.timestamp || new Date()
    });

    // Limit memory usage
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-500);
    }

    // Track error rate metric
    await this.trackPerformance({
      name: 'error_rate',
      value: 1,
      unit: 'count',
      timestamp: error.timestamp || new Date(),
      tags: { severity: error.severity }
    });

    console.error('Performance Monitor - Error tracked:', {
      message: error.message,
      severity: error.severity,
      timestamp: error.timestamp
    });
  }

  // Analytics
  async getAnalytics(projectId: string, timeRange: TimeRange): Promise<Analytics> {
    const filteredEvents = this.events.filter(event => 
      event.projectId === projectId &&
      event.timestamp >= timeRange.start &&
      event.timestamp <= timeRange.end
    );

    const eventCounts = filteredEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const uniqueUsers = new Set(
      filteredEvents
        .filter(event => event.userId)
        .map(event => event.userId!)
    ).size;

    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));

    // User activity by day
    const userActivity = this.calculateUserActivity(filteredEvents);

    // Feature usage
    const featureUsage = filteredEvents
      .filter(event => event.properties?.['feature'])
      .reduce((acc, event) => {
        const feature = event.properties['feature'];
        acc[feature] = (acc[feature] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalEvents: filteredEvents.length,
      uniqueUsers,
      topEvents,
      userActivity,
      featureUsage
    };
  }

  // Performance Reports
  async getPerformanceMetrics(timeRange: TimeRange): Promise<PerformanceReport> {
    const filteredMetrics = this.getMetricsInRange(timeRange);

    const loadTimes = filteredMetrics.get('page_load_time') || [];
    const apiTimes = filteredMetrics.get('api_response_time') || [];
    const errors = this.errors.filter(error => 
      error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
    );

    const totalRequests = apiTimes.length;
    const errorCount = errors.length;

    return {
      averageLoadTime: this.calculateAverage(loadTimes.map(m => m.value)),
      averageApiResponseTime: this.calculateAverage(apiTimes.map(m => m.value)),
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
      memoryUsage: await this.getCurrentMemoryUsage(),
      cpuUsage: await this.getCurrentCpuUsage(),
      throughput: this.calculateThroughput(apiTimes, timeRange)
    };
  }

  // Health Status
  async getHealthStatus(): Promise<HealthStatus> {
    const now = new Date();
    const recentTimeRange = {
      start: new Date(now.getTime() - 5 * 60 * 1000), // Last 5 minutes
      end: now
    };

    const recentErrors = this.errors.filter(error => 
      error.timestamp >= recentTimeRange.start
    );

    const criticalErrors = recentErrors.filter(error => 
      error.severity === 'critical'
    ).length;

    const errorRate = recentErrors.length / 5; // errors per minute

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (criticalErrors > 0 || errorRate > 10) {
      status = 'unhealthy';
    } else if (errorRate > 2) {
      status = 'degraded';
    }

    const services = {
      'database': await this.checkDatabaseHealth(),
      'ai_service': await this.checkAIServiceHealth(),
      'file_system': await this.checkFileSystemHealth()
    };

    return {
      status,
      services,
      lastCheck: now
    };
  }

  // Report Generation
  async generateReport(type: ReportType, options: ReportOptions): Promise<Report> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let data: any;

    switch (type) {
      case 'analytics':
        data = await this.generateAnalyticsReport(options);
        break;
      case 'performance':
        data = await this.generatePerformanceReport(options);
        break;
      case 'usage':
        data = await this.generateUsageReport(options);
        break;
      case 'errors':
        data = await this.generateErrorReport(options);
        break;
      default:
        throw new Error(`Unsupported report type: ${type}`);
    }

    return {
      id: reportId,
      type,
      generatedAt: new Date(),
      data,
      format: options.format || 'json'
    };
  }

  // Metric Collection
  private setupDefaultCollectors(): void {
    // Memory usage collector
    this.collectors.push({
      name: 'memory_usage',
      unit: 'MB',
      collect: async () => {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
          return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
        }
        return 0;
      }
    });

    // DOM node count collector
    this.collectors.push({
      name: 'dom_nodes',
      unit: 'count',
      collect: async () => {
        return document.querySelectorAll('*').length;
      }
    });

    // Performance timing collector
    this.collectors.push({
      name: 'performance_navigation',
      unit: 'ms',
      collect: async () => {
        if (typeof performance !== 'undefined' && performance.timing) {
          const timing = performance.timing;
          return timing.loadEventEnd - timing.navigationStart;
        }
        return 0;
      }
    });
  }

  private setupDefaultAlertRules(): void {
    // High error rate alert
    this.alertRules.set('high_error_rate', {
      id: 'high_error_rate',
      name: 'High Error Rate',
      metric: 'error_rate',
      condition: 'greater_than',
      threshold: 5, // 5 errors per minute
      duration: 60, // 1 minute
      enabled: true,
      actions: [
        {
          type: 'log',
          config: { level: 'error' }
        }
      ]
    });

    // High memory usage alert
    this.alertRules.set('high_memory_usage', {
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      metric: 'memory_usage',
      condition: 'greater_than',
      threshold: 500, // 500MB
      duration: 120, // 2 minutes
      enabled: true,
      actions: [
        {
          type: 'log',
          config: { level: 'warning' }
        }
      ]
    });
  }

  private startCollection(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 30000); // Collect every 30 seconds

    console.log('Performance monitoring started');
  }

  private stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
    this.isCollecting = false;
    console.log('Performance monitoring stopped');
  }

  private async collectMetrics(): Promise<void> {
    for (const collector of this.collectors) {
      try {
        const value = await collector.collect();
        await this.trackPerformance({
          name: collector.name,
          value,
          unit: collector.unit,
          timestamp: new Date(),
          ...(collector.tags && { tags: collector.tags })
        });
      } catch (error) {
        console.error(`Failed to collect metric ${collector.name}:`, error);
      }
    }
  }

  private async checkAlertRules(metric: PerformanceMetric): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== metric.name) continue;

      const shouldAlert = this.evaluateAlertCondition(rule, metric.value);
      const existingAlert = this.activeAlerts.get(rule.id);

      if (shouldAlert && !existingAlert) {
        // Trigger new alert
        const alert: Alert = {
          id: `alert_${Date.now()}`,
          ruleId: rule.id,
          metric: rule.metric,
          value: metric.value,
          threshold: rule.threshold,
          triggered: new Date(),
          status: 'active'
        };

        this.activeAlerts.set(rule.id, alert);
        await this.executeAlertActions(rule, alert);

      } else if (!shouldAlert && existingAlert) {
        // Resolve existing alert
        existingAlert.resolved = new Date();
        existingAlert.status = 'resolved';
        this.activeAlerts.delete(rule.id);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return value > rule.threshold;
      case 'less_than':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private async executeAlertActions(rule: AlertRule, alert: Alert): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'log':
            console.warn(`ALERT: ${rule.name} - ${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`);
            break;
          case 'webhook':
            // Would implement webhook notification
            break;
          case 'email':
            // Would implement email notification
            break;
        }
      } catch (error) {
        console.error(`Failed to execute alert action ${action.type}:`, error);
      }
    }
  }

  private calculateUserActivity(events: AnalyticsEvent[]): Array<{ date: string; activeUsers: number }> {
    const dailyUsers = new Map<string, Set<string>>();
    
    events.forEach(event => {
      if (!event.userId) return;
      
      const date = event.timestamp.toISOString().split('T')[0];
      if (date) {
        if (!dailyUsers.has(date)) {
          dailyUsers.set(date, new Set());
        }
        dailyUsers.get(date)!.add(event.userId);
      }
    });

    return Array.from(dailyUsers.entries()).map(([date, users]) => ({
      date,
      activeUsers: users.size
    }));
  }

  private getMetricsInRange(timeRange: TimeRange): Map<string, PerformanceMetric[]> {
    const filtered = new Map<string, PerformanceMetric[]>();
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(metric =>
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
      filtered.set(name, filteredMetrics);
    }
    
    return filtered;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateThroughput(metrics: PerformanceMetric[], timeRange: TimeRange): number {
    const durationMinutes = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60);
    return durationMinutes > 0 ? metrics.length / durationMinutes : 0;
  }

  private async getCurrentMemoryUsage(): Promise<number> {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  private async getCurrentCpuUsage(): Promise<number> {
    // Browser doesn't provide CPU usage directly
    // This would need to be estimated or provided by server
    return 0;
  }

  private async checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number; errorRate?: number; lastError?: string }> {
    // Would implement actual database health check
    return { status: 'healthy', responseTime: 50, errorRate: 0 };
  }

  private async checkAIServiceHealth(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number; errorRate?: number; lastError?: string }> {
    // Would implement actual AI service health check
    return { status: 'healthy', responseTime: 150, errorRate: 0.1 };
  }

  private async checkFileSystemHealth(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number; errorRate?: number; lastError?: string }> {
    // Would implement actual file system health check
    return { status: 'healthy', responseTime: 10, errorRate: 0 };
  }

  private async generateAnalyticsReport(options: ReportOptions): Promise<any> {
    // Implementation would generate comprehensive analytics report
    return {
      summary: "Analytics report data would be generated here",
      timeRange: options.timeRange,
      filters: options.filters
    };
  }

  private async generatePerformanceReport(options: ReportOptions): Promise<any> {
    const metrics = await this.getPerformanceMetrics(options.timeRange);
    return {
      summary: metrics,
      details: "Detailed performance data would be included here",
      recommendations: []
    };
  }

  private async generateUsageReport(options: ReportOptions): Promise<any> {
    return {
      summary: "Usage report data would be generated here",
      timeRange: options.timeRange
    };
  }

  private async generateErrorReport(options: ReportOptions): Promise<any> {
    const errors = this.errors.filter(error =>
      error.timestamp >= options.timeRange.start &&
      error.timestamp <= options.timeRange.end
    );

    return {
      totalErrors: errors.length,
      errorsBySeverity: errors.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      topErrors: errors.slice(0, 10),
      timeRange: options.timeRange
    };
  }

  private clearData(): void {
    this.metrics.clear();
    this.events = [];
    this.errors = [];
    this.activeAlerts.clear();
  }

  // Public API for manual metric tracking
  public trackCustomMetric(name: string, value: number, unit: string, tags?: Record<string, string>): Promise<void> {
    return this.trackPerformance({
      name,
      value,
      unit,
      timestamp: new Date(),
      ...(tags && { tags })
    });
  }

  public addCustomCollector(collector: MetricCollector): void {
    this.collectors.push(collector);
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getMetricHistory(metricName: string, timeRange: TimeRange): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.filter(metric =>
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }
}