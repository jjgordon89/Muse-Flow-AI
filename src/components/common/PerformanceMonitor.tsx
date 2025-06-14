import React, { useEffect, useRef, useState } from 'react';
import { Activity, Clock, Cpu, AlertTriangle } from 'lucide-react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentRenders: number;
  lastUpdate: number;
}

interface PerformanceMonitorProps {
  componentName: string;
  threshold?: number;
  enabled?: boolean;
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
}

export function PerformanceMonitor({
  componentName,
  threshold = 16, // 16ms = 60fps
  enabled = process.env.NODE_ENV === 'development',
  onPerformanceIssue
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentRenders: 0,
    lastUpdate: Date.now()
  });
  
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    renderStartRef.current = performance.now();
    renderCountRef.current++;

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      const newMetrics: PerformanceMetrics = {
        renderTime,
        memoryUsage: memoryUsage / 1024 / 1024, // Convert to MB
        componentRenders: renderCountRef.current,
        lastUpdate: Date.now()
      };

      setMetrics(newMetrics);

      // Check for performance issues
      if (renderTime > threshold) {
        setShowWarning(true);
        onPerformanceIssue?.(newMetrics);
        
        console.warn(`Performance issue in ${componentName}:`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          threshold: `${threshold}ms`,
          renders: renderCountRef.current
        });

        setTimeout(() => setShowWarning(false), 5000);
      }
    };
  });

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {showWarning && (
        <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded-lg shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-800">
              Slow render in {componentName}
            </span>
          </div>
        </div>
      )}
      
      <details className="bg-white border border-gray-300 rounded-lg shadow-sm">
        <summary className="p-2 cursor-pointer flex items-center space-x-2 text-xs">
          <Activity className="w-3 h-3" />
          <span>Performance</span>
        </summary>
        
        <div className="p-3 border-t border-gray-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Render Time:</span>
            </span>
            <span className={metrics.renderTime > threshold ? 'text-red-600' : 'text-green-600'}>
              {metrics.renderTime.toFixed(2)}ms
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Cpu className="w-3 h-3" />
              <span>Memory:</span>
            </span>
            <span>{metrics.memoryUsage.toFixed(1)}MB</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Component:</span>
            <span className="font-medium">{componentName}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Renders:</span>
            <span>{metrics.componentRenders}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

// Higher-order component for automatic performance monitoring
export function withPerformanceMonitor<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = React.memo((props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    
    return (
      <>
        <PerformanceMonitor componentName={name} />
        <Component {...props} />
      </>
    );
  });

  WrappedComponent.displayName = `withPerformanceMonitor(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual performance tracking
export function usePerformanceTracking(componentName: string) {
  const startTimeRef = useRef<number>(0);
  
  const startTracking = () => {
    startTimeRef.current = performance.now();
  };
  
  const endTracking = () => {
    const duration = performance.now() - startTimeRef.current;
    console.log(`${componentName} operation took ${duration.toFixed(2)}ms`);
    return duration;
  };
  
  return { startTracking, endTracking };
}