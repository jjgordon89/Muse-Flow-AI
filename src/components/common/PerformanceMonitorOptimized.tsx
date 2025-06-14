import React, { useEffect, useRef, useState } from 'react';
import { Activity, Clock, Cpu, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useMonitoring } from '../../hooks/useMonitoring';
import { monitoring } from '../../services/monitoring';

interface PerformanceMonitorProps {
  componentName: string;
  threshold?: number;
  enabled?: boolean;
  showDetails?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface PerformanceStats {
  renderTime: number;
  memoryUsage: number;
  renderCount: number;
  lastUpdate: number;
  trend: 'up' | 'down' | 'stable';
}

export function PerformanceMonitorOptimized({
  componentName,
  threshold = 16,
  enabled = process.env.NODE_ENV === 'development',
  showDetails = false,
  position = 'bottom-right'
}: PerformanceMonitorProps) {
  const [stats, setStats] = useState<PerformanceStats>({
    renderTime: 0,
    memoryUsage: 0,
    renderCount: 0,
    lastUpdate: Date.now(),
    trend: 'stable'
  });
  
  const [showWarning, setShowWarning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const previousRenderTime = useRef<number>(0);
  
  const { recordMetric, startTimer } = useMonitoring({ 
    component: componentName,
    trackRenders: true,
    performanceThreshold: threshold
  });

  useEffect(() => {
    if (!enabled) return;

    const timer = startTimer('render');
    const startMemory = getMemoryUsage();

    return () => {
      const renderTime = timer();
      const currentMemory = getMemoryUsage();
      const memoryDelta = currentMemory - startMemory;

      // Determine trend
      let trend: PerformanceStats['trend'] = 'stable';
      if (previousRenderTime.current > 0) {
        const change = renderTime - previousRenderTime.current;
        if (Math.abs(change) > 2) { // 2ms threshold for trend change
          trend = change > 0 ? 'up' : 'down';
        }
      }

      setStats(prev => ({
        renderTime,
        memoryUsage: currentMemory,
        renderCount: prev.renderCount + 1,
        lastUpdate: Date.now(),
        trend
      }));

      previousRenderTime.current = renderTime;

      // Show warning for slow renders
      if (renderTime > threshold) {
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
      }

      // Record metrics
      recordMetric('render_time', renderTime, 'ms');
      if (memoryDelta !== 0) {
        recordMetric('memory_delta', memoryDelta, 'bytes');
      }
    };
  });

  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  };

  const getPositionClasses = () => {
    const baseClasses = 'fixed z-50';
    switch (position) {
      case 'top-left':
        return `${baseClasses} top-4 left-4`;
      case 'top-right':
        return `${baseClasses} top-4 right-4`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`;
      case 'bottom-right':
      default:
        return `${baseClasses} bottom-4 right-4`;
    }
  };

  const getTrendIcon = () => {
    switch (stats.trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-green-500" />;
      default:
        return null;
    }
  };

  const getPerformanceColor = (renderTime: number) => {
    if (renderTime > threshold * 2) return 'text-red-600';
    if (renderTime > threshold) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!enabled) return null;

  return (
    <div className={getPositionClasses()}>
      {/* Warning indicator for slow renders */}
      {showWarning && (
        <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded-lg shadow-sm animate-pulse">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-800">
              Slow render: {stats.renderTime.toFixed(2)}ms
            </span>
          </div>
        </div>
      )}
      
      {/* Main performance monitor */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm min-w-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-2 flex items-center space-x-2 text-xs hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Activity className="w-3 h-3 text-indigo-600" />
          <span className="font-medium">{componentName}</span>
          <div className="flex items-center space-x-1">
            <span className={getPerformanceColor(stats.renderTime)}>
              {stats.renderTime.toFixed(1)}ms
            </span>
            {getTrendIcon()}
          </div>
        </button>
        
        {isExpanded && (
          <div className="border-t border-gray-200 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Render:</span>
                </span>
                <span className={getPerformanceColor(stats.renderTime)}>
                  {stats.renderTime.toFixed(2)}ms
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Cpu className="w-3 h-3" />
                  <span>Memory:</span>
                </span>
                <span>{stats.memoryUsage.toFixed(1)}MB</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span>Renders:</span>
              <span className="font-medium">{stats.renderCount}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span>Threshold:</span>
              <span className="font-medium">{threshold}ms</span>
            </div>

            {showDetails && (
              <>
                <div className="border-t border-gray-200 pt-2">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Last update: {new Date(stats.lastUpdate).toLocaleTimeString()}</div>
                    <div>Performance: {stats.renderTime <= threshold ? '✅ Good' : stats.renderTime <= threshold * 2 ? '⚠️ Slow' : '❌ Poor'}</div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-2">
                  <button
                    onClick={() => {
                      const report = monitoring.generateReport();
                      console.log('Performance Report:', report);
                    }}
                    className="w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    View Full Report
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Higher-order component for automatic performance monitoring
export function withPerformanceMonitor<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<PerformanceMonitorProps, 'componentName'> = {}
) {
  const WrappedComponent = React.memo((props: P) => {
    const name = Component.displayName || Component.name || 'Unknown';
    
    return (
      <>
        <PerformanceMonitorOptimized 
          componentName={name} 
          {...options}
        />
        <Component {...props} />
      </>
    );
  });

  WrappedComponent.displayName = `withPerformanceMonitor(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}