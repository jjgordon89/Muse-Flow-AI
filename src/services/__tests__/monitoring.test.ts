import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringService } from '../monitoring';

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1024 * 1024 * 10, // 10MB
  },
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
})) as any;

Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', {
  value: ['navigation', 'paint', 'largest-contentful-paint'],
  writable: true,
});

describe('MonitoringService', () => {
  let monitoring: MonitoringService;

  beforeEach(() => {
    vi.clearAllMocks();
    monitoring = MonitoringService.getInstance();
    monitoring.clearData();
  });

  describe('metric recording', () => {
    it('should record performance metrics', () => {
      monitoring.recordMetric('test_metric', 100, 'ms', { context: 'test' });
      
      const metrics = monitoring.getMetrics('test_metric');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.name).toBe('test_metric');
      expect(metrics[0]?.value).toBe(100);
      expect(metrics[0]?.unit).toBe('ms');
    });

    it('should start and stop timers', () => {
      mockPerformance.now.mockReturnValueOnce(0).mockReturnValueOnce(100);
      
      const stopTimer = monitoring.startTimer('test_timer');
      stopTimer();
      
      const metrics = monitoring.getMetrics('test_timer');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.value).toBe(100);
    });

    it('should record memory usage', () => {
      monitoring.recordMemoryUsage();
      
      const metrics = monitoring.getMetrics('memory_usage');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.value).toBe(10); // 10MB in MB units
    });
  });

  describe('component monitoring', () => {
    it('should record component render metrics', () => {
      monitoring.recordComponentRender('TestComponent', 15, { prop1: 'value1' });
      
      const componentMetrics = monitoring.getComponentMetrics();
      expect(componentMetrics).toHaveLength(1);
      expect(componentMetrics[0]?.component).toBe('TestComponent');
      expect(componentMetrics[0]?.renderTime).toBe(15);
      expect(componentMetrics[0]?.updateCount).toBe(1);
    });

    it('should track multiple renders of same component', () => {
      monitoring.recordComponentRender('TestComponent', 15);
      monitoring.recordComponentRender('TestComponent', 20);
      
      const componentMetrics = monitoring.getComponentMetrics();
      expect(componentMetrics).toHaveLength(1);
      expect(componentMetrics[0]?.updateCount).toBe(2);
      expect(componentMetrics[0]?.renderTime).toBe(20); // Latest render time
    });

    it('should identify slow components', () => {
      monitoring.recordComponentRender('FastComponent', 10);
      monitoring.recordComponentRender('SlowComponent', 25);
      
      const slowComponents = monitoring.getSlowComponents(16);
      expect(slowComponents).toHaveLength(1);
      expect(slowComponents[0]?.component).toBe('SlowComponent');
    });
  });

  describe('interaction tracking', () => {
    it('should record user interactions', () => {
      monitoring.recordInteraction('click', 'button-save', { userId: 'user123' });
      
      const interactions = monitoring.getInteractions('click');
      expect(interactions).toHaveLength(1);
      expect(interactions[0]?.type).toBe('click');
      expect(interactions[0]?.target).toBe('button-save');
    });

    it('should filter interactions by type', () => {
      monitoring.recordInteraction('click', 'button1');
      monitoring.recordInteraction('scroll', 'page');
      monitoring.recordInteraction('click', 'button2');
      
      const clickInteractions = monitoring.getInteractions('click');
      expect(clickInteractions).toHaveLength(2);
      
      const scrollInteractions = monitoring.getInteractions('scroll');
      expect(scrollInteractions).toHaveLength(1);
    });
  });

  describe('error monitoring', () => {
    it('should record errors with context', () => {
      const error = new Error('Test error');
      monitoring.recordError(error, 'TestComponent', { userId: 'user123' });
      
      const interactions = monitoring.getInteractions('error');
      expect(interactions).toHaveLength(1);
      expect(interactions[0]?.target).toBe('TestComponent');
    });
  });

  describe('network monitoring', () => {
    it('should record network requests', () => {
      monitoring.recordNetworkRequest('/api/users', 'GET', 200, 150, 1024);
      
      const metrics = monitoring.getMetrics('network_request');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.value).toBe(150);
      expect(metrics[0]?.metadata?.url).toBe('/api/users');
      expect(metrics[0]?.metadata?.status).toBe(200);
    });
  });

  describe('reporting', () => {
    it('should generate comprehensive report', () => {
      monitoring.recordMetric('test_metric', 100, 'ms');
      monitoring.recordInteraction('click', 'button');
      monitoring.recordComponentRender('TestComponent', 20);
      monitoring.recordError(new Error('Test error'), 'TestComponent');
      
      const report = monitoring.generateReport();
      
      expect(report.summary.totalMetrics).toBe(1);
      expect(report.summary.totalInteractions).toBe(2); // click + error
      expect(report.summary.slowComponents).toBe(1);
      expect(report.summary.errorCount).toBe(1);
    });

    it('should export data as JSON', () => {
      monitoring.recordMetric('test_metric', 100, 'ms');
      
      const exported = monitoring.exportData();
      const data = JSON.parse(exported);
      
      expect(data.metrics).toHaveLength(1);
      expect(data.timestamp).toBeTruthy();
      expect(data.report).toBeTruthy();
    });
  });

  describe('service control', () => {
    it('should enable and disable monitoring', () => {
      monitoring.setEnabled(false);
      monitoring.recordMetric('test_metric', 100, 'ms');
      
      expect(monitoring.getMetrics()).toHaveLength(0);
      
      monitoring.setEnabled(true);
      monitoring.recordMetric('test_metric', 100, 'ms');
      
      expect(monitoring.getMetrics()).toHaveLength(1);
    });

    it('should clear all data', () => {
      monitoring.recordMetric('test_metric', 100, 'ms');
      monitoring.recordInteraction('click', 'button');
      monitoring.recordComponentRender('TestComponent', 15);
      
      monitoring.clearData();
      
      expect(monitoring.getMetrics()).toHaveLength(0);
      expect(monitoring.getInteractions()).toHaveLength(0);
      expect(monitoring.getComponentMetrics()).toHaveLength(0);
    });
  });
});